# agent-and-mcp-patterns

The design playbook for building AI agent commerce and MCP paid tools on x402. This is the largest single category of new x402 builds, and the constraints differ from human-facing pay-per-call APIs.

Use this when designing an agent that pays for things, an MCP server with paid tools, or a discovery layer for either.

## The agent commerce loop

```
1. discover  → agent finds a paid endpoint (Bazaar, x402.direct, Cinderwright, hardcoded URL, MCP advertisement)
2. evaluate  → agent compares price + provenance + expected value against its budget and the task's value
3. authorize → agent constructs PaymentPayload, signs with its wallet
4. call      → agent sends request with PAYMENT-SIGNATURE
5. verify    → agent reads PAYMENT-RESPONSE, confirms settlement
6. consume   → agent uses the response in its plan
7. (loop)    → agent may chain more paid calls
```

This loop is small but each step has design surface.

## Discovery

There is no single canonical discovery layer. The major ones today:

| Layer | Operator | Notes |
|---|---|---|
| **Bazaar** | Coinbase Developer Platform | Largest indexed catalog (~4,000+ services); semantic search; trust scoring |
| **x402.direct** | Independent | Search engine for the agent economy; not Coinbase-controlled |
| **Cinderwright Discovery Hub** | Independent | Daily crawl, 2x-daily health checks, reliability scoring |
| **MCP server advertisement** | Per-MCP | Many MCP servers advertise their `paidTools` directly; no central directory needed |
| **Hardcoded URLs** | Per-build | Agent has the URL baked in (config, prompt, knowledge base) |

**Design choice:** which discovery layer(s) does your agent trust? A multi-layer strategy (try MCP first, fall back to Bazaar, fall back to a curated allowlist) is common.

## Pricing evaluation

Before calling, the agent should consider:

- **Absolute price.** Does this fit in the per-task budget? In the daily / monthly cap?
- **Relative value.** Is this the best price for the task? (Discovery layers expose comparable services.)
- **Provenance.** Is the seller known? Is the discovery layer's reliability score acceptable?
- **Expected utility.** Is the response likely to be useful? (Bad scrape data = wasted money.)
- **Alternative paths.** Is there a free option that's nearly as good?

Naive "just call it" agents bleed money. Agents that evaluate first behave more like a careful procurement function.

## Budget controls

Practical guardrails for autonomous agents:

| Control | Implementation |
|---|---|
| Per-task spend cap | Wallet or middleware refuses signature if cumulative spend on this task exceeds X |
| Per-time-window cap | Daily, hourly, per-session spend caps |
| Per-counterparty cap | "Max $10 to any single seller per day" prevents griefing or compromised endpoints draining funds |
| Allowlist / denylist | Only sellers on the allowlist can be paid; or any seller except those on the denylist |
| Approval gate above threshold | Payments above $X require human approval (defeats some autonomy but limits blast radius) |
| Velocity limits | Cap on payments per minute (catches runaway loops) |

These controls live above the protocol. The protocol cannot enforce them; your agent code or wallet middleware does.

## Authorization patterns

The signing happens in the agent's wallet. Common patterns:

| Pattern | Where the key lives | Trade-off |
|---|---|---|
| In-process key | Agent process holds the private key in memory | Simple; full key compromise if process is breached |
| Wallet middleware (e.g., custom signer) | Separate process / service holds keys; agent requests signatures via RPC | Smaller blast radius; more infra |
| Hardware-backed (HSM, secure element) | Hardware signs; software requests | Strongest; expensive |
| MPC / multi-sig | Multiple parties sign; quorum required | High security; latency overhead |
| Custodial signer (third party) | Provider signs on behalf of the agent | Easiest UX; centralized trust (and the 402Bridge cautionary tale applies — see `limitations-and-gotchas.md`) |

For agents handling material amounts, in-process keys are not appropriate. The 402Bridge incident is the canonical lesson. See `key-management-patterns.md` for the full spectrum of options (hardware, HSM, MPC services, threshold signature schemes, decentralized signing networks, smart contract wallets) and how to pick by value-at-risk.

## MCP paid tools pattern

The MCP-x402 fusion is the most cleanly aligned use case for agents.

### Server side (MCP server with paid tools)

A typical paid MCP tool declaration (using a Vercel-style wrapper, but the pattern generalizes):

