# changelog - `encrypt-solana-prealpha` skill

## 2026-04-28 - bump pin to `8b8518d`: vector reductions and rotate_entries land upstream

### what upstream did

2 commits, focused doc-and-DSL update for vector ops. ya girl is so back lol:

- **finally has reductions:** `reduce_add` / `reduce_min` / `reduce_max` collapse a numeric vector to a scalar of the element type, `reduce_any` / `reduce_all` go from `EUint8Vector` to `EBool`. mhm, no more decrypt-and-aggregate-clientside workarounds for full-vector aggregations.
- **new `rotate_entries(&n)` op:** cyclic left rotation by an encrypted scalar shift count. wraps within the vector's element count.
- **subtle gotcha:** reductions span the **full element count** of the vector, not just the populated prefix. unset slots are 0, so `reduce_min` over a partially-filled vector is always 0 and `reduce_all` is always false unless you pad with sentinels. the rest of the reductions (`add` / `max` / `any`) are usually fine for prefix workloads bc zeros don't dominate.
- **5 new `FheOperation` discriminators** (96 + 110-114) plus `is_reduction()` / `result_type()` helpers. new `Reduction` / `CrossEntry` / `LinearAlgebra` traits in `encrypt-dsl`. e2e example coverage for the new ops in `chains/solana/examples/vector-ops/pinocchio/`.

### what we changed in this skill (files)

- `skills/encrypt-solana-prealpha/references/docs-revision.md` - pinned `docs/` to **`8b8518d119a674bb28cf4d89a5f971693899c973`** (was **`f098ac9...`**, 2026-04-27). upstream commit date 2026-04-28, recorded 2026-04-28.
- `skills/encrypt-solana-prealpha/references/dsl-vectors.md` - refreshed the book snapshot:
  - added `### Rotate Entries` subsection under "Vector-Specific Operations" (the cyclic left rotation op).
  - added new top-level `## Reductions` section with three subsections: Sum/Min/Max, Boolean Reductions, Composing Reductions. includes the unset-slots-are-zero caveat that bites `reduce_min` / `reduce_all` over partial-prefix vectors.
  - dropped two now-incorrect bullets from `## Limitations`: "No reductions" and "No cross-type extraction" (reductions exist now; cross-type extraction was never the right framing for the `.get()` behavior).
- `skills/encrypt-solana-prealpha/references/gotchas.md` - replaced the now-wrong "No vector reduction operations" section in **SDK Gaps & Undefined Behavior** with two cleaner sections:
  - `### Vector reductions span the full element count` - the real gotcha now is the unset-slots-as-zero behavior, with a per-reduction table of which ones are safe over a prefix and which need padding.
  - `### .get() returns a vector, not a scalar` - kept the `.get()` extraction note that used to live inside the old reductions section, since `.get()` still returns a vector even though reductions return real scalars now.

### what we did NOT change

- `references/grpc-api.md`, `instructions.md`, `flows.md` - proto + user-ix surface unchanged.
- canonical env (program id, gRPC URL, Solana RPC URL) - unchanged.
- `dsl-operations.md` / `dsl-types.md` snapshots - upstream `operations.md` and `types.md` did not change in these 2 commits, so the snapshots stay in sync. the new ops live on traits in code; the published operations chapter wasn't touched.
- no new drift rules - the "still hand-rolling clientside reductions" pattern doesn't have a precise mechanical signature (every codebase invents its own loop), so the audit script can't reliably flag it. lowercase rip.

### audit status

`node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=.` reports **`docs/ vs main: fresh`**, drift block clean, exit 0. tests still 196/196.

---

## 2026-04-28 - bump pin to `f098ac9`: 17-byte input format gotcha + receipt-gated composability

### what upstream did

5 commits, 24 files. ya girl is gonna break it down lol:

- **`303439d` (2026-04-26) - mock ciphertext encoding fix.** `mockCiphertext` and grpc-web's `encryptValue` were emitting **16 raw bytes with no type tag**. silent bug for multi-byte scalars: executor falls into a fallback that returns `value >> 8` for `EUint64`. surfaced in pc-token only when `unwrap_burn`'s burned amount mismatched the receipt's plaintext requested amount, trapping SPL deposits in the vault. fixed: now both helpers emit **17 bytes `[fhe_type(1) || value_le(16)]`**. hella important for anyone hand-rolling client-side mock encryption.
- **`43949cc` (2026-04-26) - sync `encrypt-service` from encrypt.** added `plaintext_bytes: Vec<u8>` field to `CiphertextCreatedRequest`. internal executor crate state - pre-alpha doesn't ship the listener/executor itself. **not user-facing** for skill consumers. skipped in skill updates.
- **`0c4d63e` / `425567e` / `f098ac9` (2026-04-27) - receipt-gated composability** between `pc-token` and `pc-swap`. new pc-token instruction `TransferWithReceipt` (disc 22) emits a binary receipt ciphertext (= amount on success, 0 on insufficient balance) and transfers its `authorized` ACL to a caller-supplied `target_program`. pc-swap now gates every reserve/payout/LP-supply update on the receipt - a lying user yields receipt = 0, so all gated values collapse to 0 uniformly. **replaces** the older delegate-allowance composability sketch in pc-swap docs (which never matched the real program lol). docs rewrites in `pc-swap/01-03` and `pc-token/01-03`.

