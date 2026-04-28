# docs-revision

Version pinning and freshness tracking for the `x402-everything` skill.

## Pinned spec version

- **Spec:** x402 v2.0
- **Skill content vetted:** 2026-04-27
- **Foundation governance:** x402 Foundation (Linux Foundation steward), launched 2026-04-02

## Last-checked dates per primary source

| Source | URL | Last checked |
|---|---|---|
| Official docs (introduction) | https://docs.x402.org/introduction | 2026-04-27 |
| Official docs (full index) | https://docs.x402.org/llms.txt | 2026-04-27 |
| Spec markdown | https://github.com/x402-foundation/x402/blob/main/specs/x402-specification.md | 2026-04-27 |
| Foundation GitHub | https://github.com/x402-foundation/x402 | 2026-04-27 |
| Awesome list | https://github.com/xpaysh/awesome-x402 | 2026-04-27 |
| x402-rs (independent Rust facilitator) | https://github.com/x402-rs/x402-rs | 2026-04-27 |
| x402r refunds proposal | https://docs.x402r.org/ | 2026-04-27 |

## When to refresh this skill

Trigger a refresh of one or more reference files when any of these happen:

- **Spec version change** (v2.x → v3) → re-read the entire skill, especially `protocol-flow.md`, `headers-and-payloads.md`, `schemes.md`, `v1-vs-v2.md`
- **New scheme ships** (e.g., `upto` moves from proposed to released) → update `schemes.md` and `decision-framework.md`
- **New chain or asset added** to the official supported list → update `networks-and-assets.md`
- **New facilitator joins or leaves** → update `facilitators.md` and `ecosystem-snapshot.md`
- **Known bug in `limitations-and-gotchas.md` is fixed** (e.g., the Base race condition issue #1062) → move from "known bugs" to a historical note
- **A use case in `use-case-catalog.md`** moves status (Theorized → Working prototype → Live, or vice versa to abandoned) → update its status tag
- **An entry in `sources.md`** returns 404 or relocates → update the URL and re-vet the cited claim

## How this skill handles drift

Unlike the `ika-solana-prealpha` and `encrypt-solana-prealpha` skills in this repo, `x402-everything` does **not** ship a drift-detection script or audit harness. Rationale:

- x402 v2 is a stable, published spec — not a moving pre-alpha target
- The skill is implementation-agnostic; there is no specific code surface to scan for outdated patterns
- Drift here looks like *new ecosystem entries* or *resolved bugs*, not silent code breakage

Refreshes are manual and date-stamped above.
