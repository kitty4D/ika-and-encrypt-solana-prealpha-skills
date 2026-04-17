# In-repo snapshots of the Encrypt Developer Guide

**Purpose:** Table-heavy or high-retrieval chapters copied from [`encrypt-pre-alpha`](https://github.com/dwallet-labs/encrypt-pre-alpha) `docs/src/` so agents can answer without opening the browser. **Normative** text is always the [published book](https://docs.encrypt.xyz/) at the revision you care about — refresh copies when you bump [`docs-revision.md`](docs-revision.md). **Last aligned** with the `docs/` commit recorded in [`docs-revision.md`](docs-revision.md) on upstream `main`.

## snapshot files

| Snapshot | Book URL | Upstream path |
| --- | --- | --- |
| [`dsl-types.md`](dsl-types.md) | [FHE types](https://docs.encrypt.xyz/dsl/types.html) | `dsl/types.md` |
| [`dsl-vectors.md`](dsl-vectors.md) | [Vectors](https://docs.encrypt.xyz/dsl/vectors.html) | `dsl/vectors.md` |
| [`dsl-operations.md`](dsl-operations.md) | [Operations](https://docs.encrypt.xyz/dsl/operations.html) | `dsl/operations.md` |
| [`dsl-constants.md`](dsl-constants.md) | [Constants](https://docs.encrypt.xyz/dsl/constants.html) | `dsl/constants.md` |
| [`dsl-conditionals.md`](dsl-conditionals.md) | [Conditionals](https://docs.encrypt.xyz/dsl/conditionals.html) | `dsl/conditionals.md` |
| [`dsl-graph-compilation.md`](dsl-graph-compilation.md) | [Graph compilation](https://docs.encrypt.xyz/dsl/graph-compilation.html) | `dsl/graph-compilation.md` |
| [`concepts-core.md`](concepts-core.md) | [Core concepts](https://docs.encrypt.xyz/getting-started/concepts.html) | `getting-started/concepts.md` |
| [`reference-events.md`](reference-events.md) | [Events](https://docs.encrypt.xyz/reference/events.html) | `reference/events.md` |
| [`reference-accounts.md`](reference-accounts.md) | [Accounts](https://docs.encrypt.xyz/reference/accounts.html) | `reference/accounts.md` |
| [`reference-fees.md`](reference-fees.md) | [Fees](https://docs.encrypt.xyz/reference/fees.html) | `reference/fees.md` |

**Orient-only (not full copy):** [`fee-and-state-reference.md`](fee-and-state-reference.md) — short Encrypt-specific summary; use the `reference-*.md` snapshots above for full layouts.

## link-only (keep in book / print)

- [DSL overview](https://docs.encrypt.xyz/dsl/overview.html) — prose; small enough to read online.
- [Instruction reference](https://docs.encrypt.xyz/reference/instructions.html) — long per-ix account metas (~300+ lines); use live book + [`instructions.md`](instructions.md) group index.
- Tutorial, framework guides, testing prose, multi-page examples — [`developer-guide-map.md`](developer-guide-map.md).

## reference-skill testing (writing-skills)

For **retrieval** checks: ask for event wire size, ciphertext account offset of `authorized`, ENC fee formula, `Select` vs branch, or **vector** gather/scatter / `EUint*Vector` FHE type ids — answers should cite these snapshots or the book, not guess.
