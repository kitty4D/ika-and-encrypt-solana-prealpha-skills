# encrypt-pre-alpha docs: tracked revision

Published book: [Encrypt Developer Guide](https://docs.encrypt.xyz/) is built from `docs/` in [dwallet-labs/encrypt-pre-alpha](https://github.com/dwallet-labs/encrypt-pre-alpha).

## tracked revision

| field | value |
| --- | --- |
| commit (full) | `8b8518d119a674bb28cf4d89a5f971693899c973` |
| commit (short) | `8b8518d` |
| upstream commit date (UTC) | 2026-04-28 |
| recorded in skill | 2026-04-28 |

**Interpretation:** This skill’s prose was last aligned with the **`docs/`** tree at the commit above on **`main`**. **Only** changes under `docs/` in `encrypt-pre-alpha` matter when deciding whether book-derived summaries in this bundle may be stale (program, proto, or crate churn still warrants a maintainer pass if behavior changes).

## tracked npm package

| field | value |
| --- | --- |
| package | `@encrypt.xyz/pre-alpha-solana-client` |
| version | `0.1.0` |
| published (UTC) | 2026-04-03 |
| recorded in skill | 2026-04-28 |
| status | **KNOWN STALE vs upstream** - ships the pre-fix `encryptValue` helper (16 bytes, no type tag). Upstream fixed this in `303439d` (2026-04-26). Until republished, prefer hand-rolled 17-byte helpers - see [`gotchas.md`](gotchas.md#grpc-createinput-requires-the-17-byte-input-format). |

**Interpretation:** The published npm package is a separate freshness signal from `docs/`. A new package version doesn't invalidate the skill (so this never blocks the audit), but it's a prompt to review the package's public surface for new exports / behavior changes worth flagging in [`gotchas.md`](gotchas.md). Treat **NPM AHEAD OF SKILL** as a maintainer to-do, not a user-facing error.

## detecting updates (docs/ only)

1. **Compare** the tracked commit to `main`, **restricted to `docs/`**:
   - **GitHub:** `GET https://api.github.com/repos/dwallet-labs/encrypt-pre-alpha/compare/<tracked-commit>...main` — if any `files[].filename` starts with `docs/`, mdbook sources changed.
   - **Local clone:** `git fetch origin && git diff <tracked-commit>..origin/main -- docs`

2. **Hosted site** may lag `main`; the `docs/` tree at the commit you care about is the tie-breaker.

## when docs have changed

- **Inform the human user** that Encrypt **documentation** has moved ahead of this skill’s recorded revision.
- Suggest they **disable or refresh** this skill bundle until updated, or verify against the live [docs.encrypt.xyz](https://docs.encrypt.xyz/) and repo `docs/`.

## when the npm package bumps

When `@encrypt.xyz/pre-alpha-solana-client` publishes a new version, the audit script's `--- npm package vs tracked ---` block reports it as a non-blocking advisory finding. **Maintainer action:**

1. Read the package's release notes / git diff for the new version.
2. Update the `tracked npm package` table above (version, published date, recorded date, status note).
3. Re-review [`gotchas.md`](gotchas.md) for newly relevant or now-resolved items - especially anything tagged `KNOWN STALE vs upstream` may now be aligned (or have new asymmetries).
4. If the new version fixes a previously-flagged trap (e.g. the 17-byte `encryptValue` helper), retire or downgrade the related drift rule in [`drift-rules.mjs`](drift-rules.mjs).

The hard `docs/` gate (exit 2) is unchanged - npm drift is an advisory signal only and never blocks the audit.
