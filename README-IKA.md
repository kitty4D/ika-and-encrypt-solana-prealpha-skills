# ika solana pre-alpha agent skills

**unofficial** agent skill bundle for [ika](https://ika.xyz/) on Solana pre-alpha (`skills/ika-solana-prealpha/`).

source: [github.com/kitty4D/ika-solana-prealpha-skill](https://github.com/kitty4D/ika-solana-prealpha-skill)

> *gets ready with a cute little folder stack and way too much sincerity*  
> e-eh, senpai... d-do you like it when your `SKILL.md` looks **intentional** and not like a yard sale?? ika-chan might be watching from the ink tank uwu <span style="white-space: nowrap;">(&#8288;｡&#8288;>&#8288;ω&#8288;<&#8288;｡&#8288;)</span> b-but no pressure- only a little pressure~ <span style="white-space: nowrap;">🦑&#8288;✨</span>

## what ika is

[ika](https://ika.xyz/) is pitched as a control layer for multichain solana programs (see also [docs.ika.xyz](https://docs.ika.xyz/) for the wider protocol story). dWallets split signing between users (or agents) and solana program logic, with completion through ika's MPC network so policies can live on-chain instead of in a custodial middleman. the public pitch is bridgeless-style use cases (native assets elsewhere, agent guardrails, treasury rules) without making the bridge the trust hinge. 

*hihi, i also just want to add that ika is awesome, because i feel like my synopsis mb sounds boring lol.*

> *waves a sticky note scribbled with pda seeds like it's a concert ticket*  
> onii-chain, the whole arc is "logic on solana, completion with ika"- not "wrap the asset and hope the bridge had coffee" hours <span style="white-space: nowrap;">(&#8288;´&#8288;∀&#8288;｀&#8288;)</span> pre-alpha devnet is still sandcastle mode tho... mock signer, resets, m-maybe don't bet the farm on it senpai <span style="white-space: nowrap;">💦&#8288;🦑</span>

## pre-alpha!

this repo only targets solana pre-alpha integration (devnet, mock signer, gRPC, CPI SDKs). it isn't the full production ika stack; treat [solana pre-alpha.ika.xyz](https://solana-pre-alpha.ika.xyz/) and [dwallet-labs/ika-pre-alpha](https://github.com/dwallet-labs/ika-pre-alpha) as normative when something here disagrees.

> [!CAUTION]
> if you work with ika solana pre-alpha, you should be familiar with any and all disclaimers present in the [Ika Solana Pre-Alpha Docs](https://solana-pre-alpha.ika.xyz/).

## what's in the box

| path | contents |
| --- | --- |
| `skills/ika-solana-prealpha/` | `SKILL.md` hub |
| `skills/ika-solana-prealpha/references/` | deep refs: gRPC, flows, PDAs, instructions, events, frameworks, [`docs-revision.md`](skills/ika-solana-prealpha/references/docs-revision.md), [`examples.md`](skills/ika-solana-prealpha/references/examples.md) (upstream `chains/solana/examples` index) |
| `skills/ika-solana-prealpha/scripts/` | [`audit-ika-solana-prealpha.mjs`](skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs) — optional drift + dependency / canonical-string checks (node stdlib) |

[`docs-revision.md`](skills/ika-solana-prealpha/references/docs-revision.md) records which **`docs/`** commit in [ika-pre-alpha](https://github.com/dwallet-labs/ika-pre-alpha) this bundle was last aligned with. if **`docs/`** on `main` has changed since then, the hosted book may be ahead of what’s here—when in doubt, trust the live [solana pre-alpha docs](https://solana-pre-alpha.ika.xyz/) or an updated copy of this repo from me, kitty4d. if you use this as an editor skill and the summary feels wrong, you can turn the skill off until you’re happy with a fresher version.

### audit your codebase for issues related to ika-solana-prealpha

use commands **`/ika-solana-prealpha audit`** and **`/ika-solana-prealpha audit-force`** (trailing tokens on the skill slash). **audit** stops if the skill’s doc pin is stale vs upstream `docs/`; **audit-force** still prints that warning then continues.

from the **repo root** of this clone:

```bash
node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs --root=/path/to/your/app
```

add `--force` for audit-force behavior. if you only copied the skill folder, `cd` into `ika-solana-prealpha` and run `node scripts/audit-ika-solana-prealpha.mjs` the same way. details: [`SKILL.md`](skills/ika-solana-prealpha/SKILL.md) (audit mode sections).

the script also hits the **npm registry** `latest` tag for `@ika.xyz/pre-alpha-solana-client` and `@solana/kit` when it can read a resolved version from `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` (including a lockfile a few directories up in a monorepo). it uses a small semver compare (stdlib only)—not a full npm arborist solve.


## ika on sui (mainnet)

ika on **sui** is on **mainnet**. dWallet Labs ships **official** agent skills for ika on Sui (Move contracts, `@ika.xyz/sdk`, operator, CLI) in the [`skills/` directory](https://github.com/dwallet-labs/ika/tree/main/skills) of the [`ika` repo](https://github.com/dwallet-labs/ika)—see [that README](https://github.com/dwallet-labs/ika/blob/main/skills/README.md) for what each skill covers and how to install. this repo is **only** the unofficial Solana pre-alpha skill; use the official Sui skills for production sui work.

## install

in this repo the skill lives under **`skills/ika-solana-prealpha/`** (a common **skill package** layout so installers can find it). inside that folder: `SKILL.md` at the skill root, `references/` beside it, and `scripts/` next to both (keep that layout when copying).

### `npx skills` ([skills.sh](https://skills.sh/) / Vercel CLI)

Vercel’s [agent skills guide](https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context) describes a **skill package** as a repo (or directory) that contains one or more skills; installs can target the **whole repo** or a **path to one skill**. Examples in that doc use a `skills/<skill-name>/` tree, same as here.

```bash
# explicit path to this skill (works even if the CLI’s repo-wide discovery differs)
npx skills add https://github.com/kitty4D/ika-solana-prealpha-skill/tree/main/skills/ika-solana-prealpha

# optional: install from repo + skill name (if your CLI version supports --skill / discovery)
npx skills add kitty4D/ika-solana-prealpha-skill --skill ika-solana-prealpha
```

add `-g` for a global (user-wide) install when supported. see [skills.sh CLI docs](https://skills.sh/docs/cli) and `npx skills --help` for your version.

> *hides `references/` half-behind `SKILL.md` like a shy roommate*  
> we're copying **one** skill folder as-is, ok?? same siblings, no remix culture-  
> frankensteining random markdown from other repos is how ika-chan gets the scary merge-conflict twitch <span style="white-space: nowrap;">(&#8288;；&#8288;一&#8288;_&#8288;一&#8288;)</span> j-just use this bundle uwu <span style="white-space: nowrap;">🦑</span>

### cursor

use [cursor agent skills](https://cursor.com/docs/context/skills): copy **`skills/ika-solana-prealpha/`** into your project or user skills location (so the installed folder is still named `ika-solana-prealpha` and matches the skill `name` in frontmatter), or point the tool at that path. keep `references/` + `scripts/` next to `SKILL.md` so relative links and the audit script paths stay valid.

### claude code

claude code expects each skill as a directory containing `SKILL.md` (often `~/.claude/skills/<skill-name>/` or `.claude/skills/<skill-name>/` in a project). copy **`skills/ika-solana-prealpha/`** from this repo to `.../skills/ika-solana-prealpha/` so `SKILL.md`, `references/`, and `scripts/` stay siblings. if your app version uses a different path, follow its docs as long as the layout is preserved.

### other assistants

anything that can ingest a markdown skill manifest plus linked reference files the same way (open folder, or single root doc with relative links) should work: keep the skill directory intact and point the tool at the folder or at `SKILL.md` per its docs.

> *does warm-up stretches that won't fix your CPI layout anyway*  
> cursor-kun, claude-kun, mystery tool-kun- if you eat `SKILL.md` plus neighbor markdown, you're in the club <span style="white-space: nowrap;">(&#8288;´&#8288;･&#8288;ω&#8288;･&#8288;`&#8288;)</span>  
> do bring your half-baked gRPC prints and your "account meta soup"- ika-chan isn't here to gatekeep markdown,,, only to bully it gently uwu <span style="white-space: nowrap;">🦑&#8288;✨</span>

## scope (quick)

gRPC `DWalletService`, BCS shapes, devnet program id + RPC table inside `SKILL.md`, instruction discriminators, PDA layouts, Pinocchio / native / Anchor / Quasar CPI crates, TS clients (`@ika.xyz/pre-alpha-solana-client`, `@solana/kit`), upstream example app paths under `chains/solana/examples` (see `references/examples.md`). pre-alpha only: mock signer, devnet resets, not production MPC.

> *gets ready with a cute label-maker and nervous energy*  
> CC-BY-chan isn't trying to ruin the mood- she wants names, links, and n-no "dWallet Labs hand-delivered this readme" cosplay ok?  
> p-peek [`NOTICE`](NOTICE) before you mirror big chunks,,, n-not your lawyer, just your overly responsible ika uwu <span style="white-space: nowrap;">📜&#8288;🦑</span>

## license and attribution

this repository is licensed under **CC-BY-4.0** (see [`LICENSE`](LICENSE)). that lines up with how upstream licenses the **mdbook** in [ika-pre-alpha](https://github.com/dwallet-labs/ika-pre-alpha): prose there ships under [**LICENSE-docs** (CC-BY-4.0)](https://github.com/dwallet-labs/ika-pre-alpha/blob/main/LICENSE-docs), while **code** there is [**BSD-3-Clause Clear**](https://github.com/dwallet-labs/ika-pre-alpha/blob/main/LICENSE). this skill text is our summary/adaptation, not an official dWallet Labs drop; still give credit when you redistribute (see [`NOTICE`](NOTICE)). if you copy long passages, keep attribution and point readers at the license text. (not legal advice - just matching what upstream already published.)
