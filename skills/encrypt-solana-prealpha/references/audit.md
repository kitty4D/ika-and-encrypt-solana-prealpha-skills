# Audit mode (integration + skill freshness)

Load when this skill is invoked with **`audit`** (e.g. `/encrypt-solana-prealpha audit`), **`audit-force`**, or you need the full gate / script / checklist after changing [`docs-revision.md`](docs-revision.md).

## Slash commands and CLI

**Slash:** `/encrypt-solana-prealpha audit` (hard stop if the skill’s `docs/` pin is stale) or `audit-force` (warn, then continue).

**CLI:** `node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs [--force] [--no-drift] [--drift=strict] [--root=DIR]` from the **skill package** repository root (the tree that contains `skills/encrypt-solana-prealpha/`), or `node scripts/audit-encrypt-solana-prealpha.mjs` with cwd = this skill folder (`--root` defaults to `process.cwd()`).

### Flag reference

| flag | effect |
| --- | --- |
| `--force` | Continue after the stale-`docs/` gate (same as the `audit-force` slash). |
| `--no-drift` | Suppress the **drift: skill-vs-codebase** block (legacy output only). |
| `--drift=strict` | Exit **3** when the drift block reports any `critical` finding. Default is exit 0 regardless of drift severity (exit 2 still reserved for stale `docs/`). |
| `--root=DIR` | Directory to scan; defaults to `process.cwd()`. |

**Exit codes:** `0` ok · `2` stale `docs/` without `--force` · `3` `--drift=strict` + critical drift finding · `1` fatal/network.

### Drift block (default-on)

Unless `--no-drift` is passed, every run appends a `--- drift: skill-vs-codebase ---` block listing places where the **skill's current knowledge** suggests the user's **code** should change — deprecated idioms, silent-bug patterns, canonical-value mismatches, newly-available features the user hasn't adopted. Each finding includes a `skill says: <file:line>` citation and a ready-to-paste **`fix:`** prompt the user can send back to the skill.

Catalog lives in [`drift-rules.mjs`](drift-rules.mjs) (sibling of this doc). Each rule has a stable `id`, a `severity` (critical / high / medium / low), a `since` date, and an `evidence` citation. Add a rule whenever `CHANGELOG-ENCRYPT.md` records a conceptual shift.

### `.skill-audit.json` state file

The script writes a small state file at `<root>/.skill-audit.json` after each run, recording the set of rule ids seen in the last audit. On the next run, any rule id not in that set is labelled **NEW since your last sync**. Gitignore it. Delete it to reset the baseline.

### `audit-fix <rule-id>` (skill verb)

`/encrypt-solana-prealpha audit-fix <rule-id>` tells the skill to propose the remediation for that specific rule id across the files the drift block reported. The skill reads the rule's `evidence` citation, opens those skill sections, and applies the fix — the script itself never modifies user code. The skill must confirm before touching anything.

## Audit mode

If this skill is invoked with **`audit`** (e.g. `/encrypt-solana-prealpha audit`), treat it as a **repo + client integration audit** of the **user’s project** (workspace / `--root`), not a rewrite of this skill.

1. **Gate — skill freshness:** Read [`docs-revision.md`](docs-revision.md). If `docs/` on `encrypt-pre-alpha` `main` has changed since the tracked commit (GitHub compare `...main` restricted to `docs/`, or local `git diff <tracked>..origin/main -- docs`), **stop** after reporting: pinned commit, that book sources may be stale, link to compare, and the rule *do not silently rewrite this bundle*. **Do not** run dependency scans or semantic audit on the user repo until this gate passes (or the user uses **audit-force**).
2. **Deterministic checks:** From the **skill package** repository root, run `node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=<user project>` (no `--force`), or the same path relative to the skill directory’s `scripts/` folder. Paste stdout/stderr; honor non-zero exit as **blocked** when the script reports doc drift. That script also compares **locked** `@encrypt.xyz/pre-alpha-solana-client` and `@solana/kit` versions to npm **`latest`** when it finds a `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` (walking up to the monorepo root).

   **Agents read the terminal, not minds.** You must **run** that command and **read** its stdout. On **exit 0** the script prints a **`--- drift: skill-vs-codebase ---`** block (unless `--no-drift`) followed by a **`--- follow-up (optional — you choose) ---`** block with numbered lines. On **exit 2** (stale `docs/`) a shorter `--- follow-up` block precedes the exit. **Do not omit these lines** when reporting to the user: paste them verbatim after your summary, **or** merge every script line (drift findings **and** follow-ups) into your final numbered list. A summary that only says “exit 0” without those lines **does not satisfy** this procedure.

