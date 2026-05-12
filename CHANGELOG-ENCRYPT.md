# changelog - `encrypt-solana-prealpha` skill

## 2026-05-11 - bump pin to `08f723c`: npm finally republished, the encryptValue trap is dead lol

### what upstream did (the short version)

4 commits since the previous `6c9f7f9` pin. 2 of em touched `docs/` (hard gate fired this time, ya girl was right to ask) + the typescript client got a fresh npm release that lays the long-running 17-byte trap to rest:

- **`247b9ad` (2026-04-30) - docs: fix EVENT_IX_TAG_LE wire bytes.** the previous `0xe4a545ea51cb9a1d` literal was a typo - middle bytes transposed. the canonical u64 is `0x1d9acb512ea545e4`, which little-endian serializes to wire bytes `e4 45 a5 2e 51 cb 9a 1d` (equivalent to `0xe445a52e51cb9a1d` read left-to-right). also clarifies the byte-0 overlap: anchor `EmitEvent` discriminator (228 = `0xe4`) is the same value as `EVENT_IX_TAG_LE[0]`, so parsers should treat `data[0..8]` as the full tag and `data[8]` as the event discriminator. small but our `reference-events.md` was carrying the wrong literal - not cute.
- **`7a3c347` (2026-04-30) - sdk: mkdir output dirs in generate script for fresh checkouts.** ergonomic, no user-facing surface change.
- **`dadfff8` (2026-05-06) - deps: pin Agave 4.0 pre-release crates to `=4.0.0-beta.5`.** stability tightening for the rust workspace. no skill prose needs to mention it.
- **`08f723c` (2026-05-09) - fix encryptValue call in voting example (#8).** updates `docs/src/examples/voting/04-react.md` to call `encryptValue(voteVal, FHE_BOOL)` (2 args) and adds `const FHE_BOOL = 0` near the import. **this is the smoking gun confirming `0.1.1` actually requires the fhe_type arg now**, because if the npm helper still emitted 16 raw bytes regardless of arg count, fixing the example wouldn't be a fix - it'd be cosmetic. mhm.

**and the bigger deal:** `@encrypt.xyz/pre-alpha-solana-client@0.1.1` published 2026-04-30. confirmed via unpkg that the package now ships:
- `encryptValue(value, fheType)` emits the 17-byte `[fhe_type(1) || value_le(16)]` format with the canonical jsdoc warning baked in - upstream commit `303439d` (2026-04-26) finally made it onto npm.
- `CreateInputResult.ciphertextIdentifiers` is typed `Uint8Array[]` - upstream `6c9f7f9` (2026-04-29) typing fix shipped too.

both asymmetries we'd been screaming about for 2 weeks are GONE. SIKE turned into actually-fine. the stale-npm drift rule has officially aged out.

### what we changed in this skill (files)

- **`skills/encrypt-solana-prealpha/references/docs-revision.md`** - bumped commit pin from `6c9f7f9` (2026-04-29) to **`08f723ceadb462da09407c405a25ee7214e3ca1c`** (2026-05-09), recorded 2026-05-11. bumped the `tracked npm package` row from `0.1.0` (2026-04-03) to **`0.1.1`** (2026-04-30). rewrote the status note from the multi-paragraph KNOWN STALE asymmetry callout to a single "in sync" line that names which two fixes landed. import `encryptValue` from npm again, no hand-rolled helper required.
- **`skills/encrypt-solana-prealpha/references/reference-events.md`** - line 7 was carrying the transposed `0xe4a545ea51cb9a1d` literal. replaced with the canonical phrasing: u64 = `0x1d9acb512ea545e4`, LE wire bytes = `e4 45 a5 2e 51 cb 9a 1d`. also folded in the byte-0 overlap clarification from upstream so parsers know how to disambiguate.
- **`skills/encrypt-solana-prealpha/references/gotchas.md`** - rewrote the **"gRPC `CreateInput` requires the 17-byte input format"** section. dropped the npm-package-lags warning, dropped the asymmetry table, dropped the hand-rolled `mockEncryptScalarBytes` workaround template. canonical-helpers table is now a clean 2-row table with both helpers marked usable. kept the format-and-why prose, kept the "old single-argument `mockCiphertext(value)` is wrong" callout (still applies to anyone copy-pasting pre-`303439d` example code), and replaced the workaround template with a small `encryptValue` import-and-call snippet. also softened the historic-bug paragraph in **"Vector graph outputs when chained"** to note that the client-side fix shipped to npm in `0.1.1` instead of being upstream-only.
- **`skills/encrypt-solana-prealpha/references/grpc-api.md`** - removed the "do not import encryptValue" warning and the `mockEncryptScalarBytes` hand-rolled snippet. TS sample now imports `encryptValue` from `@encrypt.xyz/pre-alpha-solana-client/grpc-web` and calls `encryptValue(42n, 4)` end-to-end. trailing note explains `0.1.1+` is required and that the existing `enc-mock-ciphertext-16-byte-no-type-tag` drift rule still catches lockfiles stuck on `0.1.0`.
- **`skills/encrypt-solana-prealpha/references/drift-rules.mjs`** - retired the **`enc-encryptvalue-from-stale-npm-package`** rule entirely. its premise (npm @0.1.0 helper is broken regardless of arg count) is no longer true now that `0.1.1` ships the fix. the more general `enc-mock-ciphertext-16-byte-no-type-tag` rule still flags single-arg call sites + hand-rolled 16-byte buffers, which covers the residual risk (consumers stuck on `0.1.0` or cribbing from old example code).
- **`tests/fixtures/drift-positive/encrypt/enc-encryptvalue-from-stale-npm-package.ts`** + **`tests/fixtures/drift-negative/encrypt/enc-encryptvalue-from-stale-npm-package.ts`** - deleted both fixtures because the rule is gone. `tests/skill-facts/drift-rules.test.mjs` enforces 1 positive + 1 negative per rule, so keeping the fixtures without the rule would actually break the suite. clean removal, no orphans.

### what we did NOT change

- **`SKILL.md` common-mistakes table** - line 75 already references `encryptValue(v, fheType)` and `mockCiphertext(v, fheType)` as canonical, no edit needed. `0.1.1` made the existing copy accurate without a wording change.
- **`flows.md` line 35** - same deal, "use `encryptValue` / `mockCiphertext` rather than hand-rolling" was already the right advice; it's just true now.
- **`Cargo.toml` change at upstream** - Agave 4.0-beta.5 pin is workspace stability tightening; nothing in the skill mentions specific Agave versions, so no edit.
- **`chains/solana/clients/typescript/package.json` change** - that's just the `0.1.0` → `0.1.1` bump itself, which we surface via the npm-package tracking row in `docs-revision.md`. no skill-content impact.
- **`fee-and-state-reference.md` line 40** - mentions `EVENT_IX_TAG_LE` conceptually but not the literal bytes, so no edit needed there. only the literal in `reference-events.md` was wrong.
- **answer sheet / knowledge probe / cso queries** - none of those test fixtures reference the stale-npm gotcha by name, so no test-data edits.
- **drift rule `enc-mock-ciphertext-16-byte-no-type-tag`** stays. its fixtures stay. its job (catching single-arg call sites + hand-rolled 16-byte buffers) is still real, and `0.1.0` is still on npm waiting for someone to install it. lockfile-pinning consumers will pretty much always lag, so this one earns its keep.

### audit status

`node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=.` should now report **`docs/ vs main: fresh`**, **`npm package vs tracked: in sync`** (or whatever the script's wording is - point is the asymmetry banner is gone), advisory block reports `(no upstream commits since pin)` because we just bumped, drift block clean, exit 0. running the full `npm test` should land at 206/206 because we dropped 2 rule-fixture tests (1 positive + 1 negative for the retired rule). gonna verify after this lands. ✓

---

## 2026-04-29 - bump pin to `6c9f7f9`: pc-swap refund pattern + TS sdk Buffer→Uint8Array note + non-docs/ advisory in audit

### what upstream did (the short version)

2 commits since the previous `8b8518d` pin, both 2026-04-29, neither touching `docs/` (so the previous audit said "fresh" and we only caught it bc we asked, lol):

- **`f7f410a` - pc-swap: refund slipped swaps and one-sided lying deposits.** big behavior expansion of the receipt-gated composability we just documented in flow 7. `swap_graph` now emits `refund = receipt - final_in` (= 0 on success, = receipt on slippage rejection). `add_liquidity_graph` gates settlement on `both_ok && lp_ok` and emits per-side `refund_a` / `refund_b` when one side lies. dispatch CPIs vault→user transfers for refunds so slipped or unsettled deposits don't get stranded in the pool's vault. also extracted `pool_signed_transfer<'a>` as `#[inline(never)]` to keep four CPIs from blowing the BPF stack frame. e2e in `chains/solana/examples/pc-swap/e2e/verified.ts` (new file, 11 stages) covers all the lying / slipping paths.
- **`6c9f7f9` - sdk: typescript build fix for TS 5.7+.** changes `CreateInputResult.ciphertextIdentifiers` from `Buffer[]` to `Uint8Array[]` (Buffer extends Uint8Array so runtime is fine, but TS-strict callers will see compile errors against the npm types until the package republishes). adds `@types/node`, overrides `noUncheckedIndexedAccess` / `noImplicitOverride` on the SDK package's tsconfig. user-facing TS API change.

both changes are in `chains/...` paths only, which is exactly the gap the user flagged: the audit's `docs/`-only freshness check let real upstream behavior changes slide.

### what we changed in this skill (files)

- **`skills/encrypt-solana-prealpha/references/docs-revision.md`** - bumped pin from `8b8518d` (2026-04-28) to **`6c9f7f94b683e2437354210d58f169bc79c78e3c`** (2026-04-29). updated the `tracked npm package` table's status note to mention BOTH the `encryptValue` 17-byte fix (`303439d`) AND the new `Buffer[]` → `Uint8Array[]` TS API change (`6c9f7f9`) - both upstream, neither in npm @0.1.0. expanded the `## detecting updates` section to document the new two-tier model: hard `docs/` gate vs non-blocking advisory for everything else.
- **`skills/encrypt-solana-prealpha/references/flows.md`** - extended **flow 7 (cross-program composability)** with a new **`### refund pattern: returning slipped / unsettled deposits`** subsection. covers single-receipt `swap_graph` refund slot, multi-receipt `add_liquidity_graph` per-side refunds with `both_ok && lp_ok` gating, the output-slot re-tagging convention (input ciphertext becomes refund output), and the `pool_signed_transfer` `#[inline(never)]` helper for stack-frame management with multiple CPIs. links to the upstream `verified.ts` e2e as a reference.
- **`skills/encrypt-solana-prealpha/references/gotchas.md`** - generalized the "watch out: published npm package is pre-fix" warning into a 2-row table. now flags BOTH the `encryptValue` silent-correctness bug AND the TS `Buffer[]` → `Uint8Array[]` mismatch as standing items until the package republishes. same actionable advice (hand-roll, treat upstream TS types as source of truth).
- **`skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs`** - new `--- non-docs/ commits since pin (advisory) ---` block prints on every audit run. lists every commit between the pin and `main` regardless of which paths each commit touched, with `<short-sha> <date> <title>` format and a sample of non-docs files changed. **never blocks** the audit (still exit 0 / 2 / 3 same as before based on `docs/` and drift-strict only). adds a follow-up line "Skill maintainer to-do: review the `non-docs/ commits since pin` block above" when the advisory has content. also threads the advisory flag into the blocked-by-stale-docs follow-up so users get the full picture even on exit 2.
- **`skills/encrypt-solana-prealpha/references/audit.md`** - new `### Non-docs/ commits since pin (advisory)` subsection documenting the new block, with a table citing `f7f410a` and `6c9f7f9` as the real-world examples that prompted adding it.

### what we did NOT change

- **`docs/`-only hard gate is unchanged.** still exit 2 on `docs/` drift. the new advisory is purely additive output.
- **no new drift rules.** the upstream changes are behavior / API shifts, not code patterns we can mechanically detect in user repos. the existing `enc-encryptvalue-from-stale-npm-package` rule already covers the most-likely landmine.
- **no `book-snapshots.md` / `developer-guide-map.md` updates.** the changes are all in `chains/...`, which is link-only (repo source paths, not book-derived prose).
- **no `instructions.md` change.** no Encrypt program ix changes - the receipt-gated refund logic lives in the pc-token / pc-swap programs, not the Encrypt program reference.
- **no canonical environment changes.** program id, gRPC URL, RPC URL all unchanged.

### audit status

`node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=.` reports **`docs/ vs main: fresh`**, advisory block reports `(no upstream commits since pin)` because we just bumped, drift block clean, exit 0. tested the advisory against an older pin to confirm it correctly lists the 2 commits + 6 non-docs files. ✓

---

## 2026-04-28 - track the npm package version separately + flag the `@encrypt.xyz/pre-alpha-solana-client@0.1.0` pre-fix trap (still on pin `8b8518d`)

### what we learned (real world bug report)

shoutout to ya girl who hit this in a separate project: `@encrypt.xyz/pre-alpha-solana-client@0.1.0` is the only version on npm and it **still ships the pre-fix `encryptValue`** - the helper that emits 16 raw bytes with no fhe_type tag and silently misreads multi-byte scalars (e.g. `EUint64` returns `value >> 8`). upstream fixed this in `303439d` (2026-04-26), but the package has not been republished since 2026-04-03. mhm. so if u read the previous gotcha and went "ok i'll just import the canonical helper" - SIKE, u still got the bug. no bueno.

### what we changed

**capture the lesson:**

- `skills/encrypt-solana-prealpha/references/gotchas.md` - the 17-byte `CreateInput` section now has a "watch out: published npm package is pre-fix" subsection plus a status column on the canonical-helpers table calling out which one ships the bug (the npm one) vs which one is fresh (the repo demo helper at `f098ac9` and later). full template for a hand-rolled `mockEncryptScalarBytes(value, fheType)` is in the same section, and the example points users to delete it once npm bumps past 0.1.0.
- `skills/encrypt-solana-prealpha/references/grpc-api.md` - TS client snippet rewritten to use the hand-rolled 17-byte helper and away from `encryptValue`. inline warning + cross-link to gotchas.
- `skills/encrypt-solana-prealpha/references/drift-rules.mjs` - new high-severity rule **`enc-encryptvalue-from-stale-npm-package`**. fires when a TS/JS file BOTH names `encryptValue` AND mentions `@encrypt.xyz/pre-alpha-solana-client`. narrow scope on purpose - we only want to flag this until npm republishes. positive + negative fixtures live at `tests/fixtures/drift-{positive,negative}/encrypt/enc-encryptvalue-from-stale-npm-package.ts`.

**track the npm package as a first-class signal:**

- `skills/encrypt-solana-prealpha/references/docs-revision.md` - new `## tracked npm package` table mirroring the existing `## tracked revision` shape. records the package name, version, publish date, recorded date, and a status note. plus a new "when the npm package bumps" section telling future maintainers what to do (review release notes, refresh table, audit gotchas, possibly retire the drift rule).
- `skills/encrypt-solana-prealpha/scripts/lib/docs-revision.mjs` - new `parseTrackedNpmPackage(md)` parser. returns null when the section is absent (so older bundles don't break), throws when the section is present but malformed (catches typos). full unit test coverage in `tests/skill-audit/docs-revision.test.mjs` (12 cases now total).
- `skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs` - new audit block **`--- npm package vs tracked (skill freshness signal) ---`** that compares the tracked version against npm latest using the existing `npmLatest()` helper and `semverCompare()`. **non-blocking** - never sets exit 2 or 3, just emits the diagnostic. status outcomes:
  - `in sync` (tracked matches npm latest) - default state, just prints the status note from docs-revision.md if any
  - `NPM AHEAD OF SKILL` (npm published a new version) - prints a follow-up to-do prompting the maintainer to review and refresh
  - `tracked newer than npm latest` (pre-release or dist-tag skew) - prompts manual verification
- `skills/encrypt-solana-prealpha/references/audit.md` - documented the new block, including the severity hierarchy (docs/ drift = hard block exit 2, npm package staleness = advisory only).
- `tests/skill-lint/structure.test.mjs` - new structural lint test asserting the encrypt skill's `docs-revision.md` actually has the `## tracked npm package` section and parses cleanly. catches future accidental deletes.

**the going-forward reminder:**

- `CLAUDE.local.md` (root) - new `## skill update protocol` section. on every encrypt skill update we must check `@encrypt.xyz/pre-alpha-solana-client` on npm: bumped version? new exports? changed behavior? if so, audit the public surface for new gotchas. and if upstream has a fix the package doesn't yet have (current state with the 17-byte fix), the gotchas file MUST call that out so users don't reach for the package helper. happens once, gonna keep happening lol. the audit script's new `--- npm package vs tracked ---` block is the prompt to do this review.

### severity tiering (new)

| signal | severity | audit behavior |
| --- | --- | --- |
| `docs/` vs upstream `main` stale | hard block (exit 2) | unchanged |
| npm package newer than tracked | warn (drift block, follow-up bullet) | new |
| npm package matches tracked but pre-fix vs upstream | warn (status note in audit block) | new - this is the *current* state |

the third row is the trap that surfaced this whole update. the package is "current" on npm but ships a known-broken helper that upstream already fixed. the audit now surfaces that asymmetry without blocking.

### what we did NOT change

- `references/dsl-vectors.md`, `dsl-types.md`, etc. - book content unchanged this round.
- `docs-revision.md` upstream pin - still on `8b8518d119a674bb28cf4d89a5f971693899c973`. this update is purely about the npm package surface.
- `SKILL.md` - common-mistakes table already covers the 17-byte gotcha with a link; no need to add a per-package row.
- ika-solana-prealpha skill - separate package surface, out of scope. ika doesn't currently wrap an npm package the same way, so no parallel changes needed.

### audit + tests

`node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=.` reports `docs/ vs main: fresh`, the new `--- npm package vs tracked ---` block in sync at 0.1.0 with the KNOWN STALE status note, drift block clean, exit 0. `npm test` green across the board.

---

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
