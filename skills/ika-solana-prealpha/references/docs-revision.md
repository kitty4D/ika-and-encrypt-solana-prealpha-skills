# ika-pre-alpha docs: tracked revision

Published book: [solana pre-alpha docs](https://solana-pre-alpha.ika.xyz/) is built from `docs/` in [dwallet-labs/ika-pre-alpha](https://github.com/dwallet-labs/ika-pre-alpha).

## tracked revision

| field | value |
| --- | --- |
| commit (full) | `3bd7945e012950e54fb4d0057b72a7d466556fc1` |
| commit (short) | `3bd7945` |
| upstream commit date (UTC) | 2026-04-17 |
| recorded in skill | 2026-04-17 |

**`docs/` and this commit:** Git does not assign a separate commit to the `docs/` folder. The SHA above is a **normal repository commit**; it pins **every path in the tree at that instant**, including all of **`docs/`**. Stale checks that filter to `docs/` (below) ask whether **book sources on `main`** changed since that commit—not whether you need a second stored hash.

**Optional fingerprint (docs subtree only):** After checking out that commit locally, `git rev-parse HEAD:docs` prints the **tree object id** for the `docs/` directory. You may copy it into a maintainer note when bumping; it changes only when `docs/` content at the recorded commit differs from another revision. It is **redundant** with the commit SHA for “which snapshot” but can help scripts that compare trees.

**Interpretation:** This skill’s prose and book-derived summaries were last aligned with the **`docs/`** tree at that commit. **Only** changes under `docs/` in `ika-pre-alpha` matter when deciding whether this skill’s documentation excerpts may be stale (ignore unrelated program, proto, or crate churn unless the maintainer also updates this bundle).

## devnet spot-check (account `space`)

Optional sanity check that deployed program account sizes match the book: `getProgramAccounts` on the dWallet program id with `filters: [{ "dataSize": N }]` and compare each result’s `account.space` to **`docs/src/reference/accounts.md`** in `ika-pre-alpha` at the tracked commit.

- **2026-04-14:** **`dataSize: 312`** (MessageApproval) — returned many accounts, all with **`space: 312`**.
- **Same date:** **`dataSize: 139`** (GasDeposit) — **no accounts** on devnet (expected if nobody created gas deposits); book still lists **139 bytes** for GasDeposit.

## detecting updates (docs/ only)

Use this to decide whether to **notify the human user**.

1. **Compare** the tracked commit above to `main`, **restricted to `docs/`**:
   - **GitHub:** `GET https://api.github.com/repos/dwallet-labs/ika-pre-alpha/compare/<tracked-commit>...main` — if any `files[].filename` starts with `docs/`, the mdbook sources changed on `main` since the tracked commit.
   - **Local clone:** `git fetch origin && git diff <tracked-commit>..origin/main -- docs` — any output means `docs/` changed.

2. **Hosted site** may lag `main`; if behavior disagrees with this skill, the **`docs/`** tree at the commit you care about is the tie-breaker for prose.

## when docs have changed

If `docs/` on `main` differs from the tracked revision:

- **Inform the human user** that the ika-pre-alpha **documentation** (mdbook sources under `docs/` in `ika-pre-alpha`) has been updated since this skill was recorded.
- State that **this skill may be outdated** or wrong for new prose and examples.
- Suggest they **disable or stop using this skill** until they obtain an updated skill bundle from the maintainer (or re-verify against the live book), rather than relying on this snapshot.

