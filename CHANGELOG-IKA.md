# changelog - `ika-solana-prealpha` skill

## 2026-04-22 - client contract gap-fills (no upstream drift)

### why this one is different

not a **`docs/`** pin bump. not chasing upstream drift. **`docs-revision.md`** is still pinned to **`3bd7945…`** and the audit script still prints **fresh** against [dwallet-labs/ika-pre-alpha](https://github.com/dwallet-labs/ika-pre-alpha). this pass just fills three client-side traps that were technically correct-but-sparse in the skill and kept catching ppl in real integration code. (u know the vibe: the type signature was always right, the human just couldn't see the trap from reading it.)

### what we added in this skill (files)

- **`skills/ika-solana-prealpha/references/grpc-api.md`** - new **Client persistence contract (important)** subsection right under the **`NetworkSignedAttestation`** struct + table. tl;dr: store the **full BCS NSA bytes** on the client dWallet record, not just **`attestation_data`**. every later **`PresignForDWallet`** / **`Sign`** embeds the NSA by value as **`dwallet_attestation: NetworkSignedAttestation`**, so if u only persist the inner versioned blob u silently lose **`network_signature`**, **`network_pubkey`**, and **`epoch`**, and validators hard-reject the next request. ships with a tight TS round-trip snippet right under the rule (serialize on DKG → base64 → persist; parse back before Presign / Sign) so it's not just vibes.

- **`skills/ika-solana-prealpha/references/grpc-api.md`** - new **`message_metadata` default** bullet inside **Sign and ImportedKeySign**. empty **`Vec<u8>`** (`[]`) is the correct default for **`EcdsaKeccak256`**, **`EcdsaSha256`**, **`EcdsaDoubleSha256`**, **`TaprootSha256`**, and **`EddsaSha512`**. only **`EcdsaBlake2b256`** and **`SchnorrkelMerlin`** actually want a populated metadata struct (**`Blake2bMessageMetadata`** / **`SchnorrkelMessageMetadata`**). also spells out the PDA-side half: when metadata is empty, **`MessageApproval`** seeds OMIT the **`message_metadata_digest`** seed entirely (links to **`account-layouts.md`**) - u do NOT sub in a 32-byte zero. (zero-filling that seed is the funniest silent PDA-mismatch bug, if u have lived thru it u just felt a little seen.)

- **`skills/ika-solana-prealpha/references/flows.md`** - new **After DKG: deriving the dWallet PDA client-side** subsection immediately after flow 1 step 7. bridges the previously-implicit gap between "decode **`VersionedDWalletDataAttestation`**" (step 6) and "derive the PDA" (step 7): pull **`V1.public_key`** out of the versioned blob (32 bytes for Curve25519 / Ristretto, 33 compressed or 65 uncompressed for Secp256k1), concat **`(curve_u16_le || public_key)`**, chunk into 32-byte pieces (Solana `MAX_SEED_LEN`), `findProgramAddress(["dwallet", ...chunks], dwallet_program_id)`. the receipts-pt-2 note: persist the raw public-key bytes NEXT TO the NSA bytes on the same client record, bc **`PresignForDWallet.dwallet_public_key`** and every client-side **`MessageApproval`** seed derivation need those pubkey bytes later, and they are NOT recoverable from the dWallet PDA alone.

### what we did NOT touch

- **`docs-revision.md`** - unchanged. still pinned to **`3bd7945e012950e54fb4d0057b72a7d466556fc1`** (tracked 2026-04-17).
- **`README-IKA.md`** - unchanged. the readme is install / scope / attribution tier, not a content index, and bulleting every new subsection there is how readmes drift out of sync w the skill body.
- **`SKILL.md`** hub - unchanged. the hub was already pointing at the right reference files under existing section headers; these additions slot in without needing new hub rows.

### verification

same audit u've been running: **`node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs`** from the repo root (or the skill folder). nothing in **`references/drift-rules.mjs`** keys on **`NetworkSignedAttestation`** by name, and the existing **`VersionedDWalletDataAttestation`** rule is reinforced (not contradicted) by the new flow-1 subsection. no pin bump, no script changes, no new rules - this is a docs-internal polish release. carry on uwu.

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
