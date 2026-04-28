# facilitators

A facilitator is a service that verifies a signed `PAYMENT-SIGNATURE` payload and settles it on-chain. It is the optional-but-near-universal middleware between the seller and the blockchain.

Use this when choosing a facilitator, deciding whether to self-host, or evaluating whether a "no facilitator" architecture fits.

## What a facilitator does

| Action | Description |
|---|---|
| **Verify** | Decode the payload, run signature recovery (`ecrecover` on EVM, Ed25519 on Solana), confirm signer matches `from`, check nonce isn't replayed, check time window |
| **Settle** | Submit the signed authorization to the blockchain, wait for confirmation, return result |
| **Report** | Hand back transaction hash and success/failure status to the server |

## What a facilitator does NOT do

- **Hold funds.** The facilitator never custodies user money. The signed payload is a one-time authorization; the facilitator broadcasts it and the chain executes the transfer atomically.
- **Modify the payment.** Amount, recipient, asset, and chain are signed by the client. The facilitator can broadcast or refuse, nothing in between.
- **Track subscriptions or sessions.** Each `PAYMENT-SIGNATURE` is independent. State across calls is the seller's job.
- **Issue refunds.** Refunds require a separate on-chain transfer initiated by the seller (or the x402r escrow extension).

## The facilitator landscape

This is intentionally listed without a "default" or "recommended" choice. Pick based on your needs.

### Hosted (someone else operates it)

| Provider | Free tier | Chains | Notes |
|---|---|---|---|
| **Coinbase Developer Platform (CDP)** | 1,000 tx/month | Base, Polygon, Arbitrum, World, Solana | Largest hosted footprint; tight Bazaar / AgentKit integration |
| **QuickNode** | Varies by plan | Multiple chains via QuickNode RPC | Pairs with QuickNode's broader infra |
| **Second State** | Public test endpoint | Sei, Polygon, Solana, Base | Open-source codebase, can self-host the same binary |
| **Stellar public facilitator** | Free | Stellar | Sponsored fees; uniquely cheap for micropayments |

### Self-hosted (you run it)

| Project | Language | Chains | Notes |
|---|---|---|---|
| **x402-rs** | Rust | EVM + Solana + Aptos | Production-grade, Docker-deployable, OpenTelemetry, sub-50ms verification |
| **Second State (open-source binary)** | Rust | Same as hosted Second State | Forked from x402-rs, actively maintained |
| **Reference TypeScript facilitator** | TypeScript | EVM | Lives in the foundation repo as a reference, not optimized for production |

### Decentralized (proposal, not yet production)

| Project | Status | Notes |
|---|---|---|
| **ChaosChain decentralized facilitator** | WIP | Uses Chainlink CRE for BFT consensus across multiple independent operators; addresses single-facilitator-as-SPOF concern |

## Trade-offs

| Concern | Hosted (e.g., CDP) | Self-hosted (e.g., x402-rs) | Decentralized (e.g., ChaosChain) |
|---|---|---|---|
| Setup cost | None | Low-medium (Docker + RPC keys) | High (multi-operator coordination) |
| Operational cost | Free tier → paid plans | Your infra costs | Distributed across operators |
| Vendor lock-in | High | Low | Lowest |
| Censorship resistance | Low (centralized) | Medium (you control it) | High (BFT consensus) |
| Latency | ~100ms verify + chain settlement | Comparable | Higher (consensus overhead) |
| Observability | Vendor dashboard | Bring your own (OpenTelemetry built into x402-rs) | Per-operator |
| Scale | Vendor's job | Your job | Distributed |
| Trust assumption | Trust the vendor | Trust yourself | Trust the BFT quorum |

## When you might NOT need a facilitator

The protocol does not mandate a facilitator. If your server is willing to:

- Run a node (or reliable RPC) for the chain it accepts payments on
- Implement signature verification correctly
- Submit transactions and handle confirmation
- Manage retries and failure modes

…then it can verify and settle directly. The reference TypeScript and Rust SDKs include this "direct mode" path.

**When direct mode makes sense:**
- You're already running blockchain infrastructure for other reasons
- You want zero third-party dependency in the payment path
- You're operating at a scale where facilitator fees would be material
- You have hard regulatory or jurisdictional reasons to own the entire flow

**When it doesn't:**
- You're an app developer, not a chain operator
- You want to support multiple chains without running multiple nodes
- You'd rather outsource block-confirmation race conditions and retry logic

## Comparing facilitators in practice

A practical evaluation checklist:

1. **Which chains does it support?** Cross-reference your `networks-and-assets.md` choice.
2. **What's the latency?** Verify against a real test request, not marketing copy.
3. **What's the failure mode when the chain misbehaves?** (See the Base race condition in `limitations-and-gotchas.md` for what "misbehaves" can look like.)
4. **What observability does it expose?** Logs, metrics, traces?
5. **What happens on outage?** Hosted = vendor's status page. Self-hosted = your incident.
6. **What's the cost model at your expected volume?**
7. **Is the codebase open-source and inspectable?** (x402-rs and Second State: yes. CDP: no.)
8. **Does it implement v2 PAYMENT-RESPONSE on settlement failure?** (Some early implementations omitted this — see `limitations-and-gotchas.md`.)

## Switching facilitators

Because the protocol normalizes everything around the three v2 headers and CAIP-2 network IDs, switching facilitators is almost entirely a config change on the server side. Your client code, payload structure, signing logic, and revenue accounting do not change.

This is one of the deliberately good design decisions in x402: facilitator interchangeability is real, not theoretical. Use it as leverage.
