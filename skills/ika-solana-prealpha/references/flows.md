# end-to-end flows (Solana pre-alpha)

## table of contents

1. Flow 1 - DKG (create dWallet)
2. Flow 2 - direct approve_message + gRPC Sign
3. Flow 3 - CPI approve_message
4. Flow 4 - presign allocation
5. Flow 5 - authority transfer
6. Flow 6 - signature verification (PDA `message_digest` vs signed digest)
7. Flow 7 - voting e2e
8. Flow 8 - multisig e2e
9. Flow 9 - zero-trust → shared conversion (`MakeUserSecretKeySharePublic`)

Normative documentation URL: [`../SKILL.md`](../SKILL.md). BCS and RPC: [`grpc-api.md`](grpc-api.md). Instruction bytes and metas: [`instructions.md`](instructions.md).

---

## flow 1 - DKG (create dWallet)

**Outcome:** dWallet public key material and on-chain **DWallet** PDA; initial **authority** per current mock (verify in `ika-pre-alpha`).

1. Read **NetworkEncryptionKey** (PDA `["network_encryption_key", noa_pubkey]`).
2. Run DKG client logic from `ika-pre-alpha` (language-specific) to produce shares and proofs.
3. Build `SignedRequestData` with `DWalletRequest::DKG` and `UserSecretKeyShare::Encrypted` or `Public` ([`grpc-api.md`](grpc-api.md)).
4. Wrap in `UserSignedRequest` with `UserSignature` over `signed_request_data`.
5. Call gRPC `SubmitTransaction`.
6. Parse `TransactionResponseData::Attestation(NetworkSignedAttestation)`; decode `attestation_data` as **`VersionedDWalletDataAttestation`** / **`DWalletDataAttestationV1`** for the bytes the program expects on **`commit_dwallet`**.
7. Submit **`commit_dwallet`** with that payload; derive **DWallet** PDA with chunked seeds `["dwallet", ...chunks]` where `chunks` splits `(curve_byte || public_key)` into 32-byte pieces ([`account-layouts.md`](account-layouts.md)):

```rust
let mut payload = Vec::with_capacity(2 + public_key.len());
payload.extend_from_slice(&curve_u16_le); // DWalletCurve as u16 LE
payload.extend_from_slice(&public_key);
let mut seeds: Vec<&[u8]> = vec![b"dwallet"];
for chunk in payload.chunks(32) {
    seeds.push(chunk);
}
let (dwallet_pda, _bump) = Pubkey::find_program_address(&seeds, &dwallet_program_id);
```

### After DKG: deriving the dWallet PDA client-side

The response envelope does not contain the dWallet public key or its PDA. The client must:

1. Take the raw attestation bytes (`NetworkSignedAttestation.attestation_data`).
2. Parse them as **`VersionedDWalletDataAttestation`** and read the **`V1.public_key`** field (32 bytes for Curve25519 / Ristretto, 33 compressed or 65 uncompressed for Secp256k1).
3. Build the DWallet PDA seed payload `(curve_u16_le || public_key)` and split into **32-byte chunks** (Solana `MAX_SEED_LEN`).
4. `findProgramAddress(["dwallet", ...chunks], dwallet_program_id)` = **dWallet address** (base58 PDA).
5. Store the **public key bytes** alongside the NSA bytes — `PresignForDWallet.dwallet_public_key` and every client-side `MessageApproval` seed derivation need it later. It is not recoverable from the PDA alone.

---

## flow 2 - direct approve_message + gRPC Sign (off-chain)

**Outcome:** `MessageApproval` filled; signature from gRPC and/or on-chain when the signing environment supports **`Sign`**.

1. Compute **`message_digest`** (**keccak256(message)**) and optional **`message_metadata_digest`** per [`../SKILL.md`](../SKILL.md) and [`instructions.md`](instructions.md) (`approve_message`).
2. Derive **MessageApproval** PDA: **`["dwallet", …chunks…, "message_approval", scheme_u16_le, message_digest, [message_metadata_digest if non-zero]]`** — full layout in [`account-layouts.md`](account-layouts.md) (not a legacy `["message_approval", dwallet, message_hash]` triple).
3. Submit **approve_message** (disc 8, direct signer metas): [`instructions.md`](instructions.md). The on-chain account records **`DWalletSignatureScheme`** (and related fields) for validators to read.
4. Record `transaction_signature` and `slot` from the confirmed Solana transaction.
5. Keep the **DKG (or import) response** as **`NetworkSignedAttestation`** — you need **`dwallet_attestation`** on `Sign` (proves dWallet state).
6. Allocate **presign** if required: [`grpc-api.md`](grpc-api.md) `Presign` / `PresignForDWallet`; parse **`Attestation`** → **`VersionedPresignDataAttestation`** and persist **`presign_session_identifier`** (and presign material).
7. Build `DWalletRequest::Sign` with **`approval_proof: ApprovalProof::Solana { transaction_signature, slot }`**, **`dwallet_attestation`**, **`presign_session_identifier`**, **`message`**, **`message_centralized_signature`**, and BCS **`message_metadata`** when the scheme requires it (e.g. **`EcdsaBlake2b256`**, **`SchnorrkelMerlin`**). Validators derive **`DWalletSignatureScheme`** from **on-chain `MessageApproval`**, not from extra fields on `Sign`.
8. Handle `TransactionResponseData::Signature` or **`::Error`**. **`Sign` / `ImportedKeySign`** are **supported** in pre-alpha mock when **`MessageApproval` exists on-chain**, **`ApprovalProof::Solana`** matches the approving tx, and the rest of the request validates — you still need **devnet / LiteSVM / e2e** (or **`protocols-e2e`**) where that chain state is real for your test. **HTTP 200** can still carry **`::Error`**; deserialize `response_data` ([`grpc-api.md`](grpc-api.md)).
9. Confirm completion via `MessageApproval` offsets ([`account-layouts.md`](account-layouts.md)) or **`SignatureCommitted`** ([`events.md`](events.md)).

