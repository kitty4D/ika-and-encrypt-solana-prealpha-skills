# schemes

A "scheme" in x402 defines how a payment is authorized, verified, and settled. The scheme is the primary degree of freedom in the protocol — it determines whether you can charge a fixed amount, a variable amount, escrow funds, or do recurring billing.

Use this when choosing how to price your endpoint, or when figuring out whether a use case (variable cost, refunds, streaming) is shippable today.

## At a glance

| Scheme | Status | What it does |
|---|---|---|
| `exact` | Shipped (only production scheme) | Strict equality: client pays exactly the amount, asset, and recipient the server quoted |
| `upto` | Proposed, not shipped | Variable cost: client authorizes a maximum, server settles for actual usage |
| `exact-with-refund` (x402r) | Beta extension | Adds escrow + dispute resolution on top of exact |
| Custom future schemes | Theorized | Streaming/recurring/conditional — not in spec yet |

## `exact` — the only shipped scheme

This is what every `x402` integration today uses unless explicitly noted otherwise.

### Mechanics

- Server quotes `maxAmountRequired`, `asset`, `payTo`, `network` in `PaymentRequirements`
- Client signs a payload that pays *exactly* that amount to *exactly* that recipient
- Facilitator verifies equality across all four fields before settling
- No overpayment, no underpayment, no substitution

### Per-chain implementations

The `exact` scheme has chain-specific specs:

- **EVM** (`scheme_exact_evm.md`): payload is an EIP-3009 `transferWithAuthorization`
- **Solana** (`scheme_exact_svm.md`): payload is a signed SPL token transfer authorization
- **Algorand** (`scheme_exact_algo.md`): payload uses Algorand's transaction signing primitives

These differ in payload structure but behave identically from the protocol's view. See `headers-and-payloads.md` for the actual payload shapes.

### What `exact` is good for

- Pay-per-call APIs (one request = one fixed price)
- Content paywalls (one article = $0.10)
- One-shot agent purchases (agent buys data, scrape, or model inference at a known price)
- Tip jars (sender chooses amount, server quotes back exactly that amount)

### What `exact` cannot do

- Charge based on consumption that isn't known until after the work is done (LLM tokens generated, GPU seconds used)
- Allow partial refunds without a separate transfer
- Stream payments over time
- Reserve funds without spending them

For these, see `upto` (when it ships) or `exact-with-refund` via x402r.

## `upto` — proposed variable-cost scheme

`upto` is the most-discussed not-yet-shipped scheme. It would let clients authorize a *maximum* amount, with the server settling for whatever was actually consumed.

### What it would unlock

- LLM token-cost billing: authorize $0.50, settle for $0.07 based on tokens generated
- GPU-second billing: authorize 60 seconds of compute, settle for the 12 actually used
- Storage requests: authorize for the largest possible response, settle for actual bytes
- Anything where the seller can't quote a fixed price ahead of time

### Why it hasn't shipped (per research)

Permit2 nonce constraints prevent multi-settlement against a single signed authorization. The spec discussions explore workarounds (e.g., short-lived nonces, range proofs, escrow-style holds) but as of the v2 spec date, no canonical implementation exists.

### What people are doing instead today

- **Quote-then-charge:** API endpoint A (free) returns a price quote based on the input; endpoint B (paid via `exact`) takes that quote as input and is gated at exactly that amount. Two round-trips, but works today.
- **Conservative pricing:** charge the maximum plausible cost via `exact`. Wastes value but ships.
- **x402r escrow:** authorize via x402r escrow, dispute or refund the difference. Adds dispute infrastructure.

If your idea fundamentally requires variable post-execution cost, treat `upto` as roadmap-dependent.

## `exact-with-refund` — x402r extension

x402r is a separate-but-compatible extension proposal at https://docs.x402r.org/.

### What it adds

- A smart-contract escrow holds the payment instead of transferring directly
- A dispute resolution mechanism (pluggable — small claims arbiter, community vote, oracle, etc.)
- A refund flow: if the client disputes within a window and the dispute resolves in their favor, escrow returns funds

### Status

- Beta: live but APIs may change
- Adopters: UltravioletaDAO, Execution Market (small but real)
- Requires minimal client/server code changes vs base `exact`

### When it makes sense

- Service might fail to deliver (LLM hallucinates and is unusable, scrape returns garbage)
- Subscription-style recurring payments where escrow holds a series of small charges
- High-trust failure scenarios where the seller would rather offer dispute than churn

### When it doesn't

- Sub-cent micropayments (escrow + dispute overhead exceeds value)
- Use cases where the client and server already trust each other (e.g., same-org agent commerce)
- Anything time-critical (dispute windows add latency to refund availability)

## Theorized but unspecified schemes

Topics that come up in spec discussions but have no canonical implementation:

- **Streaming/recurring** — pay per second, per usage tick, per heartbeat. Closest existing pattern: open many short-lived `exact` calls. Real streaming would need state outside the per-request model.
- **Conditional payment** — pay only if some on-chain or off-chain condition is met (e.g., oracle confirms event happened). Possible via custom scheme; nothing standardized.
- **Multi-party split** — single authorization that pays multiple recipients (e.g., creator + platform + tax). Possible via on-chain logic the facilitator submits to, but not a first-class scheme.
- **NFT or non-fungible asset payment** — would require a scheme over ERC-721 / ERC-1155 / SPL non-fungibles. Not in spec; see `networks-and-assets.md` for asset constraints.

## Choosing a scheme

```
Need fixed price per request?              → exact (ship today)
Need variable price based on usage?        → wait for upto, OR quote-then-charge with exact, OR x402r escrow
Need refunds / disputes?                   → x402r
Need streaming / per-second?               → not standardized; chain many exact calls (latency caveats apply)
Need multi-recipient or conditional?       → custom scheme; not standardized
```

For more detail on the constraints driving these choices, see `limitations-and-gotchas.md` and `decision-framework.md`.
