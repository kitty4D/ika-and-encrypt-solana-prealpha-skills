# dWallet types (Solana pre-alpha)

The Sui-side conceptual taxonomy ([docs.ika.xyz/docs/sdk/ika-transaction/dwallet-types](https://docs.ika.xyz/docs/sdk/ika-transaction/dwallet-types)) names three kinds: **zero-trust**, **shared**, and **imported-key**. The Solana pre-alpha surface supports all three but does **not** name them in those terms — the distinction is encoded in the gRPC `UserSecretKeyShare` enum variant chosen at DKG (or import) and, for the conversion path, in the on-chain instruction discriminators.

This file maps the Sui taxonomy onto the Solana surface so a reader who learned the model from the Sui docs can navigate this skill without re-learning vocabulary.

---

## the three types at a glance

| type | trust model | how to create on Solana | identifying signal |
| --- | --- | --- | --- |
| **zero-trust** | user share is encrypted under the user's encryption key; both the user share and the network share are needed to sign | `DWalletRequest::DKG` with **`UserSecretKeyShare::Encrypted { encrypted_centralized_secret_share_and_proof, encryption_key, signer_public_key }`** ([`grpc-api.md`](grpc-api.md)); on-chain DKG flow uses discs **0–4** ([`instructions.md`](instructions.md)) plus the encrypted-share lifecycle (discs **17–21**) | `EncryptedUserSecretKeyShare` PDA (disc **11**) exists for this dWallet ([`account-layouts.md`](account-layouts.md)) |
| **shared** | user share is **public**; the network can sign autonomously without the user holding any secret share | either born-shared via `DWalletRequest::DKG` with **`UserSecretKeyShare::Public { public_user_secret_key_share }`**, or converted from zero-trust via **`DWalletRequest::MakeSharePublic`** + on-chain `MakeUserSecretKeySharePublic` (disc **22**) → `VerifyMakePublic` (disc **23**) | response decodes as **`VersionedPublicUserKeyShareAttestation`** ([`grpc-api.md`](grpc-api.md) attestation table); **no** `EncryptedUserSecretKeyShare` PDA |
| **imported-key** | existing private key brought into the dWallet system; can be configured as zero-trust **or** shared by choosing the matching `UserSecretKeyShare` variant | `DWalletRequest::ImportedKeyVerification` (instead of `DKG`); on-chain `CreateImportedKeyDKGRequest` (disc **5**) → `CompleteImportedKeyVerification` (disc **6**) / `RejectImportedKeyVerification` (disc **7**) | `is_imported` flag at **DWallet offset 143** = `1` ([`account-layouts.md`](account-layouts.md)) |

---

## the default DKG flow produces a zero-trust dWallet

[`flows.md`](flows.md) flow 1 walks the canonical DKG path. It calls `DWalletRequest::DKG` and lets the caller choose the `UserSecretKeyShare` variant — but every example in this skill (and every TypeScript example in upstream `chains/solana/examples`) uses **`Encrypted`**, so the produced dWallet is **zero-trust** unless you explicitly switch the variant. The Rust binary `chains/solana/examples/protocols-e2e` exercises the **`Public`** variant under a "DKG with Public share mode" step — that is the born-shared path.

If a reader of this skill expected "shared by default", they were reading the Sui docs and projecting; on Solana, the variant is an explicit field on the request.

---

## sharedness is not a flag in the DWallet account

The on-chain **DWallet** account (disc 2, 153 bytes) carries `is_imported` at offset **143** but **does not** carry an `is_shared` or `is_public` flag. The `state` byte at offset **36** holds **lifecycle** state only — `0=DKGInProgress`, `1=Active`, `2=Frozen` — not trust-model state.

To detect whether a given dWallet is zero-trust or shared from on-chain data alone:

- look up the **`EncryptedUserSecretKeyShare`** PDA (disc **11**) keyed off the dWallet — if it exists and is in the accepted state, the dWallet is zero-trust.
- if no `EncryptedUserSecretKeyShare` exists, the dWallet was either born-shared or has been converted via `MakeUserSecretKeySharePublic`.

For the conversion path specifically, the `VerifyMakePublic` (disc 23) commit creates the public attestation; track its presence to confirm a successful zero-trust → shared transition.

---

## use-this-when (Solana pre-alpha context)

| use case | type | reasoning |
| --- | --- | --- |
| user-controlled custody, wallet browser extension | **zero-trust** | user keeps the centralized share encrypted under a key only they control; network cannot sign alone |
| DAO treasury that signs autonomously after governance approves a CPI | **shared** | no per-vote encrypted-share decryption; the network can sign once on-chain `MessageApproval` is in the right state |
| automated bots / programmatic signers (token streaming, scheduled transactions) | **shared** | same as DAO — automation cannot prompt a user for their encryption key on every signature |
| migrate an existing EOA / classical key into MPC | **imported-key** (variant: zero-trust if the user retains custody, shared if it becomes a smart-contract-owned key) | preserves the existing public key while adding network-side participation; **note the upstream caveat**: the original private key still exists outside the dWallet system, so import does not retroactively make the source key safe |
| start zero-trust, hand off to a program later | **zero-trust → shared via `MakeUserSecretKeySharePublic`** | see [`flows.md`](flows.md) for the conversion flow; the public-share attestation goes on-chain via disc 22 / 23 |

---

## related references

- [`grpc-api.md`](grpc-api.md) — `UserSecretKeyShare` enum, `DWalletRequest::DKG` / `ImportedKeyVerification` / `MakeSharePublic`, attestation decode table
- [`instructions.md`](instructions.md) — discriminators 0–7 (DKG + imported-key), 17–21 (encrypted-share lifecycle), 22–23 (MakeSharePublic conversion)
- [`account-layouts.md`](account-layouts.md) — DWallet, EncryptedUserSecretKeyShare, NetworkEncryptionKey, DWalletAttestation layouts
- [`user-share-encryption-keys.md`](user-share-encryption-keys.md) — how the user-share encryption key (relevant to **zero-trust** and the encrypted variant of **imported-key**) gets created and managed
- [`flows.md`](flows.md) — flow 1 (DKG → zero-trust by default), flow 9 (zero-trust → shared conversion)
- upstream Sui-side concept doc: [docs.ika.xyz/docs/sdk/ika-transaction/dwallet-types](https://docs.ika.xyz/docs/sdk/ika-transaction/dwallet-types)
