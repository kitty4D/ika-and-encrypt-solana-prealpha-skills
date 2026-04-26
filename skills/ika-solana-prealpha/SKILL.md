---
name: ika-solana-prealpha
description: Use when working with ika dWallet on Solana pre-alpha (devnet, mock signer), gRPC DWalletService SubmitTransaction, BCS signing and attestation types, ApproveMessage and MessageApproval PDAs, CommitDWallet, CommitSignature, DWalletContext CPI, @ika.xyz/pre-alpha-solana-client, or when the book vs ika-pre-alpha repo drifts, PDA or seed errors, gRPC or BCS failures, or comparing this stack to the Sui ika-sdk.
---

# ika solana pre-alpha

## Overview

Normative book: [solana pre-alpha docs](https://solana-pre-alpha.ika.xyz/) — sources [`ika-pre-alpha` `docs/`](https://github.com/dwallet-labs/ika-pre-alpha). This file routes to [`references/`](references/); it does not duplicate full tables. If [`docs-revision.md`](references/docs-revision.md) shows `docs/` on `main` past the pin, **tell the user**; do not silently patch the bundle.

## When to use

- **Integrating or debugging** ika dWallet on pre-alpha: on-chain program, gRPC, BCS, `DWalletContext` CPI, `@ika.xyz/pre-alpha-solana-client` / `@solana/kit`, and upstream `chains/solana/examples` / e2e flows in the repo.
- **Symptoms:** book vs `ika-pre-alpha` **drift**, wrong **MessageApproval** or **DWallet** PDAs, gRPC `Sign` or **SubmitTransaction** issues, Sui vs Solana ika questions — see [`solana-vs-sui-ika.md`](references/solana-vs-sui-ika.md).
- **Running the skill audit** (`/ika-solana-prealpha audit`, `audit-force`, `audit-fix <rule-id>`) — see [`audit.md`](references/audit.md).

## pre-alpha disclaimer (non-negotiable)

**SDK / dev only** — not production MPC. **Mock signer** (not distributed); **no real-value signing**; keys and protocol **not final**. **Devnet resets**; **no warranty**. Do not sell this as production custody to end users; surface limits where exposure warrants.

## references (load on demand)

| file | when |
| --- | --- |
| [`docs-revision.md`](references/docs-revision.md) | Tracked `docs/` commit vs `main` |
| [`audit.md`](references/audit.md) | **`audit` / `audit-force` / `audit-fix`**, drift script, `--no-drift`, `--drift=strict`, `.skill-audit.json` |
| [`solana-vs-sui-ika.md`](references/solana-vs-sui-ika.md) | Sui PTB/ika-sdk vs Solana gRPC/PDAs; `UserShareEncryptionKeys`; dwallet-type map |
| [`grpc-api.md`](references/grpc-api.md) | SubmitTransaction, BCS types, mock matrix, **`Attestation`** |
| [`account-layouts.md`](references/account-layouts.md) | PDA seeds, offsets |
| [`instructions.md`](references/instructions.md) | Discriminators, metas, ix data |
| [`events.md`](references/events.md) | Events vs polling `MessageApproval` |
| [`frameworks.md`](references/frameworks.md) | `DWalletContext`, crates, CPI |
| [`flows.md`](references/flows.md) | Ordered DKG → sign → CPI → verify |
| [`dwallet-types.md`](references/dwallet-types.md) | **zero-trust / shared / imported-key** — Sui taxonomy mapped to the Solana surface |
| [`user-share-encryption-keys.md`](references/user-share-encryption-keys.md) | User-share encryption key creation paths + browser-extension guidance (model lives in Sui `@ika.xyz/sdk`) |
| [`examples.md`](references/examples.md) | Upstream `chains/solana/examples`: voting, multisig, `protocols-e2e`, `_shared` |

## install

**TypeScript:** `pnpm add @ika.xyz/pre-alpha-solana-client @solana/kit` — **Rust CPI / gRPC:** [`frameworks.md`](references/frameworks.md), sample in [`grpc-api.md`](references/grpc-api.md). **Account helpers:** `ika-solana-sdk-types` (sometimes `ika-sdk-types` in prose). **Type names** from crates: `ika-dwallet-types`.

## environment (pre-alpha)

| resource | value |
| --- | --- |
| dWallet gRPC | `https://pre-alpha-dev-1.ika.ika-network.net:443` |
| Solana RPC | `https://api.devnet.solana.com` (typical) |
| dWallet program id | `87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY` |
| source repo | `https://github.com/dwallet-labs/ika-pre-alpha` |

**Canonical:** program id, gRPC URL, default RPC, git remote — **only here**; samples elsewhere must match.

## Quick reference (hub)

- **PascalCase** instruction names in program/book; **snake_case** on `DWalletContext` in Rust (e.g. `approve_message`) — [`instructions.md`](references/instructions.md), [`frameworks.md`](references/frameworks.md).
- **DWallet** PDA: **(curve u16 LE ‖ pubkey bytes)**; **MessageApproval** seeds: **`scheme_u16_le`**, **`message_digest`**, optional **`message_metadata_digest`** — not a flat `[message_approval, dwallet, message_hash]` triple — [`account-layouts.md`](references/account-layouts.md).
- **Signing** uses on-chain **`MessageApproval.signature_scheme`** and gRPC **`message` / `message_metadata`**. **`message_digest`** / PDA: **Keccak-256** (metadata digest in seeds when non-zero); scheme from **`DWalletSignatureScheme`** — [`grpc-api.md`](references/grpc-api.md), [`flows.md`](references/flows.md) flow 6.
- **Rough flow:** DKG attestation → **`CommitDWallet`** (NOA) → optional **`TransferOwnership`** → **`ApproveMessage`** → gRPC **`Sign`** → **`CommitSignature`** (NOA) / read **`MessageApproval`** — [`flows.md`](references/flows.md).

## When NOT to use

- **FHE / Encrypt** (`execute_graph`, ciphertext lifecycle) — **`encrypt-solana-prealpha`**. This skill is ika dWallet signing, not Encrypt.
- **Sui-only ika-sdk** (PTB, `IkaClient`, objects) — this skill is the **Solana** pre-alpha path; see [`solana-vs-sui-ika.md`](references/solana-vs-sui-ika.md).
- **Production custody** — pre-alpha only (mock signer, devnet resets, no warranty); do not market as production MPC.

## Audit

Slash commands, gate, drift catalog, flags, and follow-up: [`audit.md`](references/audit.md) (incl. [`drift-rules.mjs`](references/drift-rules.mjs), `.skill-audit.json`).

## common mistakes

| mistake | what to do instead |
| --- | --- |
| Wrong **MessageApproval** or **DWallet** PDAs | [`account-layouts.md`](references/account-layouts.md): MessageApproval seeds include **`scheme_u16_le`**, **`message_digest`**, optional **`message_metadata_digest`**; DWallet uses **curve u16 LE ‖ pubkey** chunks. |
| Verify from PDA **`message_digest`** only | Use **`DWalletSignatureScheme`** + **`message` / `message_metadata`** per validator path — [`flows.md`](references/flows.md) flow 6, [`grpc-api.md`](references/grpc-api.md). |
| **gRPC** trust | HTTP **200** can still wrap **`TransactionResponseData::Error`**; always deserialize `response_data` — [`grpc-api.md`](references/grpc-api.md). |
| **`docs/`** moved upstream | [`docs-revision.md`](references/docs-revision.md): tell the user; do not silently patch. |
| **Sui vs Solana** confusion | [`solana-vs-sui-ika.md`](references/solana-vs-sui-ika.md) |
