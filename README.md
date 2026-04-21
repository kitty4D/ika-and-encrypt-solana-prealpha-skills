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

from this repo root, audit scripts (full flag reference in each skill’s [`references/audit.md`](skills/ika-solana-prealpha/references/audit.md)):

```bash
# default: runs staleness gate + drift scan
node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs --root=/path/to/your/app
node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=/path/to/your/app

# suppress drift block (legacy output only)
node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs --root=. --no-drift

# make critical drift findings fail CI (exit 3)
node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs --root=. --drift=strict
```

or via the npm shortcuts defined in `package.json`:

```bash
npm run audit:ika    # equivalent to the ika audit with no extra flags
npm run audit:encrypt
```

## skill-vs-codebase drift detection

both audit scripts now include a drift scanner - a curated catalog of rules that check if ur project code has patterns the skill specifically warns against (silent bugs, deprecated apis, missing required setup, etc.). the catalog lives in each skill’s [`references/drift-rules.mjs`](skills/ika-solana-prealpha/references/drift-rules.mjs) as an ES module so rules can carry real regexes + detect functions, not just strings.

example output when findings exist:

```
--- drift: skill-vs-codebase ---
critical (1):
  [ika-mock-sign-is-error-assumption] src/sign.ts:88
    skill says: grpc-api.md:210-228
    fix: ask the ika-solana-prealpha skill - "update my mock Sign assumption..."
high (2):
  ...
--- end drift ---
```

**exit codes:** drift findings don’t change exit code by default (exit 2 stays reserved for stale docs). pass `--drift=strict` to make `critical` findings exit 3. `--no-drift` suppresses the block entirely for CI configs that want the legacy output only.

**state file:** on each run the script writes `.skill-audit.json` to the scan root (gitignored by convention). subsequent runs compare rule ids and call out new findings since ur last sync. documented in full in each skill’s `references/audit.md`.

**fix prompts:** every rule ships a ready-to-paste prompt - copy the `fix:` line back to the skill (e.g. `/ika-solana-prealpha audit-fix ika-mock-sign-is-error-assumption`) and the skill will walk u through the remediation.

**rule coverage:**

| skill | rules | notable catches |
| --- | --- | --- |
| ika | 8 | flipped mock-Sign support, chunked MessageApproval PDA seeds, VersionedDWalletDataAttestation BCS tag, stale endpoint/program-id in comments |
| encrypt | 10 | `EUintVector.is_equal(&scalar)` silent all-false, ReadCiphertext type-prefix skip, execute_graph + token transfer in same ix, stale graph bin without dump test |

## automated tests

the repo ships a zero-dependency test suite (node `node:test`, node >= 20) covering the skills as first-class artifacts - prose, drift catalog, and audit script all tested together. 186 tests, ~300ms, no network required for the default suite.

```bash
npm test              # b1-b3 + b5a + b6 - fast, deterministic, always on
npm run test:lint     # b1 - frontmatter, structure, changelog vs pin, canonical consistency
npm run test:facts    # b2 - citation resolver, drift-rule evidence, cross-references
npm run test:audit    # b3 - audit script unit tests (semver, lockfiles, docs-revision, drift engine)
npm run test:effectiveness  # b5a - knowledge probes (is the required knowledge still in the prose?)
npm run test:discovery      # b6 - CSO: does the description route the right queries to the right skill?
```

optional / network-gated tiers (not run in CI by default):

```bash
SKILL_TESTS_NETWORK=1 npm run test:upstream   # b4 - upstream book sha check at pinned commit
npm run test:behavior                          # b5b - LLM-driven subagent rubric tests
```

**what the tests catch:**

- `b1 skill-lint` - frontmatter shape (name is kebab-case, description starts with "Use when", block <= 1024 chars, audit modes advertised), required reference files exist, no orphan `.md` files, `audit.md` documents every `--flag` the script parses, CHANGELOG date + sha agree with `docs-revision.md` (within 30 days), program id + gRPC host are consistent across SKILL.md / drift rules / audit script
- `b2 skill-facts` - every `evidence:` citation in drift rules resolves to a real file with enough lines, every markdown link in SKILL.md + references resolves on disk, SKILL.md references audit.md + docs-revision.md + drift-rules.mjs
- `b5a knowledge-probe` - asserts key facts the skill MUST convey (canonical program ids, PDA seed layouts, gotcha patterns) are still in the prose corpus; also asserts forbidden substrings (stale claims, wrong terminology) don’t appear
- `b6 cso` - for a fixed set of realistic user queries, the right skill’s description scores higher than the other one’s - catches "description drift" where renaming a keyword breaks discoverability

**self-audit exclusion:** when u run either audit script with `--root` pointing at this repo itself, it detects that and automatically skips `tests/fixtures/` and `drift-rules.mjs` from drift + canonical-literal scans. running it on ur own project is unaffected.

## Cursor / Claude Code

copy or point your tool at the **`skills/<skill-name>/`** directory so the installed folder name matches the skill `name` in each `SKILL.md` frontmatter. see [Cursor agent skills](https://cursor.com/docs/context/skills) and ur assistant’s docs.
