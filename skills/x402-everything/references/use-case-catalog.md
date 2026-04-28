# use-case-catalog

A vetted inventory of what people are actually building or seriously theorizing with x402, organized by category. Each entry tagged with status:

- **Live** — running in production with real users
- **Working prototype** — built and demonstrated (often hackathon), not necessarily at scale
- **Theorized** — design proposed in writing or talks, no shipped implementation found
- **Unverified** — claim found in marketing/landing-page form with no code, spec, or working demo behind it (treat with skepticism)

Use this when scoping a new idea: find the closest precedent, learn from its status, decide whether to extend or pivot.

---

## API monetization and pay-per-call

**The single largest x402 use case category by transaction count.**

| Project | Status | What's interesting |
|---|---|---|
| **Firecrawl** | Live | Web scraping API at $0.01 per scrape. Canonical "small price, frequent use" pattern |
| **Neynar (Farcaster APIs)** | Live | Per-call pricing on Farcaster data; agents pay only for what they pull, skip the API-key tier dance |
| **QuickNode RPC** | Live | RPC endpoints monetized via x402, 80+ chains. Demonstrates infrastructure-grade adoption |
| **Alchemy** | Live | x402 + autonomous signup + gas sponsorship across 100+ chains |

**Pattern:** simple `exact` scheme, USDC, response is a single JSON payload. The cleanest x402 fit.

**Where it works:** APIs that have natural per-call pricing, low per-call cost (cents to fractional cents), and clients who care about not maintaining accounts.

**Where it doesn't:** APIs with highly variable cost per call (use quote-then-charge or wait for `upto`), APIs where the value-per-call is sub-cent (overhead eats it), APIs whose users won't or can't run wallets.

---

## Content paywalls

| Pattern | Status | What's interesting |
|---|---|---|
| Article paywall ($0.05–$0.25 per article) | Live (multiple sites) | Replaces subscription friction; reader pays once, gets content |
| Video / streaming paywall ($0.50–$2 per video) | Live (multiple sites) | Same model at higher price |
| Mirror.xyz-style monetized writing | Working prototype | Crypto-native publishing already exists; x402 layer makes per-piece payment standard over HTTP |
| Paid newsletter (per-issue) | Theorized | No major adoption found; substack/newsletter incumbents have account-based moats |

**Pattern:** server gates content with 402, returns teaser in response body (v2 lets you do this), reveals full content after settlement.

**Where it works:** content where the user knows they want it (already on the page), pricing in the few-cents-to-few-dollars range, audience that already runs wallets.

**Where it doesn't:** discovery-heavy content (browsing / scrolling — too much friction), audiences without wallets (mainstream consumer), prices below the chain's economic floor.

---

## AI agent commerce

**The fastest-growing category, where x402's design pays off most.**

| Project / framework | Status | What's interesting |
|---|---|---|
| **Coinbase AgentKit** | Live | x402 baked in; agents make autonomous purchases as a primitive |
| **Cloudflare Agents** | Live | Edge-deployed agents with x402 payment support |
| **ElizaOS** | Live | AI agent framework with x402 integration |
| **Sentient** | Live | Agent commerce platform |
| **Giza** | Live | ML model serving with x402-gated inference |
| **ChaosChain** | Working prototype | Decentralized facilitator + agent payment patterns |
| **CodecFlow** | Live | Code-generation agent with paid tool calls |
| **ampli^** | Live | Agent commerce / discovery platform |

**Pattern:** agent receives task → discovers paid tool/API (via Bazaar, x402.direct, Cinderwright, or hardcoded URL) → evaluates price against budget → makes call with `PAYMENT-SIGNATURE` → uses response → potentially makes more calls.

**Where it works:** any task where an agent needs paid data, paid compute, paid actions, and the per-call cost fits in the agent's budget.

**Where it doesn't:** agents with hard sub-second latency requirements, agents in trust-minimized settings where facilitator dependency is unacceptable, agents needing to spend amounts where payment-receipt finality matters more than speed.

See `agent-and-mcp-patterns.md` for the agent-specific design playbook.

---

## MCP paid tools

x402 + Model Context Protocol = paid MCP tools that AI agents can discover and call.