### what we changed in this skill (files)

- **`skills/encrypt-solana-prealpha/references/docs-revision.md`** - pinned `docs/` to **`f098ac9e61fb9b39b457b860f33382f44ae9d65b`** (was **`f779af5...`**, 2026-04-16). upstream commit date 2026-04-27, recorded 2026-04-28.
- **`skills/encrypt-solana-prealpha/references/gotchas.md`** - added section **"gRPC `CreateInput` requires the 17-byte input format"** under Ciphertext Lifecycle, with canonical helper table and corrected `mockCiphertext` template. added section **"Cross-program composability: receipt-gated vs delegate-allowance"** under CPI Integration, pointing at `flows.md` flow 7. corrected the historic-bug note in "Vector graph outputs when chained" to distinguish executor-side `MockEncryptor` truncation (pre-`f779af5`, fixed) from the new client-side `mockCiphertext` bug (`303439d`, also fixed).
- **`skills/encrypt-solana-prealpha/references/grpc-api.md`** - documented the 17-byte `ciphertext_bytes` format on `EncryptedInput`, with helper references and a link to gotchas. updated TS client snippet to show `encryptValue(value, fheType)` usage end-to-end.
- **`skills/encrypt-solana-prealpha/references/flows.md`** - added the 17-byte format requirement to flow 2 (ciphertext creation). added new **flow 7 - cross-program composability (receipt-gated)** describing the source-program / caller-program halves of the `TransferWithReceipt` pattern, with a "when to prefer allowance-based" note for streaming-payments-style flows that just need authorized delivery.
- **`skills/encrypt-solana-prealpha/SKILL.md`** - common-mistakes table got two new rows: hand-rolling 16-byte `ciphertext_bytes` (silent bug), and reaching for `Approve` + `TransferFrom` when receipt-gated would be more accurate.
- **`skills/encrypt-solana-prealpha/references/drift-rules.mjs`** - two new rules:
  - `enc-mock-ciphertext-16-byte-no-type-tag` (high, silent-bug) - flags single-arg `mockCiphertext(value)` / `encryptValue(value)` calls and hand-rolled `new Uint8Array(16)` near ciphertext mentions. since 2026-04-28.
  - `enc-pc-swap-delegate-allowance-stale-pattern` (medium, missing-feature) - flags pc-swap mentions paired with allowance/transfer_from/approve/delegate that don't already mention `TransferWithReceipt` or receipt-gated terms. since 2026-04-28.

### what we did NOT change

- **no `book-snapshots.md` snapshots** affected. all 6 changed `docs/` files are example walkthroughs (pc-swap, pc-token), which are already **link-only / keep in book** per `book-snapshots.md` and `developer-guide-map.md`. no DSL or reference chapters changed.
- **no public Encrypt program instruction changes**. `create_plaintext_ciphertext` (disc 2) was already documented; the new `TransferWithReceipt` instruction is part of the **pc-token program**, not the Encrypt program itself - so `instructions.md` (which is the Encrypt program reference) stays put.
- **no public gRPC API surface changes**. `CreateInput` / `ReadCiphertext` proto unchanged - only the `ciphertext_bytes` encoding for scalar inputs needed clarifying (which was always the rule, just silently buggy in the helpers).
- **no canonical environment changes**. program id, gRPC URL, RPC URL all unchanged.

### audit status

`node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=.` reports **`docs/ vs main: fresh`**, drift block clean, exit 0. mhm that's right :3

---

## 2026-04-26 - CSO: hub + yaml description

### what changed

- **`SKILL.md`** — `description` is **triggers and symptoms only** (audit workflow not summarized there; one-line entry in **Overview** + existing [`audit.md`](skills/encrypt-solana-prealpha/references/audit.md)). new **Overview** and **When to use**; **pre-alpha disclaimer** and **When NOT to use** de-duped so ika routing is not repeated twice. old **quick pointers** folded into **Quick reference (hub)** to save words without dropping links.
- **no** `docs-revision.md` pin change; no new reference file.

