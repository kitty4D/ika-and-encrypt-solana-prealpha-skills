# events (dWallet program)

## table of contents

1. Wire format
2. MessageApprovalCreated, SignatureCommitted, DWalletCreated, AuthorityTransferred
3. Parsing strategy (Rust + TypeScript sketches)
4. Polling vs events

The dWallet program emits **Anchor-compatible self-CPI** events as **inner instructions**. Inspect transaction meta or indexer feeds that expose inner instructions.

---

## wire format

```
EVENT_IX_TAG_LE (8 bytes) | event_discriminator (1 byte) | event_data (N bytes)
```

- **`EVENT_IX_TAG_LE`:** 8-byte constant; book little-endian hex `0xe4a545ea51cb9a1d`.
- **`event_discriminator`:** selects event type. Numeric values: derive from `ika-pre-alpha` sources or IDL for stability across releases.
- **`event_data`:** event-specific; remaining bytes of the inner instruction after the 9-byte prefix.

---

## MessageApprovalCreated

Emitted when **approve_message** initializes a MessageApproval.

| field | size |
| --- | --- |
| dwallet | 32 |
| message_digest | 32 |
| caller_program | 32 |

---

## SignatureCommitted

Emitted when the NOA executes **commit_signature**.

| field | size |
| --- | --- |
| message_approval | 32 |
| signature_len | 2 (LE u16) |

---

## DWalletCreated

Emitted when **CommitDWallet** creates a dWallet.

| field | size |
| --- | --- |
| dwallet | 32 |
| authority | 32 |
| curve | 2 (u16 LE) or per program IDL |

---

## AuthorityTransferred

Emitted when **transfer_ownership** runs.

| field | size |
| --- | --- |
| dwallet | 32 |
| old_authority | 32 |
| new_authority | 32 |

---

## parsing strategy

1. Load transaction meta with inner instructions.
2. Filter by dWallet program id.
3. For each inner ix data: require length ≥ 9; compare bytes `[0..8]` to `EVENT_IX_TAG_LE`; read `event_discriminator` at index 8; decode `event_data` per tables above.

### Rust sketch

```rust
for ix in inner_ixs {
    let data = &ix.data;
    if data.len() < 9 { continue; }
    if &data[0..8] != EVENT_IX_TAG_LE_BYTES { continue; }
    match data[8] {
        // map discriminators to structs
        _ => {}
    }
}
```

---

## TypeScript sketch

```typescript
const TAG = new Uint8Array([0x1d, 0x9a, 0xcb, 0x51, 0xea, 0x45, 0xa5, 0xe4]); // LE book constant
function parseDwalletEvents(inner: { programId: string; data: Uint8Array }[]) {
  for (const ix of inner) {
    const d = ix.data;
    if (d.length < 9) continue;
    let ok = true;
    for (let i = 0; i < 8; i++) if (d[i] !== TAG[i]) ok = false;
    if (!ok) continue;
    const disc = d[8];
    const payload = d.subarray(9);
    // switch (disc) - match program constants from repo
  }
}
```

---

## Polling vs events

Poll **MessageApproval** `status` at offset **172**; signature length **173–174** (LE u16); signature starts **175**.

| approach | pros | cons |
| --- | --- | --- |
| events | low latency when meta available | requires inner ix or indexer |
| polling | simple RPC-only path | extra RPC load, latency |
