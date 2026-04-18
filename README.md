# unofficial ika.xyz + encrypt.xyz solana pre-alpha agent skills

this repository bundles **two** unofficial [agent skills](https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context) for solana pre-alpha work with [ika](https://ika.xyz/) and [encrypt](https://docs.encrypt.xyz/) (dWallet Labs stacks). each skill lives under `skills/<skill-name>/` with `SKILL.md`, `references/`, and `scripts/` as siblings - keep that layout when copying or installing.

**repository:** [github.com/kitty4D/ika-and-encrypt-solana-prealpha-skills](https://github.com/kitty4D/ika-and-encrypt-solana-prealpha-skills)

| Skill | Role |
| --- | --- |
| [`skills/ika-solana-prealpha/`](skills/ika-solana-prealpha/) | ika dWallet signing / gRPC / solana pre-alpha integration |
| [`skills/encrypt-solana-prealpha/`](skills/encrypt-solana-prealpha/) | encrypt FHE graphs, gRPC, `execute_graph` (not the ika signing stack) |

long-form hub docs (preserved from the standalone repos) live in [`README-IKA.md`](README-IKA.md) and [`README-ENCRYPT.md`](README-ENCRYPT.md). Legal: [`LICENSE`](LICENSE), [`NOTICE`](NOTICE).

**changelogs (plain-english, skill-focused):** [`CHANGELOG-IKA.md`](CHANGELOG-IKA.md) · [`CHANGELOG-ENCRYPT.md`](CHANGELOG-ENCRYPT.md) — what changed in each skill when upstream mdbook / `docs/` moved. both stacks are **pre-alpha**: dWallet Labs can ship `docs/` and repo changes often; pins in each skill’s `references/docs-revision.md` can go stale between releases here. when in doubt, trust live [solana pre-alpha docs](https://solana-pre-alpha.ika.xyz/) / [Encrypt developer guide](https://docs.encrypt.xyz/) and re-run the audit scripts below.

## install (`npx skills`)

```bash
npx skills add https://github.com/kitty4D/ika-and-encrypt-solana-prealpha-skills/tree/main/skills/ika-solana-prealpha
npx skills add https://github.com/kitty4D/ika-and-encrypt-solana-prealpha-skills/tree/main/skills/encrypt-solana-prealpha
```

optional repo-wide install (if your CLI supports discovery / `--skill`):

```bash
npx skills add kitty4D/ika-and-encrypt-solana-prealpha-skills --skill ika-solana-prealpha
npx skills add kitty4D/ika-and-encrypt-solana-prealpha-skills --skill encrypt-solana-prealpha
```

from this repo root, audit scripts (see the per-skill README archives for behavior):

```bash
node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs --root=/path/to/your/app
node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=/path/to/your/app
```

## Cursor / Claude Code

copy or point your tool at the **`skills/<skill-name>/`** directory so the installed folder name matches the skill `name` in each `SKILL.md` frontmatter. see [Cursor agent skills](https://cursor.com/docs/context/skills) and ur assistant’s docs.
