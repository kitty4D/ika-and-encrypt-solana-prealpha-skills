# v1-vs-v2

x402 v2 launched in late 2025 / early 2026 after roughly six months of v1 production usage. Many tutorials, blog posts, and SDKs from that period are still online and reference v1 conventions. This file helps you recognize and adapt them.

## TL;DR

| Concern | v1 | v2 |
|---|---|---|
| Where requirements live | HTTP 402 response **body** (JSON) | HTTP 402 response **header** (`PAYMENT-REQUIRED`, base64-encoded JSON) |
| Where signed payment lives | Custom request body or header (varied) | `PAYMENT-SIGNATURE` header (base64-encoded JSON) |
| Settlement result delivery | Mixed: response body, custom headers | `PAYMENT-RESPONSE` header (base64-encoded JSON) |
| Session / identity | None (one-shot only) | Optional Sign-In-With-X (CAIP-122) wallet-controlled sessions |
| Network identifier format | Mixed strings | CAIP-2 (`eip155:8453`, `solana:5eykt...`) |
| Spec governance | Coinbase repo (`coinbase/x402`) | Foundation repo (`x402-foundation/x402`) |

## Why v2 exists

v1 was the proof-of-concept: HTTP 402 reactivated, USDC payments working, agents transacting. The lessons:

- **Putting `PaymentRequirements` in the response body coupled the protocol envelope to the response content.** Sellers couldn't return partial content (a teaser, an error explanation, a preview) in the 402 response without entangling it with payment data. Moving to headers freed the body.
- **Custom-named request headers varied across SDKs.** v1 was loose on the exact header name for the signed payload. v2 standardized on `PAYMENT-SIGNATURE`.
- **Settlement metadata was inconsistent.** Sometimes in the response body, sometimes a custom header, sometimes nowhere. v2 mandated `PAYMENT-RESPONSE` everywhere.
- **No session concept made every request a fresh handshake.** v2 added optional CAIP-122 SIWX so a wallet can prove identity once and reuse a session token, opening subscription-style and identity-aware patterns.
- **Network ID strings were inconsistent.** v2 standardized on CAIP-2.

## How to recognize v1 in the wild

Suspect v1 when you see:

- Tutorials calling out a specific JSON shape for the **402 response body** (e.g., "the server responds with a JSON body containing `paymentRequirements`")
- Code that reads `await response.json()` after a 402 to extract requirements
- Custom header names like `X-PAYMENT`, `X-402-PAYMENT`, `X-x402-Sig` (these are non-canonical v1-era variants)
- Network references like `"base"`, `"base-sepolia"` as plain strings, instead of CAIP-2 IDs
- Settlement results returned in the response body
- No mention of `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE` headers

Some SDKs are backward-compatible with v1 servers but new builds should target v2.

## Migration in code (typical)

For a server middleware:

| Step | v1 → v2 change |
|---|---|
| 1 | Stop writing `PaymentRequirements` to the response body; start emitting `PAYMENT-REQUIRED` header (base64 JSON) |
| 2 | Stop reading payment data from request body or custom headers; read from `PAYMENT-SIGNATURE` |
| 3 | Always emit `PAYMENT-RESPONSE` header on both success and failure (the spec requires it on failure too) |
| 4 | Update network IDs to CAIP-2 |
| 5 | (Optional) wire up SIWX session handling if you want subscription/identity patterns |

For a client SDK:

| Step | v1 → v2 change |
|---|---|
| 1 | On 402, parse `PAYMENT-REQUIRED` header instead of response body |
| 2 | Build payload using current spec; send via `PAYMENT-SIGNATURE` header |
| 3 | After retry, read `PAYMENT-RESPONSE` header to confirm settlement |
| 4 | Handle CAIP-2 network IDs |

The reference SDKs in `x402-foundation/x402` already implement v2. If you're starting fresh, use them and ignore v1 documentation entirely.

## Where v1 still leaks through

- **Old blog tutorials** (especially anything from May–November 2025) often show v1 patterns. Check the date and verify against current spec.
- **Awesome-list entries** that haven't been updated since v2 launched.
- **Some smaller-language SDKs** (community-maintained Ruby, Elixir, etc.) may still be on v1 — check the SDK's own changelog before using.
- **Production endpoints that haven't migrated.** Some sellers may still emit v1 wire format. v2 client SDKs typically have a compatibility shim, but it's worth confirming.

## When the difference matters

- **Building a fresh integration today:** target v2 only. Ignore v1.
- **Debugging an existing integration:** check whether you and your counterparty are on the same version. A mismatch shows up as "client SDK can't find PAYMENT-REQUIRED header" or "server SDK can't parse signed payload."
- **Reading old code:** don't blindly copy patterns; cross-reference with the current spec at https://github.com/x402-foundation/x402/blob/main/specs/x402-specification.md.

## Will there be a v3?

The foundation hasn't announced one. The roadmap items most likely to drive a future major version are:

- Shipping the `upto` scheme (probably an extension, not a v3)
- Native escrow / refunds (probably x402r becomes part of core, not necessarily v3)
- Decentralized facilitator standardization
- Privacy-preserving variants

For now, plan around v2 and watch the spec repo for breaking-change announcements.
