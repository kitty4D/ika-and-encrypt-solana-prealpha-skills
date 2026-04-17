---
name: ika-solana-prealpha
description: Use when working with ika dWallet on Solana pre-alpha (devnet, mock signer), gRPC DWalletService SubmitTransaction, BCS SignedRequestData and DWalletRequest, NetworkSignedAttestation, versioned attestations, DWalletSignatureScheme, message_metadata, ApproveMessage, MessageApproval PDAs, CommitDWallet, CommitSignature, DWalletContext CPI (Pinocchio, native, Anchor, Quasar), @ika.xyz/pre-alpha-solana-client, @solana/kit, ika-dwallet-types, chunked dwallet seeds, chains/solana/examples, protocols-e2e, e2e-protocols, or comparing this stack to Sui ika-sdk. Call with audit or audit-force for drift and client dependency checks.
---

# ika solana pre-alpha

Normative book: [solana pre-alpha docs](https://solana-pre-alpha.ika.xyz/) — sources: [`ika-pre-alpha` `docs/`](https://github.com/dwallet-labs/ika-pre-alpha). **Details live in [`references/`](references/)**; this file is the hub only.

**Stale check:** [`references/docs-revision.md`](references/docs-revision.md) — if `docs/` on `main` is past the tracked commit, **tell the user**; do not silently rewrite the bundle.

**Maintainer / integration audit:** `/ika-solana-prealpha audit` (hard stop if skill docs pin is stale) or `/ika-solana-prealpha audit-force` (same checks, but continues after printing a stale warning). Run `node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs` from the **ika-solana-prealpha-skill** repo root, or `node scripts/audit-ika-solana-prealpha.mjs` with cwd set to this skill folder; optional `--root=<path>` for the project to scan (default `process.cwd()`); add `--force` to match audit-force.

## pre-alpha disclaimer (non-negotiable)

**SDK / dev only** — not production MPC. **Mock signer** (not distributed); **no real-value signing**; keys and protocol **not final**. **Devnet resets**; **no warranty**. Do not sell this as production custody to end users; surface limits where exposure warrants.

## references (load on demand)

| file | when |
| --- | --- |
| [`docs-revision.md`](references/docs-revision.md) | Tracked `docs/` commit vs `main` |
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

## Audit mode

If this skill is invoked with **`audit`** (e.g. `/ika-solana-prealpha audit`), treat it as a **repo + client integration audit** of the **user’s project** (workspace / `--root`), not a rewrite of this skill.

1. **Gate — skill freshness:** Read [`references/docs-revision.md`](references/docs-revision.md). If `docs/` on `ika-pre-alpha` `main` has changed since the tracked commit (same test as that file: GitHub compare `...main` restricted to `docs/`, or local `git diff <tracked>..origin/main -- docs`), **stop** after reporting: pinned commit, that book sources may be stale, link to compare, and the rule *do not silently rewrite this bundle*. **Do not** run dependency scans or semantic audit on the user repo until this gate passes (or the user uses **audit-force**).
2. **Deterministic checks:** From the ika-solana-prealpha-skill repo root, run `node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs --root=<user project>` (no `--force`), or the same path relative to the skill directory’s `scripts/` folder. Paste stdout/stderr; honor non-zero exit as **blocked** when the script reports doc drift. That script also compares **locked** `@ika.xyz/pre-alpha-solana-client` and `@solana/kit` versions to npm **`latest`** when it finds a `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` (walking up to the monorepo root).
3. **Semantic checklist (user code):** With [`flows.md`](references/flows.md), [`grpc-api.md`](references/grpc-api.md), and [`account-layouts.md`](references/account-layouts.md), trace **`Sign` / `SubmitTransaction`**, **`ApproveMessage` / CPI**, **MessageApproval** reads, and **flow 6** verification; cite **file:line**. Note gaps; do not invent upstream APIs.

## Audit-force mode

If invoked with **`audit-force`** (e.g. `/ika-solana-prealpha audit-force`), perform the **same** steps as **Audit mode**, except:

1. **Still compute and print** whether `docs/` is stale (commit, compare link, warning that the skill may be wrong for new book prose).
2. **Then continue** even if stale: run `node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs --force --root=<user project>` (or `node scripts/audit-ika-solana-prealpha.mjs` from the skill folder) and complete the semantic checklist. The human must see the stale warning **before** downstream “all clear” language.

## common mistakes

| mistake | what to do instead |
| --- | --- |
| Wrong **MessageApproval** or **DWallet** PDAs | [`account-layouts.md`](references/account-layouts.md): MessageApproval seeds include **`scheme_u16_le`**, **`message_digest`**, optional **`message_metadata_digest`**; DWallet chunks use **curve u16 LE ‖ pubkey**. |
| Verify from PDA **`message_digest`** only | Use **`DWalletSignatureScheme`** + **`message` / `message_metadata`** like the validator — [`flows.md`](references/flows.md) flow 6, [`grpc-api.md`](references/grpc-api.md). |
| **gRPC** trust | Mock **`Sign`** often **`Error`**; HTTP **200** can still wrap **`TransactionResponseData::Error`** — deserialize — [`grpc-api.md`](references/grpc-api.md). |
| **`docs/`** moved upstream | [`docs-revision.md`](references/docs-revision.md): tell the user; do not silently patch this bundle. |

**vs Sui `ika-sdk`:** Sui uses PTB + `IkaClient`, objects, effects certs; Solana pre-alpha uses Solana txs + gRPC **`SubmitTransaction`**, PDAs, **`ApprovalProof::Solana`**. BCS and lifecycles: [`grpc-api.md`](references/grpc-api.md), [`flows.md`](references/flows.md).

## related (optional)

Generic Solana / wallet docs for non-ika plumbing as needed.
