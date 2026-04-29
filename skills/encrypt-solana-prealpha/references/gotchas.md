# Known Gotchas (community field-tested)

**Source:** Building production FHE programs on Solana devnet (April 2026). All findings verified against pre-alpha executor at `pre-alpha-dev-1.encrypt.ika-network.net:443`.

See also: [`performance-caveats.md`](performance-caveats.md) for timing and REFHE expectations.

---

## Executor Bugs (pre-alpha)

### Vector graph outputs when chained (status uncertain)

When a vector ciphertext produced by one `execute_graph` CPI call is used as an input to a *second* graph, the second graph's vector output may return zeros from `ReadCiphertext` even though the executor commits a non-zero digest (status = 1).

**As of the `f098ac9` pin (2026-04-27):** graphs where all inputs come from fresh `createInput` calls are verified working — the official `chains/solana/examples/vector-ops` e2e tests confirm multi-element vectors round-trip correctly in that case. Whether chained graph → graph vector inputs are also now fixed is not covered by the published examples, so assume this limitation may still apply until you field-test it.

**Root cause (historic):** the executor's internal `MockEncryptor` was truncating all ciphertext data to 16 bytes regardless of FHE type, so vector digests were computed on zeros-padded data. This was fixed in the "Add vector support" commit (2026-04-15). A separate but related client-side encoding bug (16-byte input bytes, no type tag) was fixed in commit `303439d` (2026-04-26) — see [gRPC `CreateInput` requires the 17-byte input format](#grpc-createinput-requires-the-17-byte-input-format) below.

---

## DSL & Macro

### `#[encrypt_fn]` works with vector types directly

As of the "Add vector support" commit (2026-04-15, before the `f779af5` pin), `#[encrypt_fn]` handles `EUint*Vector` types natively — no fallback to `#[encrypt_fn_graph]` needed. Earlier builds had a `HasFheTypeId` trait wiring gap for vector types; that is resolved. See [`dsl-vectors.md`](dsl-vectors.md) for full usage examples.

Use `#[encrypt_fn_graph]` only if you need the raw graph bytecode *without* the Solana CPI wrapper (e.g., for testing with `EncryptContext::execute_graph()` directly). It is not a workaround for vector type support anymore.

### `vector.is_equal(&scalar_input)` silently returns all-false

Comparing a vector against a **runtime ciphertext scalar input** silently produces an all-zero mask. No error, no warning — just wrong results.

| pattern | result |
| --- | --- |
| `vec.is_equal(&EUint128::from(0))` | works (constant in bytecode) |
| `vec.is_equal(&runtime_scalar_ct)` | **all-false** (silent failure) |
| `vec.is_equal(&splatted_vector)` | works (vector-vector comparison) |

Workaround: pass scalar values as splatted vectors (all 512 elements = the value).

```typescript
makeVector128(Array.from({ length: 512 }, () => value))
```

### Static graph binaries must be regenerated

`include_bytes!("graph.bin")` embeds a snapshot. Editing the `.rs` graph source does NOT update the `.bin`. Run `cargo test -- dump_<name>_graph_bytes` after every graph code change. Forgetting silently deploys stale bytecode.

---

## BPF & Solana Limits

### Large graphs OOM on BPF heap

BPF heap is 32 KB. Graphs larger than ~1 KB built at runtime via `#[encrypt_fn_graph]` cause "memory allocation failed, out of memory". A ~9 KB graph (~67 ops) consistently fails.

Fix: dump bytecode via cargo test, embed as `include_bytes!("graph.bin")`, return `&'static [u8]`.

### CPI account creation capped at 10,240 bytes

Accounts created via CPI cannot exceed 10 KB. If you need larger accounts, allocate directly or split across multiple accounts.

### Transaction size limit (1,232 bytes)

With 36+ accounts (9 Encrypt CPI context + inputs + outputs + program accounts), you will exceed the base TX size. Use Address Lookup Tables (ALTs) for static accounts.

---

## Ciphertext Lifecycle

### Two-phase execution (not synchronous)

`execute_graph` does NOT compute FHE inline. It registers the request on-chain. The off-chain executor computes asynchronously (~3–5 s on devnet for small graphs, ~60 s for large), then calls `commit_ciphertext`. Output status byte (offset 99) transitions from 0 (Pending) to 1 (Verified).

You must poll the status byte before reading outputs.

### ReadCiphertext returns a structured response, not a raw byte blob

The gRPC `ReadCiphertextResponse` has three distinct fields — `value`, `fhe_type`, and `digest`. **Do not skip the first byte.** `value` is already the raw plaintext bytes with no type prefix prepended.

