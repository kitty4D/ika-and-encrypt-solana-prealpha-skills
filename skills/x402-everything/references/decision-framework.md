# decision-framework

A structured walkthrough for the question: **"Can my idea ship on x402 today?"**

Use this when scoping a new build. The framework is seven yes/no questions. Each question has guidance for "if yes" and "if no," and points to the relevant deeper reference.

The summary version of these questions appears in `SKILL.md`. This file is the deep version with worked examples.

---

## Question 1: Is the unit of value paid for behind an HTTP request?

**The premise of x402.** The protocol works for things that can be modeled as: "client makes an HTTP request, server gates it on payment, server returns a response."

### How to answer

Look at your idea's value-delivery surface. Is it:
- An API call? ✓
- A piece of content fetched from a URL? ✓
- A tool invocation an agent makes over HTTP/MCP? ✓
- A page view? ✓
- An on-chain action that doesn't go through HTTP? ✗
- A peer-to-peer payment with no service exchange? ✗
- A websocket session? Maybe — depends on how it's modeled
- A push notification? ✗ (no client-initiated HTTP request)

### If yes

You pass the most fundamental gate. Continue to Q2.

### If no

x402 is the wrong protocol. Consider:
- Pure on-chain payments → direct chain RPC
- Streaming/persistent connections → bespoke protocol or session-token + intermittent x402
- Off-chain peer payments → Lightning, custom off-chain channels

---

## Question 2: Is the asset USDC (or another EIP-3009-compatible token)?

x402 on EVM requires the asset to support EIP-3009 `transferWithAuthorization`. Solana's constraint is looser (any standard SPL token works) but USDC dominates everywhere in practice.

### How to answer

