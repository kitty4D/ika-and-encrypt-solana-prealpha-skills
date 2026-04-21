---
name: encrypt-solana-prealpha
description: Use when integrating Encrypt on Solana pre-alpha (devnet)—FHE DSL (`#[encrypt_fn]`, graphs, ciphertexts), Encrypt gRPC (`CreateInput`, `ReadCiphertext`), on-chain `execute_graph` / fees / events, `@encrypt.xyz/pre-alpha-solana-client`, or disambiguating Encrypt vs ika dWallet signing. Symptoms include book vs `encrypt-pre-alpha` `docs/` drift, NEK or `authorized` wiring mistakes, vector vs scalar graph paths, and mock executor / BPF / ciphertext lifecycle surprises. Also covers `/encrypt-solana-prealpha audit` / `audit-force` / `audit-fix <rule-id>` — script-driven integration audit + skill-vs-codebase drift findings with ready-to-paste fix prompts.
---

# encrypt solana pre-alpha

Normative: [Encrypt Developer Guide](https://docs.encrypt.xyz/) · mdbook in [`encrypt-pre-alpha`](https://github.com/dwallet-labs/encrypt-pre-alpha) `docs/`. **Load [`references/`](references/)** for gRPC, ix, flows.

**`docs/` pin:** [`references/docs-revision.md`](references/docs-revision.md) — if `main` changed `docs/` after that commit, **tell the user** the skill may be stale; do not silently rewrite this bundle. Gate, script, checklist: [`references/audit.md`](references/audit.md).

## pre-alpha disclaimer

- **Exploration only** — not production confidentiality.
- **No real encryption guarantee** — data can be **plaintext on-chain**; do not submit sensitive or real data.
- **Keys / trust model not final**; **devnet resets**; **no warranty**. Do not market as production FHE or private custody to end users.
- **Not for** ika dWallet signing (`approve_message`, `DWalletService` SubmitTransaction, MessageApproval PDAs) — use **`ika-solana-prealpha`**.

## When NOT to use

- **ika dWallet signing** (`ApproveMessage`, `DWalletService` `SubmitTransaction`, `MessageApproval` PDAs, `DWalletContext` CPI) — route to **`ika-solana-prealpha`**. This skill is Encrypt (FHE on Solana), not ika signing.
- **Production FHE / private custody** — pre-alpha runs **no real FHE** (ciphertexts can be plaintext on-chain); redirect to mainnet Encrypt once it exists. Do not ship this as confidential-data infra.
- **Sui-side FHE / non-Solana chains** — this skill is the `chains/solana` surface of `encrypt-pre-alpha`. Other chains are out of scope.

## references (load on demand)

| file | load for |
| --- | --- |
| [`references/developer-guide-map.md`](references/developer-guide-map.md) | Book TOC + URLs — load before guessing |
| [`references/book-snapshots.md`](references/book-snapshots.md) | Lists all book-copy md under `references/` |
| [`references/fee-and-state-reference.md`](references/fee-and-state-reference.md) | ENC/SOL fees, seven account kinds, five event types |
| [`references/docs-revision.md`](references/docs-revision.md) | `docs/` vs `main` |
| [`references/audit.md`](references/audit.md) | **`audit` / `audit-force` / `audit-fix`**, drift catalog ([`references/drift-rules.mjs`](references/drift-rules.mjs)), `--no-drift`, `--drift=strict`, `.skill-audit.json`, checklist |
| [`references/grpc-api.md`](references/grpc-api.md) | `EncryptService`, proto, clients |
| [`references/instructions.md`](references/instructions.md) | Discriminators, ix groups |
| [`references/frameworks.md`](references/frameworks.md) | Crates, `EncryptCpi`, toolchain |
| [`references/flows.md`](references/flows.md) | Lifecycle, tests, CPI vs signer |
| [`references/dsl-types.md`](references/dsl-types.md) | `EUint*` / `EVector*` / `EBitVector*` / `PUint*` tables |
| [`references/dsl-vectors.md`](references/dsl-vectors.md) | Vector types, element-wise `#[encrypt_fn]`, gather/scatter, gRPC + limits |
| [`references/gotchas.md`](references/gotchas.md) | Field-tested bugs, silent failures, BPF limits, CPI layout |
| [`references/performance-caveats.md`](references/performance-caveats.md) | Timing, REFHE vs TFHE, bootstrap cost unknowns |

## install & tooling

**TS:** `@encrypt.xyz/pre-alpha-solana-client` + `createEncryptClient` — [`grpc-api.md`](references/grpc-api.md). **Rust** 2024, **Solana CLI** 3.x (`build-sbf`), **Bun**, `just test-unit` / `test-examples` — [`frameworks.md`](references/frameworks.md), [`flows.md`](references/flows.md). Pin git crates per upstream `Cargo.toml`.

## environment (pre-alpha)

| resource | value |
| --- | --- |
| Encrypt gRPC (TLS) | `https://pre-alpha-dev-1.encrypt.ika-network.net:443` |
| Solana RPC | `https://api.devnet.solana.com` (typical) |
| Encrypt program id | `4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8` |
| source repo | `https://github.com/dwallet-labs/encrypt-pre-alpha` |

**Canonical:** program id, gRPC URL, Solana RPC, git remote — hub only; align samples.

## quick pointers

**On-chain:** first ix byte = **discriminator**; 22 user ix + `emit_event` **228** — [`instructions.md`](references/instructions.md). Common path: discs 1–4 (`create_input_ciphertext` … `execute_graph`); full metas: [instruction reference](https://docs.encrypt.xyz/).

**gRPC:** `encrypt.v1.EncryptService` — `CreateInput`, `ReadCiphertext` — [`grpc-api.md`](references/grpc-api.md).

**Model:** `#[encrypt_fn]` (scalars; **vectors** element-wise per book [`dsl-vectors.md`](references/dsl-vectors.md)) or `#[encrypt_fn_graph]` (graph bytes / chain-agnostic) → graph → on-chain `execute_graph` / ciphertext accounts → executor + `commit_ciphertext`; decrypt via gateway ix — [`flows.md`](references/flows.md), [introduction](https://docs.encrypt.xyz/). **Gotchas:** [`gotchas.md`](references/gotchas.md). **Performance:** [`performance-caveats.md`](references/performance-caveats.md). **Book map + snapshots + fees:** [`developer-guide-map.md`](references/developer-guide-map.md), [`book-snapshots.md`](references/book-snapshots.md), [`fee-and-state-reference.md`](references/fee-and-state-reference.md).

## common mistakes

| mistake | instead |
| --- | --- |
| Assuming pre-alpha ciphertexts are secret | Treat as **public / plaintext-capable** (book + repo). |
| Assuming vectors always need `#[encrypt_fn_graph]` | Book **Vectors** shows element-wise **`#[encrypt_fn]`** with `EUint*Vector` — [`dsl-vectors.md`](references/dsl-vectors.md). If **`encrypt-solana-dsl`** still errors (`HasFheTypeId`) or you need graph-only bytes, use **`#[encrypt_fn_graph]`** — [`gotchas.md`](references/gotchas.md). |
| Treating devnet commit times as FHE benchmarks | Pre-alpha runs **no real FHE** — all timings are mock overhead. See [`performance-caveats.md`](references/performance-caveats.md). |
| Wrong `CreateInput` **authorized** / **network_encryption_public_key** | Match **NetworkEncryptionKey** + access rules — [`grpc-api.md`](references/grpc-api.md). |
| **Encrypt** vs **ika** dWallet | ika signing / `approve_message` → **`ika-solana-prealpha`** skill, not this one. |
| Patching skill when upstream `docs/` changed | **Notify user** — [`docs-revision.md`](references/docs-revision.md). |
| Forgetting Encrypt **fees / deposits / events** | Not ika-shaped — [`fee-and-state-reference.md`](references/fee-and-state-reference.md) + [`book-snapshots.md`](references/book-snapshots.md). |

**Examples:** [encrypt-pre-alpha `chains/solana/examples`](https://github.com/dwallet-labs/encrypt-pre-alpha/tree/main/chains/solana/examples).
