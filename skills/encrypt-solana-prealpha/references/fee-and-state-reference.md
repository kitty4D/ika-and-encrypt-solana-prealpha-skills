# Fees, accounts, and events (Encrypt-specific)

**Normative:** [Fee model](https://docs.encrypt.xyz/reference/fees.html), [Account reference](https://docs.encrypt.xyz/reference/accounts.html), [Event reference](https://docs.encrypt.xyz/reference/events.html). Use this file as a **fast orient**.

**Full in-repo copies:** [`reference-fees.md`](reference-fees.md), [`reference-accounts.md`](reference-accounts.md), [`reference-events.md`](reference-events.md) — and the index [`book-snapshots.md`](book-snapshots.md).

These topics are **Encrypt program state and economics**, not gRPC / ika-style signing flows.

---

## fee model (dual token)

- **ENC** (SPL): FHE-side charges. **SOL**: transaction-side “gas” charges.
- User holds an **`EncryptDeposit`** PDA; **`create_deposit` / `top_up` / `withdraw` / `reimburse` / `request_withdraw`** (discs **13–18**) implement the lifecycle — see [`instructions.md`](instructions.md) groups.
- **`execute_graph`** charges against the deposit using **`EncryptConfig`** fee parameters (`enc_per_input`, `enc_per_output`, `max_enc_per_op`, `max_ops_per_graph`, `gas_base`, `gas_per_input`, `gas_per_output`, `gas_per_byte`). Authority **`reimburses`** after off-chain evaluation when actual cost < max charge.
- **`update_config_fees`** (authority): mutates fee fields on config.

---

## account types (seven)

On-chain accounts use prefix **`discriminator(1) | version(1)`** then payload — full offset tables in the book.

| Disc (type id) | Account |
| ---: | --- |
| 1 | `EncryptConfig` |
| 2 | `Authority` |
| 3 | `DecryptionRequest` |
| 4 | `EncryptDeposit` |
| 5 | `RegisteredGraph` |
| 6 | `Ciphertext` |
| 7 | `NetworkEncryptionKey` |

**Typical agent tasks:** PDA seeds, field sizes, which accounts a given ix needs — always confirm in the published account reference.

---

## events (five)

Emitted via Anchor-compatible self-CPI / **`emit_event`** (disc **228**). Payloads start with the book’s **`EVENT_IX_TAG_LE`** + 1-byte event discriminator.

| Event disc | Name | Typical consumer |
| ---: | --- | --- |
| 0 | `CiphertextCreated` | Executor picks up new ciphertexts |
| 1 | `CiphertextCommitted` | Inputs become usable when verified |
| 2 | `GraphExecuted` | Executor runs graph / commits outputs |
| 3 | `DecryptionRequested` | Decryptor path |
| 4 | `DecryptionResponded` | Plaintext / response path |

---

## common mistakes

| mistake | instead |
| --- | --- |
| Treating Encrypt like “only CreateInput / ReadCiphertext” | Also model **deposits, fees, config, events** when reasoning about devnet behavior |
| Guessing account sizes | Use [Account reference](https://docs.encrypt.xyz/reference/accounts.html) |
| Ignoring `GraphExecuted` / `CiphertextCommitted` | Off-chain executor automation is event-driven in the documented architecture |