```typescript
// TypeScript
const result = await client.readCiphertext(params);
// result.value    → Buffer of raw plaintext bytes (no prefix)
// result.fheType  → number (e.g., 36 for EVectorU128)
// result.digest   → Buffer (32-byte on-chain digest)
const elem0 = result.value.readUInt32LE(0); // direct — no [0] skip
```

```rust
// Rust
let result = client.read_ciphertext(&ct, &[], epoch, &signer).await?;
// result.value     → Vec<u8> of raw plaintext bytes
// result.fhe_type  → FheType enum
// result.digest    → [u8; 32]
let elem0 = u32::from_le_bytes(result.value[0..4].try_into().unwrap());
```

For the on-chain `DecryptionRequest` path (when using `request_decryption` + polling), plaintext data starts at account byte offset 107 — also no type prefix within that slice.

### Ciphertext account on-chain layout (100 bytes)

```
[0..2]:   discriminator + version
[2..34]:  ciphertext_digest (32 bytes)
[34..66]: authorized (32 bytes, zero = public)
[66..98]: network_encryption_public_key (32 bytes)
[98]:     fhe_type (1 byte)
[99]:     status (1 byte, 0=Pending, 1=Verified)
```

Actual encrypted data is stored off-chain by the executor — the on-chain account is metadata only.

### gRPC `CreateInput` requires the 17-byte input format

`EncryptedInput.ciphertext_bytes` (the bytes you submit to `CreateInput`) must be the executor's **legacy 17-byte format**: one `fhe_type` tag byte followed by 16 little-endian value bytes — `[fhe_type(1) || value_le(16)]`. **Without the type tag**, the executor falls into a fallback path that misreads multi-byte scalars: e.g. `EUint64` returns `value >> 8`. Silent in any flow where corruption hides inside encrypted state — surfaced in `pc-token` only when `unwrap_burn` produced a burned amount that mismatched the receipt's plaintext requested amount, trapping SPL deposits in the vault.

**Canonical helpers (use these as templates, do not hand-roll):**

| helper | location | export | status |
| --- | --- | --- | --- |
| `encryptValue(value, fheType)` | `@encrypt.xyz/pre-alpha-solana-client/grpc-web` | npm package | **stale - see warning below** |
| `mockCiphertext(value, fheType)` | `chains/solana/examples/_shared/helpers.ts` | repo demo helper at `f098ac9` and later | **fixed upstream** |

**Watch out: the published npm package lags upstream HEAD.** `@encrypt.xyz/pre-alpha-solana-client@0.1.0` (only version on npm, published 2026-04-03) is the only artifact users can `npm install`, but upstream `chains/solana/clients/typescript/` has accumulated meaningful changes that have **not been republished**:

| upstream fix | commit | status on npm @0.1.0 |
| --- | --- | --- |
| `encryptValue` emits 17 bytes (fhe_type prefix added) | `303439d` (2026-04-26) | **missing — still emits 16 raw bytes** |
| `CreateInputResult.ciphertextIdentifiers` type: `Buffer[]` → `Uint8Array[]` | `6c9f7f9` (2026-04-29) | **missing — npm @0.1.0 still types as `Buffer[]`** |

The first one is a silent-correctness bug (above). The second is a TS-only type mismatch — `Buffer` extends `Uint8Array` so runtime is fine, but anyone typing variables against the upstream `Uint8Array[]` shape (or building under TS 5.7+ strictness) will see compile errors against the npm types until the package bumps.

**Until the package republishes**, importing `encryptValue` from `@encrypt.xyz/pre-alpha-solana-client/grpc-web` gives you the 17-byte bug **regardless of how you call it** (the 2-arg form just gets ignored, the underlying implementation still emits 16 raw bytes). Hand-roll a `mockEncryptScalarBytes(value, fheType)` using the template below, and add a code comment pointing at this gotcha so you can rip it out once the package bumps. The skill's [`docs-revision.md`](docs-revision.md#tracked-npm-package) tracks the package version, and the audit script's `--- npm package vs tracked ---` block prompts a re-review when npm publishes a new version.

**Old single-argument `mockCiphertext(value)` is wrong** — it emitted 16 raw bytes with no type tag. Anything cribbed from pre-`303439d` (2026-04-26) examples needs the `fheType` argument added at every call site.

```typescript
// CORRECT — 17 bytes, fhe_type prefix required
export function mockCiphertext(value: bigint, fheType: number): Uint8Array {
  const buf = new Uint8Array(17);
  buf[0] = fheType;
  let v = value;
  for (let i = 0; i < 16; i++) {
    buf[1 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}
```

