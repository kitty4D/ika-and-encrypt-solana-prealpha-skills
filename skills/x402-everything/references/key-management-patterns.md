# key-management-patterns

The x402 protocol assumes the client controls a wallet that can sign payment authorizations. *How* that wallet is controlled is out of scope for the protocol but central to whether your build is safe, especially for autonomous agents handling material amounts.

Use this when designing the signing surface for an agent, server, or service that uses x402; when reviewing the security posture of an existing build; or after reading the 402Bridge incident in `limitations-and-gotchas.md` and asking "what would have prevented that?"

## The lesson from 402Bridge

In October 2025, ~$200k+ USDC was drained from 200+ users of a centralized cross-chain bridge built on x402. Root cause: a single private key was stored in plaintext on a networked server, with unlimited user approvals delegated to it.

This is not a bug in the x402 protocol. It is a key-management failure of a kind that recurs in every cycle of crypto infrastructure. The protocol cannot prevent it. **Your key management choice is the difference between a recoverable mistake and a total loss.**

The categories below are arranged from least-safe / most-DIY to most-safe / most-infrastructure. Pick by the value at risk, not by what's easiest.

## The spectrum

| Category | Where the key lives | Examples | Typical fit for x402 |
|---|---|---|---|
| In-process keys | Agent or server process memory | A `.env` file, a hardcoded constant | Local dev only |
| Local secure storage | OS keychain or encrypted file | macOS Keychain, Linux Secret Service, age-encrypted file | Single-user CLI tools |
| Hardware wallets | User-controlled hardware | Ledger, Trezor, Coldcard, GridPlus | Human-driven flows; clunky for agents |
| Cloud HSMs / KMS | Cloud-provider hardware | AWS KMS, Google Cloud HSM, Azure Key Vault, YubiHSM | Server-side flows with audit/compliance needs |
| Trusted Execution Environments | Software in hardware-isolated enclave | Intel SGX, AMD SEV, AWS Nitro Enclaves | Mid-trust agents; isolation without external custody |
| MPC services (custodial-ish) | Vendor's distributed compute | Fireblocks, Coinbase WaaS, ZenGo, Privy, Magic.link | Easiest "managed" path; vendor trust required |
| Threshold signature schemes (self-hosted) | Multiple parties you control | tss-lib, Sodot SDK, MPC frameworks | High-value flows where you want MPC without a vendor |
| Decentralized signing networks | Distributed network with policy on chain | ika dWallets, Lit Protocol PKPs | Cross-chain or policy-gated agent commerce |
| Smart contract wallets | On-chain logic + off-chain signers | Safe (Gnosis), Argent, ERC-4337 account abstraction | Programmable spend rules, multi-sig governance |

Detail on each follows.

---

## In-process keys

**What it is:** the private key sits in the agent's memory, a `.env` file, a config secret, a hardcoded string.

**Examples:** typical hackathon code, most "hello world" wallet tutorials, the 402Bridge architecture before the breach.

**Trade-offs:** simplest to build; catastrophic if the process is compromised. The LLM-in-the-loop case is especially dangerous — agents can leak keys via prompt injection or by including them in tool-call arguments.

**Fit for x402:** local development only. Not appropriate for any agent that holds real funds.

**The 402Bridge anti-pattern in one line:** a single in-process key with unlimited user approvals = total compromise on first breach.

---

## Local secure storage

**What it is:** keys live in OS-managed secret stores (macOS Keychain, Linux Secret Service / GNOME Keyring, Windows Credential Manager) or in an encrypted file unlocked by a passphrase.

**Examples:** `keytar` for Node, the `keyring` Python library, age-encrypted `.env` files.

**Trade-offs:** much harder to exfiltrate than a plaintext key, but still a single point of failure on the user's machine. No protection against malware running with the user's privileges.

**Fit for x402:** single-user CLI tools, developer workstations, agents pinned to one machine with low-value flows.

---

## Hardware wallets

**What it is:** dedicated hardware (USB device, smart card, hardware wallet) holds the key. Signing happens on-device; the key never leaves.

**Examples:** Ledger (Nano S/X, Stax), Trezor (Model One/T), Coldcard, GridPlus Lattice1, Keystone.

**Trade-offs:** strongest single-key protection. Major UX cost: every signature requires physical confirmation, which kills agent autonomy. Some hardware wallets support "blind signing" mode that removes the confirmation gate, but that recreates the in-process problem with extra latency.

