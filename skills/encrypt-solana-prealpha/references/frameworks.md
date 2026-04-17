# frameworks and crates (Encrypt Solana)

**Source layout** (see [encrypt-pre-alpha](https://github.com/dwallet-labs/encrypt-pre-alpha) README):

| area | path | role |
| --- | --- | --- |
| Core (chain-agnostic) | `crates/encrypt-types`, `encrypt-dsl`, `encrypt-compute`, `encrypt-service`, `encrypt-grpc` | FHE types, `#[encrypt_fn]` graph IR, mock engine, test harness types, gRPC codegen |
| Solana chain | `chains/solana/program-sdk/`, `chains/solana/dev/`, `chains/solana/test/`, `chains/solana/clients/`, `chains/solana/examples/` | CPI SDKs, `EncryptTxBuilder`, LiteSVM / ProgramTest harness, Rust+TS clients, examples |

---

## on-chain CPI SDKs (same DSL, same `EncryptCpi`)

| framework | crate | notes |
| --- | --- | --- |
| Pinocchio | `encrypt-pinocchio` | `#![no_std]`, CU-focused |
| Native | `encrypt-native` | `solana-program` |
| Anchor | `encrypt-anchor` | `anchor-lang` v1 line per upstream examples |

All three share the **`#[encrypt_fn]`** DSL (from `encrypt-dsl` / Solana DSL wrappers as documented) and the **`EncryptCpi`** trait pattern described in the [CPI framework chapter](https://docs.encrypt.xyz/on-chain/cpi-framework.html). Per-framework prose: [Pinocchio](https://docs.encrypt.xyz/frameworks/pinocchio.html), [Anchor](https://docs.encrypt.xyz/frameworks/anchor.html), [Native](https://docs.encrypt.xyz/frameworks/native.html) — also listed in [`developer-guide-map.md`](developer-guide-map.md).

---

## gRPC / off-chain

- **`encrypt-grpc`** — proto-generated types (Rust).
- **`encrypt_solana_client`** (Rust) — high-level `EncryptClient` (see [`grpc-api.md`](grpc-api.md)).
- **TypeScript** — `@encrypt.xyz/pre-alpha-solana-client` (grpc submodule).

---

## tooling versions (upstream expectations)

- **Rust** edition **2024**
- **Solana CLI 3.x** for `cargo build-sbf`
- **Bun** for TypeScript in the monorepo
- **just** recipes: `just build`, `just test-unit`, `just test-examples`, `just generate-clients`

Confirm versions from repo `rust-toolchain.toml`, `package.json`, and CI before pinning in downstream projects.
