# networks-and-assets

Which chains x402 supports, which assets it accepts, and the EIP-3009 hard constraint that explains why USDC is essentially the only realistic asset today.

Use this when picking a chain for a new build, when a non-USDC asset comes up as a requirement, or when an idea needs a chain that isn't on the list.

## Vendor-neutral framing

Different sources will push different chains:

- **Coinbase** emphasizes Base (their L2)
- **Solana Foundation** emphasizes Solana (35M+ x402 transactions and growing)
- **Stellar** emphasizes Stellar (sponsored fees, sub-cent settlement)
- **Polygon, Arbitrum, Avalanche, etc.** emphasize themselves

This skill picks none of them as canonical. Pick by user geography, asset preference, throughput needs, and finality requirements — not by which company wrote the loudest blog post.

## Supported networks

CAIP-2 standard identifiers are used in `PaymentRequirements.network`. The protocol is chain-agnostic by design; what's "supported" depends on which facilitators implement which chains.

### Production-supported (multiple facilitators, mature SDKs)

| Network | CAIP-2 ID | Notes |
|---|---|---|
| Base mainnet | `eip155:8453` | Highest production transaction volume |
| Base Sepolia (testnet) | `eip155:84532` | Standard test environment |
| Solana mainnet | `solana:5eykt4UsFzeyGoCDNW2CFsvHvfJBqJ3zQcsKqt486dx` | First-class, 35M+ tx as of late 2025 |
| Solana devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | Test environment |
| Polygon | `eip155:137` | Supported by CDP and others |
| Arbitrum | `eip155:42161` | Supported by CDP |
| Ethereum mainnet | `eip155:1` | Supported but high gas makes micropayments uneconomic |
| Avalanche C-chain | `eip155:43114` | Community + facilitator support |
| World Chain | `eip155:480` | CDP-supported |

### Newer / smaller adoption

| Network | Notes |
|---|---|
| Stellar | Public free facilitator with ~5s finality and sponsored fees — uniquely cheap for micropayments |
| Aptos testnet | Reference implementation exists |
| Algorand mainnet | `scheme_exact_algo.md` spec; facilitator available |
| SKALE | Bazaar launch on SKALE announced |
| Starknet | v2 added support |
| Injective | v2 added support |
| Sui | Community implementations only |
| Sei | Second State facilitator support |
| NEAR | Community implementations only |

When in doubt, check the official network-and-token-support page (https://docs.x402.org/core-concepts/network-and-token-support) and the facilitator's own docs for what's actually live this month.

## Supported assets

### The dominant choice: USDC

Every production deployment of x402 today uses USDC. This isn't a marketing choice — it's a technical constraint (next section).

USDC is available on most supported chains. Asset addresses differ per chain:

| Chain | USDC contract / mint |
|---|---|
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Polygon | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` (native USDC) |
| Arbitrum | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Solana | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (SPL mint) |

### EURC

Euro Coin (EURC) is also supported wherever Circle has deployed it. Same EIP-3009 properties as USDC. Niche today but present.

### Native tokens (ETH, SOL, etc.)

**Not supported for payment.** Native tokens don't implement EIP-3009 (next section), so the off-chain-signed authorization pattern doesn't work for them.

### Other ERC-20 stablecoins (USDT, DAI, etc.)

**USDT does not natively implement EIP-3009.** As of writing, neither USDT nor DAI nor most other stablecoins support `transferWithAuthorization` natively. Theoretically a wrapper or permit-based bridge could be built; in practice today, USDC is the only realistic choice.

### NFTs and other non-fungible assets

**Not supported.** No standardized scheme exists for paying with ERC-721 / ERC-1155 / SPL non-fungibles. See `schemes.md`.

## The EIP-3009 hard constraint (why USDC dominates)

The `exact` scheme on EVM relies on **EIP-3009 `transferWithAuthorization`**: a method that lets a third party (the facilitator) submit a transfer signed by the token holder, paying gas itself.

Without EIP-3009 (or an equivalent like a wrapped permit), the client would have to broadcast its own transaction to pay for an HTTP request — which defeats the entire point of off-chain authorization.

EIP-3009 was proposed by Circle in 2020 and adopted natively by USDC. It has not been widely implemented by other ERC-20 tokens. Until that changes, USDC is structurally privileged in the x402 ecosystem.

**EIP-2612 `permit`** is sometimes mentioned as an alternative. It enables off-chain approvals (not direct transfers), but the integration into x402 requires extra steps and gas sponsorship infrastructure. Some facilitators support it via the EIP-2612 / ERC-20 gas-sponsoring extensions documented at https://docs.x402.org/extensions. It's a workaround, not a replacement.

For Solana, the equivalent constraint is that the SPL token must support delegated transfers — which all standard SPL tokens do, so the constraint is much looser on Solana.

## Decision matrix: chain + asset for common scenarios

| Scenario | Suggested chain | Suggested asset | Why |
|---|---|---|---|
| Cheapest possible micropayment | Stellar | USDC (Stellar variant) | Sponsored fees, sub-cent practical floor |
| US/EU consumer-facing app | Base or Polygon | USDC | Lowest friction, broad wallet support |
| Solana-native dapp / agent | Solana | USDC (SPL) | First-class support, ~1s settlement |
| Highest production reliability today | Base | USDC | Most-tested production path (with the caveat in `limitations-and-gotchas.md`) |
| Need EUR-denominated billing | Base | EURC | Same protocol, fewer FX conversions |
| Multi-chain agent | Whatever the user holds | USDC | Facilitator can be configured for several chains |
| Sub-second-sensitive | Solana | USDC | Lowest settlement latency |

This matrix is a starting point, not a recommendation. Real choice depends on your users' wallets, your team's chain expertise, and the facilitator you choose (`facilitators.md`).

## Honest call-outs

- **Base has the most marketing volume but also the unfixed race-condition bug** (issue #1062 in `limitations-and-gotchas.md`). Production users have lost funds.
- **Solana has the most transaction volume but less English-language documentation outside the official Solana Foundation pages.**
- **Stellar is genuinely cheap and has a free public facilitator, but smaller ecosystem of x402-aware tooling.**
- **Polygon, Arbitrum, Avalanche, World** all work but are second-tier in adoption — nothing wrong with them, just less production traffic to learn from.
- **Ethereum mainnet** technically works but gas costs make micropayments under ~$1 uneconomic.

## What if your asset isn't USDC

Three options today:

1. **Use USDC anyway.** Convert at the wallet layer or quote in fiat-equivalent USDC.
2. **Wait for the asset to implement EIP-3009.** Unlikely on a useful timeline for most tokens.
3. **Build or wait for a non-`exact` scheme** that doesn't require EIP-3009 (e.g., escrow-based via x402r could in principle support arbitrary ERC-20, since the funds enter an escrow contract instead of using direct transfer authorization).

If you genuinely need to take a non-USDC ERC-20 today, x402 is probably the wrong protocol. Consider Lightning (for BTC), direct on-chain payments (for ETH/SOL), or building an off-chain payment processor.

## What if your chain isn't on the list

Same triage:

1. **Check facilitator docs.** Some facilitators (x402-rs, Second State) support more chains than the official docs list.
2. **Self-host a facilitator.** x402-rs is Rust, Docker-deployable, and extensible to new chains with moderate effort.
3. **Consider whether a different chain works.** Most users don't care which chain settles their micropayment; they care that it's fast and cheap.
