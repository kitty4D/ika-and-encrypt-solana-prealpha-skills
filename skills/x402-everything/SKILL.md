---
name: x402-everything
description: Use when evaluating whether a new idea fits the x402 HTTP 402 payment protocol - pay-per-call APIs, AI agent commerce, MCP paid tools, content paywalls, micropayments, machine-to-machine payments, IoT/hardware payments, agent-to-agent settlement, or assessing protocol limits like EIP-3009, USDC-only assets, the "exact" scheme, facilitator choice, network selection, or v1->v2 changes. Vendor-neutral; not tied to any specific SDK, chain, or facilitator vendor.
---

# x402-everything

## Overview

x402 is an open HTTP payment protocol that reactivates the HTTP `402 Payment Required` status code for crypto-native, account-free, request-scoped payments. A client requests a resource, the server returns `402` with payment requirements, the client signs a payment authorization off-chain, retries the request with a `PAYMENT-SIGNATURE` header, the server (usually via a facilitator) verifies and settles on-chain, and the resource is delivered with a `PAYMENT-RESPONSE` header.

Normative sources: [docs.x402.org](https://docs.x402.org/) and [github.com/x402-foundation/x402](https://github.com/x402-foundation/x402). When this skill disagrees with the live spec, the live spec wins.

**Vendor-neutrality stance:** this skill names many SDKs, facilitators, chains, and adopters. It picks none as canonical. Coinbase CDP, Coinbase Bazaar, AgentKit, and Base are listed as **one option among many** alongside community alternatives (x402-rs, Second State, ChaosChain, mark3labs/x402-go, ruby-x402, Elixir x402, Solana, Stellar, Polygon, etc.). If you want a stack-specific guide, load that vendor's docs after this skill.

## When to use

- "Can I monetize my API with crypto without accounts?"
- "Can my AI agent autonomously pay for a paid MCP tool / API / inference / scrape?"
- "How do machine-to-machine payments actually work?"
- Considering pay-per-call, content paywalls, micropayments, IoT payments, tip jars, agent-to-agent settlement
- Comparing x402 to alternatives (Lightning, Stripe, fiat metering, direct on-chain transfers)
- Evaluating whether a non-USDC asset, a non-EVM chain, recurring billing, escrow, or refunds are possible
- Reading older x402 tutorials and not sure if they're v1 or v2
- Picking between hosted, self-hosted, or decentralized facilitators
- Trying to figure out why a payment succeeded on-chain but the server returned an error (the Base race condition)

## When NOT to use

- Building production with a specific SDK - load that SDK's docs (or a vendor-specific skill) instead of this one
- Pure on-chain payment flows that don't involve HTTP requests
- Need help with a specific Coinbase CDP / QuickNode / Second State integration - go to that vendor's docs
- Need a deep cryptographic walkthrough of EIP-3009 itself - that's a token-standard topic
- Building a non-x402 protocol that happens to involve HTTP 402 (e.g., a custom variant) - read the spec directly

## references (load on demand)

| file | load when |
| --- | --- |
| [`protocol-flow.md`](references/protocol-flow.md) | tracing the full request/response cycle, debugging where a flow breaks |
| [`headers-and-payloads.md`](references/headers-and-payloads.md) | constructing or debugging `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE`, EIP-3009 payload structure, Solana payload differences |
| [`schemes.md`](references/schemes.md) | choosing between `exact` (shipped) and `upto` (proposed); evaluating x402r escrow; understanding why streaming/recurring need workarounds |
| [`networks-and-assets.md`](references/networks-and-assets.md) | picking a chain or asset; hitting the EIP-3009 wall; Base vs Solana vs Stellar trade-offs |
| [`facilitators.md`](references/facilitators.md) | choosing hosted (CDP, QuickNode, Second State, Stellar public) vs self-hosted (x402-rs) vs decentralized (ChaosChain) |
| [`use-case-catalog.md`](references/use-case-catalog.md) | scoping a new idea against vetted real-world precedents (API monetization, paywalls, agent commerce, MCP, gaming, IoT, social, e-commerce, more) |
| [`decision-framework.md`](references/decision-framework.md) | running the full "can my idea ship on x402 today?" walkthrough with worked examples |
| [`limitations-and-gotchas.md`](references/limitations-and-gotchas.md) | hard limits, soft limits, known bugs (Base #1062 race condition), security incidents (402Bridge), anti-patterns, "wrong protocol" signs |
| [`agent-and-mcp-patterns.md`](references/agent-and-mcp-patterns.md) | designing AI agent commerce, MCP paidTools, A2A flows, budget controls, observability |
| [`key-management-patterns.md`](references/key-management-patterns.md) | choosing how to hold the signing key (in-process, hardware, HSM, MPC, threshold, decentralized signing networks, smart contract wallets, custodial); the lesson from the 402Bridge breach |
| [`v1-vs-v2.md`](references/v1-vs-v2.md) | reading older tutorials, debugging integration with legacy SDKs, recognizing v1 patterns |
| [`ecosystem-snapshot.md`](references/ecosystem-snapshot.md) | inventory of SDKs across TypeScript / Python / Go / Rust / Ruby / Elixir, facilitators, discovery layers, foundation governance |
| [`sources.md`](references/sources.md) | every URL cited anywhere in this skill, grouped by category, for verification |
| [`docs-revision.md`](references/docs-revision.md) | when this skill was vetted, what spec version is targeted, when to refresh |

## Quick reference: protocol at a glance

The full v2 lifecycle:

```
1. client GET /resource                   ->  server
2. server HTTP 402 + PAYMENT-REQUIRED     ->  client
   (header carries base64 PaymentRequirements: scheme, network, asset, amount, payTo)
3. client signs PaymentPayload off-chain  (no chain interaction yet)
4. client GET /resource + PAYMENT-SIGNATURE  ->  server
5. server -> facilitator: verify + settle on chain
6. server HTTP 200 + body + PAYMENT-RESPONSE  ->  client
```

Three v2 headers (all base64-encoded JSON):

| Header | Direction | Carries |
|---|---|---|
| `PAYMENT-REQUIRED` | server -> client (with HTTP 402) | `PaymentRequirements` |
| `PAYMENT-SIGNATURE` | client -> server (on retry) | Signed `PaymentPayload` |
| `PAYMENT-RESPONSE` | server -> client (on success or failure) | Settlement result |

End-to-end latency: ~1-2 seconds on the fastest chains. Deeper detail in [`protocol-flow.md`](references/protocol-flow.md) and [`headers-and-payloads.md`](references/headers-and-payloads.md).

## Decision framework: can my idea ship on x402?

Seven yes/no questions. If you pass all seven, ship a small pilot. If you fail one, the corresponding deeper section in [`decision-framework.md`](references/decision-framework.md) describes the workaround.

1. Is the unit of value paid for **behind an HTTP request**? (See [`decision-framework.md`](references/decision-framework.md))
2. Is the asset **USDC** (or another EIP-3009-compatible token)? (See [`networks-and-assets.md`](references/networks-and-assets.md))
3. Is the chain **in the supported set**? (See [`networks-and-assets.md`](references/networks-and-assets.md))
4. Is **one-shot per-request payment** acceptable, or do you need recurring/streaming/escrow? (See [`schemes.md`](references/schemes.md))
5. Is **~2 second settlement latency** acceptable? (See [`protocol-flow.md`](references/protocol-flow.md))
6. Are you OK depending on a **facilitator** (hosted or self-hosted)? (See [`facilitators.md`](references/facilitators.md))
7. Is the payment amount **above the minimum economic floor** (gas + facilitator fees)? (See [`networks-and-assets.md`](references/networks-and-assets.md))

The full framework with worked examples lives in [`decision-framework.md`](references/decision-framework.md).

## Vendor-neutral framing

| Topic | What this skill does |
|---|---|
| Facilitator | Lists CDP, QuickNode, Second State, Stellar public (hosted); x402-rs, Second State binary (self-hosted); ChaosChain (decentralized proposal). Pick by needs, not branding. |
| Chain | Lists Base, Solana, Polygon, Arbitrum, Stellar, Aptos, Algorand, etc. Notes that Base has the most marketing volume but Solana has more transaction volume; Stellar is uniquely cheap. |
| Asset | Acknowledges USDC dominance for technical reasons (EIP-3009), not promotional ones. EURC noted. |
| SDK | Names official `@x402/*` packages alongside community SDKs (x402-rs, mark3labs/x402-go, ruby-x402, Elixir x402, etc.) at parity. |
| Bugs and incidents | Documents the Base #1062 race condition and 402Bridge security incident honestly in [`limitations-and-gotchas.md`](references/limitations-and-gotchas.md). |

This skill is unaffiliated with the x402 Foundation, Coinbase, the Linux Foundation, or any vendor. It is a third-party reference.

## Glossary (inline, short)

- **Scheme** - how a payment is authorized, verified, and settled. Today: `exact` (only shipped). Proposed: `upto`. Extension: x402r escrow.
- **Facilitator** - service that verifies signed `PAYMENT-SIGNATURE` payloads and settles on-chain. Hosted, self-hosted, or (proposed) decentralized.
- **Settler / verifier** - phases of facilitator work; not separate roles.
- **`PAYMENT-REQUIRED`** - v2 server response header carrying base64 `PaymentRequirements`.
- **`PAYMENT-SIGNATURE`** - v2 client request header carrying signed `PaymentPayload`.
- **`PAYMENT-RESPONSE`** - v2 server response header carrying settlement result (required even on failure).
- **EIP-3009** - ERC-20 extension for `transferWithAuthorization`. The hard constraint that effectively limits x402 EVM payments to USDC.
- **CAIP-2** - chain identifier standard used in `network` field (e.g., `eip155:8453`, `solana:5eykt...`).
- **Bazaar** - Coinbase's discovery layer for paid x402/MCP services. One of several discovery layers (x402.direct, Cinderwright are independent).
- **x402r** - separate-but-compatible extension proposal adding escrow-backed refunds and dispute resolution.
- **SIWX** - Sign-In-With-X (CAIP-122) wallet-controlled session identity, added in v2.

## Spec version pinned

Aligned to **x402 v2.0** spec as of **2026-04-27**. Foundation governance (Linux Foundation steward) launched 2026-04-02. See [`docs-revision.md`](references/docs-revision.md) for source-by-source last-checked dates and refresh triggers.

When in doubt, the live spec at [github.com/x402-foundation/x402/blob/main/specs/x402-specification.md](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification.md) wins.

## common mistakes

| mistake | what to do instead |
| --- | --- |
| Defaulting to Coinbase CDP / Bazaar / Base because they're loudest | Read [`facilitators.md`](references/facilitators.md) and [`networks-and-assets.md`](references/networks-and-assets.md); choose by user/cost/control needs |
| Assuming USDT or DAI works | Only EIP-3009 tokens work for `exact` scheme on EVM; that's USDC and EURC today. See [`networks-and-assets.md`](references/networks-and-assets.md) |
| Designing a refund / subscription / streaming flow into the base spec | Base spec is request-scoped and one-shot. Use x402r for refunds/escrow, SIWX sessions for identity, application logic for recurring. See [`schemes.md`](references/schemes.md) |
| Trusting Base + CDP facilitator's failure result without checking the chain | Race condition (issue #1062) means payments can succeed on-chain after facilitator returns failure. See [`limitations-and-gotchas.md`](references/limitations-and-gotchas.md) |
| Copying a tutorial that uses response-body for payment requirements | That's v1. v2 uses headers. See [`v1-vs-v2.md`](references/v1-vs-v2.md) |
| Building an autonomous agent without budget caps | 402Bridge-class incidents and runaway-loop scenarios. See [`agent-and-mcp-patterns.md`](references/agent-and-mcp-patterns.md) |
| Pricing a $0.0001 micropayment on Ethereum mainnet | Gas eats it. Pick Stellar or Solana, or raise the price. See [`networks-and-assets.md`](references/networks-and-assets.md) |
| Trusting the "$600M annualized volume" headline as proof of product-market fit | Much volume is testing/farming. Validate with your own pilot. See [`limitations-and-gotchas.md`](references/limitations-and-gotchas.md) |
