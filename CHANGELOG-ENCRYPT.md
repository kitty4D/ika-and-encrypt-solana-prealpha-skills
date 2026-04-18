# changelog - `encrypt-solana-prealpha` skill

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