3. **Semantic checklist (user code):** With [`flows.md`](flows.md), [`grpc-api.md`](grpc-api.md), [`instructions.md`](instructions.md), and [`gotchas.md`](gotchas.md), trace **`CreateInput` / `ReadCiphertext`**, **`execute_graph` / ciphertext lifecycle**, **fees / deposits** if relevant, and **vector vs scalar** paths; cite **file:line**. Note gaps; do not invent upstream APIs. **Finish** by giving the user a **numbered follow-up list** (combine script output with [Conclusion](#conclusion-actionable-follow-ups) below — they choose what to do).

## Audit-force mode

If invoked with **`audit-force`** (e.g. `/encrypt-solana-prealpha audit-force`), perform the **same** steps as **Audit mode**, except:

1. **Still compute and print** whether `docs/` is stale (commit, compare link, warning that the skill may be wrong for new book prose).
2. **Then continue** even if stale: run `node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --force --root=<user project>` (or `node scripts/audit-encrypt-solana-prealpha.mjs` from the skill folder) and complete the semantic checklist. The human must see the stale warning **before** downstream “all clear” language.

## Conclusion: actionable follow-ups

End every audit by giving the **user** a **numbered list** of optional next steps they can accept or ignore. Do not imply everything is “done” without this. Pull items from script output + your semantic pass; add skill-repo items only when auditing the skill bundle itself.

**Typical menu (subset may apply):**

1. **Skill bundle stale (`docs/` vs `main`):** Bump [`docs-revision.md`](docs-revision.md) to current [`encrypt-pre-alpha`](https://github.com/dwallet-labs/encrypt-pre-alpha) `main`, refresh affected `references/`, re-run `audit-encrypt-solana-prealpha.mjs` until `docs/ vs main: fresh` — or **stop using** this skill until updated.
2. **Audited with `--force` while stale:** Re-check critical flows against the **live book**; skill prose may lag new `docs/`.
3. **Canonical mismatches** (gRPC URL / program id): Align scanned files with [`SKILL.md`](../SKILL.md) environment table.
4. **Drift block (skill-vs-codebase):** For each `critical` / `high` finding, paste the rule's `fix:` prompt back to the skill (e.g. `/encrypt-solana-prealpha audit-fix <rule-id>`). The skill will open the cited `references/` section and confirm before changing code. `NEW since your last sync:` ids are the most important — they appeared after the last run wrote `.skill-audit.json`.
5. **npm lockfile vs `latest`:** If the script reported **OUTDATED**, consider upgrading `@encrypt.xyz/pre-alpha-solana-client` / `@solana/kit` after reading release notes; if **no lockfile resolved**, run install or point `--root` at the app package.
6. **Semantic pass (always worth doing):** Trace `CreateInput` / `ReadCiphertext`, `execute_graph`, fees/deposits/events, vector vs scalar — [`flows.md`](flows.md), [`grpc-api.md`](grpc-api.md), [`instructions.md`](instructions.md), [`gotchas.md`](gotchas.md); note **file:line** gaps.
7. **Runtime confidence:** Run unit/integration tests and a small **devnet** smoke path if you touched Encrypt client or program code.

**Gate-only stop (exit 2, no `--force`):** Still leave the user with items **1** (refresh skill or pause using it) and optionally **6** for unrelated work — plus the compare URL from stderr/script.
