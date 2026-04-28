# headers-and-payloads

The wire format of the three v2 headers and the signed payloads they carry. Use this when constructing requests by hand, debugging an integration, or porting x402 to a new language or framework.

## The three v2 headers

| Header | Direction | Carries |
|---|---|---|
| `PAYMENT-REQUIRED` | server → client (with HTTP 402) | Base64-encoded `PaymentRequirements` |
| `PAYMENT-SIGNATURE` | client → server (on retry) | Base64-encoded `PaymentPayload` (signed authorization) |
| `PAYMENT-RESPONSE` | server → client (with HTTP 200 or error) | Base64-encoded settlement result |

All three headers carry base64-encoded JSON. v1 used the response body for `PaymentRequirements`; v2 moved everything to headers, freeing the body for partial content. See `v1-vs-v2.md`.

## `PAYMENT-REQUIRED` — the `PaymentRequirements` object

Returned by the server when the resource is gated.

### Required fields

| Field | Type | Description |
|---|---|---|
| `x402Version` | string | Protocol version, e.g., `"2.0"` |
| `scheme` | string | Payment scheme (`"exact"` is the only shipped one; see `schemes.md`) |
| `network` | string | CAIP-2 network identifier (e.g., `"eip155:8453"`, `"solana:5eykt4UsFzeyGoCDNW2CFsvHvfJBqJ3zQcsKqt486dx"`) |
| `maxAmountRequired` | string | Amount in the asset's smallest unit (wei for ETH-class, lamports of SPL token unit for Solana). String to avoid JS number precision loss. |
| `asset` | string | Token contract address (or chain-native asset identifier) |
| `payTo` | string | Recipient wallet address |
| `resource` | string | URI or identifier of the requested resource (used for client-side display and idempotency) |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `description` | string | Human-readable note for client UIs |
| `mimeType` | string | Expected response content type, helps clients decide whether to pay |
| `outputSchema` | object | Optional JSON Schema describing the response body |
| `extra` | object | Scheme-specific or extension-specific data (e.g., `permitData` for EIP-2612) |
| `payment-identifier` | string | Idempotency / correlation key (see Payment-Identifier extension) |
| `expiresAt` | number | Unix timestamp after which this offer is invalid |

### Example `PaymentRequirements` for Base + USDC

```json
{
  "x402Version": "2.0",
  "scheme": "exact",
  "network": "eip155:8453",
  "maxAmountRequired": "10000",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "payTo": "0xA0Cf798816D4b9b9866b5330EEa46a18382f251e",
  "resource": "https://api.example.com/v1/scrape",
  "description": "Scrape one URL",
  "mimeType": "application/json",
  "expiresAt": 1714161600
}
```

`maxAmountRequired: "10000"` = 0.01 USDC (USDC has 6 decimals).

### Example `PaymentRequirements` for Solana + USDC

```json
{
  "x402Version": "2.0",
  "scheme": "exact",
  "network": "solana:5eykt4UsFzeyGoCDNW2CFsvHvfJBqJ3zQcsKqt486dx",
  "maxAmountRequired": "10000",
  "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "payTo": "8xJk2pqTnZbYj3mFqXR4wL1nVcMpD6sR9hT5kNwQfZeY",
  "resource": "https://api.example.com/v1/scrape",
  "expiresAt": 1714161600
}
```

## `PAYMENT-SIGNATURE` — the `PaymentPayload` object

Sent by the client on the retry. Wraps the chain-specific signed authorization.

### Envelope

```json
{
  "x402Version": "2.0",
  "scheme": "exact",
  "network": "eip155:8453",
  "payload": { /* chain- and scheme-specific signed authorization */ }
}
```

### EVM `payload` (EIP-3009 `transferWithAuthorization`)

For EVM chains using the `exact` scheme, the payload is the signed EIP-3009 struct plus the signature:

```json
{
  "signature": "0x<65-byte hex sig>",
  "authorization": {
    "from":        "0x<client wallet>",
    "to":          "0x<server wallet (matches PaymentRequirements.payTo)>",
    "value":       "10000",
    "validAfter":  "1714161000",
    "validBefore": "1714161600",
    "nonce":       "0x<random 32 bytes>"
  }
}
```

