# instruction reference (dWallet program + examples)

## table of contents

1. dWallet program (full discriminator table)
2. approve_message, transfer_ownership, CommitDWallet, TransferFutureSign, CommitSignature
3. Voting example program (create_proposal, cast_vote)
4. Multisig example program

Byte **0** of dWallet program instruction data is the **discriminator**.

**Program id:** [`../SKILL.md`](../SKILL.md) environment table.

**Normative:** upstream [`docs/src/reference/accounts.md`](https://github.com/dwallet-labs/ika-pre-alpha/blob/main/docs/src/reference/accounts.md) and [`docs/src/on-chain/message-approval.md`](https://github.com/dwallet-labs/ika-pre-alpha/blob/main/docs/src/on-chain/message-approval.md) at the commit in [`docs-revision.md`](docs-revision.md).

---

## dWallet program — full discriminator table

| disc | instruction |
| --- | --- |
| 0 | CreateDKGRequest |
| 1 | CompleteDKGFirstRound |
| 2 | SubmitUserDKGVerification |
| 3 | CompleteDKG |
| 4 | RejectDKG |
| 5 | CreateImportedKeyDKGRequest |
| 6 | CompleteImportedKeyVerification |
| 7 | RejectImportedKeyVerification |
| 8 | ApproveMessage |
| 11 | CreatePresignRequest |
| 12 | CompletePresign |
| 13 | RejectPresign |
| 14 | CreatePartialUserSignature |
| 15 | VerifyPartialUserSignature |
| 16 | RejectPartialUserSignature |
| 17 | CreateEncryptionKey |
| 18 | CreateEncryptedShare |
| 19 | VerifyEncryptedShare |
| 20 | RejectEncryptedShare |
| 21 | AcceptEncryptedShare |
| 22 | MakeUserSecretKeySharePublic |
| 23 | VerifyMakePublic |
| 24 | TransferOwnership |
| 25 | CreateSigningDelegation |
| 26 | CloseSigningDelegation |
| 27 | RequestNetworkDKG |
| 28 | CommitNetworkDKG |
| 29 | RequestNetworkKeyReconfiguration |
| 30 | CommitNetworkKeyReconfiguration |
| 31 | CommitDWallet |
| 33 | CommitFutureSign |
| 34 | CommitEncryptedUserSecretKeyShare |
| 35 | CommitPublicUserSecretKeyShare |
| 36 | CreateDeposit |
| 37 | TopUp |
| 38 | SettleGas |
| 39 | UpdateFees |
| 40 | PauseCurve |
| 41 | UnpauseCurve |
| 42 | TransferFutureSign |
| 43 | CommitSignature |
| 44 | RequestWithdraw |
| 45 | Withdraw |
| 46 | Initialize |
| 228 | EmitEvent |

Layouts for DKG / presign / share / gas instructions **not** spelled out here — read **`ika-pre-alpha`** program sources or book chapters at the tracked revision.

---

## approve_message (disc 8)

Creates **MessageApproval** PDA. **`message_digest`** = **keccak256(message)** (32 bytes). **`message_metadata_digest`** = **keccak256(message_metadata_bytes)** or **zeros** if no metadata. **`signature_scheme`** = **`DWalletSignatureScheme`** as **u16 LE** (0–6).

### data — 100 bytes

| offset | field | size |
| --- | --- | --- |
| 0 | discriminator | 1 (`8`) |
| 1 | bump | 1 |
| 2 | message_digest | 32 |
| 34 | message_metadata_digest | 32 |
| 66 | user_pubkey | 32 |
| 98 | signature_scheme | 2 (LE u16) |

### accounts — CPI path (7 metas)

| # | account | writable | signer | notes |
| --- | --- | --- | --- | --- |
| 0 | coordinator | no | no | DWalletCoordinator PDA (epoch) |
| 1 | message_approval | yes | no | empty PDA to create |
| 2 | dwallet | no | no | |
| 3 | caller_program | no | no | executable |
| 4 | cpi_authority | no | yes | PDA `["__ika_cpi_authority"]` |
| 5 | payer | yes | yes | rent |
| 6 | system_program | no | no | |

**Checks:** `cpi_authority == PDA(["__ika_cpi_authority"], caller_program)` and `dwallet.authority == cpi_authority`.

### accounts — direct signer path (6 metas)

| # | account | writable | signer |
| --- | --- | --- | --- |
| 0 | coordinator | no | no |
| 1 | message_approval | yes | no |
| 2 | dwallet | no | no |
| 3 | authority | no | yes |
| 4 | payer | yes | yes |
| 5 | system_program | no | no |

---

## transfer_ownership (disc 24)

### data — 33 bytes

| offset | field | size |
| --- | --- | --- |
| 0 | discriminator | 1 (`24`) |
| 1 | new_authority | 32 |

### accounts — signer path

| # | account | writable | signer |
| --- | --- | --- | --- |
| 0 | current_authority | no | yes |
| 1 | dwallet | yes | no |

### accounts — CPI path

| # | account | writable | signer |
| --- | --- | --- | --- |
| 0 | caller_program | no | no |
| 1 | cpi_authority | no | yes |
| 2 | dwallet | yes | no |

---

## CommitDWallet (disc 31) — NOA only

Commits DKG / imported-key verification attestation; creates **DWallet** (+ **DWalletAttestation** per upstream). Exact **`data` / accounts`** — see book and program sources.

---

## TransferFutureSign (disc 42) — CPI path

### accounts

| # | account | writable | signer |
| --- | --- | --- | --- |
| 0 | partial_user_sig | yes | no |
| 1 | caller_program | no | no |
| 2 | cpi_authority | no | yes |

### data — 33 bytes

| offset | field | size |
| --- | --- | --- |
| 0 | discriminator | 1 (`42`) |
| 1 | new_completion_authority | 32 |

---

## CommitSignature (disc 43) — NOA only

Writes signature into **MessageApproval** or **PartialUserSignature** (dispatches by target account discriminator).

### accounts

| # | account | writable | signer |
| --- | --- | --- | --- |
| 0 | target_account | yes | no |
| 1 | nek | no | no |
| 2 | noa | no | yes |

### data

| offset | field | size |
| --- | --- | --- |
| 0 | discriminator | 1 |
| 1 | signature_len | 2 (LE u16) |
| 3 | signature | 128 |

---

# voting example program (not dWallet program)

**Verify** instruction layouts and account lists against the **voting** example tree in [`examples.md`](examples.md) (paths under `chains/solana/examples/voting/`) — they may drift from this snapshot.

## create_proposal (disc 0)

### accounts

| # | account | writable | signer |
| --- | --- | --- | --- |
| 0 | proposal | yes | no |
| 1 | dwallet | no | no |
| 2 | creator | no | yes |
| 3 | payer | yes | yes |
| 4 | system_program | no | no |

### data

See example `lib.rs` / TS e2e for current byte layout (`proposal_id`, message fields, `signature_scheme`, quorum, bumps).

---

## cast_vote (disc 1)

### accounts — base

| # | account | writable | signer |
| --- | --- | --- | --- |
| 0 | proposal | yes | no |
| 1 | vote_record | yes | no |
| 2 | voter | no | yes |
| 3 | payer | yes | yes |
| 4 | system_program | no | no |

### accounts — when quorum reached (+5)

| # | account |
| --- | --- |
| 5 | message_approval |
| 6 | dwallet |
| 7 | caller_program (voting program) |
| 8 | cpi_authority |
| 9 | dwallet_program |

### data — 35 bytes

`proposal_id(32) | vote(1) | vote_record_bump(1) | cpi_authority_bump(1)`

---

# multisig example program

| disc | instruction |
| --- | --- |
| 0 | CreateMultisig |
| 1 | CreateTransaction |
| 2 | Approve |
| 3 | Reject |

**Multisig** PDA `["multisig", create_key]`, 395 bytes: disc, version, create_key, threshold (u16), member_count (u16), tx_index (u32), dwallet, bump, members (10×32).

**Transaction** PDA `["transaction", multisig, tx_index_le]`, 432 bytes: field offsets per example sources.

**ApprovalRecord** `["approval", transaction, member]`, 68 bytes.

At `approval_count >= threshold`, the reference program CPI-calls **approve_message** (with coordinator + new ix layout) and may call **TransferFutureSign**. On-disk layout: [`examples.md`](examples.md) (`multisig/`).