---

## 2026-04-21 - correct stale vector gotchas (no upstream pin change, same `f779af5`)

### what changed

**`skills/encrypt-solana-prealpha/references/gotchas.md`** - removed two now-wrong vector gotchas and corrected a third:

- **removed: "vector ciphertext data loss"** - the `MockEncryptor` slot-0-only truncation bug was fixed in upstream commit `"Add vector support"` (2026-04-15, before our current pin). `mock_crypto.rs` now uses `fhe_type.byte_width()` so all vector slots round-trip correctly. the official `chains/solana/examples/vector-ops` e2e tests confirm elements at indices 1+ work.

- **removed: `#[encrypt_fn]` + `HasFheTypeId` workaround** - vectors work with `#[encrypt_fn]` directly as of the same 2026-04-15 fix. the "fall back to `#[encrypt_fn_graph]`" advice was obsolete. replaced with a positive note that `#[encrypt_fn_graph]` is only needed if you want raw bytecode without the Solana CPI wrapper.

- **updated: "no vector reduction operations"** - still accurate (no `.sum()` / `.any()` / `.max()`), but added `.get()` as a partial single-element workaround; clarified that the result is still a vector type, not a scalar.

- **kept: "vector graph outputs when chained"** - the e2e example always uses fresh `createInput` inputs, so chained graph → graph vector behavior is unverified at this pin. may also be fixed by the same `byte_width` commit, but not confirmed.

- **kept: `vector.is_equal(&scalar_input)` silently returns all-false** - no upstream contradiction found.

- **fixed: "ReadCiphertext response has a type prefix"** - wrong. the proto now returns a structured `ReadCiphertextResponse` with separate `value` (raw bytes), `fhe_type` (uint32), and `digest` (bytes) fields. `value` has no fhe_type byte prepended - "skip the first byte" was incorrect and would mis-parse the result. corrected with working TypeScript + Rust examples.

- **fixed: "Account ordering for execute_graph CPI"** - wrong on two counts: (1) the fixed account count is 8, not 9 - no `system_program` in the execute_graph fixed set; (2) the order is completely different: `config, deposit, caller_program, cpi_authority, nk, payer, event_authority, encrypt_program` (encrypt_program is last, not first as the old gotcha stated). confirmed from pinocchio SDK `cpi.rs`.

### no docs-revision.md change

upstream `main` is still at `f779af5` - this is a skill correction based on inspecting the pinned source code, not a new upstream `docs/` commit.

---

## 2026-04-17 - align with encrypt-pre-alpha `main` @ `f779af5`

### what upstream did (the short version)

`encrypt-pre-alpha` picked up a **`quasar`** commit on **`main`** that touches **`docs/`**: **`SUMMARY.md`** (nav), **`examples/overview.md`**, **`frameworks/pinocchio.md`**, and a **new** **`frameworks/quasar.md`** - so the published [Encrypt Developer Guide](https://docs.encrypt.xyz/) now lists **Quasar** next to Pinocchio / Anchor / Native for on-chain CPI. same pre-alpha disclaimers apply (exploration, no production confidentiality, etc.).

### what we changed in this skill (files)

- **`skills/encrypt-solana-prealpha/references/docs-revision.md`** - pinned **`docs/`** to **`f779af5b2ffb33ad3902dc69cbbe6922bdc8b479`** (was **`86d1f08…`**, 2026-04-15).

- **`skills/encrypt-solana-prealpha/references/frameworks.md`** - added **`encrypt-quasar`** / **Quasar** row; aligned table order with the book (**Pinocchio → Anchor → Native → Quasar**); linked [frameworks/quasar.html](https://docs.encrypt.xyz/frameworks/quasar.html); “all three” → **these frameworks** so the copy matches four CPI paths.

- **`skills/encrypt-solana-prealpha/references/developer-guide-map.md`** - **Framework guides** table: **Quasar** chapter URL + load hint; **repo parity** line mentions Quasar where upstream ships variants.

- **`skills/encrypt-solana-prealpha/references/flows.md`** - flow 6 examples line: **Quasar** alongside the other framework variants (when present upstream per example).

- **`skills/encrypt-solana-prealpha/references/audit.md`** · **`scripts/audit-encrypt-solana-prealpha.mjs`** - “skill package” repo root wording (same idea as the ika audit script), not the old standalone repo name.

### verification

**`node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs`** → **`docs/ vs main: fresh`** until **`encrypt-pre-alpha` `main`** moves again.
