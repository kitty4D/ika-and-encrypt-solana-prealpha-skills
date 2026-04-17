# frameworks - TypeScript + Rust CPI SDKs

## table of contents

1. TypeScript (`@ika.xyz/pre-alpha-solana-client` + `@solana/kit`)
2. Pinocchio (`ika-dwallet-pinocchio`)
3. Native (`ika-dwallet-native`)
4. Anchor v1 (`ika-dwallet-anchor`)
5. Quasar (`ika-dwallet-quasar`)
6. Comparison table, interoperability

Pinocchio, Native, Anchor, and Quasar CPI crates share **instruction encodings**, **account order**, and **`CPI_AUTHORITY_SEED`**.

**Git remote for `ika-dwallet-*`:** [`../SKILL.md`](../SKILL.md) **source repo** row. The Pinocchio snippet below shows one full `[dependencies]` example; other Rust crates use the same `git` URL (see each section).

---

## TypeScript - `@ika.xyz/pre-alpha-solana-client` + `@solana/kit`

Install: [`../SKILL.md`](../SKILL.md). Typical Solana Kit entrypoints: `createSolanaRpc`, `pipe`, `createTransactionMessage`, `signTransactionMessageWithSigners`, `sendAndConfirmTransactionFactory`, `getProgramDerivedAddress`, `getAddressEncoder`, `getUtf8Encoder`.

### approve_message (direct or CPI)

Derive **DWallet** PDA with **`curve_u16_le || public_key`** chunks per [`account-layouts.md`](account-layouts.md). Derive **MessageApproval** PDA with  
`["dwallet", ...chunks, "message_approval", scheme_u16_le, message_digest, [message_metadata_digest?]]` — include the metadata seed only when non-zero. Instruction data: **100 bytes** per [`instructions.md`](instructions.md). Account list starts with **DWalletCoordinator** (readonly).

```typescript
import { address } from "@solana/kit";

const DWALLET_PROGRAM = address("87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY");
// Build ix data: disc 8, bump, message_digest(32), message_metadata_digest(32), user_pubkey(32), signature_scheme u16 LE
const data = new Uint8Array(100);
data[0] = 8;
data[1] = messageApprovalBump;
data.set(messageDigest, 2);
data.set(messageMetadataDigest, 34);
data.set(userPubkey, 66);
data[98] = signatureSchemeU16 & 0xff;
data[99] = (signatureSchemeU16 >> 8) & 0xff;
// Metas: coordinator, message_approval, dwallet, authority | caller_program + cpi_authority, payer, system — see instructions.md
```

### transfer_ownership (disc 24)

```typescript
const tdata = new Uint8Array(33);
tdata[0] = 24;
tdata.set(newAuthorityBytes, 1);
// metas: current_authority signer, dwallet writable
```

### gRPC from TypeScript

`ika_dwallet.proto` in the repo; endpoint in `SKILL.md`. Serialize `UserSignedRequest` per [`grpc-api.md`](grpc-api.md).

---

## Pinocchio - `ika-dwallet-pinocchio`

Use for `#![no_std]`, minimal binary size, CU-sensitive programs.

**deps**

```toml
ika-dwallet-pinocchio = { git = "https://github.com/dwallet-labs/ika-pre-alpha" }
pinocchio = "0.10"
pinocchio-system = "0.5"
```

**DWalletContext**

```rust
use ika_dwallet_pinocchio::DWalletContext;

let ctx = DWalletContext {
    dwallet_program: &dwallet_program_account,
    cpi_authority: &cpi_authority_account,
    caller_program: &my_program_account,
    cpi_authority_bump: bump,
};
```

**CPI authority**

```rust
use ika_dwallet_pinocchio::CPI_AUTHORITY_SEED;
let (cpi_authority, bump) = pinocchio::Address::find_program_address(
    &[CPI_AUTHORITY_SEED],
    program_id,
);
```

**Methods:** `approve_message(coordinator, …, message_digest, message_metadata_digest, user_pubkey, signature_scheme: u16, bump)`, `transfer_dwallet`, `transfer_future_sign` — exact account lists in crate `cpi.rs`.

**Types:** `AccountView`, `pinocchio::entrypoint!`, `pinocchio::cpi::invoke_signed`.

---

## Native - `ika-dwallet-native`

Use for existing `solana-program` codebases (`std`, `AccountInfo`).

**deps:** add `ika-dwallet-native = { git = ... }` using the **source repo** URL from [`../SKILL.md`](../SKILL.md), plus:

```toml
solana-program = "2.2"
solana-system-interface = "1"
```