gRPC may return a signature before or in parallel with on-chain `commit_signature`; clients should tolerate ordering variance.

---

## flow 3 - CPI approve_message (on-chain)

**Outcome:** program-controlled **authority**; **approve_message** via CPI.

1. Derive `cpi_authority = PDA(["__ika_cpi_authority"], your_program_id)`.
2. **`transfer_ownership`** (disc 24) to `cpi_authority` while still current authority.
3. Construct **`DWalletContext`** ([`frameworks.md`](frameworks.md)).
4. CPI **approve_message** with six-account layout ([`instructions.md`](instructions.md)).
5. Off-chain: gRPC `Sign` with `ApprovalProof::Solana` for that CPI transaction (same **`Sign`** shape and **on-chain `MessageApproval` / proof** requirements as flow 2).
6. Observe completion as in flow 2 step 9.

**Testing:** Mollusk does not exercise cross-program CPI to the dWallet program; use LiteSVM or devnet e2e for CPI coverage.

---

## flow 4 - presign allocation

1. Submit `Presign` or `PresignForDWallet` with `signature_algorithm` per [`grpc-api.md`](grpc-api.md).
2. Response is **`TransactionResponseData::Attestation`**, not a separate `Presign` variant. Decode **`attestation_data`** as **`VersionedPresignDataAttestation`** → **`PresignDataAttestationV1`**.
3. Persist **`presign_session_identifier`**, presign material, and (for queries) correlation with `GetPresigns` / `GetPresignsForDWallet` as needed.

---

## flow 5 - authority transfer

- **User → program:** `transfer_ownership` signer path; `new_authority` = CPI PDA bytes.
- **On-chain handoff:** CPI `transfer_ownership` when logic allows.

**AuthorityTransferred** payload: [`events.md`](events.md).

---

## flow 6 - signature verification (off-chain)

Verify using the **same construction the network used** for the completed signature — keyed off **`DWalletSignatureScheme`** read from **on-chain `MessageApproval`** (and your `message` / `message_metadata`), not the PDA seed **`message_digest`** alone (that digest remains **`keccak256(message)`** as an on-chain uniqueness key).

**`EddsaSha512` (Curve25519 / Ed25519)**

Verification uses the **message preimage** from the `Sign` request (RFC 8032; `ed25519-dalek` hashes internally):

```rust
use ed25519_dalek::{Signature, VerifyingKey};

let verifying_key = VerifyingKey::from_bytes(&dwallet_public_key)?;
let signature = Signature::from_bytes(&signature_bytes.try_into().unwrap())?;
verifying_key.verify_strict(&message_preimage, &signature)?;
```

**ECDSA / Taproot / BLAKE2b / Schnorrkel schemes on `DWalletSignatureScheme`**

Build the **digest or input** that matches the variant (**`EcdsaKeccak256`**, **`EcdsaSha256`**, **`EcdsaDoubleSha256`**, **`TaprootSha256`**, **`EcdsaBlake2b256`** with **`Blake2bMessageMetadata`**, **`SchnorrkelMerlin`** with **`SchnorrkelMessageMetadata`**) — mirror upstream crypto docs and the same bytes the validator used. Then verify per algorithm — **do not** assume PDA **`message_digest`** equals the signed digest unless your app defined it that way.

```rust
use secp256k1::{Message, PublicKey, Secp256k1, ecdsa::Signature};

let digest: [u8; 32] = /* scheme + metadata(message) matching MessageApproval + Sign */;
let secp = Secp256k1::verification_only();
let pubkey = PublicKey::from_slice(&dwallet_public_key)?;
let message = Message::from_digest(digest);
let signature = Signature::from_compact(&signature_bytes)?;
secp.verify_ecdsa(&message, &signature, &pubkey)?;
```

---

