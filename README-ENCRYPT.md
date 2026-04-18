# encrypt solana pre-alpha agent skills

**unofficial** agent skill bundle for [Encrypt](https://docs.encrypt.xyz/) on Solana pre-alpha (`skills/encrypt-solana-prealpha/`). Encrypt is the FHE / ciphertext programmability stack (`#[encrypt_fn]`, `execute_graph`, Encrypt gRPC); it is **not** the ika dWallet signing stack—use a separate skill for ika if you are wiring `DWalletService` and `approve_message`.

normative sources: [Encrypt developer guide](https://docs.encrypt.xyz/) and [dwallet-labs/encrypt-pre-alpha](https://github.com/dwallet-labs/encrypt-pre-alpha). if anything here disagrees with those, trust the live docs and repo.

**changelog (this bundle, root repo):** [`CHANGELOG-ENCRYPT.md`](CHANGELOG-ENCRYPT.md) — human-readable notes when this skill was bumped for upstream `docs/` changes. pre-alpha moves fast; see also [`docs-revision.md`](skills/encrypt-solana-prealpha/references/docs-revision.md) inside the skill.

> [!CAUTION]
> pre-alpha has **no real encryption** in the sense of production confidentiality: data can be **plaintext on-chain**, devnet is resettable, and interfaces change. read the disclaimer in the official guide before you ship anything user-facing.

## what's in the box

| path | contents |
| --- | --- |
| `skills/encrypt-solana-prealpha/` | `SKILL.md` + `references/` (including [`references/docs-revision.md`](skills/encrypt-solana-prealpha/references/docs-revision.md)) |
| `skills/encrypt-solana-prealpha/scripts/` | [`audit-encrypt-solana-prealpha.mjs`](skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs) — optional drift + dependency / canonical-string checks (node stdlib) |

[`docs-revision.md`](skills/encrypt-solana-prealpha/references/docs-revision.md) records which **`docs/`** commit in [encrypt-pre-alpha](https://github.com/dwallet-labs/encrypt-pre-alpha) this bundle was last aligned with. if **`docs/`** on `main` has moved since then, treat the hosted book as ahead of this snapshot. refresh the skill or disable it in your editor until you have a bundle you trust.

### audit your codebase for issues related to encrypt-solana-prealpha

> **note:** **audit mode** (slash commands, [`references/audit.md`](skills/encrypt-solana-prealpha/references/audit.md) checklist, script follow-up output) is **in progress** — behavior and docs may still shift.

use commands **`/encrypt-solana-prealpha audit`** and **`/encrypt-solana-prealpha audit-force`** (trailing tokens on the skill slash). **audit** stops if the skill’s doc pin is stale vs upstream `docs/`; **audit-force** still prints that warning then continues.

from the **repo root** of this clone:

```bash
node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=/path/to/your/app
```

add `--force` for audit-force behavior. if you only copied the skill folder, `cd` into `encrypt-solana-prealpha` and run `node scripts/audit-encrypt-solana-prealpha.mjs` the same way. full gate + checklist: [`references/audit.md`](skills/encrypt-solana-prealpha/references/audit.md); hub: [`SKILL.md`](skills/encrypt-solana-prealpha/SKILL.md).

the script also hits the **npm registry** `latest` tag for `@encrypt.xyz/pre-alpha-solana-client` and `@solana/kit` when it can read a resolved version from `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` (including a lockfile a few directories up in a monorepo). it uses a small semver compare (stdlib only)—not a full npm arborist solve.

**maintainers:** after bumping [`docs-revision.md`](skills/encrypt-solana-prealpha/references/docs-revision.md), run `node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs` from this repo root; expect exit **0** and `docs/ vs main: fresh`.

## install

the skill directory must stay intact: `SKILL.md` and `references/` as siblings under **`skills/encrypt-solana-prealpha/`**.

### `npx skills` ([skills.sh](https://skills.sh/) / Vercel CLI)

Vercel’s [agent skills guide](https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context) describes installing from a repo path. replace `OWNER` with your GitHub user or org once this repository is published.

```bash
npx skills add https://github.com/OWNER/encrypt-solana-prealpha-skill/tree/main/skills/encrypt-solana-prealpha
```

add `-g` for a global install when your CLI supports it. see [skills.sh CLI docs](https://skills.sh/docs/cli) and `npx skills --help`.

keep the folder as-is when installing: do not split `SKILL.md` from `references/` or mix in unrelated markdown from other repos.

### Cursor

use [Cursor agent skills](https://cursor.com/docs/context/skills): copy **`skills/encrypt-solana-prealpha/`** into your project or user skills location so the folder name still matches the skill `name` in frontmatter (`encrypt-solana-prealpha`), or point the tool at that path.

### Claude Code

each skill is a directory containing `SKILL.md` (commonly `~/.claude/skills/<name>/` or `.claude/skills/<name>/`). copy **`skills/encrypt-solana-prealpha/`** so `SKILL.md` and `references/` remain siblings.

### other assistants

any tool that loads a skill root plus relative markdown links should work if you pass the folder or `SKILL.md` according to that tool’s docs.

## scope (quick)

FHE DSL and graphs, Encrypt **devnet** program id and **Encrypt gRPC** endpoint (see `SKILL.md`), `EncryptService` (**CreateInput**, **ReadCiphertext**), on-chain instruction groups at a high level (full metas in the official instruction reference), `encrypt-pinocchio` / `encrypt-native` / `encrypt-anchor`, and `@encrypt.xyz/pre-alpha-solana-client`. pre-alpha only: mock executor behavior, resets, not production privacy.

## license and attribution

this repository is licensed under **CC-BY-4.0** (see [`LICENSE`](LICENSE)). that matches how upstream licenses the **mdbook** in [encrypt-pre-alpha](https://github.com/dwallet-labs/encrypt-pre-alpha): prose there is under [**LICENSE-docs** (CC-BY-4.0)](https://github.com/dwallet-labs/encrypt-pre-alpha/blob/main/LICENSE-docs), while **code** there is under [**BSD-3-Clause Clear**](https://github.com/dwallet-labs/encrypt-pre-alpha/blob/main/LICENSE)—the same **documentation vs code** split as [ika-pre-alpha](https://github.com/dwallet-labs/ika-pre-alpha), not a different policy for Encrypt.

this skill text is a third-party summary, not an official dWallet Labs release. when redistributing, keep attribution and see [`NOTICE`](NOTICE). this is not legal advice.
