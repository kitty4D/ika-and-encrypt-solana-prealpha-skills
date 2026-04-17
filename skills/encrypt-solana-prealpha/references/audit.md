# Audit mode (integration + skill freshness)

Load when this skill is invoked with **`audit`** (e.g. `/encrypt-solana-prealpha audit`), **`audit-force`**, or you need the full gate / script / checklist after changing [`docs-revision.md`](docs-revision.md).

## Slash commands and CLI

**Slash:** `/encrypt-solana-prealpha audit` (hard stop if the skill’s `docs/` pin is stale) or `audit-force` (warn, then continue).

**CLI:** `node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs [--force] [--root=DIR]` from the **encrypt-solana-prealpha-skill** repo root, or `node scripts/audit-encrypt-solana-prealpha.mjs` with cwd = this skill folder (`--root` defaults to `process.cwd()`).

## Audit mode

If this skill is invoked with **`audit`** (e.g. `/encrypt-solana-prealpha audit`), treat it as a **repo + client integration audit** of the **user’s project** (workspace / `--root`), not a rewrite of this skill.

1. **Gate — skill freshness:** Read [`docs-revision.md`](docs-revision.md). If `docs/` on `encrypt-pre-alpha` `main` has changed since the tracked commit (GitHub compare `...main` restricted to `docs/`, or local `git diff <tracked>..origin/main -- docs`), **stop** after reporting: pinned commit, that book sources may be stale, link to compare, and the rule *do not silently rewrite this bundle*. **Do not** run dependency scans or semantic audit on the user repo until this gate passes (or the user uses **audit-force**).
2. **Deterministic checks:** From the encrypt-solana-prealpha-skill repo root, run `node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=<user project>` (no `--force`), or the same path relative to the skill directory’s `scripts/` folder. Paste stdout/stderr; honor non-zero exit as **blocked** when the script reports doc drift. That script also compares **locked** `@encrypt.xyz/pre-alpha-solana-client` and `@solana/kit` versions to npm **`latest`** when it finds a `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` (walking up to the monorepo root).

   **Agents — the skill does not auto-read the terminal.** You must **run** that command and **read** its stdout. On **exit 0** the script always prints a block starting with **`--- follow-up (optional — you choose) ---`** (numbered lines). On **exit 2** (stale `docs/`) it prints a shorter **`--- follow-up`** block before exiting. **Do not omit these lines** when reporting to the user: paste them verbatim after your summary, **or** merge every script line into your final numbered follow-up list (you may add more from the semantic pass). A summary that only says “exit 0” without those lines **does not satisfy** this procedure.

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
4. **npm lockfile vs `latest`:** If the script reported **OUTDATED**, consider upgrading `@encrypt.xyz/pre-alpha-solana-client` / `@solana/kit` after reading release notes; if **no lockfile resolved**, run install or point `--root` at the app package.
5. **Semantic pass (always worth doing):** Trace `CreateInput` / `ReadCiphertext`, `execute_graph`, fees/deposits/events, vector vs scalar — [`flows.md`](flows.md), [`grpc-api.md`](grpc-api.md), [`instructions.md`](instructions.md), [`gotchas.md`](gotchas.md); note **file:line** gaps.
6. **Runtime confidence:** Run unit/integration tests and a small **devnet** smoke path if you touched Encrypt client or program code.

**Gate-only stop (exit 2, no `--force`):** Still leave the user with items **1** (refresh skill or pause using it) and optionally **6** for unrelated work — plus the compare URL from stderr/script.
