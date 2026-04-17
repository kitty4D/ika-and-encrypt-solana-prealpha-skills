# account layouts (pre-alpha)

## table of contents

1. Rent helper (book / examples)
2. dWallet program accounts (coordinator, NEK, GasDeposit, **DWallet** chunked PDA seeds, MessageApproval, attestations, partial sig)
3. CPI authority PDA
4. Ika system accounts (`ika-solana-sdk-types`)
5. Voting + multisig example accounts
6. Summary table
7. TypeScript read hints

Account layouts follow the dWallet program and `ika-solana-sdk-types` documentation. **Normative:** upstream [`docs/src/reference/accounts.md`](https://github.com/dwallet-labs/ika-pre-alpha/blob/main/docs/src/reference/accounts.md) at the commit in [`docs-revision.md`](docs-revision.md).

**Prefix:** typed accounts use **`discriminator` (1 byte) + `version` (1 byte)** then payload.

**dWallet program id:** see environment table in [`../SKILL.md`](../SKILL.md).

---

## rent helper (book / examples)

Example approximation from the book:

```rust
fn minimum_balance(data_len: usize) -> u64 {
    (data_len as u64 + 128) * 6960
}
```

On-chain: use `Rent::get()?.minimum_balance(data_len)`. Clients: use RPC rent where appropriate. Sizes below support estimation.

---

## dWallet program accounts

### type discriminators

| disc | account |
| --- | --- |
| 1 | DWalletCoordinator |
| 2 | DWallet |
| 3 | NetworkEncryptionKey |
| 4 | GasDeposit |
| 9 | PartialUserSignature |
| 11 | EncryptedUserSecretKeyShare |
| 14 | MessageApproval |
| 15 | DWalletAttestation |

**DWallet PDA seeds:** `["dwallet", ...chunks]` where **`chunks`** splits **`(curve_u16_le || raw_public_key)`** into **32-byte** pieces (Solana `MAX_SEED_LEN`). Concatenate **2-byte** little-endian `DWalletCurve` and pubkey bytes, then `chunks(32)`.

| pubkey len | payload size | chunk pattern (example) |
| --- | --- | --- |
| 32 bytes (Ed25519 / Curve25519 / Ristretto) | 34 bytes | `[32, 2]` |
| 33 bytes (compressed Secp) | 35 bytes | `[32, 3]` |
| 65 bytes (uncompressed SEC1) | 67 bytes | `[32, 32, 3]` |

---

### DWalletCoordinator - 116 bytes

- **PDA seeds:** `["dwallet_coordinator"]`

| offset | field | size |
| --- | --- | --- |
| 0 | discriminator | 1 (`1`) |
| 1 | version | 1 (`1`) |
| 2+ | coordinator fields | 114 |

---

### NetworkEncryptionKey - 164 bytes

- **PDA seeds:** `["network_encryption_key", noa_pubkey]`

| offset | field | size |
| --- | --- | --- |
| 0 | discriminator | 1 (`3`) |
| 1 | version | 1 (`1`) |
| 2 | NEK fields | 162 |

Read NEK bytes from chain for `dwallet_network_encryption_public_key` in DKG requests.

---

### DWallet - 153 bytes (2 + 151)

- **PDA seeds:** `["dwallet", chunks_of(curve_u16_le || public_key)]`

| offset | field | size | notes |
| --- | --- | --- | --- |
| 0 | discriminator | 1 | `2` |
| 1 | version | 1 | `1` |
| 2 | authority | 32 | user or CPI PDA |
| 34 | curve | 2 | `DWalletCurve` u16 LE |
| 36 | state | 1 | DKGInProgress / Active / Frozen |
| 37 | public_key_len | 1 | 32 or 33 typical |
| 38 | public_key | 65 | padded |
| 103 | created_epoch | 8 | LE u64 |
| 111 | noa_public_key | 32 | |
| 143 | is_imported | 1 | |
| 144 | bump | 1 | |
| 145 | _reserved | 8 | |

---

### MessageApproval - 312 bytes (2 + 310)

- **PDA seeds:** `["dwallet", chunks..., "message_approval", &scheme_u16_le, &message_digest, [&message_metadata_digest]]`  
  Include **`message_metadata_digest`** seed only when non-zero (32-byte digest).

- **`message_digest`:** **keccak256(message)** (same bytes as in `approve_message` ix data).
- **`signature_scheme`:** **`DWalletSignatureScheme`** as **u16 LE** (values 0–6), not the legacy 1-byte `SignatureScheme`.

| offset | field | size |
| --- | --- | --- |
| 0 | discriminator | 1 (`14`) |
| 1 | version | 1 (`1`) |
| 2 | dwallet | 32 |
| 34 | message_digest | 32 |
| 66 | message_metadata_digest | 32 |
| 98 | approver | 32 |
| 130 | user_pubkey | 32 |
| 162 | signature_scheme | 2 (LE u16) |
| 164 | epoch | 8 (LE u64) |
| 172 | status | 1 |
| 173 | signature_len | 2 (LE u16) |
| 175 | signature | 128 (padded) |
| 303 | bump | 1 |
| 304 | _reserved | 8 |

**status:** `0` Pending, `1` Signed.

**Signature bytes:** `len = u16::from_le_bytes(data[173..175])`, then `data[175..175+len]`.

---

### DWalletAttestation (disc 15)

Variable-size PDA: **67-byte header** + `attestation_data` (BCS versioned blob). NOA signature over attestation data. Seed patterns depend on operation type — see upstream **accounts** reference (`CommitDWallet`, etc.).

---

### GasDeposit (disc 4)

- **PDA seeds:** `["gas_deposit", user_pubkey]` — **139 bytes (2 + 137)** per upstream reference (field table in book). Devnet may have **no** such accounts at a given time; size is from **`docs/src/reference/accounts.md`**, not inferred from RPC samples.

---

### PartialUserSignature (disc 9)

Used for **FutureSign** / partial user signature flows. PDA seeds include **`partial_user_sig`**, scheme, digests — see upstream reference.

---

## CPI authority PDA

- **seeds:** `["__ika_cpi_authority"]`
- **program id:** calling program (not the dWallet program)
- Must equal `dwallet.authority` for CPI `approve_message` / `transfer_ownership` paths.

---

## Ika system accounts (`ika-solana-sdk-types`)

### SystemState - 365 bytes

- **seeds:** `["ika_system_state"]`

| offset | field | size |
| --- | --- | --- |
| 0 | discriminator | 1 (`1`) |
| 1 | version | 1 |
| 2 | epoch | 8 (LE u64) |
| … | … | … |
| 34 | authority | 32 |

### Validator - 973 bytes

- **seeds:** `["validator", identity_pubkey]`

### StakeAccount - 115 bytes

- **seeds:** `["stake_account", stake_id_le_bytes]`

### ValidatorList

- **seeds:** `["validator_list"]`

---

## voting example accounts (separate program)

### Proposal - 195 bytes

- **seeds:** `["proposal", proposal_id]`

Fields include `dwallet`, `message_hash` / digest fields per example version — **verify** against `chains/solana/examples/voting` in [`../SKILL.md`](../SKILL.md) source repo.

### VoteRecord - 69 bytes

- **seeds:** `["vote", proposal_id, voter]`

---

## multisig example accounts (separate program)

| account | seeds | size |
| --- | --- | --- |
| Multisig | `["multisig", create_key]` | 395 |
| Transaction | `["transaction", multisig, tx_index_le]` | 432 |
| ApprovalRecord | `["approval", transaction, member]` | 68 |

Field-level layouts: [`instructions.md`](instructions.md) multisig section; confirm against current example sources.

---

## summary table

| account | disc | size | seeds | program |
| --- | --- | --- | --- | --- |
| DWalletCoordinator | 1 | 116 | `["dwallet_coordinator"]` | dWallet |
| DWallet | 2 | 153 | `["dwallet", chunks(curve_u16_le \|\| pk)]` | dWallet |
| NetworkEncryptionKey | 3 | 164 | `["network_encryption_key", noa]` | dWallet |
| GasDeposit | 4 | 139 | `["gas_deposit", user]` | dWallet |
| PartialUserSignature | 9 | 570+ | `["dwallet", chunks..., "partial_user_sig", ...]` | dWallet |
| EncryptedUserSecretKeyShare | 11 | 148 | `["dwallet", chunks..., "encrypted_user_share", ...]` | dWallet |
| MessageApproval | 14 | 312 | `["dwallet", chunks..., "message_approval", ...]` | dWallet |
| DWalletAttestation | 15 | 67+ | type-specific | dWallet |
| SystemState | 1 | 365 | `["ika_system_state"]` | Ika system |
| Validator | 2 | 973 | `["validator", identity]` | Ika system |
| StakeAccount | 3 | 115 | `["stake_account", stake_id]` | Ika system |
| ValidatorList | 4 | 18+ | `["validator_list"]` | Ika system |

---

## TypeScript read hints (`@solana/kit` + rpc)

Decode `getAccountInfo` data (e.g. base64), then:

- **MessageApproval:** `status` at **172**; `signature_len` LE u16 at **173–174**; signature bytes at **175** for `signature_len` bytes.
- **dWallet:** curve **u16 LE** at **34**; validate against live `getAccountInfo` if docs and chain diverge.
