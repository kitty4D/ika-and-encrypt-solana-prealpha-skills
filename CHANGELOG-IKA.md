# changelog - `ika-solana-prealpha` skill

## 2026-04-17 - align with ika-pre-alpha `main` @ `3bd7945`

### what upstream did (the short version)

dWallet Labs landed fresh mdbook stuff on `ika-pre-alpha` `main`. the big one: **`docs/src/grpc/request-types.md`** now has a **Mock Support** section that says all **`DWalletRequest`** variants are **implemented** end-to-end in pre-alpha (with **`protocols-e2e` / `e2e-protocols`** called out), and the **disclaimer** in **`submit-transaction.md`** got tighter: single mock signer, **not** real MPC, but **11 protocol operations** across **4 curves** and **7 signature schemes** - still dev/test only, keys not final, etc.

the old story in the book (“`Sign` / `ImportedKeySign` basically error in mock because no `MessageApproval` lookup”, plus several ops “not implemented”) **doesn’t match that table anymore**. some per-variant sections in the same file still read like legacy caveats; we treat the **Mock Support** table as what this skill tracks until upstream deletes the contradictions. (life is a small raccoon holding two contradictory markdown files. we pick one.)

### what we changed in this skill (files)

- **`skills/ika-solana-prealpha/references/docs-revision.md`** - pinned the tracked **`docs/`** snapshot to commit **`3bd7945e012950e54fb4d0057b72a7d466556fc1`** (was **`bbef8cf…`**, 2026-04-15). dates in the table updated so ur stale-check scripts and future u don’t argue with git.

- **`skills/ika-solana-prealpha/references/grpc-api.md`** - rewrote **Mock support (pre-alpha)**: new condensed table aligned to upstream’s **Status / Notes** grid; explained that **`Sign` / `ImportedKeySign`** still need real **on-chain `MessageApproval`** + valid **`ApprovalProof::Solana`** (validators read **`signature_scheme`** from chain). dropped the obsolete “mock never looks up `MessageApproval`” line. added a short **Note** on legacy per-variant wording vs the **Mock Support** table. refreshed **`TransactionResponseData`** prose: **`Error`** isn’t described as “mock limitation” only; **`Signature` / `Attestation`** rows mention the ops that actually return those. **On-chain vs signing digest** bit now says **`message_digest`** where we mean the PDA seed field, consistent with **`account-layouts.md`**.

- **`skills/ika-solana-prealpha/references/flows.md`** - flow 2: step 1 uses **`message_digest`** / optional **`message_metadata_digest`** language consistent with **`approve_message`**; step 2 **MessageApproval** PDA line matches **`account-layouts.md`** (chunked **`dwallet`** + **`message_approval`** + scheme + digests) instead of a simplified wrong triple. step 8: **`Sign`** is **supported** in mock when chain state + proofs are real - no more “mock can’t index Solana so it’s always error” - still devnet / e2e when u need actual accounts. flow 3 step 5: same alignment, minus the old “mock caveat” phrasing. flow 6 / toc: **`message_digest`** wording vs signed digest for verification (less **`message_hash`** drift).

- **`skills/ika-solana-prealpha/SKILL.md`** - **common mistakes** row for **gRPC trust**: no longer claims mock **`Sign`** is “often **`Error`**” for the old MessageApproval-indexing reason; focuses on **deserialize `response_data`**, valid approval state, and inputs.

### verification

after the pin bump, **`node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs`** should report **`docs/ vs main: fresh`** against **`dwallet-labs/ika-pre-alpha`** (until `main` moves again - then it’s changelog season 2, solana boogaloo).