- USDC on Base / Polygon / Arbitrum / Ethereum / Solana / Stellar / etc.: ✓
- EURC on supported chains: ✓
- USDT, DAI, FRAX: ✗ (don't natively implement EIP-3009)
- ETH, SOL, MATIC, native chain tokens: ✗ (no EIP-3009)
- Project-specific tokens: ✗ unless they happen to have implemented EIP-3009 (rare)
- NFTs / non-fungibles: ✗

### If yes

Continue to Q3.

### If no

Three options:
1. **Use USDC anyway.** Convert at the wallet level or quote in USDC terms.
2. **Wait for the token to add EIP-3009.** Unlikely on a useful timeline.
3. **Use x402r escrow** which holds funds in a contract instead of using direct authorization — this could in principle support arbitrary ERC-20s, though adoption is early.

If your idea fundamentally requires a specific non-USDC asset, x402 is probably the wrong protocol today.

See `networks-and-assets.md` for the full constraint and the workaround details.

---

## Question 3: Is the chain in the supported set?

The protocol is chain-agnostic, but practical support depends on which facilitators implement which chains.

### How to answer

Production-ready chains: Base, Solana, Polygon, Arbitrum, Ethereum, Stellar, Avalanche, World, plus several others via specific facilitators.

Less mature: Aptos, Algorand, SKALE, Starknet, Injective, Sui, NEAR, Sei.

If your users are all on a chain that isn't on the list:
- Check facilitator docs (some support more chains than the official list)
- Self-host x402-rs which is extensible to new chains
- Reconsider whether a different chain works for the same use case

### If yes

Continue to Q4.

### If no

If users care which chain (e.g., chain-native dapp), the list constrains you. If users don't care (e.g., agent commerce), pick the chain that fits other criteria (cost, speed, facilitator availability) and let the facilitator handle the rest.

See `networks-and-assets.md` for the chain list and the chain-selection matrix.

---

## Question 4: Is one-shot per-request payment acceptable, or do you need recurring/streaming/escrow?

x402 base spec is request-scoped. Each `PAYMENT-SIGNATURE` is independent. Anything beyond "pay-per-call" requires either application-level state, the SIWX session extension, or x402r.

### How to answer

- One-shot per-call (pay $X for this scrape, this article, this inference): ✓ exactly what `exact` does
- Variable cost per call (pay between $X and $Y based on usage): partially — quote-then-charge or wait for `upto`
- Recurring billing (subscription): not native; build with SIWX sessions + scheduled `exact` calls
- Escrow / refundable: not native; use x402r
- Streaming per-second: not native; chain many `exact` calls or design a session abstraction
- Rental / time-share: not native

### If yes (you only need one-shot)

You're in the sweet spot. Continue to Q5.

### If no

| Need | Path |
|---|---|
| Variable cost | Quote endpoint + paid endpoint with `exact`, or wait for `upto` |
| Refunds | x402r escrow + dispute |
| Recurring | SIWX session + your own scheduling |
| Streaming | Chain `exact` calls per tick (with latency caveats), or wait for streaming scheme |
| Subscription | SIWX session + your own scheduling, optionally with x402r escrow |

See `schemes.md` for what's shipped vs proposed and the workaround patterns.

---

## Question 5: Is ~2 second settlement latency acceptable?

End-to-end x402 latency floors at ~1–2s on the fastest chains.

### How to answer

- Background jobs / async agents: ✓
- Interactive UI where 2s is fine: ✓
- Agent task chains with handful of paid calls: ✓ (parallelize where possible)
- Sub-second-sensitive systems: ✗
- Long agent chains with 50+ sequential paid calls: ✗ (would total minutes)

### If yes

Continue to Q6.

### If no

Mitigations:
- Use Solana for fastest settlement (~1s)
- Parallelize independent calls
- Pre-pay common operations or use SIWX sessions
- Use a faster off-chain payment system if latency is truly critical

If sub-second strict latency is required, x402 may not be the right tool.

See `protocol-flow.md` for the timing breakdown and `agent-and-mcp-patterns.md` for latency-aware design.

---

## Question 6: Are you OK depending on a facilitator (hosted or self-hosted)?

Most production x402 deployments depend on a facilitator. Self-hosting reduces vendor risk; decentralized facilitators are early but exist.

### How to answer

- Fine with hosted (CDP, QuickNode, Second State public): ✓ (acknowledge vendor lock-in)
- Will self-host (x402-rs, Second State binary): ✓ (own the ops)
- Need fully decentralized verification: partial — ChaosChain proposal exists, not production
- Want zero third-party dependency: design "no facilitator" with direct settlement

### If yes

Continue to Q7.

### If no

You can still use x402, but:
- Run your own facilitator (small ops cost, removes vendor)
- Implement direct verification + settlement in your server (more work, no third party)
- Wait for decentralized facilitator infrastructure to mature

See `facilitators.md` for the trade-off table.

---

## Question 7: Is the payment amount above the minimum-viable economics floor?

Every transaction has overhead (gas + facilitator fees). Below a floor, the math doesn't work.

### How to answer

Approximate floors per chain:
- Stellar: sub-cent (sponsored fees)
- Solana: ~$0.001
- Base: a few cents in gas
- Polygon: ~$0.01
- Ethereum mainnet: dollars

If your idea is a $0.0001 micropayment on Ethereum mainnet, the gas eats it. If it's a $0.05 micropayment on Solana or Stellar, you're fine.

### If yes

You can ship. See the worked examples below.

### If no

- Pick a cheaper chain (Stellar, Solana)
- Batch payments (one transaction = many logical operations)
- Reconsider the unit economics — maybe charging more per call works

---

## Worked example 1: podcast tipping app on Solana, $0.10 tips

| Q | Answer | Reasoning |
|---|---|---|
| 1. HTTP request? | ✓ | Tipper's app sends a POST to the podcast's tip endpoint |
| 2. USDC? | ✓ | USDC-SPL on Solana |
| 3. Chain supported? | ✓ | Solana mainnet is first-class |
| 4. One-shot? | ✓ | Each tip is independent |
| 5. ~2s OK? | ✓ | Solana settles ~1s; tipper waits briefly |
| 6. Facilitator OK? | ✓ | Use any of the SVM-supporting facilitators |
| 7. Above economic floor? | ✓ | $0.10 well above Solana's ~$0.001 floor |

**Verdict:** ships today on x402, no extensions needed. Pick a facilitator (CDP if you want hosted, x402-rs if you want self-hosted), use the `exact` scheme, target Solana + USDC-SPL.

---

## Worked example 2: pay-per-second GPU inference on Ethereum mainnet, $0.01/second

| Q | Answer | Reasoning |
|---|---|---|
| 1. HTTP request? | ✓ | Inference triggered by HTTP |
| 2. USDC? | ✓ | USDC-Ethereum |
| 3. Chain supported? | ✓ | Ethereum mainnet supported |
| 4. One-shot? | ✗ | Per-second billing is variable / streaming |
| 5. ~2s OK? | partial | Each tick must clear within the second |
| 6. Facilitator OK? | ✓ | Hosted or self-hosted |
| 7. Above floor? | ✗ | $0.01 on Ethereum mainnet is eaten by gas |

**Verdict:** **doesn't ship as-is on Ethereum mainnet.** Two changes make it work:

- Switch to Solana or Stellar (clears the economic floor)
- Re-model as discrete chunks (chain `exact` calls per chunk, e.g., 10-second blocks at $0.10 each), or use x402r escrow for variable-cost reconciliation

Re-evaluate: on Solana with 10-second chunks at $0.10, all seven gates pass.

---

## Worked example 3: NFT-as-payment for in-game cosmetics

| Q | Answer | Reasoning |
|---|---|---|
| 1. HTTP request? | ✓ | Game client sends purchase request |
| 2. USDC? | ✗ | Wants to use NFTs as the payment unit |
| 3. Chain supported? | n/a | Doesn't matter — Q2 already failed |
| 4–7 | n/a | Doesn't reach these |

**Verdict:** **doesn't ship.** No supported scheme for NFT-as-payment. Workarounds:

- Sell the cosmetic for USDC instead, leave NFT ownership as a separate concept
- Use direct on-chain logic (not x402) to transfer the NFT
- Wait for / propose a non-fungible scheme (no roadmap signal as of writing)

---

## Worked example 4: AI agent calls 5 paid APIs to research a topic, $0.05 each, on Base

| Q | Answer | Reasoning |
|---|---|---|
| 1. HTTP request? | ✓ | Each tool call is HTTP/MCP |
| 2. USDC? | ✓ | USDC-Base |
| 3. Chain supported? | ✓ | Base is first-class |
| 4. One-shot? | ✓ | Each call independent |
| 5. ~2s OK? | partial | 5 sequential = 10s; parallelize to ~2s total |
| 6. Facilitator OK? | ✓ | But watch the Base race condition (`limitations-and-gotchas.md`) |
| 7. Above floor? | ✓ | $0.05 on Base is fine |

**Verdict:** ships today. Design notes:
- Parallelize the 5 calls
- Implement budget caps per task and per counterparty (`agent-and-mcp-patterns.md`)
- Add chain-side double-check to defend against the Base race condition
- Consider Solana if 2s parallelized is still too slow

---

## Worked example 5: subscription newsletter at $5/month, audience is mainstream non-crypto

| Q | Answer | Reasoning |
|---|---|---|
| 1. HTTP request? | ✓ | Subscriber's browser fetches issues |
| 2. USDC? | ✓ | USDC-anywhere |
| 3. Chain supported? | ✓ | Pick any |
| 4. One-shot? | ✗ | Recurring monthly billing |
| 5. ~2s OK? | ✓ | Newsletter latency is forgiving |
| 6. Facilitator OK? | ✓ | Any |
| 7. Above floor? | ✓ | $5 is fine on any chain |

But there's an off-list disqualifier: **Q2.5 (implicit) — does your audience hold wallets?** Mainstream non-crypto audiences don't, and won't onboard to read a newsletter. Even if all seven gates pass technically, the UX doesn't.

**Verdict:** technically possible (with x402r escrow or SIWX session for the recurring part), but **don't build this.** The wallet-onboarding friction will kill the funnel. Use Substack or Stripe.

---

## The implicit gates not in the seven-question list

- **Does your audience hold wallets?** Most mainstream consumer audiences don't. Most agents do. Most crypto-native audiences do. Check before building.
- **Does refund/dispute matter to your buyers?** If yes, plan for x402r or for a non-x402 system that has them natively.
- **Are you comfortable with on-chain transparency?** Every settlement is visible on-chain. Privacy-sensitive use cases need additional layers.
- **Does the Base #1062 race condition affect you?** If targeting Base + CDP, plan around it (`limitations-and-gotchas.md`).

These don't fit cleanly in the structured framework but matter for the build/don't-build call.

---

## Summary

The seven questions filter out almost all bad fits in a few minutes. If you pass all seven, ship a small pilot before scaling. If you fail one, the corresponding workaround section tells you what to change.

When in doubt, look up the closest precedent in `use-case-catalog.md` and see what they did.