**DWalletContext** uses `&AccountInfo<'info>`; same CPI methods as Pinocchio (including **`approve_message`** with **`coordinator`** first).

**CPI authority**

```rust
use ika_dwallet_native::CPI_AUTHORITY_SEED;
let (cpi_authority, bump) = Pubkey::find_program_address(&[CPI_AUTHORITY_SEED], &program_id);
```

| topic | Pinocchio | Native |
| --- | --- | --- |
| account type | `AccountView` | `AccountInfo` |
| std | no_std | std |
| rent | pinocchio helpers | `Rent::get()?.minimum_balance` |
| CPI | pinocchio invoke | `solana_program::program::invoke_signed` |
| iteration | fixed indices | `next_account_info` |

---

## Anchor v1 - `ika-dwallet-anchor`

Use for Anchor 1.x programs and declarative account validation.

**deps:** add `ika-dwallet-anchor = { git = ... }` using the **source repo** URL from [`../SKILL.md`](../SKILL.md), plus:

```toml
anchor-lang = "1"
```

**Tooling:** Anchor CLI 1.x, Solana CLI 3.x (see upstream book for `avm` pins).

**DWalletContext**

```rust
use ika_dwallet_anchor::{DWalletContext, CPI_AUTHORITY_SEED};

let ctx = DWalletContext {
    dwallet_program: dwallet_program.to_account_info(),
    cpi_authority: cpi_authority.to_account_info(),
    caller_program: program.to_account_info(),
    cpi_authority_bump: bump,
};
```

**Methods**

```rust
ctx.approve_message(
    &coordinator.to_account_info(),
    &message_approval.to_account_info(),
    &dwallet.to_account_info(),
    &payer.to_account_info(),
    &system_program.to_account_info(),
    message_digest,
    message_metadata_digest,
    user_pubkey,
    signature_scheme, // u16 — DWalletSignatureScheme
    bump,
)?;
ctx.transfer_dwallet(&dwallet.to_account_info(), &new_authority)?;
ctx.transfer_future_sign(&partial_user_sig.to_account_info(), &new_authority)?;
```

Anchor v1 patterns from book: `UncheckedAccount`, `InitSpace`, consolidated `#[error_code]`.

---

## Quasar - `ika-dwallet-quasar`

Use for **Quasar** on-chain programs (`no_std`, zero-copy, declarative validation); CPI uses **`invoke_signed_unchecked`** with stack buffers. Full prose and “when to use” vs Pinocchio / Anchor: upstream book [`docs/src/frameworks/quasar.md`](https://github.com/dwallet-labs/ika-pre-alpha/blob/main/docs/src/frameworks/quasar.md) at the commit in [`docs-revision.md`](docs-revision.md).

**deps**

```toml
ika-dwallet-quasar = { git = "https://github.com/dwallet-labs/ika-pre-alpha" }
quasar-lang = { git = "https://github.com/blueshift-gg/quasar", branch = "master" }
solana-address = { version = "2.4", features = ["curve25519"] }

[lib]
crate-type = ["cdylib", "lib"]
```

**DWalletContext** (`ika_dwallet_quasar::DWalletContext`): same logical fields as other CPI crates. Build from Quasar account types with **`.to_account_view()`** on `Signer`, `UncheckedAccount`, `Program`, `Account`.

**CPI authority:** `CPI_AUTHORITY_SEED` + `solana_address::Address::find_program_address` (see upstream crate).

**Methods:** **`approve_message`**, **`transfer_dwallet`**, **`transfer_future_sign`** — same discriminators and account order as Pinocchio / Native / Anchor; **`approve_message`** keeps **`coordinator`** first (see [`instructions.md`](instructions.md)).

---

## comparison table

| | Pinocchio | Native | Anchor | Quasar | TypeScript |
| --- | --- | --- | --- | --- | --- |
| language | Rust | Rust | Rust | Rust | TS |
| runs | on-chain | on-chain | on-chain | on-chain | off-chain |
| account type | `AccountView` | `AccountInfo` | `Account` / `UncheckedAccount` | Quasar views | addresses + bytes |
| std | no | yes | yes | yes | n/a |
| best for | max CU / size | legacy svm | rapid iteration | Quasar programs | clients, automation |

- **Runnable program samples** (voting, multisig, gRPC-only `protocols-e2e`): [`examples.md`](examples.md).

---

## interoperability

Same `CPI_AUTHORITY_SEED`, discriminators, and per-instruction account order across Rust CPI crates. Example programs target the dWallet program id from [`../SKILL.md`](../SKILL.md) and the same PDA derivations on devnet.
