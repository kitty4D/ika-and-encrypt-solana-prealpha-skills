# DSL — operations (in-skill snapshot)

**Normative:** [Operations — Encrypt Developer Guide](https://docs.encrypt.xyz/dsl/operations.html) · source `docs/src/dsl/operations.md` in [`encrypt-pre-alpha`](https://github.com/dwallet-labs/encrypt-pre-alpha). **Live book wins**; refresh with [`docs-revision.md`](docs-revision.md).

---

## Arithmetic

```rust
let sum = a + b;      // Add
let diff = a - b;     // Subtract
let prod = a * b;     // Multiply
let quot = a / b;     // Divide
let rem = a % b;      // Modulo
let neg = -a;         // Negate
```

## Bitwise

```rust
let and = a & b;      // AND
let or = a | b;       // OR
let xor = a ^ b;      // XOR
let not = !a;         // NOT
let shl = a << b;     // Shift left
let shr = a >> b;     // Shift right
```

## Comparison

All comparisons return the **same encrypted type** (0 or 1), not `EBool`:

```rust
let eq = a == b;      // Equal
let ne = a != b;      // Not equal
let lt = a < b;       // Less than
let le = a <= b;      // Less or equal
let gt = a > b;       // Greater than
let ge = a >= b;      // Greater or equal
```

## Method Syntax

Same operations, explicit names:

```rust
let sum = a.add(&b);
let cmp = a.is_greater_or_equal(&b);
let min_val = a.min(&b);
let max_val = a.max(&b);
let rotated = a.rotate_left(&n);
```

## Constants

Bare integer literals are auto-promoted to encrypted constants:

```rust
let incremented = count + 1;       // 1 becomes an encrypted constant
let doubled = value * 2;           // 2 becomes an encrypted constant
```

For explicit construction:

```rust
let one = EUint64::from(1u64);
let big = EUint256::from([0xABu8; 32]);
let vec = EVectorU32::from_elements([1u32, 2, 3, 4]);
let ones = EVectorU64::splat(1u128);
let bits = EBitVector16::from(0b1010u128);
```

Identical constants are automatically deduplicated in the graph.
