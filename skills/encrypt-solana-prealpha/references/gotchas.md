# Known Gotchas (community field-tested)

**Source:** Building production FHE programs on Solana devnet (April 2026). All findings verified against pre-alpha executor at `pre-alpha-dev-1.encrypt.ika-network.net:443`.

See also: [`performance-caveats.md`](performance-caveats.md) for timing and REFHE expectations.

---

## Executor Bugs (pre-alpha)

### Vector graph outputs when chained (status uncertain)

When a vector ciphertext produced by one `execute_graph` CPI call is used as an input to a *second* graph, the second graph's vector output may return zeros from `ReadCiphertext` even though the executor commits a non-zero digest (status = 1).

**As of the `f779af5` pin (2026-04-17):** graphs where all inputs come from fresh `createInput` calls are verified working — the official `chains/solana/examples/vector-ops` e2e tests confirm multi-element vectors round-trip correctly in that case. Whether chained graph → graph vector inputs are also now fixed is not covered by the published examples, so assume this limitation may still apply until you field-test it.

**Root cause (historic):** `MockEncryptor` was truncating all ciphertext data to 16 bytes regardless of FHE type, so vector digests were computed on zeros-padded data. This was fixed in the "Add vector support" commit (2026-04-15). The same fix likely resolved the chained case, but there is no e2e test to confirm.

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

### ReadCiphertext response has a type prefix

gRPC `ReadCiphertext` returns `[fhe_type_byte][raw_value_bytes]`. For vectors: byte 0 = `0x24` (type 36), bytes 1..8193 = 512 x 16-byte u128 LE values. For scalars: byte 0 = type code, bytes 1..17 = value. Skip the first byte when parsing.

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

---

## CPI Integration

### Account ordering for `execute_graph` CPI

`EncryptContext` requires exactly 9 accounts in fixed order, followed by graph inputs and outputs:

```
[0]:  encrypt_program       (readonly)
[1]:  config                (writable)  — PDA ["encrypt_config"]
[2]:  deposit               (writable)  — PDA ["encrypt_deposit", payer]
[3]:  cpi_authority         (readonly, PDA signer) — PDA ["__encrypt_cpi_authority"] from YOUR program
[4]:  caller_program        (readonly)  — YOUR program ID
[5]:  network_encryption_key (readonly) — PDA ["network_encryption_key", key_bytes]
[6]:  payer                 (writable, signer)
[7]:  event_authority       (readonly)  — PDA ["__event_authority"]
[8]:  system_program        (readonly)

[9..9+N]:     input ciphertext accounts
[9+N..9+N+M]: output ciphertext accounts
```

Instruction data: `[opcode=4, graph_len_u16_le, graph_bytes, num_inputs_u8]`

Misordering causes silent CPI failures or wrong account usage.

### Mock network encryption key

Dev executor uses `Buffer.alloc(32, 0x55)` as the mock network encryption key. Must match when creating inputs and deriving the `network_encryption_key` PDA.

### FHE type discriminants

| type | ID | on-chain size |
| --- | ---: | --- |
| EUint128 (scalar) | 5 | 17 bytes (1 type + 16 value) |
| EVectorU128 (512 elements) | 36 | 8,193 bytes (1 type + 8,192 value) |
| EBitVector256 | 23 | — |

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

### No vector reduction operations

`.sum()`, `.any()`, `.max()` do not exist in the SDK — no operation collapses a full vector to a scalar in a single graph (confirmed on the roadmap in [`dsl-vectors.md`](dsl-vectors.md)).

**Partial workaround — single element:** use `.get(&index_vec)` to extract one element; the result is a vector where position 0 holds the value and the rest are zero. That is still a vector type, not a scalar — if you need a scalar `EUint*`, you have to decrypt the output and re-create a scalar input via gRPC.

If you need a true scalar derived from a full vector aggregation, the only path today is: decrypt the vector, compute the reduction client-side, feed the result back as a new scalar `createInput`.