| Project | Status | What's interesting |
|---|---|---|
| **Bazaar (CDP)** | Live | Discovery layer for paid MCP/x402 services. Indexes 4,000+ services |
| **x402-mcp (Vercel)** | Live | Wrapper around `mcp-handler` with `paidTools` definitions; integrates with Vercel AI SDK + Claude Desktop |
| **mcp-go-x402 (mark3labs)** | Live | Go MCP transport with x402 — bridges Go agents to x402 APIs |
| **x402-discovery-mcp** | Working prototype | Alternative MCP discovery implementation |
| **Cinderwright Discovery Hub** | Live | Health-monitored x402 service indexer with daily crawl + 2x-daily health check |
| **MCPay (Solana hackathon)** | Working prototype | Pay-per-tool-call MCP gateway built at the Solana x402 hackathon |

**Pattern:** MCP server declares some tools as `paidTools` with a price; calling them returns a 402 with `PAYMENT-REQUIRED`; agent SDK transparently handles the payment retry; tool returns its result.

**Where it works:** MCP-native agent stacks (Claude Desktop, Vercel AI SDK with MCP), tool authors who want to monetize without API-key bureaucracy.

**Where it doesn't:** non-MCP tool ecosystems, tools that are free as a strategic choice, tools whose value is below the chain economic floor.

---

## Streaming and per-second billing

| Project | Status | What's interesting |
|---|---|---|
| **Micro402** | Working prototype (early) | Per-second billing for video/audio/API streams. Wallet-based auth + session auto-renewal. Genuinely novel attempt at sub-call granularity |
| GPU inference per-second billing | Theorized | Discussed in many design pieces; depends on `upto` shipping or x402r escrow |
| LLM token-cost billing | Theorized | Same dependency on variable-cost scheme |

**Pattern:** chain many short `exact` calls (every N seconds), or use a session token to amortize, or wait for `upto`.

**Where it works today:** coarse-grained streaming where each "tick" is a separate request and the per-tick cost clears the floor.

**Where it doesn't:** anything truly sub-second, anything where session lapses cause real damage (mid-video cutoff), variable-cost-per-tick.

---

## Gaming

| Project / pattern | Status | What's interesting |
|---|---|---|
| **x402 + ERC-8001 for AI NPCs** | Theorized | AI-controlled NPCs and factions monetize per-interaction services (dynamic weather, procedural missions) |
| In-game asset access (per-use) | Theorized | Pay per use of a rare item or special action, instead of buying outright |
| Cosmetic / customization per-use | Theorized | Single-session cosmetics priced as micropayments |

**Status note:** I found design proposals and one published Medium piece, but no shipped game using x402 in production at the time of writing. This is a "promising but unproven" category.

**Where it might work:** games already integrating wallets (web3 games, agent-controlled game environments), games where AI NPCs are part of the design.

**Where it likely won't:** AAA / mobile games whose users won't onboard wallets, F2P games whose business model is anchored to ad revenue.

---

## IoT and hardware

| Project | Status | What's interesting |
|---|---|---|
| **PlaiPin** (Solana x402 hackathon, Nov 2025) | Working prototype | ESP32 microcontroller ($5) running its own wallet + making x402 payments. First IoT-native demo |
| Vending machine concepts | Theorized | "Wallet-pays-machine" demos discussed; nothing shipped at scale |
| EV charging concepts | Theorized | Per-second or per-kWh billing via x402; depends on streaming/`upto` |
| Printer / appliance pay-per-use | Theorized | Pay-per-print, pay-per-cycle |

**Pattern:** the hardware client signs off-chain; the service it interacts with (or a gateway) verifies and settles. Constrained mostly by hardware-side wallet security.

**Where it works:** demo-scale hardware with controlled environments, internal corporate IoT.

**Where it doesn't:** consumer hardware where key management is a non-starter, anything requiring strong tamper resistance without HSM/secure-element support.

---

## Decentralized social and creator monetization

| Project / pattern | Status | What's interesting |
|---|---|---|
| **Neynar (Farcaster mini-apps)** | Live | Mini-apps avoid free-tier limits via x402 pay-per-use; agents tip and purchase within the social graph |
| Tip jar pattern (any creator) | Live (multiple) | Creator publishes a wallet address; tippers send via x402; works on any chain |
| Per-post paywalled content (Lens, Farcaster, etc.) | Working prototype | Several demos; no breakout adoption |
| Agent-managed creator treasury | Theorized | Agent represents the creator, autonomously buys / monetizes / distributes |

**Where it works:** crypto-native social platforms whose users already hold wallets.

**Where it doesn't:** mass-market platforms (Twitter/X, Instagram, TikTok) whose users don't hold wallets and whose business models conflict with crypto rails.

---

## E-commerce and agent shopping