## flow 7 - voting e2e

1. DKG + **commit_dwallet**
2. **transfer_ownership** to voting program CPI PDA
3. **create_proposal**
4. **cast_vote** until quorum; final vote supplies CPI accounts for **approve_message**
5. **MessageApproval** pending
6. **commit_signature**
7. Read signature: **`status`** at offset **172**; **`signature_len`** LE **u16** at **173–174**; bytes at **175** for `signature_len` (see [`account-layouts.md`](account-layouts.md))

**Which folder to open:** per-framework paths under `voting/` vs `multisig/` — [`examples.md`](examples.md) (voting has no `react`; multisig includes `react`).

---

## flow 8 - multisig e2e

1. DKG  
2. **transfer_ownership** to multisig program CPI PDA  
3. **CreateMultisig**  
4. **CreateTransaction**  
5. **Approve** until threshold  
6. **MessageApproval** + gRPC presign + gRPC sign  
7. Optional: **Reject** until `rejection_threshold = member_count - threshold + 1` (see multisig docs in book)

**Which folder to open:** `multisig/<framework>/` — see [`examples.md`](examples.md) for `anchor` / `quasar` / `e2e` / etc.

---

## flow 9 - zero-trust → shared conversion (`MakeUserSecretKeySharePublic`)

**Outcome:** an existing **zero-trust** dWallet ([`dwallet-types.md`](dwallet-types.md)) becomes **shared** — the centralized user share is published on-chain so the network can sign without the user holding any secret material. After conversion, the dWallet has no live `EncryptedUserSecretKeyShare` PDA and signing requests no longer require the user-share encryption key ([`user-share-encryption-keys.md`](user-share-encryption-keys.md)).

**When to use:** handing off a user-controlled dWallet to a smart contract or DAO treasury that needs to sign autonomously; converting a prototype dWallet to a "born-shared" equivalent without re-running DKG. **One-way:** there is no "make share private again" path — once published, the share is public.

1. Have the dWallet's existing **`NetworkSignedAttestation`** ready (the BCS bytes you persisted at flow 1 step 7 — see [`grpc-api.md`](grpc-api.md) **Client persistence contract**). You also need the dWallet's **public key bytes** (persisted alongside the NSA) and the **public form** of the user secret key share you want to publish.
2. Build `SignedRequestData` with **`DWalletRequest::MakeSharePublic`** ([`grpc-api.md`](grpc-api.md)):

   ```rust
   DWalletRequest::MakeSharePublic {
       dwallet_public_key: Vec<u8>,            // from your stored DKG record
       dwallet_attestation: NetworkSignedAttestation,  // full BCS NSA from DKG
       public_user_secret_key_share: Vec<u8>,  // the share, in publishable form
   }
   ```

   In **pre-alpha mock**, `public_user_secret_key_share` may be a 32-byte placeholder — `chains/solana/examples/protocols-e2e` passes `vec![0u8; 32]` for both `dwallet_public_key` and `public_user_secret_key_share`. Real (non-mock) callers must pass the actual published share bytes.

3. Wrap in `UserSignedRequest` and call gRPC `SubmitTransaction`.
4. Parse `TransactionResponseData::Attestation(NetworkSignedAttestation)`; decode `attestation_data` as **`VersionedPublicUserKeyShareAttestation`** → **`PublicUserKeyShareAttestationV1`** ([`grpc-api.md`](grpc-api.md) attestation table). The struct carries `session_identifier`, `intended_chain_sender`, `dwallet_public_key`, `public_user_secret_key_share`.
5. Submit on-chain **`MakeUserSecretKeySharePublic`** (disc **22**, [`instructions.md`](instructions.md)) carrying the new attestation payload.
6. Submit on-chain **`VerifyMakePublic`** (disc **23**) to commit the public-share state.
7. Confirm by checking that the **`EncryptedUserSecretKeyShare`** PDA (disc **11**, see [`account-layouts.md`](account-layouts.md)) for this dWallet is **gone or marked retired**. The `DWallet` account itself does not gain an `is_shared` flag — sharedness is determined by the absence of an active encrypted-share PDA plus the existence of the `MakeSharePublic` attestation. See [`dwallet-types.md`](dwallet-types.md) for the detection logic.

**Born-shared alternative:** if you don't have an existing zero-trust dWallet to convert, skip this flow and run flow 1 with **`UserSecretKeyShare::Public { public_user_secret_key_share }`** in the `DWalletRequest::DKG` body instead of `Encrypted { ... }`. The `protocols-e2e` "DKG with Public share mode" step exercises this path.

**Imported-key variant:** the same conversion applies if the dWallet was created via `DWalletRequest::ImportedKeyVerification` with `UserSecretKeyShare::Encrypted` — `MakeSharePublic` works on both. Validators do not need a separate `ImportedKeyMakeSharePublic` request type; the dWallet's `is_imported` flag at offset 143 is independent of its sharedness.

