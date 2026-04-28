# x402-everything agent skill

**unofficial** vendor-neutral agent skill for the x402 HTTP payment protocol (`skills/x402-everything/`). this is a totally separate thing from the ika and encrypt skills in this repo - they don't talk to each other, they don't share code, they barely make eye contact.

normative sources: [docs.x402.org](https://docs.x402.org/) and [github.com/x402-foundation/x402](https://github.com/x402-foundation/x402). when this skill disagrees with the live spec, trust the live spec.

## what this skill is and isn't

it IS:
- vendor-neutral. coinbase CDP, base, USDC are listed as ONE OPTION AMONG MANY alongside x402-rs (rust, self-host), second state, stellar's free public facilitator, solana, polygon, ruby-x402, elixir x402, all of it
- comprehensive. covers protocol mechanics, schemes, networks, assets, facilitators, the whole vendor landscape, all the use cases people are actually building, all the limitations that get downplayed in marketing
- idea-fit oriented. there's a 7-question decision framework with worked examples so you can figure out if YOUR idea ships today or hits a wall

it ISN'T:
- a coinbase shill deck. nothing is centered on CDP / bazaar / agentkit just because they pay for the most billboards
- an SDK tutorial. if you want to wire up `@x402/express` for the fifteenth time, go to vercel's docs. this skill is the layer above that
- affiliated with anyone. not the x402 foundation, not coinbase, not the linux foundation, not any chain or facilitator vendor. literally just a third party reference
- about the ika or encrypt stuff in this repo. that's solana pre-alpha cryptography stuff. x402 is about web payments. they coexist in this repo for unrelated reasons

## what's in the box

| path | contents |
| --- | --- |
| `skills/x402-everything/` | [`SKILL.md`](skills/x402-everything/SKILL.md) hub |
| `skills/x402-everything/references/` | the deep stuff: protocol flow, headers and payloads, schemes, networks and assets, facilitators, use case catalog, decision framework, limitations and gotchas, agent and MCP patterns, v1 vs v2, ecosystem snapshot, sources, docs revision |

refresh manually when needed; see [`docs-revision.md`](skills/x402-everything/references/docs-revision.md) for the date-stamped list.

## the 7-question decision framework (the whole point)

if you have an idea and want to know if x402 can do it, the [`decision-framework.md`](skills/x402-everything/references/decision-framework.md) walks you through:

1. is the unit of value paid for behind an http request?
2. is the asset USDC (or another EIP-3009 token)?
3. is the chain in the supported set?
4. is one-shot per-request payment ok, or do you need recurring/streaming/escrow?
5. is ~2 second settlement latency ok?
6. are you ok depending on a facilitator?
7. is the payment amount above the minimum economic floor (gas + facilitator fees)?

worked examples in there too: podcast tipping on solana ✓ ships today. per-second GPU billing on ethereum mainnet ✗ doesn't (gas eats it; switch chain or rethink). NFT-as-payment ✗ no scheme exists.

## where this skill is honest about limits

[`limitations-and-gotchas.md`](skills/x402-everything/references/limitations-and-gotchas.md) is the antidote to vendor decks. it covers:

- the EIP-3009 hard constraint (basically only USDC works on EVM today)
- the base facilitator timeout vs block confirmation race condition (issue #1062, unfixed at time of writing - users have lost money)
- the 402bridge security incident from october 2025 (~$200k+ drained from a centralized bridge built on x402)
- the adoption-vs-narrative gap (headline volume vs real daily volume)
- a full anti-patterns table

if your idea depends on something in there, treat it as a yellow or red flag.

## where the receipts live

[`sources.md`](skills/x402-everything/references/sources.md) is every URL referenced anywhere in this skill, grouped by category. official docs, spec markdown, foundation github, awesome list, independent SDKs, extensions, discovery layers, vendor docs, use cases, critical takes, educational deep-dives. if a claim in this skill isn't traceable to something in there, it's a gap - flag it.

## install

the skill folder must stay intact: `SKILL.md` and `references/` as siblings under **`skills/x402-everything/`**. do not split them. 

### `npx skills` ([skills.sh](https://skills.sh/) / Vercel CLI)

vercel's [agent skills guide](https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context) describes installing from a repo path. point it at the skill folder:

```bash
npx skills add https://github.com/kitty4D/ika-and-encrypt-solana-prealpha-skills/tree/main/skills/x402-everything
```

add `-g` for global install when supported. see [skills.sh CLI docs](https://skills.sh/docs/cli) and `npx skills --help` for your version.

### cursor

use [cursor agent skills](https://cursor.com/docs/context/skills): copy **`skills/x402-everything/`** into your project or user skills location so the folder name still matches the skill `name` in frontmatter (`x402-everything`), or point the tool at that path. keep `references/` next to `SKILL.md`.

### claude code

each skill is a directory containing `SKILL.md` (typically `~/.claude/skills/<name>/` or `.claude/skills/<name>/` in a project). copy **`skills/x402-everything/`** so `SKILL.md` and `references/` stay siblings.

### other assistants

anything that can ingest a markdown skill manifest plus linked reference files (open folder, or single root doc with relative links) should work. keep the folder intact.

## scope (quick)

protocol mechanics (the four-phase request/response flow + three v2 headers), schemes (`exact` shipped, `upto` proposed, x402r escrow extension), networks (base, solana, polygon, arbitrum, stellar, aptos, algorand, more), assets (USDC dominance via EIP-3009, EURC noted), facilitators (hosted, self-hosted, decentralized proposals), the full use-case catalog (API monetization, paywalls, AI agent commerce, MCP paid tools, streaming, gaming, IoT, social, e-commerce, AI model marketplaces, more), the 7-question idea-fit framework, the honest limitations writeup, agent commerce design playbook, v1 vs v2 differences, ecosystem snapshot of SDKs across TS/python/go/rust/ruby/elixir, and a full sources list.

vendor-neutral throughout.

## where to file issues

bug in this skill? something stale? new community SDK or use case worth adding? open an issue at [github.com/kitty4D/ika-and-encrypt-solana-prealpha-skills](https://github.com/kitty4D/ika-and-encrypt-solana-prealpha-skills) and tag it `x402-everything` so it doesn't get tangled up with the unrelated ika or encrypt issues.

## license and attribution

this repository is licensed under **CC-BY-4.0** (see [`LICENSE`](LICENSE)). x402 spec content from the foundation repo is referenced under the foundation's published licensing terms; this skill is a third-party summary and reference, not an official drop. when redistributing, keep attribution and see [`NOTICE`](NOTICE). not legal advice, just being a polite citizen of the open-source commons.
