# limitations-and-gotchas

Honest accounting of what x402 can't do today, what it does badly, what's broken in production, and the structural risks of the architecture.

This file is the antidote to vendor marketing. If your idea depends on something here, treat it as a yellow or red flag.

## Hard limits (will not work today, no workaround in base spec)

### EIP-3009 requirement on EVM

The `exact` scheme on EVM requires the asset to implement EIP-3009 `transferWithAuthorization`. Almost no token outside USDC and EURC implements it natively. **Practical consequence:** USDC is essentially the only viable asset on EVM today. See `networks-and-assets.md`.

### Strict equality in `exact`

The only shipped scheme requires the client to pay exactly the quoted amount, asset, recipient, and chain. No overpayment, underpayment, or substitution. Variable-cost use cases need workarounds. See `schemes.md`.

### No native NFTs or non-fungible assets

There is no scheme today that lets a client pay with an NFT or other non-fungible. If your idea involves "user pays with an NFT they hold," x402 is not the protocol.

### No native subscriptions, recurring billing, or escrow

The protocol is request-scoped. Each `PAYMENT-SIGNATURE` is independent. v2 added Sign-In-With-X (CAIP-122) which enables session identity, but recurring charges and escrow still require either:

- Application-level state (server tracks subscription, charges per-period via fresh `exact` calls)
- The x402r escrow extension (beta)

### No native refunds

Once an `exact` payment settles, the funds are with the seller. Refunds require either:
- The seller initiates a separate on-chain transfer
- Use of x402r escrow + dispute resolution

There is no protocol-level "undo."

## Soft limits (works, but the constraint shapes design)

### ~2 second settlement latency

Even on the fastest chains, end-to-end x402 latency is ~1–2 seconds (Solana faster, Stellar slower, Ethereum mainnet much slower). This becomes hostile when:

