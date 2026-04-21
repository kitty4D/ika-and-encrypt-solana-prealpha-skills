---
name: ika-solana-prealpha
description: Use when working with ika dWallet on Solana pre-alpha (devnet, mock signer), gRPC DWalletService SubmitTransaction, BCS SignedRequestData and DWalletRequest, NetworkSignedAttestation, versioned attestations, DWalletSignatureScheme, message_metadata, ApproveMessage, MessageApproval PDAs, CommitDWallet, CommitSignature, DWalletContext CPI (Pinocchio, native, Anchor, Quasar), @ika.xyz/pre-alpha-solana-client, @solana/kit, ika-dwallet-types, chunked dwallet seeds, chains/solana/examples, protocols-e2e, e2e-protocols, comparing to Sui ika-sdk, or when docs vs repo drift, PDA/account layout mistakes, gRPC SubmitTransaction or BCS issues, or CPI/DWalletContext integration breaks appear. Also covers `/ika-solana-prealpha audit` / `audit-force` / `audit-fix <rule-id>` — script-driven integration audit + skill-vs-codebase drift findings with ready-to-paste fix prompts.
---

# ika solana pre-alpha

Normative book: [solana pre-alpha docs](https://solana-pre-alpha.ika.xyz/) — sources: [`ika-pre-alpha` `docs/`](https://github.com/dwallet-labs/ika-pre-alpha). **Details live in [`references/`](references/)**; this file is the hub only.

**Stale check:** [`references/docs-revision.md`](references/docs-revision.md) — if `docs/` on `main` is past the tracked commit, **tell the user**; do not silently rewrite the bundle.

**Maintainer / integration audit:** `/ika-solana-prealpha audit` / `audit-force` / `audit-fix <rule-id>` — full gate, script, drift catalog, and checklist live in [`references/audit.md`](references/audit.md).

## pre-alpha disclaimer (non-negotiable)

**SDK / dev only** — not production MPC. **Mock signer** (not distributed); **no real-value signing**; keys and protocol **not final**. **Devnet resets**; **no warranty**. Do not sell this as production custody to end users; surface limits where exposure warrants.

## references (load on demand)

| file | when |
| --- | --- |
| [`docs-revision.md`](references/docs-revision.md) | Tracked `docs/` commit vs `main` |
| [`audit.md`](references/audit.md) | **`audit` / `audit-force` / `audit-fix`**, drift script, `--no-drift`, `--drift=strict`, `.skill-audit.json` |
| [`grpc-api.md`](references/grpc-api.md) | SubmitTransaction, BCS types, mock matrix, **`Attestation`** |
| [`account-layouts.md`](references/account-layouts.md) | PDA seeds, offsets |
| [`instructions.md`](references/instructions.md) | Discriminators, metas, ix data |
| [`events.md`](references/events.md) | Events vs polling `MessageApproval` |
| [`frameworks.md`](references/frameworks.md) | `DWalletContext`, crates, CPI |
| [`flows.md`](references/flows.md) | Ordered DKG → sign → CPI → verify |
| [`examples.md`](references/examples.md) | Upstream `chains/solana/examples`: voting, multisig, `protocols-e2e`, `_shared` |

## install

**TypeScript:** `pnpm add @ika.xyz/pre-alpha-solana-client @solana/kit` — **Rust CPI / gRPC:** [`frameworks.md`](references/frameworks.md), sample in [`grpc-api.md`](references/grpc-api.md). **Account helpers:** `ika-solana-sdk-types` (sometimes `ika-sdk-types` in prose).

## environment (pre-alpha)

| resource | value |
| --- | --- |
| dWallet gRPC | `https://pre-alpha-dev-1.ika.ika-network.net:443` |
| Solana RPC | `https://api.devnet.solana.com` (typical) |
| dWallet program id | `87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY` |
| source repo | `https://github.com/dwallet-labs/ika-pre-alpha` |

**Canonical:** program id, gRPC URL, default RPC, git remote — **only here**; samples elsewhere must match.

## on-chain instruction names vs Rust CPI

The **program** and **book** use PascalCase instruction names with discriminators — e.g. **`ApproveMessage`** (8), **`TransferOwnership`** (24), **`CommitDWallet`** (31), **`CommitSignature`** (43). Full table: [`instructions.md`](references/instructions.md). **Rust SDK** methods on `DWalletContext` are snake_case (`approve_message`, …) and wrap those instructions — see [`frameworks.md`](references/frameworks.md).

## wire (one minute)

- **DWallet** PDA: chunk **(curve u16 LE ‖ pubkey bytes)** per [`account-layouts.md`](references/account-layouts.md) — not legacy single-byte curve.
- **MessageApproval** PDA: seeds include **`scheme_u16_le`**, **`message_digest`**, optional **`message_metadata_digest`** — not a flat `[message_approval, dwallet, message_hash]` triple.
- **Signing:** scheme from on-chain **`MessageApproval.signature_scheme`** (`DWalletSignatureScheme`) plus **`message` / `message_metadata`** on gRPC — [`grpc-api.md`](references/grpc-api.md).

## core convention

**`message_digest`** / PDA keys: **Keccak-256** of the message (and metadata digest in seeds when non-zero). How the network signs follows **`DWalletSignatureScheme`** — [`grpc-api.md`](references/grpc-api.md), [`flows.md`](references/flows.md) flow 6.

## workflows

**Rough order:** DKG attestation → **`CommitDWallet`** (NOA) → optional **`TransferOwnership`** → **`ApproveMessage`** → gRPC **`Sign`** → **`CommitSignature`** (NOA) / read **`MessageApproval`**. Detail: [`flows.md`](references/flows.md).

## When NOT to use

- **Non-ika signing work** — if the user needs FHE / `execute_graph` / ciphertext lifecycle, route to **`encrypt-solana-prealpha`**. This skill is for ika dWallet signing, not Encrypt.
- **Sui ika-sdk questions** — Sui uses PTB + `IkaClient` / objects / effects certs; this skill teaches the Solana pre-alpha surface (txs + gRPC `SubmitTransaction` + PDAs + `ApprovalProof::Solana`). See `grpc-api.md` for the vs-Sui table if the user is migrating.
- **Production custody / real-value signing** — pre-alpha only (mock signer, devnet resets, no warranty). Redirect to mainnet ika once it exists; do not market this as production MPC.

## Audit / audit-force / audit-fix

See [`references/audit.md`](references/audit.md) for the gate, CLI flags (`--force`, `--no-drift`, `--drift=strict`, `--root=`), drift catalog ([`references/drift-rules.mjs`](references/drift-rules.mjs)), `.skill-audit.json` state file, and the full follow-up menu.

## common mistakes

| mistake | what to do instead |
| --- | --- |
| Wrong **MessageApproval** or **DWallet** PDAs | [`account-layouts.md`](references/account-layouts.md): MessageApproval seeds include **`scheme_u16_le`**, **`message_digest`**, optional **`message_metadata_digest`**; DWallet chunks use **curve u16 LE ‖ pubkey**. |
| Verify from PDA **`message_digest`** only | Use **`DWalletSignatureScheme`** + **`message` / `message_metadata`** like the validator — [`flows.md`](references/flows.md) flow 6, [`grpc-api.md`](references/grpc-api.md). |
| **gRPC** trust | HTTP **200** can still wrap **`TransactionResponseData::Error`**; **`Sign` succeeds only with valid on-chain approval state and inputs** — always deserialize `response_data` — [`grpc-api.md`](references/grpc-api.md). |
| **`docs/`** moved upstream | [`docs-revision.md`](references/docs-revision.md): tell the user; do not silently patch this bundle. |

**vs Sui `ika-sdk`:** Sui uses PTB + `IkaClient`, objects, effects certs; Solana pre-alpha uses Solana txs + gRPC **`SubmitTransaction`**, PDAs, **`ApprovalProof::Solana`**. BCS and lifecycles: [`grpc-api.md`](references/grpc-api.md), [`flows.md`](references/flows.md).

## related (optional)

Generic Solana / wallet docs for non-ika plumbing as needed.
