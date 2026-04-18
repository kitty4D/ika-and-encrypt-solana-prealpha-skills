# encrypt-pre-alpha docs: tracked revision

Published book: [Encrypt Developer Guide](https://docs.encrypt.xyz/) is built from `docs/` in [dwallet-labs/encrypt-pre-alpha](https://github.com/dwallet-labs/encrypt-pre-alpha).

## tracked revision

| field | value |
| --- | --- |
| commit (full) | `f779af5b2ffb33ad3902dc69cbbe6922bdc8b479` |
| commit (short) | `f779af5` |
| upstream commit date (UTC) | 2026-04-16 |
| recorded in skill | 2026-04-17 |

**Interpretation:** This skill’s prose was last aligned with the **`docs/`** tree at the commit above on **`main`**. **Only** changes under `docs/` in `encrypt-pre-alpha` matter when deciding whether book-derived summaries in this bundle may be stale (program, proto, or crate churn still warrants a maintainer pass if behavior changes).

## detecting updates (docs/ only)

1. **Compare** the tracked commit to `main`, **restricted to `docs/`**:
   - **GitHub:** `GET https://api.github.com/repos/dwallet-labs/encrypt-pre-alpha/compare/<tracked-commit>...main` — if any `files[].filename` starts with `docs/`, mdbook sources changed.
   - **Local clone:** `git fetch origin && git diff <tracked-commit>..origin/main -- docs`

2. **Hosted site** may lag `main`; the `docs/` tree at the commit you care about is the tie-breaker.

## when docs have changed

- **Inform the human user** that Encrypt **documentation** has moved ahead of this skill’s recorded revision.
- Suggest they **disable or refresh** this skill bundle until updated, or verify against the live [docs.encrypt.xyz](https://docs.encrypt.xyz/) and repo `docs/`.
