# gRPC API (pre-alpha)

## table of contents

1. Service definition
2. `UserSignedRequest`, `UserSignature`, `SignedRequestData`
3. `NetworkSignedAttestation` and versioned `attestation_data`
4. `DWalletRequest` (BCS enum), mock support matrix
5. `Sign` / `ImportedKeySign` fields (scheme from on-chain `MessageApproval`)
6. `ApprovalProof`
7. `TransactionResponse`, `TransactionResponseData`
8. Query RPCs (`GetPresigns`, `GetPresignsForDWallet`)
9. `DWalletSignatureScheme`, `message_metadata`, internal `DWalletHashScheme`
10. BCS notes, minimal Rust client

Mutations use **`SubmitTransaction`**. Protobuf carries **BCS** payloads in `bytes` fields.

**Normative:** upstream mdbook [`docs/src/grpc/`](https://github.com/dwallet-labs/ika-pre-alpha/tree/main/docs/src/grpc) and Rust types [`crates/ika-dwallet-types/src/lib.rs`](https://github.com/dwallet-labs/ika-pre-alpha/blob/main/crates/ika-dwallet-types/src/lib.rs) at the commit in [`docs-revision.md`](docs-revision.md).

**Endpoints and Rust crate git remote:** [`../SKILL.md`](../SKILL.md) environment + install sections.

**TypeScript:** `@grpc/grpc-js`, Connect-RPC, or grpc-web; serialize with `@mysten/bcs` or another layout-compatible BCS implementation aligned with `ika-dwallet-types`.

---

## service definition

```protobuf
service DWalletService {
  rpc SubmitTransaction(UserSignedRequest) returns (TransactionResponse);
  rpc GetPresigns(GetPresignsRequest) returns (GetPresignsResponse);
  rpc GetPresignsForDWallet(GetPresignsForDWalletRequest) returns (GetPresignsResponse);
}
```

---

## UserSignedRequest

```protobuf
message UserSignedRequest {
  bytes user_signature = 1;      // BCS UserSignature
  bytes signed_request_data = 2; // BCS SignedRequestData
}
```

| field | description |
| --- | --- |
| `user_signature` | BCS `UserSignature` (scheme + signature + public key) |
| `signed_request_data` | BCS `SignedRequestData` (signed payload) |

Validators check that `user_signature` covers `signed_request_data`.

---

## UserSignature (BCS enum)

```rust
pub enum UserSignature {
    Ed25519 {
        signature: Vec<u8>,   // 64
        public_key: Vec<u8>,  // 32
    },
    Secp256k1 {
        signature: Vec<u8>,   // 64
        public_key: Vec<u8>,  // 33 compressed
    },
    Secp256r1 {
        signature: Vec<u8>,   // 64
        public_key: Vec<u8>,  // 33 compressed
    },
}
```

---

## SignedRequestData

```rust
pub struct SignedRequestData {
    pub session_identifier_preimage: [u8; 32],
    pub epoch: u64,
    pub chain_id: ChainId,
    pub intended_chain_sender: Vec<u8>,
    pub request: DWalletRequest,
}
```

| field | role |
| --- | --- |
| `session_identifier_preimage` | 32-byte nonce (replay control) |
| `epoch` | ika epoch |
| `chain_id` | `Solana` or `Sui` |
| `intended_chain_sender` | caller address on target chain (bytes) |
| `request` | operation payload |

---

## NetworkSignedAttestation

Returned inside **`TransactionResponseData::Attestation`** and also passed **into** requests that need proof of a prior network result (e.g. `DWalletRequest::Sign.dwallet_attestation`).

```rust
pub struct NetworkSignedAttestation {
    pub attestation_data: Vec<u8>,
    pub network_signature: Vec<u8>,
    pub network_pubkey: Vec<u8>,
    pub epoch: u64,
}
```

| field | role |
| --- | --- |
| `attestation_data` | BCS **versioned** per-type struct (see table below) |
| `network_signature` | NOA Ed25519 signature over `attestation_data` |
| `network_pubkey` | NOA public key |
| `epoch` | ika epoch |

### Which versioned type is in `attestation_data`

| originating request | decode as |
| --- | --- |
| `DKG`, `ImportedKeyVerification` | `VersionedDWalletDataAttestation` → `DWalletDataAttestationV1` |
| `Presign`, `PresignForDWallet` | `VersionedPresignDataAttestation` → `PresignDataAttestationV1` |
| `FutureSign` | `VersionedPartialUserSignatureAttestation` |
| `ReEncryptShare` | `VersionedEncryptedUserKeyShareAttestation` |
| `MakeSharePublic` | `VersionedPublicUserKeyShareAttestation` |

`PresignDataAttestationV1` includes `presign_session_identifier`, `presign_data`, `curve`, `signature_algorithm`, optional `dwallet_public_key` (global vs dWallet-bound), `user_pubkey`, etc. — see `ika-dwallet-types`.

---

## DWalletRequest (BCS enum)

Exact fields: **`ika-dwallet-types`** (and upstream book **Request types** chapter).

### Mock support (pre-alpha)

**Normative summary** (matches upstream **Mock Support** table in [`docs/src/grpc/request-types.md`](https://github.com/dwallet-labs/ika-pre-alpha/blob/main/docs/src/grpc/request-types.md) at [`docs-revision.md`](docs-revision.md)): pre-alpha uses a **single mock signer**, not distributed MPC — the book disclaimer stresses **no real MPC security** despite broad coverage. **All request variants below are implemented** and exercised end-to-end in upstream **`protocols-e2e`** / **`e2e-protocols`**.

**`Sign` / `ImportedKeySign`:** validators read **`signature_scheme`** from **on-chain `MessageApproval`** (and curve from **`dwallet_attestation`**). You still need a **confirmed** `approve_message` (or CPI equivalent), correct **`ApprovalProof::Solana`**, and RPC access to **Solana** state the validators use — local misconfig or bad inputs yield **`TransactionResponseData::Error`** like any other validation failure.

**HTTP vs body:** **`SubmitTransaction`** may return HTTP **200** with BCS **`TransactionResponseData::Error`** — always deserialize `response_data`.

| Request | Status | Notes (condensed from upstream) |
| --- | --- | --- |
| `DKG` | Supported | Four curves; encrypted or public `UserSecretKeyShare`; optional `sign_during_dkg_request`; Ristretto uses real Schnorrkel keypairs in the mock path. |
| `Sign` | Supported | Seven `DWalletSignatureScheme` variants; `hash_scheme` / cross-chain digests per book; reads scheme from **`MessageApproval`**. |
| `ImportedKeySign` | Supported | Same as `Sign` for imported-key dWallets. |
| `Presign` | Supported | Attestation with presign data; **`signature_algorithm`**, not combined scheme. |
| `PresignForDWallet` | Supported | Bound presign; **`dwallet_public_key`** (not legacy `dwallet_id`). |
| `ImportedKeyVerification` | Supported | Imported-key dWallet creation. |
| `ReEncryptShare` | Supported | Returns **`VersionedEncryptedUserKeyShareAttestation`**. |
| `MakeSharePublic` | Supported | Returns **`VersionedPublicUserKeyShareAttestation`**. |
| `FutureSign` | Supported | Step 1 of conditional signing; partial user sig attestation. |
| `SignWithPartialUserSig` | Supported | Step 2; completes **`FutureSign`**. |
| `ImportedKeySignWithPartialUserSig` | Supported | Imported-key variant of step 2. |

**Note:** Some **per-variant** subsections in the same upstream chapter may still contain older phrasing (for example “not yet implemented in mock”). For this skill bundle, treat the **Mock Support** table at the revision recorded in [`docs-revision.md`](docs-revision.md) as authoritative. When upstream reconciles those subsections, bump the pin and refresh this file.

### DKG (representative)

```rust
DWalletRequest::DKG {
    dwallet_network_encryption_public_key: Vec<u8>,
    curve: DWalletCurve,
    centralized_public_key_share_and_proof: Vec<u8>,
    user_secret_key_share: UserSecretKeyShare, // Encrypted { ... } or Public { ... }
    user_public_output: Vec<u8>,
    sign_during_dkg_request: Option<SignDuringDKGRequest>,
}
```

`UserSecretKeyShare::Encrypted` carries `encrypted_centralized_secret_share_and_proof`, `encryption_key`, `signer_public_key`. `Public` carries `public_user_secret_key_share`.

**Response:** `TransactionResponseData::Attestation(NetworkSignedAttestation)`; decode `attestation_data` as **`VersionedDWalletDataAttestation`** for `commit_dwallet` input.

### Sign and ImportedKeySign

```rust
DWalletRequest::Sign {
    message: Vec<u8>,
    message_metadata: Vec<u8>,
    presign_session_identifier: Vec<u8>,
    message_centralized_signature: Vec<u8>,
    dwallet_attestation: NetworkSignedAttestation,
    approval_proof: ApprovalProof,
}
```

`ImportedKeySign` has the **same fields**; validators also check the dWallet was imported.

- **`curve` and per-request `hash_scheme` are not on the wire** — validators derive **`DWalletSignatureScheme`** from the **on-chain `MessageApproval`** and curve from **`dwallet_attestation`**.
- **`message_metadata`:** BCS for `Blake2bMessageMetadata`, `SchnorrkelMessageMetadata`, etc., when the chosen scheme requires it (e.g. **`EcdsaBlake2b256`**, **`SchnorrkelMerlin`**).

**Response (when supported):** `TransactionResponseData::Signature { signature }` (64-byte signature for the active algorithm).

### Presign / PresignForDWallet

- Use **`signature_algorithm: DWalletSignatureAlgorithm`** (not a combined scheme) — hashing is chosen at **sign** time.
- **`PresignForDWallet`** uses **`dwallet_public_key`** (not a legacy `dwallet_id`).

**Response:** **`Attestation`** with **`VersionedPresignDataAttestation`** (no separate `Presign` top-level response variant).

---

## ApprovalProof

```rust
pub enum ApprovalProof {
    Solana {
        transaction_signature: Vec<u8>,
        slot: u64,
    },
    Sui {
        effects_certificate: Vec<u8>,
    },
}
```

After Solana **`approve_message`**, set **`Solana`** to the transaction signature bytes and **slot** of the tx that created the **`MessageApproval`**.

---

## TransactionResponse

```protobuf
message TransactionResponse {
  bytes response_data = 1; // BCS TransactionResponseData
}
```

## TransactionResponseData (BCS)

**Three variants only** — presign outputs use **`Attestation`**, not a fourth variant.

```rust
pub enum TransactionResponseData {
    Signature { signature: Vec<u8> },
    Attestation(NetworkSignedAttestation),
    Error { message: String },
}
```

| variant | use |
| --- | --- |
| `Signature` | Completed signing (`Sign`, `ImportedKeySign`, `SignWithPartialUserSig`, `ImportedKeySignWithPartialUserSig`, …) |
| `Attestation` | DKG, imported-key verification, **presign**, `ReEncryptShare` / `MakeSharePublic` / `FutureSign`, etc. |
| `Error` | Validation failure, missing or mismatched on-chain state, bad proofs, or other server-side errors — **deserialize before treating HTTP as success** |

**On-chain vs signing digest:** `MessageApproval` PDA seed **`message_digest`** (**keccak256(message)**) is an on-chain uniqueness key. The bytes the network signs follow **`DWalletSignatureScheme`** / metadata — not necessarily equal to that seed alone. See [`flows.md`](flows.md) flow 6 and [`../SKILL.md`](../SKILL.md).

---

## query RPCs

### GetPresignsRequest / GetPresignsForDWalletRequest

```protobuf
message GetPresignsRequest {
  bytes user_pubkey = 1;
}

message GetPresignsForDWalletRequest {
  bytes user_pubkey = 1;
  bytes dwallet_id = 2;
}
```

### GetPresignsResponse

```protobuf
message GetPresignsResponse {
  repeated PresignInfo presigns = 1;
}

message PresignInfo {
  bytes presign_id = 1;
  bytes dwallet_id = 2;
  uint32 curve = 3;
  uint32 signature_scheme = 4;
  uint64 epoch = 5;
}
```

---

## DWalletSignatureScheme (`repr(u16)`)

User-facing **combined** algorithm + hash. Invalid curve pairs are rejected at validators.

| variant | index | curve | use |
| --- | ---: | --- | --- |
| `EcdsaKeccak256` | 0 | Secp256k1 | Ethereum |
| `EcdsaSha256` | 1 | Secp256k1 / Secp256r1 | Bitcoin legacy / WebAuthn |
| `EcdsaDoubleSha256` | 2 | Secp256k1 | Bitcoin BIP143 |
| `TaprootSha256` | 3 | Secp256k1 | Taproot BIP340 |
| `EcdsaBlake2b256` | 4 | Secp256k1 | Zcash — set **`Blake2bMessageMetadata`** in `message_metadata` |
| `EddsaSha512` | 5 | Curve25519 | Ed25519 (Solana, Sui) |
| `SchnorrkelMerlin` | 6 | Ristretto | Substrate — **`SchnorrkelMessageMetadata`** |

### Message metadata structs

- **`Blake2bMessageMetadata`:** `personal` (≤16 bytes), `salt` (≤16 bytes) — for **`EcdsaBlake2b256`**.
- **`SchnorrkelMessageMetadata`:** `context` — for **`SchnorrkelMerlin`** (empty defaults to `b"substrate"` per upstream docs).

### Internal `DWalletHashScheme`

The MPC stack still uses separate **`DWalletSignatureAlgorithm`** + **`DWalletHashScheme`** internally; the validator boundary maps to/from **`DWalletSignatureScheme`**. You rarely set raw `DWalletHashScheme` on user-facing gRPC requests for `Sign` on current `main`.

---

## BCS notes

Match `ika-dwallet-types` tag ordering; prefer generated bindings over hand-rolled layouts.

- Rust: `bcs::to_bytes` / `bcs::from_bytes`
- TypeScript: generated client or `@mysten/bcs` with verified layouts

---

## minimal Rust client shape

```rust
use ika_grpc::d_wallet_service_client::DWalletServiceClient;
use ika_grpc::UserSignedRequest;
use ika_dwallet_types::TransactionResponseData;
use std::env;

let mut client = DWalletServiceClient::connect(env::var("DWALLET_GRPC_URL").unwrap()).await?;
let resp = client.submit_transaction(UserSignedRequest {
    user_signature: bcs::to_bytes(&user_sig)?,
    signed_request_data: bcs::to_bytes(&signed_data)?,
}).await?;

let tx_response = resp.into_inner();
let result: TransactionResponseData = bcs::from_bytes(&tx_response.response_data)?;
```

---

## crypto parameter enums (BCS)

**`DWalletCurve`:** `Secp256k1`, `Secp256r1`, `Curve25519`, `Ristretto` — on-chain often `u16` LE; gRPC BCS per `ika-dwallet-types`.

**`DWalletSignatureAlgorithm` (presign):** `ECDSASecp256k1`, `ECDSASecp256r1`, `Taproot`, `EdDSA`, `Schnorrkel`.

**`ChainId`:** `Solana`, `Sui`.
