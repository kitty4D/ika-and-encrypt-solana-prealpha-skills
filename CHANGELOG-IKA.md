# changelog - `ika-solana-prealpha` skill

## 2026-04-26 - CSO: hub trim + `solana-vs-sui-ika` extract

### what changed

- **`SKILL.md`** — yaml `description` is **triggers only** (no audit-workflow summary in the field). new **Overview** and **When to use**; single **Audit** block pointing at [`audit.md`](skills/ika-solana-prealpha/references/audit.md). **Quick reference (hub)** folds the old on-chain / wire / core / workflows blurbs into one scannable section. **References** table gains a row for the new crosswalk file.
- **NEW [`references/solana-vs-sui-ika.md`](skills/ika-solana-prealpha/references/solana-vs-sui-ika.md)** — short Sui vs Solana surface comparison, `UserShareEncryptionKeys` + pointer to `user-share-encryption-keys.md`, link to `dwallet-types.md`. Replaces the long **vs Sui** paragraph that lived at the bottom of the hub.
- **no** `docs-revision.md` pin change; no drift-rule edit.

---

## 2026-04-26 - dWallet types + user-share encryption keys gap-fills (no upstream drift)

### why this one is different

still no **`docs/`** pin bump. **`docs-revision.md`** stays at **`3bd7945e012950e54fb4d0057b72a7d466556fc1`** (re-verified today: upstream `main` has not moved since 2026-04-17). this pass adds two reference files + slots updates into existing files to close two ergonomic gaps a wallet/extension dev would walk straight into:

1. the skill never named the **zero-trust / shared / imported-key** typology the way the live sui docs do at [docs.ika.xyz/docs/sdk/ika-transaction/dwallet-types](https://docs.ika.xyz/docs/sdk/ika-transaction/dwallet-types). all three were technically present (instruction discriminators, `is_imported` flag, `UserSecretKeyShare::Encrypted` vs `Public`) but scattered and never compared. anyone learning the model from the sui docs first would not know how to map "shared dwallet" onto the solana surface from this skill alone. **`MakeUserSecretKeySharePublic`** (disc 22) was orphaned in the discriminator table with zero prose anywhere in flows / grpc-api / examples. now it has a real subsection + a dedicated flow.
2. user-share encryption keys: the canonical class **`UserShareEncryptionKeys`** lives in sui's **`@ika.xyz/sdk`** but the solana pre-alpha client (`@ika.xyz/pre-alpha-solana-client@0.1.0`) does not expose it - and the upstream ts examples in `chains/solana/examples/_shared/ika-setup.ts` pass literal **zero-byte buffers** for `encrypted_centralized_secret_share_and_proof` and `encryption_key` because the mock signer skips proof validation. a wallet/extension dev modeling the real (non-mock) zero-trust key flow had to leave this skill to find any of that. now they don't.

### what we added in this skill (files)

- **NEW `skills/ika-solana-prealpha/references/dwallet-types.md`** - one-page mapping of the sui taxonomy (zero-trust / shared / imported-key) onto the solana surface. table of how each type is created (gRPC `UserSecretKeyShare` variant + on-chain instruction discriminators), how to detect each from on-chain data (no `is_shared` flag exists; you read it off the `EncryptedUserSecretKeyShare` PDA's presence + the `MakeSharePublic` attestation), and a use-this-when matrix (custody/wallet -> zero-trust, DAO/automation -> shared, key migration -> imported-key). links out to the sui docs page as the canonical conceptual source.

- **NEW `skills/ika-solana-prealpha/references/user-share-encryption-keys.md`** - documents the four ways to source the 32-byte seed that drives `UserShareEncryptionKeys.fromRootSeedKey`: (1) random + persisted, (2) **wallet-signature-derived** (recommended for browser extensions - re-derivable on every popup mount, no secret at rest), (3) BIP-39 mnemonic + BIP-32 path, (4) hardware wallet / secure enclave. plus the three canonical constructors (`fromRootSeedKey`, `fromRootSeedKeyLegacyHash` w/ the curve-byte bug warning, `fromShareEncryptionKeysBytes`), the `createClassGroupsKeypair` primitive, and a decision matrix per use case. closes with the current solana pre-alpha mock state (zeros placeholders) and the migration story for when the solana client surfaces a real analogue.

- **`skills/ika-solana-prealpha/SKILL.md`** - two new rows in the references-load-on-demand table (one per new reference file). expanded the **vs sui ika-sdk** line so a reader looking at the sui docs first understands that `UserShareEncryptionKeys` lives only on the sui side today + points at both new reference files.

- **`skills/ika-solana-prealpha/references/flows.md`** - new **flow 9** at the end (after voting + multisig e2e, to avoid renumbering existing cross-references): step-by-step zero-trust to shared conversion via `DWalletRequest::MakeSharePublic` -> on-chain `MakeUserSecretKeySharePublic` (disc 22) -> `VerifyMakePublic` (disc 23). includes the "born-shared alternative" via `UserSecretKeyShare::Public` in `DKG`, and the imported-key variant (works on both, `is_imported` is independent of sharedness). new TOC line at the top.

- **`skills/ika-solana-prealpha/references/grpc-api.md`** - two surgical edits. (a) right after the `UserSecretKeyShare::Encrypted` description (around the DKG section), added the **pre-alpha mock caveat** showing the exact zeroed-buffer pattern from upstream ts examples + linking to `user-share-encryption-keys.md` for the real model. (b) new **MakeSharePublic** subsection right after Presign, with the full `DWalletRequest::MakeSharePublic` body, the `VersionedPublicUserKeyShareAttestation` / `PublicUserKeyShareAttestationV1` decode shape, the on-chain commit path (disc 22 -> disc 23), the pinocchio program-sdk gap (no `make_share_public()` helper - call disc 22/23 directly), and the same mock-zeros caveat.

- **`skills/ika-solana-prealpha/references/account-layouts.md`** - added a clarifying paragraph right under the **DWallet** account table explaining that the `state` byte at offset 36 is **lifecycle only** (DKGInProgress/Active/Frozen) and that there is **no `is_shared` flag** on the account. spells out the on-chain detection logic (live `EncryptedUserSecretKeyShare` PDA = zero-trust; absent + `MakeSharePublic` attestation = shared) and notes that `is_imported` at offset 143 is **independent** of sharedness.

### what we did NOT touch

- **`docs-revision.md`** - unchanged. still pinned to **`3bd7945e012950e54fb4d0057b72a7d466556fc1`**. these gaps are structural (the upstream solana mdbook also doesn't name the three types) not drift, so no pin bump.
- **flows 1-8** were not renumbered. cross-references in **`SKILL.md`** and **`grpc-api.md`** that say "flow 6" / "flow 1 step 7" still resolve correctly. the new flow is appended as flow 9.
- **`drift-rules.mjs`** - unchanged. no rule touches `MakeSharePublic` or `UserShareEncryptionKeys` by name + the new prose doesn't introduce a pattern worth gating on yet.
- **`README-IKA.md`** - unchanged for the same reason as 2026-04-22 (readme is install/scope/attribution, not a content index).

### verification

run **`node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs`** from the repo root - should still print **`docs/ vs main: fresh`** against [dwallet-labs/ika-pre-alpha](https://github.com/dwallet-labs/ika-pre-alpha). spot-check the two new reference files render correctly and that the new SKILL.md table rows + vs-sui sentence link to them. no script changes, no rule changes, no drift impact - this is purely additive prose. carry on uwu pt 2.

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
