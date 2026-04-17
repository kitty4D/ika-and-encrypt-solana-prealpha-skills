# DSL — FHE types (in-skill snapshot)

**Normative:** [FHE Types — Encrypt Developer Guide](https://docs.encrypt.xyz/dsl/types.html) · source `docs/src/dsl/types.md` in [`encrypt-pre-alpha`](https://github.com/dwallet-labs/encrypt-pre-alpha). Pre-alpha disclaimer and any updates: **live book wins**; refresh this file when you align [`docs-revision.md`](docs-revision.md).

---

## Scalar Types (16)

| Type | Byte Width | Rust Equivalent |
| --- | --- | --- |
| `EBool` | 1 | `u8` (0 or 1) |
| `EUint8` | 1 | `u8` |
| `EUint16` | 2 | `u16` |
| `EUint32` | 4 | `u32` |
| `EUint64` | 8 | `u64` |
| `EUint128` | 16 | `u128` |
| `EUint256` | 32 | `[u8; 32]` |
| `EAddress` | 32 | `[u8; 32]` |
| `EUint512` | 64 | `[u8; 64]` |
| `EUint1024` | 128 | `[u8; 128]` |
| ... up to `EUint65536` | 8192 | `[u8; 8192]` |

## Boolean Vectors (16)

`EBitVector2` through `EBitVector65536` — packed boolean arrays.

## Arithmetic Vectors (13)

`EVectorU8` through `EVectorU32768` — SIMD-style encrypted integer arrays (8,192 bytes each). The book’s **Vectors** chapter uses `EUint*Vector` names in examples and expands operations (`gather`, `scatter`, …) — **in-repo copy:** [`dsl-vectors.md`](dsl-vectors.md).

## Plaintext Types

For inputs that don't need encryption:

| Type | Encrypted Equivalent |
| --- | --- |
| `PBool` | `EBool` |
| `PUint8` | `EUint8` |
| `PUint16` | `EUint16` |
| `PUint32` | `EUint32` |
| `PUint64` | `EUint64` |
| ... | ... |

Plaintext inputs are embedded in the instruction data (not ciphertext accounts).

## Type Safety

Each type has a compile-time `FHE_TYPE_ID`:

- Operations between incompatible types fail at compile time
- The on-chain processor verifies `fhe_type` of each input account matches the graph
- The CPI extension trait verifies `fhe_type` at runtime before CPI