The signature is over the EIP-712 typed-data hash of the `authorization` struct, signed with the `from` wallet's private key. The facilitator runs `ecrecover` to confirm the signer matches `from`.

**Why EIP-3009 specifically:** It allows a third party (the facilitator) to submit the transfer transaction on behalf of the signer, paying gas itself. This is what makes "client signs off-chain, facilitator broadcasts on-chain" possible. See `networks-and-assets.md` for why this constraint forces USDC dominance.

### Solana `payload` (signed SPL token transfer authorization)

Solana's payload structure differs because Solana uses a different account model and signature scheme (Ed25519 instead of secp256k1):

```json
{
  "signature": "<base58-encoded 64-byte Ed25519 sig>",
  "authorization": {
    "from":        "<client SPL token account>",
    "to":          "<server SPL token account (derived from payTo)>",
    "amount":      "10000",
    "mint":        "<SPL token mint address>",
    "validAfter":  "1714161000",
    "validBefore": "1714161600",
    "nonce":       "<random bytes>",
    "feePayer":    "<facilitator wallet — pays Solana tx fees>"
  }
}
```

Different chains may have analogous but not identical structures. See `github.com/x402-foundation/x402/tree/main/specs/schemes` for per-scheme, per-chain specifications.

## `PAYMENT-RESPONSE` — settlement result

Returned by the server (with HTTP 200 on success, error code on failure) so the client knows what actually happened on-chain.

### Fields

| Field | Type | Description |
|---|---|---|
| `success` | boolean | Whether settlement succeeded |
| `transaction` | string | On-chain transaction hash / signature |
| `network` | string | CAIP-2 ID of the chain settled on |
| `payer` | string | Address that paid (echoes `from`) |
| `errorReason` | string | If `success: false`, why (e.g., `"insufficient_balance"`, `"nonce_used"`, `"expired"`) |

### Example success

```json
{
  "success": true,
  "transaction": "0x9a7e...c2f1",
  "network": "eip155:8453",
  "payer": "0x<client wallet>"
}
```

### Example failure

```json
{
  "success": false,
  "transaction": null,
  "network": "eip155:8453",
  "payer": "0x<client wallet>",
  "errorReason": "insufficient_balance"
}
```

**Spec gotcha:** v2 requires `PAYMENT-RESPONSE` even on settlement failure (so the client knows the payment didn't go through). Some early TypeScript middlewares omitted it on failure; if your client times out without receiving this header on a 402 retry, suspect an outdated server middleware. (See `limitations-and-gotchas.md`.)

## Constructing the headers manually (debugging)

If you need to inspect or build a request without an SDK:

1. **Decode `PAYMENT-REQUIRED`:** base64-decode the header value, parse as JSON. Confirm scheme, network, amount, asset, payTo match expectations.
2. **Build `PAYMENT-SIGNATURE`:** construct the appropriate `PaymentPayload` envelope, sign the inner authorization with your wallet, base64-encode the whole envelope.
3. **Decode `PAYMENT-RESPONSE`:** base64-decode, parse JSON, check `success` and `transaction`. Use the transaction hash to confirm on a chain explorer (basescan.org, solscan.io, etc.).

A common debugging tactic: copy the `PAYMENT-REQUIRED` header from a real 402 response, paste into a base64 decoder, inspect. Then construct the `PAYMENT-SIGNATURE` by hand for a known test wallet. This isolates whether failures are in payload construction, signature, verification, or settlement.

## Where to find authoritative field-level specs

- Main spec: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification.md
- Per-scheme specs: https://github.com/x402-foundation/x402/tree/main/specs/schemes
  - `scheme_exact_evm.md` — EVM-specific exact scheme
  - `scheme_exact_svm.md` — Solana-specific exact scheme
  - `scheme_exact_algo.md` — Algorand-specific exact scheme

When the spec disagrees with this file, the spec wins. This file is a navigational aid, not a normative reference.
