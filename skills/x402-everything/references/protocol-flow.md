# protocol-flow

The full request/response lifecycle of an x402 v2 transaction. Use this when tracing what happens at each hop, debugging where a flow breaks, or designing a new use case from first principles.

## The four phases (v2)

```
PHASE 1: unauthenticated request
    client ───── HTTP GET /resource ─────▶ server
    server ────── HTTP 402 + PAYMENT-REQUIRED header ──▶ client

PHASE 2: client signs payment authorization (off-chain, no chain interaction)
    client constructs PaymentPayload (e.g., EIP-3009 transferWithAuthorization)
    client signs with its wallet key
    client base64-encodes the signed payload

PHASE 3: authorized retry
    client ───── HTTP GET /resource + PAYMENT-SIGNATURE header ─────▶ server
    server ─── verify (often via facilitator) ──▶ facilitator
    facilitator ─── ecrecover / signature check ─▶ result
    facilitator ─── submit signed tx ────────────▶ blockchain
    blockchain ───── confirmation ───────────────▶ facilitator
    facilitator ─── settlement result ───────────▶ server

PHASE 4: fulfillment
    server ───── HTTP 200 + response body + PAYMENT-RESPONSE header ─▶ client
```

## What each party does at each step

### Phase 1: discover requirements

**Client** issues a request without payment headers.

**Server** responds with HTTP `402 Payment Required` and a `PAYMENT-REQUIRED` header containing a base64-encoded `PaymentRequirements` object. The 402 response body is *free for the server to populate* — it can include partial content, a teaser, error details, or be empty. (This is a v2 change from v1, where the body carried the requirements.)

The `PaymentRequirements` object tells the client:
- Which scheme (e.g., `exact`)
- Which network (CAIP-2 ID, e.g., `eip155:8453` for Base, `solana:5eykt4UsFzeyGoCDNW2CFsvHvfJBqJ3zQcsKqt486dx` for Solana mainnet)
- Which asset (e.g., USDC contract address)
- The amount in the asset's smallest unit
- The recipient address (`payTo`)
- Optional fields: expiration, idempotency identifier, resource URI, scheme-specific extras

See `headers-and-payloads.md` for the full field-by-field breakdown.

### Phase 2: construct and sign the payment authorization

This phase happens entirely on the client side and **does not touch the chain yet**.

The client builds a payload appropriate to the chain and asset. For EVM + USDC, the payload is an EIP-3009 `transferWithAuthorization` struct:

```
{
  from:        <client wallet address>,
  to:          <PaymentRequirements.payTo>,
  value:       <PaymentRequirements.maxAmountRequired>,
  validAfter:  <unix timestamp>,
  validBefore: <unix timestamp>,
  nonce:       <random 32 bytes>
}
```

The client signs this with its wallet key, producing `(v, r, s)`. The full payload (struct + signature) is wrapped in a `PaymentPayload` envelope, base64-encoded, and placed in the `PAYMENT-SIGNATURE` header.

For Solana, the payload is a signed SPL token transfer authorization with analogous fields. See `headers-and-payloads.md` for chain-specific differences.

**Why off-chain signing matters:** The client never needs to broadcast a transaction or pay gas. The signature is a *promise* the facilitator can later cash on-chain. Until that happens, no funds move.

### Phase 3: authorized retry, verification, and settlement

The client repeats the same HTTP request, this time with the `PAYMENT-SIGNATURE` header attached.

The server now has a choice:
1. **Delegate to a facilitator** (the common path) — POST the signed payload to a facilitator endpoint, which handles verification and settlement and returns a result
2. **Verify and settle directly** (rare, requires the server to run chain infrastructure) — see `facilitators.md` for the "no facilitator" pattern

The facilitator (or the server in direct mode) does two things:

**Verification (~100ms, no chain interaction):**
- Decode the payload
- Recover the signer address (`ecrecover` on EVM, equivalent for other chains)
- Confirm the signer matches the `from` field
- Confirm the nonce hasn't been used (anti-replay)
- Confirm `validAfter`/`validBefore` window is open
- Confirm `to`, `value`, and asset match the original `PaymentRequirements`

**Settlement (varies by chain, typically 0.5–10s):**
- Submit the signed authorization to the blockchain
- Wait for confirmation per chain rules (Base ~2s, Solana ~0.5s, Stellar ~5s)
- Return success/failure to the server

### Phase 4: fulfillment

If settlement succeeds, the server returns `HTTP 200` with the actual resource and a `PAYMENT-RESPONSE` header containing settlement metadata (transaction hash, block, etc.).

If settlement fails, the server returns an appropriate error (often `402` again or `5xx`) with `PAYMENT-RESPONSE` describing the failure.

## Total round-trip timing

| Phase | Typical time |
|---|---|
| Phase 1 (request → 402) | network RTT |
| Phase 2 (client signing) | <50ms |
| Phase 3a (verification) | ~100ms |
| Phase 3b (settlement on Base) | ~2s |
| Phase 3b (settlement on Solana) | ~0.5–1s |
| Phase 3b (settlement on Stellar) | ~5s |
| Phase 4 (fulfillment) | network RTT |

End-to-end on Base + USDC: ~2 seconds. On Solana: ~1 second. On Stellar: ~6 seconds.

This latency is the dominant constraint when designing agent flows that chain many paid calls. See `limitations-and-gotchas.md` for failure modes (notably the Base facilitator-timeout race condition).

## Lifecycle hooks

The official SDKs and several community facilitators expose hooks at the boundaries between phases:

- **Pre-verification hook** — server inspects the signed payload before sending it to the facilitator (rate-limit, validate request shape, reject early)
- **Post-verification hook** — server is informed of verification result before settlement is attempted (allows aborting a settlement that would succeed but doesn't fit business rules)
- **Post-settlement hook** — server is informed of settlement result before fulfillment (allows logging, analytics, side effects)
- **On-fulfillment hook** — server's normal request handler runs

These are SDK-specific in spelling but conceptually consistent. See `agent-and-mcp-patterns.md` for hook patterns useful in agent commerce.

## What the protocol does not specify

- **How the server learns its own pricing** — that's business logic. The server can quote different prices to different clients, vary by time of day, etc.
- **How the client funds its wallet** — out of scope. The protocol assumes the client controls a wallet with sufficient balance.
- **How disputes or refunds work** — there is no refund flow in the base protocol. See `schemes.md` and `limitations-and-gotchas.md` for what the x402r extension proposes.
- **How discovery happens** — finding paid endpoints is a layer above the protocol. See `agent-and-mcp-patterns.md` for Bazaar, x402.direct, Cinderwright.