| Project | Status | What's interesting |
|---|---|---|
| **Shopify x402 integration** (Solana hackathon) | Working prototype | Store owners paste URL + auth; AI agents browse and buy autonomously. Bridges traditional commerce to agent economy |
| Agent-to-store flows | Working prototype | Agent searches multiple stores via Bazaar, picks based on price+reliability, settles via x402 |
| Group / DAO procurement | Theorized | A DAO's agent buys software, services, or compute on the DAO's behalf |

**Where it works:** agents acting on user instructions for known purchases (refill subscription, restock inventory), agents acting under tight budget caps.

**Where it doesn't:** consumer purchases requiring human review, anything where chargeback / refund rights are a buyer protection (x402 has no native chargebacks).

---

## AI model and inference marketplaces

| Project | Status | What's interesting |
|---|---|---|
| **Intelligence Cubed (i³)** | Working prototype | "Taobao + stock market for AI models" — invoke models after wallet auth |
| Per-inference paid model serving | Live (multiple via Giza, Bazaar, etc.) | Standard pattern: API monetization category applied to ML |
| Model rental / time-share | Theorized | Pay for exclusive access to a model for a fixed period; not in current scheme set |

**Where it works:** model serving where each inference has a knowable price and the consumer is software (an agent, another model, a pipeline).

**Where it doesn't:** models whose runtime cost varies dramatically with input (use quote-then-charge), models requiring long-running stateful sessions.

---

## Cross-chain and bridge use cases

| Project | Status | What's interesting |
|---|---|---|
| **402Bridge** | Was live, breached October 2025 | Cross-chain bridge built on x402; suffered ~$200k+ exploit. **See `limitations-and-gotchas.md` for the structural lesson.** |
| Multi-chain payment routing | Theorized | Facilitator picks chain based on cost + user balance; nothing standardized |

**Pattern note:** bridges built on x402 inherit all the risks of bridges in general. The protocol doesn't make them safer; if anything, the abstraction can hide custodial risk.

---

## Infrastructure-grade adopters

These are big-company integrations using x402 as a substrate. Listed for completeness, not endorsement.

| Adopter | Status | What's interesting |
|---|---|---|
| **Cloudflare Workers** | Live | Edge-deployed paid services; CDN paywalls for AI crawlers |
| **Google A2A protocol** | Live | Agent-to-agent protocol with x402 extension (https://github.com/google-agentic-commerce/a2a-x402) |
| **AWS Bedrock AgentCore** | Live | x402 payments supported in Amazon's agent framework |
| **Chainlink CRE (Compute / Runtime Environment)** | Live | x402 is first AI payment partner; agents trigger CRE workflows + pay in same HTTP round-trip |
| **Visa, Mastercard, Stripe** | Foundation members (governance, not direct use yet) | Joined x402 Foundation; no live x402 product from them yet |

---

## Theorized / proposed (no shipped implementation found)

| Idea | Status | What's interesting |
|---|---|---|
| **Open-source maintainer funding** | Theorized | Per-download or per-API-call payments to open-source projects; infrastructure exists, no breakout project found |
| **DAO autonomous treasury operations** | Theorized | A DAO's agent buys services on its behalf with hard caps |
| **Privacy via z402.cash** | Unverified | Landing page claims x402 ↔ Zcash bridging. **No code or technical doc found.** Treat as marketing-only until primary source surfaces |
| **Decentralized facilitator (ChaosChain)** | Working prototype | Real WIP; addresses single-facilitator-as-SPOF concern |
| **Streaming via `upto`** | Theorized | Awaits scheme shipping |
| **NFT-as-payment** | Theorized | No scheme exists; would need new spec work |

---

## Surprising patterns (cross-cutting observations)

- **Indie + enterprise, but the middle is empty.** Lots of hackathon prototypes, lots of big-company adopters; not many medium-sized commercial products yet.
- **Rust + Go are leading systems-level adoption** despite Python's AI dominance. Suggests infra engineers, not data scientists, are driving x402.
- **Ruby and Elixir gems exist** but with almost zero marketing — organic adoption in smaller bubbles.
- **No published failure narratives.** Either projects don't fail publicly, failures are quiet, or the ecosystem is too new to accumulate them. Be skeptical of any "x402 always works" framing.
- **Discovery layers index the same ~4,000–5,000 services.** Apparent diversity may be lower than ecosystem rhetoric suggests.
- **Privacy is absent.** No production privacy-preserving x402 today. A real gap if regulation tightens.
- **Coinbase ecosystem dominates marketing volume** but production volume is more distributed (Solana 35M+ tx independent of CDP, plus Cloudflare, Google, AWS).

For a critical perspective on adoption-vs-narrative gap, see `limitations-and-gotchas.md`.
