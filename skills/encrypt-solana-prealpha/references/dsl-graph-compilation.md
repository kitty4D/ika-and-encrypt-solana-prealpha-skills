# DSL — graph compilation (in-skill snapshot)

**Normative:** [Graph Compilation — Encrypt Developer Guide](https://docs.encrypt.xyz/dsl/graph-compilation.html) · source `docs/src/dsl/graph-compilation.md` in [`encrypt-pre-alpha`](https://github.com/dwallet-labs/encrypt-pre-alpha). **Live book wins**; refresh with [`docs-revision.md`](docs-revision.md).

---

## Binary Format

The `#[encrypt_fn]` macro compiles your function into a binary graph at compile time:

```
[Header 13B] [Nodes N×9B] [Constants section]
```

### Header (13 bytes)

```
version(1) | num_inputs(2) | num_plaintext_inputs(2) | num_constants(2) | num_ops(2) | num_outputs(2) | constants_len(2)
```

Counts are ordered by node kind. `num_nodes` is derived (sum of all counts).

### Nodes (9 bytes each)

```
kind(1) | op_type(1) | fhe_type(1) | input_a(2) | input_b(2) | input_c(2)
```

| Kind | Value | Description |
| --- | ---: | --- |
| Input | 0 | Encrypted ciphertext account |
| PlaintextInput | 1 | Plaintext value in instruction data |
| Constant | 2 | Literal value in constants section |
| Op | 3 | FHE operation |
| Output | 4 | Graph result |

Nodes are topologically sorted — every node's operands appear earlier in the list.

### Constants Section

Variable-length byte blob. Constant nodes reference it by byte offset (`input_a`). Values stored as little-endian bytes at `fhe_type.byte_width()`.

## Example

```rust
#[encrypt_fn]
fn add(a: EUint64, b: EUint64) -> EUint64 { a + b }
```

Produces 4 nodes:

- Node 0: Input (EUint64) — `a`
- Node 1: Input (EUint64) — `b`
- Node 2: Op (Add, EUint64, inputs: 0, 1)
- Node 3: Output (EUint64, source: 2)

Header: `version=1, num_inputs=2, num_constants=0, num_ops=1, num_outputs=1, constants_len=0`

## Registered Graphs

For frequently used graphs, register them on-chain to avoid re-sending graph data:

```rust
ctx.register_graph(graph_pda, bump, &graph_hash, &graph_data)?;
ctx.execute_registered_graph(graph_pda, ix_data, remaining)?;
```

Registered graphs enable exact per-op fee calculation (no max-charge gap).