```ts
// pseudocode — actual SDK varies
mcpHandler({
  paidTools: [
    {
      name: "scrape_url",
      description: "Scrape a URL and return parsed content",
      inputSchema: { /* ... */ },
      price: { amount: "10000", asset: USDC_BASE, network: "eip155:8453" },
      handler: async (input, ctx) => {
        // ctx.payment is the verified PAYMENT-RESPONSE
        return await scrape(input.url);
      },
    },
  ],
});
```

The middleware handles the 402, the verification, and the settlement. The handler runs only after settlement succeeds.

### Client side (agent calling paid MCP tools)

An agent SDK wraps the MCP `callTool()` to make payment transparent:

```ts
// pseudocode
const result = await mcpClient.callTool("scrape_url", { url: "..." });
// under the hood:
// 1. tries call → receives 402 + PAYMENT-REQUIRED
// 2. constructs PaymentPayload, signs with agent's wallet
// 3. retries with PAYMENT-SIGNATURE
// 4. receives 200 + PAYMENT-RESPONSE
// 5. returns result to agent
```

If budget controls reject the payment (price too high, allowlist denial, etc.), the SDK returns an error instead.

### Discovery via MCP

Some MCP discovery patterns expose `search_resources` and `proxy_tool_call` so an agent can ask "find me a paid tool that does X" and then call it through a proxy. Bazaar's MCP server is one example; community alternatives exist.

## Agent-to-agent (A2A) patterns

Two agents transacting directly is the cleanest x402 use case in many ways: both sides are software, both sides have wallets, neither needs human UX.

| Pattern | Description |
|---|---|
| **Direct A2A** | Agent A calls agent B's API directly; B emits 402; A pays; B fulfills |
| **Brokered A2A via Bazaar/Cinderwright/etc.** | A discovers B through a registry, then transacts directly |
| **Google A2A protocol with x402 extension** | Standardized agent-to-agent envelope (https://github.com/google-agentic-commerce/a2a-x402) layered on x402 payment semantics |
| **Multi-hop A2A** | Agent A pays agent B which pays agent C; each hop is its own x402 transaction |

**Watch out for:** infinite loops where agents pay each other in cycles. Budget controls prevent runaway, but it's an emergent failure mode.

## Latency-aware design

x402 settlement is ~1–2s end-to-end on the fastest chains. For agents:

- **Parallelize independent paid calls.** If you need three different scrape endpoints, fire all three at once and pay all three in parallel.
- **Batch where possible.** If a seller offers a "bulk" endpoint, prefer it over many single calls.
- **Pre-pay common operations.** If the same operation is needed often, consider a session-token or subscription pattern (out of base spec; needs SIWX or x402r).
- **Use Solana for sub-second-sensitive operations.** ~1s settlement vs Base's ~2s.

## Observability for paid agents

What you want to log per call:

- Counterparty (URL, MCP server, identity)
- Price quoted vs price paid
- Settlement status + transaction hash
- Latency at each phase (verify, settle, fulfill)
- Whether response was useful (subjective; logged by downstream code)
- Cumulative spend (per task, per day, per counterparty)

OpenTelemetry-instrumented facilitators (e.g., x402-rs) make some of this easier server-side. Client-side, you build it yourself.

## Anti-patterns specific to agents

| Anti-pattern | What goes wrong |
|---|---|
| No budget cap | Compromised or buggy agent drains the wallet |
| No counterparty cap | Single bad seller can drain the wallet via repeated payments |
| Blind trust in discovery layer | Discovery layer can promote scam endpoints (especially if scoring is gamed) |
| Calling without value evaluation | Agent pays for low-value or duplicate data |
| Storing private keys in the agent's prompt or context | Catastrophic — the LLM can leak them |
| No telemetry | Can't tell whether the agent is making good purchasing decisions |
| Treating settlement success as fulfillment success | Payment ≠ useful response. Always evaluate what came back |
| Ignoring the Base race condition | On Base + CDP, double-check the chain when the facilitator returns failure |

## When MCP + x402 is overkill

- The agent has access to a free version of the same tool
- The cost of integration exceeds the expected value of monetization
- Your agent is internal-only and the "monetization" is just internal cost accounting (use plain budgeting instead of on-chain payment)
- You need stronger guarantees than x402 offers (refunds, escrow, fiat rails) — use a different system

## Where to look for live agent commerce

- **Bazaar:** https://docs.cdp.coinbase.com/x402/bazaar
- **x402.direct:** https://x402.direct
- **Cinderwright Discovery Hub:** https://glama.ai/mcp/servers/cinderwright-ai/cinderwright-api
- **Awesome x402:** https://github.com/xpaysh/awesome-x402

These will reflect the current landscape better than this file ever can.