The on-chain scalar ciphertext account stores the same 17-byte payload (see [FHE type discriminants](#fhe-type-discriminants)) — input format and on-chain layout are intentionally aligned in pre-alpha.

---

## CPI Integration

### Account ordering for `execute_graph` CPI

`EncryptContext` requires exactly **8** fixed accounts (not 9), followed by input then output ciphertext accounts. **encrypt_program is last, not first. There is no system_program in this set.**

```
[0]:  config                (writable)  — PDA ["encrypt_config"]
[1]:  deposit               (writable)  — PDA ["encrypt_deposit", payer]
[2]:  caller_program        (readonly)  — YOUR on-chain program ID
[3]:  cpi_authority         (readonly, PDA signer) — PDA ["__encrypt_cpi_authority"] from YOUR program
[4]:  network_encryption_key (readonly) — PDA ["network_encryption_key", key_bytes]
[5]:  payer                 (writable, signer)
[6]:  event_authority       (readonly)  — PDA ["__event_authority"]
[7]:  encrypt_program       (readonly)

[8..8+N]:     input ciphertext accounts  (readonly)
[8+N..8+N+M]: output ciphertext accounts (writable)
```

Instruction data: `[opcode=4, graph_len_u16_le, graph_bytes, num_inputs_u8]`

Use the framework SDK (`EncryptContext::execute_graph()`) rather than constructing this manually — it manages the fixed account list. Misordering causes silent CPI failures or wrong account usage.

### Mock network encryption key

Dev executor uses `Buffer.alloc(32, 0x55)` as the mock network encryption key. Must match when creating inputs and deriving the `network_encryption_key` PDA.

### FHE type discriminants

| type | ID | on-chain size |
| --- | ---: | --- |
| EUint128 (scalar) | 5 | 17 bytes (1 type + 16 value) |
| EVectorU128 (512 elements) | 36 | 8,193 bytes (1 type + 8,192 value) |
| EBitVector256 | 23 | — |

### Cross-program composability: receipt-gated vs delegate-allowance

If a calling program needs to gate its own FHE state on whether a transfer in another program **actually succeeded** (without ever seeing the from-balance), use **receipt-gated** composability — `pc-token` instruction `TransferWithReceipt` (disc 22) emits a binary receipt ciphertext (`= amount` on success, `= 0` on insufficient balance) and transfers its `authorized` ACL to a caller-supplied target program. This is what `pc-swap` switched to in upstream commit `425567e` (2026-04-27); the older delegate-allowance sketch in pc-swap docs no longer matches the program. Full pattern: [`flows.md` flow 7](flows.md#flow-7--cross-program-composability-receipt-gated). Use **allowance-based** (`Approve` + `TransferFrom`) only when the calling program just needs *authorized delivery* and does not read downstream state.

---

## SDK Gaps & Undefined Behavior

### FHE graph outputs and token transfers must be separate transactions

Because `execute_graph` is asynchronous (executor commits later), any token transfer in the same instruction as a graph execution cannot depend on the graph result. If the graph's FHE logic would revert a debit (e.g., insufficient encrypted balance), the token transfer still executes.

Split FHE computation and token movement into separate transactions. Wait for executor commit (status byte = 1) before issuing the token transfer.

### Division semantics are undefined

`a / b` on encrypted u128 presumably truncates toward zero, but divide-by-zero behavior is unspecified. Guard with:

```rust
let is_zero = denominator.is_equal_scalar(EUint128::from(0));
let safe_denom = select(is_zero, ONE_VEC, denominator);
let result = numerator / safe_denom;
```

### Vector reductions span the full element count

As of upstream `8b8518d` (2026-04-28), reductions exist as `reduce_add` / `reduce_min` / `reduce_max` (numeric vector → scalar of element type) and `reduce_any` / `reduce_all` (`EUint8Vector` → `EBool`). They collapse a vector down to a real scalar inside a single graph — see [`dsl-vectors.md`](dsl-vectors.md#reductions).

**The reduction always covers every entry of the vector**, not just the populated prefix. Unset slots are treated as `0`, so:

| reduction | effect over a partially-populated vector |
| --- | --- |
| `reduce_min` | always **0** — the unset tail dominates |
| `reduce_all` | always **false** — any unset slot vetoes |
| `reduce_max` | usually fine for prefix workloads (zeros lose) |
| `reduce_add` | usually fine for prefix workloads (zeros add nothing) |
| `reduce_any` | usually fine for prefix workloads (zeros don't trigger) |

**Workaround:** pad the vector with the right sentinel before reducing — typically the **maximum value of the element type** for `reduce_min`, and `1` for `reduce_all`.

### `.get()` returns a vector, not a scalar

`v.get(&index_vec)` extracts a single element by index, but the result is still a **vector type** with the value at position `0` and the rest zero — not a scalar `EUint*`. For genuine vector → scalar of the same type, use the reductions above. If you need a single element as a scalar (rather than a reduction across all elements), there is no in-graph path today — decrypt and re-create a scalar input via gRPC `CreateInput`.
