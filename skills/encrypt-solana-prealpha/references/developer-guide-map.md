# Encrypt Developer Guide — full topic map

**Purpose:** Every chapter in the published [Encrypt Developer Guide](https://docs.encrypt.xyz/) (mdBook from `docs/src/` in [`encrypt-pre-alpha`](https://github.com/dwallet-labs/encrypt-pre-alpha)). Use this when the task touches **book material** that is not spelled out in `grpc-api.md`, `flows.md`, or `instructions.md` alone (tutorial, DSL, examples, fees, accounts, events).

**In-repo copies:** [`book-snapshots.md`](book-snapshots.md) lists markdown snapshots (DSL, concepts, accounts, events, fees).

**Rule:** Prefer the **live book** for prose, layouts, and tables; this file is a **routing index** only.

---

## getting started

| Chapter | URL | Load when |
| --- | --- | --- |
| Introduction | https://docs.encrypt.xyz/introduction | Product model, five-step lifecycle, framework table |
| Installation | https://docs.encrypt.xyz/getting-started/installation.html | Toolchain, deps, disclaimers |
| Quick Start | https://docs.encrypt.xyz/getting-started/quick-start.html | First program / minimal path |
| Core Concepts | https://docs.encrypt.xyz/getting-started/concepts.html | Ciphertext layout, graph, executor/decryptor, ACL, digest verification — [`concepts-core.md`](concepts-core.md) |

---

## tutorial: confidential voting

| Chapter | URL | Load when |
| --- | --- | --- |
| Overview | https://docs.encrypt.xyz/tutorial/overview.html | End-to-end voting design, update mode, digest pattern |
| Create the Program | https://docs.encrypt.xyz/tutorial/create-program.html | Scaffolding |
| Write FHE Logic | https://docs.encrypt.xyz/tutorial/fhe-logic.html | `#[encrypt_fn]` in app context |
| Create Proposal | https://docs.encrypt.xyz/tutorial/create-proposal.html | |
| Cast Votes | https://docs.encrypt.xyz/tutorial/cast-votes.html | |
| Decrypt Results | https://docs.encrypt.xyz/tutorial/decrypt-results.html | |
| Testing | https://docs.encrypt.xyz/tutorial/testing.html | `EncryptTestContext`, lifecycle tests |

---

## writing FHE programs (DSL)

| Chapter | URL | Load when |
| --- | --- | --- |
| The DSL | https://docs.encrypt.xyz/dsl/overview.html | `#[encrypt_fn]` (Solana + CPI trait) vs `#[encrypt_fn_graph]` (graph bytes only); plaintext inputs — link-only |
| Types | https://docs.encrypt.xyz/dsl/types.html | `EUint*`, `EBool`, `PUint*`, **`EVector*` (arithmetic vectors / SIMD-style arrays, 8,192-byte payloads), `EBitVector*` (packed bools)**, `FHE_TYPE_ID` — **in-repo copy:** [`dsl-types.md`](dsl-types.md) |
| Operations | https://docs.encrypt.xyz/dsl/operations.html | Scalar **and vector** arithmetic; `from_elements`, `splat`, bitmask constructors — [`dsl-operations.md`](dsl-operations.md) |
| Constants | https://docs.encrypt.xyz/dsl/constants.html | Literals / const in graphs; **vector** `from_elements` / `splat` / `EBitVector*` — [`dsl-constants.md`](dsl-constants.md) |
| Vectors | https://docs.encrypt.xyz/dsl/vectors.html | Element-wise `#[encrypt_fn]` on `EUint*Vector`, gather/scatter, gRPC `CreateInput`, limits — **in-repo copy:** [`dsl-vectors.md`](dsl-vectors.md) |
| Conditionals | https://docs.encrypt.xyz/dsl/conditionals.html | Branches in FHE — [`dsl-conditionals.md`](dsl-conditionals.md) |
| Graph Compilation | https://docs.encrypt.xyz/dsl/graph-compilation.html | IR, serialization, limits — [`dsl-graph-compilation.md`](dsl-graph-compilation.md) |

---

## on-chain integration

| Chapter | URL | Load when |
| --- | --- | --- |
| Ciphertext Accounts | https://docs.encrypt.xyz/on-chain/ciphertexts.html | Account layout, statuses, creation paths |
| Access Control | https://docs.encrypt.xyz/on-chain/access-control.html | `authorized`, transfer/copy/public |
| Execute Graph | https://docs.encrypt.xyz/on-chain/execute-graph.html | Inline vs registered graph, CPI metas |
| Decryption | https://docs.encrypt.xyz/on-chain/decryption.html | Gateway ix flow, verification |
| CPI Framework | https://docs.encrypt.xyz/on-chain/cpi-framework.html | `EncryptCpi`, builder patterns |

---

## framework guides

| Chapter | URL | Load when |
| --- | --- | --- |
| Pinocchio | https://docs.encrypt.xyz/frameworks/pinocchio.html | `no_std`, CU |
| Anchor | https://docs.encrypt.xyz/frameworks/anchor.html | Declarative accounts |
| Native | https://docs.encrypt.xyz/frameworks/native.html | `solana-program` |
| Quasar | https://docs.encrypt.xyz/frameworks/quasar.html | Zero-copy Quasar programs, `EncryptContext`, `.to_account_view()` |

---

## testing

| Chapter | URL | Load when |
| --- | --- | --- |
| Test Framework | https://docs.encrypt.xyz/testing/test-framework.html | LiteSVM, `EncryptTestContext`, `process_pending` |
| Mock vs Real FHE | https://docs.encrypt.xyz/testing/mock-vs-real.html | Mock engine behavior vs production intent |

---

## examples (book walkthroughs)

| Example | URL | Load when |
| --- | --- | --- |
| Examples overview | https://docs.encrypt.xyz/examples/overview.html | Which example fits |
| Confidential Counter | https://docs.encrypt.xyz/examples/counter/01-overview.html | (+ program / testing / react subpages) |
| Encrypted Coin Flip | https://docs.encrypt.xyz/examples/coin-flip/01-overview.html | Escrow, betting, React |
| Confidential Voting | https://docs.encrypt.xyz/examples/voting/01-overview.html | Parallels tutorial + E2E |
| Encrypted ACL | https://docs.encrypt.xyz/examples/acl/01-overview.html | Access patterns |
| PC-Token | https://docs.encrypt.xyz/examples/pc-token/01-overview.html | Repo: `chains/solana/examples/pc-token/` |
| PC-Swap | https://docs.encrypt.xyz/examples/pc-swap/01-overview.html | Repo: `chains/solana/examples/pc-swap/` |

Subpages under each example follow `02-program.html`, `03-testing.html`, etc., on the same path prefix.

---

## reference (machine-level)

| Chapter | URL | Load when |
| --- | --- | --- |
| Instructions | https://docs.encrypt.xyz/reference/instructions.html | Account order, data layout (see also [`instructions.md`](instructions.md)) |
| Accounts | https://docs.encrypt.xyz/reference/accounts.html | Seven account types, offsets, PDAs — [`reference-accounts.md`](reference-accounts.md) |
| Events | https://docs.encrypt.xyz/reference/events.html | Five event kinds, `emit_event` / self-CPI — [`reference-events.md`](reference-events.md) |
| Fee model | https://docs.encrypt.xyz/reference/fees.html | ENC + SOL gas, `EncryptDeposit`, reimburse — [`reference-fees.md`](reference-fees.md); orient [`fee-and-state-reference.md`](fee-and-state-reference.md) |

---

## repo parity

Example **source** paths (not a substitute for the book): `chains/solana/examples/` in `encrypt-pre-alpha` (Pinocchio / Anchor / Native / Quasar variants per example when upstream ships them). Book **PC-Token** / **PC-Swap** ↔ `pc-token/`, `pc-swap/` on disk.
