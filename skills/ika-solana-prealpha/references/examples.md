# upstream example apps (`chains/solana/examples`)

Normative tree: [ika-pre-alpha `chains/solana/examples`](https://github.com/dwallet-labs/ika-pre-alpha/tree/main/chains/solana/examples). Layouts **may drift** from this snapshot — verify instruction bytes in each example’s `lib.rs` / TS e2e against [`instructions.md`](instructions.md) for the **dWallet** program.

Typical layout under `voting/` or `multisig/` (from the book’s examples overview; `multisig` adds **`react/`**):

```text
chains/solana/examples/<name>/
├── anchor/
├── native/
├── pinocchio/
├── quasar/
├── e2e/
└── e2e-rust/
```

## folders

| folder | purpose | subdirs (typical) |
| --- | --- | --- |
| `_shared` | Shared TS / setup for e2e clients | (helpers only) |
| `voting` | On-chain voting sample + e2e per framework | `anchor`, `e2e`, `e2e-rust`, `native`, `pinocchio`, `quasar` — **no `react`** |
| `multisig` | On-chain multisig sample + e2e | same as voting **plus `react`** |
| `protocols-e2e` | **Not** a Solana program sample | Rust binary **`e2e-protocols`** (`cargo run`): gRPC-only E2E vs **mock** server (curves, presign/sign schemes, imported key, etc.) — see crate `src/main.rs` |

Per-framework paths follow `voting/<framework>/` or `multisig/<framework>/` (e.g. `multisig/quasar/`, `voting/anchor/`).

## `protocols-e2e` vs voting/multisig

`protocols-e2e` exercises **SubmitTransaction** / BCS flows against mock gRPC; it does **not** implement the voting or multisig on-chain programs. For CPI + program structure, use **`voting/`** or **`multisig/`** and [`frameworks.md`](frameworks.md).
