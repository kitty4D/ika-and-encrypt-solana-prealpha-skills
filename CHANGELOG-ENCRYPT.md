# changelog - `encrypt-solana-prealpha` skill

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