- An agent wants to chain 10 paid API calls (now you're at 10–20 seconds before final response)
- A user is waiting interactively (UX threshold for "this is too slow")
- A real-time system needs payment confirmation as part of a sub-second loop

Mitigations: parallelize independent calls, pre-pay common operations, batch where possible.

### Facilitator dependency adds a third party to every request

Even with a perfect protocol, a facilitator outage stalls every paid endpoint that depends on it. Self-hosting (`facilitators.md`) shifts this to your own ops; decentralized facilitators (ChaosChain) are a proposal, not yet production.

### Minimum-viable economics floor

Every transaction costs gas (or chain fees) and (sometimes) facilitator fees. A $0.001 micropayment may be eaten by overhead. Realistic floors:

- **Stellar:** sub-cent (sponsored fees)
- **Solana:** ~$0.001 of overhead
- **Base:** few cents in gas
- **Ethereum mainnet:** dollars

Below the floor, the math doesn't work.

### Wallet UX

The protocol assumes the client controls a wallet with the right asset on the right chain. For human users, this is still a UX hurdle. For agents (where the wallet is software), it's frictionless. **Most successful x402 use cases today are agent-first, not consumer-first.**

## Known bugs (in production, watch for these)

### Base facilitator timeout vs block confirmation race condition

**Source:** https://github.com/coinbase/x402/issues/1062

**Status:** open and unfixed at time of writing (2026-04-27)

**What happens:** The CDP facilitator times out waiting for Base block confirmation (5–10s timeout vs 10–28s actual confirmation under load). It returns failure to the server. The server returns 402 to the client. **But the transaction then succeeds on-chain.** The client paid, the server didn't fulfill, and the user is out the money.

**Mitigations:**
- Don't rely on the CDP facilitator's success/failure result alone — independently check the chain
- Build idempotent retry logic that recognizes already-settled payments
- Consider a different facilitator if you can
- Self-host with longer timeouts

This is a real bug affecting real production users. Search the issue tracker for current status before relying on Base + CDP.

### Spec-vs-implementation drift on PAYMENT-RESPONSE

V2 spec requires `PAYMENT-RESPONSE` on settlement failure. Some early TypeScript middlewares omitted it. If your client receives a non-200 response without `PAYMENT-RESPONSE`, suspect an outdated server middleware. Update or work around.

## Security incidents (real, and what they teach)

### 402Bridge breach (October 2025)

**Source:** https://superex.medium.com/the-explosion-of-the-x402-protocol-and-the-402bridge-security-incident-an-in-depth-analysis-of-12c909bed5f1

**What happened:** 402Bridge was a centralized cross-chain bridge built on top of x402. An attacker exploited a private key stored in plaintext on a networked server and drained ~$200k+ USDC from 200+ users.

**What this is NOT:** a bug in the x402 protocol. The protocol's wire format and signing model held up.

**What this IS:** a structural lesson about every layer above the protocol. Specifically:
- Centralized custodial bridges built on x402 inherit all the risks of any custodial bridge
- Single private keys controlling many users' funds are a giant target
- Plaintext key storage is unacceptable
- Unlimited user approvals (allowing the bridge to move arbitrary amounts) compound the blast radius
- No multi-sig or hardware-key separation made the breach total

**For your own build:** if you're building a service that custodies signing authority on behalf of users, x402 doesn't make you safer. Apply normal custody-grade security (HSMs, multi-sig, key rotation, allowance limits, monitoring). See `key-management-patterns.md` for the spectrum of options that would have prevented this specific failure mode (anything from cloud HSMs and TEEs through MPC services and threshold signature schemes to decentralized signing networks).

## Architectural risks

### Facilitator as single point of failure

Most facilitators today are centralized services. If CDP goes down, every endpoint depending on CDP fails. Mitigation paths:

- Self-host (`facilitators.md`)
- Multi-facilitator failover (your server tries facilitator A, falls back to B)
- Wait for decentralized options (ChaosChain et al.)

### Lack of decentralized verification

Verification is currently done by single trusted parties (the facilitator). A malicious facilitator could in theory accept invalid signatures and settle nothing, or refuse valid ones. The off-chain verification step is the trust gap. Decentralized facilitators with BFT consensus (proposed) would close it.

### Spec-vs-implementation drift

The spec is one repository, the SDKs are dozens. Bugs in middleware (the missing PAYMENT-RESPONSE example above) reflect a fast-moving ecosystem. Always check that your stack is on the current spec version, especially when consuming third-party endpoints.

## Adoption-vs-narrative gap

Headline numbers are large: ~$119M+ Base transactions, ~$600M annualized volume.

Real-volume reports are smaller: ~$28k/day per March 2026 third-party analyses, with much volume from testing, farming, and gamed transactions rather than real commerce.

The PANews "narrative bubble" critique (https://www.panewslab.com/en/articles/0036c3c1-08c0-492a-96cc-2e8659851458) is a useful sanity check. The protocol works; the narrative may be ahead of organic adoption.

**For your build:** don't assume "x402 has $600M volume so my idea will fly." Most volume is concentrated in a small number of integrations and synthetic activity. You still need to find product-market fit.

## Anti-patterns

| Anti-pattern | Why it's bad | What to do instead |
|---|---|---|
| Treating x402 as fiat-equivalent | Settlement is on-chain crypto; price volatility, FX, on-ramps all matter | Use stablecoins (USDC), make pricing explicit, account for chain selection |
| Assuming refunds work | They don't, in base spec | Use x402r if refunds matter, or design without them |
| Pricing below the economic floor | Gas + fees eat the payment | Set price floors per chain; pick Stellar/Solana for sub-cent |
| Designing for sub-second latency | ~2s round-trip is the floor | Parallelize calls, pre-pay common operations |
| Trusting headline volume numbers | Much is gamed/synthetic | Validate with your own pilot, not marketing |
| Single facilitator, no fallback | One outage kills your revenue | Multi-facilitator failover or self-host |
| Storing user private keys server-side | See 402Bridge | Use signed authorizations, not custodial keys |
| Ignoring chain confirmation when facilitator returns failure | Base #1062 race condition exists | Independently verify on-chain before final fail |
| Building on `upto` scheme today | Not shipped | Use quote-then-charge with `exact`, or wait |
| Targeting NFT/native-token payments | No supported scheme | Use a different protocol |

## When x402 is the wrong protocol

- You need to take BTC payments → look at Lightning
- You need card / ACH / fiat rails → use Stripe or similar
- You need NFT-as-payment → use direct on-chain logic
- You need fully synchronous, sub-100ms confirmation → not achievable on public chains
- You need true privacy / non-pseudonymous payments → x402 transactions are public on-chain; consider Lightning + Nostr or zk-based protocols
- You need an asset that doesn't have EIP-3009 and isn't worth wrapping → wrong asset for x402

## Where this section is honest about its own limits

This file is a snapshot of known issues as of `docs-revision.md`. New bugs will appear, old ones will be fixed, the ecosystem will mature. Cross-check the official issue tracker (https://github.com/x402-foundation/x402/issues) and your facilitator's status page before relying on any specific claim here.