**Fit for x402:** human-in-the-loop flows where a person is approving each payment (rare in x402's typical use cases). Mostly impractical for autonomous agents.

---

## Cloud HSMs and KMS

**What it is:** cloud-provider hardware security modules expose signing operations via API. The key never leaves the HSM; your code only sends "sign this" requests.

**Examples:** AWS KMS / CloudHSM, Google Cloud HSM, Azure Key Vault Premium, IBM Cloud HSM, YubiHSM (self-hosted hardware), Thales Luna.

**Trade-offs:** strong key isolation, audit logs, IAM integration, certifications (FIPS 140-2 Level 2 or 3) for compliance use cases. Costs money per signing operation. Vendor trust required (the cloud provider could in theory be compelled to sign). Most cloud HSMs sign secp256k1 (EVM-compatible) but not all support Ed25519 (Solana) — check before committing.

**Fit for x402:** server-side payment flows with compliance needs, agents under regulated environments, mid-to-high-value flows where the per-signature cost is justified.

---

## Trusted Execution Environments (TEEs)

**What it is:** code runs in a hardware-isolated enclave that the host operating system cannot inspect. Keys generated inside the enclave can be made impossible to extract.

**Examples:** Intel SGX, AMD SEV-SNP, AWS Nitro Enclaves, Google Confidential Computing, Azure Confidential VMs.

**Trade-offs:** strong isolation without delegating custody to a third party. Complexity is real (attestation, remote verification, side-channel concerns). Some TEE generations have had documented vulnerabilities; check the current state of art before relying on a specific implementation.

**Fit for x402:** mid-trust agents that need to hold keys server-side without a custodial relationship; experimental decentralized facilitators.

---

## MPC services (managed)

**What it is:** the provider runs a multi-party computation network that holds key shares. Signing requires quorum across the provider's nodes. From your code's perspective it looks like a custodial signer, but the provider cannot unilaterally sign because no single node has the full key.

**Examples:** Fireblocks, Coinbase Wallet-as-a-Service (WaaS), ZenGo, Privy, Magic.link, Web3Auth, Turnkey.

**Trade-offs:** easiest "managed but non-custodial-ish" path. Provider has policy controls, audit logs, allowance limits, automated workflows. Vendor trust required (the provider could in theory collude internally to sign or refuse). Pricing varies; some have per-signature fees that add up at high volume.

**Fit for x402:** agent commerce platforms wanting fast time-to-market, products where the operator is fine trusting one MPC vendor, mid-value autonomous agents.

---

## Threshold signature schemes (self-hosted)

**What it is:** the same MPC concept as above, but you operate the nodes. Multiple parties you control hold key shares; a quorum signs. No single party — including you — can sign alone.

**Examples:** ZenGo's `tss-lib` (open source), Sodot SDK, various academic and open-source TSS implementations for ECDSA and Ed25519.

**Trade-offs:** removes vendor trust. Operationally heavy: you run multiple signing nodes (ideally on independent infrastructure), manage their keys, handle node failures. Library quality and audit status matter a lot.

**Fit for x402:** high-value flows where vendor trust is a non-starter, organizations with security engineering capacity, decentralized facilitator operators.

---

## Decentralized signing networks

**What it is:** key shares are held by an external decentralized network, with signing policy enforced on-chain. The network signs only when policy conditions are met (quorum among network nodes, plus on-chain approvals or attestations).

**Examples:** Lit Protocol Programmable Key Pairs (PKPs), ika dWallets (multi-chain signing where signing is split between users/agents and Solana program logic, completed through ika's MPC network), various emerging zk-based signing networks.

**Trade-offs:** strongest decoupling of "who holds the key" from "who controls when it signs." Policy lives on chain, so spending rules are auditable and enforceable independently of any single operator. Cross-chain capability is real — one logical wallet signs on multiple chains. Latency and cost vary; networks are still relatively young; ecosystem maturity differs by project.

**Fit for x402:**
- Cross-chain agent commerce (one logical wallet signs USDC payments on Base, Solana, Polygon, etc. without bridging)
- Agents whose spending policy needs to be enforced cryptographically rather than by a vendor's word
- DAO or multi-party treasuries operating agents collectively
- Avoiding the 402Bridge failure mode where a single operator's key compromise = total loss

For ika specifically, this repo also publishes the `ika-solana-prealpha` skill (a separate, unrelated skill in this same monorepo). If you actually want to integrate ika dWallets, load that skill — this skill stays implementation-neutral and won't walk you through dWallet integration.

---

## Smart contract wallets

**What it is:** the "wallet" is an on-chain smart contract that gates signing with programmable logic. The signer of a transaction (often called the "session key" or "owner") may be lower-trust because the contract enforces what they can do.

**Examples:** Safe (formerly Gnosis Safe), Argent, ERC-4337 account abstraction wallets (Biconomy, Stackup, Pimlico, Alchemy AA), Coinbase Smart Wallet, Solana's program-controlled accounts.

**Trade-offs:** programmable spend rules (per-day limits, per-recipient limits, time-locks, multi-sig quorum). Adds gas overhead. ERC-4337 ecosystem is mature on EVM; equivalents on Solana use program-derived addresses with different ergonomics.

**Fit for x402:** agents with strict on-chain spending policy, multi-party / DAO agents, products where users want self-custody with budget guards. Note: x402's `exact` scheme on EVM relies on EIP-3009 `transferWithAuthorization`, and not all smart contract wallets support EIP-3009 natively. Check before committing — some need a workaround like depositing USDC into a sub-account that does.

---

## Custodial signers

**What it is:** the provider holds the key outright and signs on your behalf when authorized.

**Examples:** Coinbase Custody, BitGo, Anchorage, Fireblocks (when used in fully-custodial mode), most exchange wallets.

**Trade-offs:** simplest UX; full vendor trust; regulatory implications (the custodian may be a regulated entity with KYC requirements, withdrawal limits, etc.). For agent commerce, custodians often have rate limits and policy controls that conflict with autonomous high-frequency operations.

**Fit for x402:** generally not a great fit for autonomous agent commerce. Better suited to human-managed treasury operations that occasionally use x402 endpoints.

---

## Choosing a category

Some practical decision questions:

| If you... | Consider |
|---|---|
| Are running local dev or a hackathon prototype | In-process or local secure storage; **not** for production |
| Run an autonomous agent with under ~$100 at risk | Local secure storage or MPC service |
| Run an autonomous agent with $100–$10k at risk | MPC service or cloud HSM |
| Run an autonomous agent with > $10k at risk | Self-hosted TSS, decentralized signing, or smart contract wallet with quorum |
| Operate a multi-party / DAO agent | Smart contract wallet (multi-sig) or decentralized signing network |
| Need to sign on multiple chains from one logical identity | Decentralized signing networks |
| Need regulator-friendly audit trail | Cloud HSM or custodial signer |
| Cannot tolerate any single vendor trust | Self-hosted TSS or decentralized signing network |
| Are building a custodial bridge or pooled-funds service | Read 402Bridge writeup in `limitations-and-gotchas.md` first |

## Cross-cutting requirements regardless of category

Whatever you pick, layer these on top:

- **Allowance limits.** Don't grant unlimited token approvals. The 402Bridge attacker drained funds because users had granted unbounded USDC allowances. Use exact-amount allowances, refresh per session, or a smart-contract layer that caps spending.
- **Per-counterparty caps.** Limit how much can flow to any single recipient per time window.
- **Per-session and per-day budgets.** Enforce in the wallet middleware, not just the agent code.
- **Velocity limits.** Cap signatures per minute/hour to catch runaway agent loops.
- **Independent monitoring.** Log every signature off the signing service to a separate system. Alert on anomalies.
- **Key rotation plan.** Have a documented procedure for rotating keys when (not if) something goes wrong.
- **Defense in depth.** No single layer is enough. Combine: HSM + on-chain spend caps + monitoring + alerting beats any single category.

## What this skill won't tell you

- Which specific MPC vendor or HSM is right for your build (depends on your jurisdiction, scale, and team)
- How to integrate any specific signing service with any specific x402 SDK (those are SDK-specific topics; load the relevant docs)
- Audit results for the libraries listed (check current audit reports yourself before relying on any of them)
- Whether a specific decentralized signing network has shipped, is in pre-alpha, or is roadmap-only (check each project's current status)

The point of this file is to make sure you pick from a category that fits your value-at-risk and threat model, not to recommend a specific stack.
