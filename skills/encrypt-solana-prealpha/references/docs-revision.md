# encrypt-pre-alpha docs: tracked revision

Published book: [Encrypt Developer Guide](https://docs.encrypt.xyz/) is built from `docs/` in [dwallet-labs/encrypt-pre-alpha](https://github.com/dwallet-labs/encrypt-pre-alpha).

## tracked revision

| field | value |
| --- | --- |
| commit (full) | `08f723ceadb462da09407c405a25ee7214e3ca1c` |
| commit (short) | `08f723c` |
| upstream commit date (UTC) | 2026-05-09 |
| recorded in skill | 2026-05-11 |

**Interpretation:** This skill’s prose was last aligned with `main` at the commit above. The hard `docs/` gate fires only when files under `docs/` change between this pin and `main` (book-derived summaries in this bundle may be stale). The audit's separate non-docs/ advisory block surfaces code / proto / crate / example churn since the pin so maintainers can decide whether the change is worth a content refresh.

## tracked npm package

| field | value |
| --- | --- |
| package | `@encrypt.xyz/pre-alpha-solana-client` |
| version | `0.1.1` |
| published (UTC) | 2026-04-30 |
| recorded in skill | 2026-05-11 |
| status | **in sync** — `0.1.1` ships both fixes the previous `0.1.0` was missing: `encryptValue` now emits the 17-byte `[fhe_type(1) \|\| value_le(16)]` format (upstream `303439d`, 2026-04-26) and `CreateInputResult.ciphertextIdentifiers` is typed `Uint8Array[]` (upstream `6c9f7f9`, 2026-04-29). Importing `encryptValue` from `@encrypt.xyz/pre-alpha-solana-client/grpc-web` is the canonical path again — no hand-rolled helper required. |

**Interpretation:** The published npm package is a separate freshness signal from `docs/`. A new package version doesn't invalidate the skill (so this never blocks the audit), but it's a prompt to review the package's public surface for new exports / behavior changes worth flagging in [`gotchas.md`](gotchas.md). Treat **NPM AHEAD OF SKILL** as a maintainer to-do, not a user-facing error.

## detecting updates

The audit script splits upstream churn into two tiers:

1. **Hard gate (`docs/` only).** If any file under `docs/` changed between the pin and `main`, the audit blocks (exit 2) until the pin is bumped or `--force` is passed. Compare:
   - **GitHub:** `GET https://api.github.com/repos/dwallet-labs/encrypt-pre-alpha/compare/<tracked-commit>...main` — if any `files[].filename` starts with `docs/`, mdbook sources changed.
   - **Local clone:** `git fetch origin && git diff <tracked-commit>..origin/main -- docs`
2. **Non-blocking advisory (everything else).** The audit's `--- non-docs/ commits since pin (advisory) ---` block lists commits since the pin that touched code / proto / crate / example paths. These don't fire the hard gate, but they should prompt a maintainer pass when refreshing the skill — code-level fixes, new helpers, or behavior changes can introduce gotchas even when the book stays still.
3. **Hosted site** may lag `main`; the `docs/` tree at the commit you care about is the tie-breaker.

## when docs have changed

- **Inform the human user** that Encrypt **documentation** has moved ahead of this skill’s recorded revision.
- Suggest they **disable or refresh** this skill bundle until updated, or verify against the live [docs.encrypt.xyz](https://docs.encrypt.xyz/) and repo `docs/`.

## when only non-docs/ paths have changed

- The audit prints the commit list as an advisory; review it on every refresh.
- Updates to `chains/solana/clients/typescript/`, `chains/solana/examples/`, `crates/`, or `proto/` may introduce new gotchas, deprecate canonical helpers, or re-shape recommended patterns even without touching `docs/`.
- After review, bump the tracked commit to clear the advisory and refresh any affected reference files.

## when the npm package bumps

When `@encrypt.xyz/pre-alpha-solana-client` publishes a new version, the audit script's `--- npm package vs tracked ---` block reports it as a non-blocking advisory finding. **Maintainer action:**

1. Read the package's release notes / git diff for the new version.
2. Update the `tracked npm package` table above (version, published date, recorded date, status note).
3. Re-review [`gotchas.md`](gotchas.md) for newly relevant or now-resolved items - especially anything tagged `KNOWN STALE vs upstream` may now be aligned (or have new asymmetries).
4. If the new version fixes a previously-flagged trap (e.g. the 17-byte `encryptValue` helper), retire or downgrade the related drift rule in [`drift-rules.mjs`](drift-rules.mjs).

The hard `docs/` gate (exit 2) is unchanged - npm drift is an advisory signal only and never blocks the audit.
