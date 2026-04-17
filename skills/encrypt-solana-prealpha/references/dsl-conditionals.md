# DSL — conditionals (in-skill snapshot)

**Normative:** [Conditionals — Encrypt Developer Guide](https://docs.encrypt.xyz/dsl/conditionals.html) · source `docs/src/dsl/conditionals.md` in [`encrypt-pre-alpha`](https://github.com/dwallet-labs/encrypt-pre-alpha). **Live book wins**; refresh with [`docs-revision.md`](docs-revision.md).

---

FHE doesn't support branching — both paths are always evaluated. The `if`/`else` syntax compiles to a **select** operation.

## Syntax

```rust
let result = if condition { value_a } else { value_b };
```

**Rules:**

- Both branches must be the **same encrypted type**
- Condition must be an encrypted comparison result (0 or 1)
- `else` is **mandatory** — no bare `if`
- Both branches are always evaluated (FHE requirement)

## Example

```rust
#[encrypt_fn]
fn conditional_transfer(
    from: EUint64,
    to: EUint64,
    amount: EUint64,
) -> (EUint64, EUint64) {
    let has_funds = from >= amount;
    let new_from = if has_funds { from - amount } else { from };
    let new_to = if has_funds { to + amount } else { to };
    (new_from, new_to)
}
```

This compiles to:

1. `has_funds = IsGreaterOrEqual(from, amount)` → 0 or 1
2. `from_minus = Subtract(from, amount)`
3. `to_plus = Add(to, amount)`
4. `new_from = Select(has_funds, from_minus, from)`
5. `new_to = Select(has_funds, to_plus, to)`

Both `from - amount` and `from` are computed; `Select` picks one based on the condition.

## Nested Conditionals

```rust
let tier = if amount >= 1000 {
    3
} else if amount >= 100 {
    2
} else {
    1
};
```

Each `if`/`else` becomes a `Select` operation. Nested conditionals produce a chain of `Select` nodes.
