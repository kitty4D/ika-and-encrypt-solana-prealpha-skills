# ecosystem-snapshot

A vendor-neutral inventory of x402 SDKs, facilitators, discovery layers, and frameworks. Updated `2026-04-27` per `docs-revision.md`.

This file leans toward **completeness over endorsement**. Multiple options are listed in every category. Where one option dominates by adoption, that's noted, but no option is presented as the canonical default.

## SDKs by language

### TypeScript / JavaScript

The largest SDK surface area, mostly under the `@x402/*` namespace in the foundation repo.

| Package | Purpose |
|---|---|
| `@x402/core` | Transport-agnostic primitives (client, server, facilitator base) |
| `@x402/evm` | EVM chain implementation |
| `@x402/svm` | Solana implementation |
| `@x402/stellar` | Stellar implementation |
| `@x402/aptos` | Aptos implementation (community) |
| `@x402/express` | Express.js middleware |
| `@x402/fastify` | Fastify integration |
| `@x402/hono` | Hono framework integration |
| `@x402/next` | Next.js integration |
| `@x402/fetch` | Client wrapper around `fetch()` |
| `@x402/axios` | Axios interceptor for automatic retry-with-payment |
| `@x402/paywall` | Paywall UI helpers |
| `@x402/extensions` | SIWX, Bazaar, Payment-Identifier, etc. |
| `@x402/mcp` | MCP integration helpers |

Notes:
- All `@x402/*` packages target v2 spec
- Backward compatibility with v1 servers via shims in `@x402/core`

### Python

Official SDK in the foundation repo. Async + sync variants.

- FastAPI middleware
- Flask middleware
- Facilitator client
- HTTP client wrappers
- Type hints throughout
- Integrations targeting common AI agent frameworks

### Go

Two production-grade options:

| Package | Maintainer | Notes |
|---|---|---|
| Official Go SDK | x402 Foundation | Goroutine-safe, structured errors, web framework integration |
| `mark3labs/x402-go` | Independent | Framework-agnostic (net/http, Chi, Gin, PocketBase); multi-chain USDC helpers; MCP integration |

Both are real and maintained. Pick by feature fit.

### Rust

| Package | Notes |
|---|---|
| `x402-rs` | Production-grade, Docker-deployable facilitator. EVM + Solana + Aptos. OpenTelemetry observability. Sub-50ms verification. Most respected independent stack. |
| `second-state/x402-facilitator` | Forked from x402-rs; supports Sei + Polygon + Solana + Base; published on crates.io |
| x402nano | Smaller / experimental |

### Ruby

| Gem | Notes |
|---|---|
| `ruby-x402` | Rack middleware + facilitator client; EVM + Solana support. Quietly mature, low marketing |

### Elixir

HexDocs `x402` v0.3.1: PaymentGate Plug, per-route payment configuration. Functional ecosystem support.

### Java

Mentioned in the official docs but less mature than the above. Check the foundation repo for current state.

### Other languages

Awesome-x402 (https://github.com/xpaysh/awesome-x402) is the best community list and may include implementations not surveyed here.

---

## Facilitator implementations

See `facilitators.md` for the design-level discussion. This table is the inventory.

### Hosted

| Provider | Chains | Notes |
|---|---|---|
| Coinbase Developer Platform (CDP) | Base, Polygon, Arbitrum, World, Solana | 1,000 tx/month free tier; largest hosted footprint |
| QuickNode | Multiple, via QuickNode RPC | Bundled with broader RPC infra |
| Second State (public endpoint) | Sei, Polygon, Solana, Base | Open-source binary; can self-host the same code |
| Stellar public facilitator | Stellar | Free, sponsored fees, sub-cent micropayments |

### Self-hosted

| Project | Language | Chains |
|---|---|---|
| x402-rs | Rust | EVM + Solana + Aptos (extensible) |
| Second State (open-source binary) | Rust | Same as the hosted version |
| Reference TypeScript facilitator | TypeScript | EVM (reference, not optimized) |

### Decentralized (proposal stage)

| Project | Status |
|---|---|
| ChaosChain decentralized facilitator | WIP — uses Chainlink CRE for BFT consensus |

---

## Discovery layers

| Layer | Operator | Notes |
|---|---|---|
| Bazaar | Coinbase Developer Platform | Largest catalog (~4,000+ services); semantic search; trust scoring; MCP server interface |
| x402.direct | Independent | Independent search engine; not Coinbase-controlled |
| Cinderwright Discovery Hub | Independent | Daily crawl, 2x-daily health checks, reliability scoring |
| Direct MCP advertisement | Per-MCP-server | Many MCP servers expose `paidTools` directly without an external directory |

---

## Extensions

| Extension | Purpose |
|---|---|
| Sign-In-With-X (SIWX, CAIP-122) | Wallet-controlled session identity; enables subscription / session patterns |
| Bazaar | Discovery primitives |
| EIP-2612 / Permit | Gas-sponsored permit-based transfers (alternative to EIP-3009) |
| ERC-20 Gas Sponsoring | Generic gas sponsorship for ERC-20 transfers |
| Payment-Identifier | Idempotency / correlation IDs |
| Signed Offers & Receipts | Cryptographic receipt format |
| x402r (separate proposal) | Escrow-backed refunds and dispute resolution |

---

## AI agent and MCP integrations

| Project / framework | Operator | Notes |
|---|---|---|
| Coinbase AgentKit | Coinbase | Includes x402 as an agent payment primitive |
| Cloudflare Agents | Cloudflare | Edge-deployed agents with x402 support |
| ElizaOS | Independent | AI agent framework with x402 integration |
| Vercel x402-mcp | Vercel | Wraps `mcp-handler` with `paidTools` definitions |
| mark3labs/mcp-go-x402 | Independent | Go MCP transport bridging agents to x402 APIs |
| Google A2A x402 extension | Google | Standardized agent-to-agent protocol layered on x402 |
| AWS Bedrock AgentCore | AWS | Agent framework with x402 support |
| Sentient, Giza, ChaosChain, CodecFlow, ampli^ | Various | Independent agent platforms with x402 commerce |

---

## Foundation governance

- **Repository:** https://github.com/x402-foundation/x402 (canonical)
- **Steward:** Linux Foundation
- **Founding coalition (announced):** Coinbase, Cloudflare, AWS, Google, Microsoft, Visa, Mastercard, Stripe
- **Pre-foundation development:** continued at https://github.com/coinbase/x402 (now a development fork)
- **Community curated index:** https://github.com/xpaysh/awesome-x402

---

## What's missing or weak

Honest gaps in the ecosystem as of writing:

- **Privacy-preserving x402.** No production implementation. The "z402.cash" claim is unverified.
- **Decentralized facilitators.** Proposed (ChaosChain), not in production at scale.
- **NFT or non-fungible asset schemes.** Not in spec. Would need new scheme work.
- **True streaming / per-second billing scheme.** Not in spec. Workarounds (chained `exact` calls, x402r escrow) exist.
- **Mass-consumer wallet UX.** The protocol assumes wallets exist. Outside crypto-native audiences, this remains a real onboarding gate.
- **Mid-market commercial products.** Lots of indie prototypes, lots of big-company adoptions. The middle ($1M–$50M ARR commercial products built on x402) is sparse.

---

## How to refresh this snapshot

When you suspect this file is stale:

1. Check `docs-revision.md` for the last-vetted date
2. Re-read https://github.com/x402-foundation/x402 README for new packages
3. Check https://github.com/xpaysh/awesome-x402 for new community entries
4. Search GitHub for "x402" sorted by recently-updated
5. Update entries here, bump the date in `docs-revision.md`
