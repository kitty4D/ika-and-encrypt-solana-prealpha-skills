---
name: encrypt-solana-prealpha
description: Use when integrating Encrypt on Solana pre-alpha (devnet): FHE DSL (`#[encrypt_fn]`, graphs, ciphertexts), on-chain `execute_graph` / fees / events, Encrypt gRPC `CreateInput` and `ReadCiphertext`, `@encrypt.xyz/pre-alpha-solana-client`, or when the book vs `encrypt-pre-alpha` docs/ drift, NEK or `authorized` wiring errors, vector vs scalar graph issues, or mock executor / BPF / ciphertext surprises, or disambiguating Encrypt from ika dWallet signing.
---

# encrypt solana pre-alpha

## Overview

Normative: [Encrypt Developer Guide](https://docs.encrypt.xyz/) · mdbook in [`encrypt-pre-alpha`](https://github.com/dwallet-labs/encrypt-pre-alpha) `docs/`. Load [`references/`](references/) for gRPC, instructions, and flows. If [`docs-revision.md`](references/docs-revision.md) is behind `main` for `docs/`, **tell the user**; do not silently rewrite the bundle. **Audit** (slash *audit* / *audit-force* / *audit-fix*): [`audit.md`](references/audit.md).

## When to use

- **Encrypt** on pre-alpha: DSL, `execute_graph`, gRPC, TS client, on-chain program, fees, events, and `chains/solana/examples`.
- **Symptoms** include book vs repo drift, wrong `CreateInput` **authorized** / **network_encryption_public_key**, vector vs scalar path mistakes, or “Encrypt vs ika?” routing errors.

## pre-alpha disclaimer

- **Exploration only** — not production confidentiality.
- **No real encryption guarantee** — data can be **plaintext on-chain**; do not submit sensitive or real data.
- **Keys / trust model not final**; **devnet resets**; **no warranty**. Do not market as production FHE to end users.

## When NOT to use

- **ika dWallet signing** (`ApproveMessage`, `DWalletService` `SubmitTransaction`, `MessageApproval` PDAs, `DWalletContext` CPI) — **`ika-solana-prealpha`**.
- **Production FHE** — pre-alpha is not confidential infra; use future mainnet guidance when it exists.
- **Sui or non-Solana chains** — this skill is the `chains/solana` surface of `encrypt-pre-alpha` only.

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

## Quick reference (hub)

- **On-chain:** first byte = **discriminator**; 22 user ix + `emit_event` **228** — [`instructions.md`](references/instructions.md). Common path: discs 1–4; full metas: [instruction reference](https://docs.encrypt.xyz/).
- **gRPC:** `encrypt.v1.EncryptService` — `CreateInput`, `ReadCiphertext` — [`grpc-api.md`](references/grpc-api.md).
- **Model:** `#[encrypt_fn]` (scalars; **vectors** may be element-wise — [`dsl-vectors.md`](references/dsl-vectors.md)) or `#[encrypt_fn_graph]` → graph → on-chain `execute_graph` and ciphertext flow — [`flows.md`](references/flows.md), [introduction](https://docs.encrypt.xyz/). **Gotchas** / **perf:** [`gotchas.md`](references/gotchas.md), [`performance-caveats.md`](references/performance-caveats.md). **Book + fees:** [`developer-guide-map.md`](references/developer-guide-map.md), [`book-snapshots.md`](references/book-snapshots.md), [`fee-and-state-reference.md`](references/fee-and-state-reference.md).

## common mistakes

| mistake | instead |
| --- | --- |
| Assuming pre-alpha ciphertexts are secret | Treat as **public / plaintext-capable** (book + repo). |
| Assuming vectors always need `#[encrypt_fn_graph]` | Book **Vectors** — element-wise **`#[encrypt_fn]`** with `EUint*Vector` — [`dsl-vectors.md`](references/dsl-vectors.md). If DSL errors (`HasFheTypeId`) or you need graph-only bytes, use **`#[encrypt_fn_graph]`** — [`gotchas.md`](references/gotchas.md). |
| Treating devnet times as FHE benchmarks | **No real FHE** in pre-alpha — see [`performance-caveats.md`](references/performance-caveats.md). |
| Wrong `CreateInput` **authorized** / **network_encryption_public_key** | [`grpc-api.md`](references/grpc-api.md) — **NetworkEncryptionKey** + access rules. |
| **Encrypt** vs **ika** dWallet | ika → **`ika-solana-prealpha`**. |
| Patching the skill when upstream `docs/` moved | **Notify user** — [`docs-revision.md`](references/docs-revision.md). |
| Forgetting **fees / deposits / events** | [`fee-and-state-reference.md`](references/fee-and-state-reference.md), [`book-snapshots.md`](references/book-snapshots.md). |

**Examples:** [encrypt-pre-alpha `chains/solana/examples`](https://github.com/dwallet-labs/encrypt-pre-alpha/tree/main/chains/solana/examples).
