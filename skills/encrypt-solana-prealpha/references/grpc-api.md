# gRPC API (Encrypt pre-alpha)

**Normative proto:** [`proto/encrypt_service.proto`](https://github.com/dwallet-labs/encrypt-pre-alpha/blob/main/proto/encrypt_service.proto) in [encrypt-pre-alpha](https://github.com/dwallet-labs/encrypt-pre-alpha).

**Endpoint:** TLS URL in [`../SKILL.md`](../SKILL.md) environment table (`pre-alpha-dev-1.encrypt.ika-network.net:443`).

**Generated clients:** `chains/solana/clients/` in the repo (Rust + TypeScript / Codama). Regenerate with upstream `just generate-clients` when proto changes.

---

## service

```protobuf
package encrypt.v1;

service EncryptService {
  rpc CreateInput(CreateInputRequest) returns (CreateInputResponse);
  rpc ReadCiphertext(ReadCiphertextRequest) returns (ReadCiphertextResponse);
}
```

**Chain enum:** `SOLANA = 0` (only variant today).

---

## CreateInput

**Purpose:** Batch-submit **encrypted input** ciphertexts; executor validates proof (**mock skips proof** in dev), creates on-chain ciphertext accounts, returns **identifiers** (same order as `inputs`).

| message | fields (summary) |
| --- | --- |
| `EncryptedInput` | `ciphertext_bytes` (see 17-byte format below), `fhe_type` (uint32, 0–44 validated server-side) |
| `CreateInputRequest` | `chain`, `repeated inputs`, `proof`, **`authorized`** (who may use ciphertexts), **`network_encryption_public_key`** (32 bytes, must match active on-chain key) |
| `CreateInputResponse` | `repeated bytes ciphertext_identifiers` |

Align `authorized` with your program’s address / access-control story and the **NetworkEncryptionKey** PDAs documented in the [on-chain guide](https://docs.encrypt.xyz/).

**`ciphertext_bytes` format (scalars):** legacy 17-byte layout `[fhe_type(1) || value_le(16)]`. The type tag is **required** — without it the executor falls into a fallback that misreads multi-byte scalars (e.g. `EUint64` returns `value >> 8`). Use `encryptValue(value, fheType)` from `@encrypt.xyz/pre-alpha-solana-client/grpc-web` or the `mockCiphertext(value, fheType)` helper in `chains/solana/examples/_shared/helpers.ts`. Anything cribbed from pre-`303439d` (2026-04-26) examples that called single-arg `mockCiphertext(value)` is wrong — see [`gotchas.md`](gotchas.md#grpc-createinput-requires-the-17-byte-input-format).

---

## ReadCiphertext

**Purpose:** Read ciphertext material off-chain. Request carries a **BCS-serialized `ReadCiphertextMessage`** plus **Ed25519** signature and **signer** pubkey.

| message | notes |
| --- | --- |
| `ReadCiphertextRequest` | `message` (BCS payload), `signature`, `signer` (32 bytes) |
| `ReadCiphertextResponse` | `value` — **mock:** plaintext bytes; **production (future):** re-encrypted under user key; `fhe_type`; `digest` for client verification |

Proto comments note **response caching** per `(ciphertext_identifier, signer, epoch)` and invalidation when the epoch advances.

---

## client snippets (illustrative)

**Rust** (from upstream README pattern):

```rust
use encrypt_solana_client::grpc::EncryptClient;
use encrypt_types::encrypted::Uint64;

let mut client = EncryptClient::connect_default().await?;
let ct = client.create_input::<Uint64>(42u64, &program_id, &network_key).await?;
```

**TypeScript** (from upstream README pattern):

> **Warning:** `@encrypt.xyz/pre-alpha-solana-client@0.1.0` (only version on npm) ships a **pre-fix `encryptValue`** that emits 16 bytes with no type tag — silent multi-byte scalar bug. Until the package republishes past 0.1.0, hand-roll the 17-byte helper instead. See [`gotchas.md`](gotchas.md#grpc-createinput-requires-the-17-byte-input-format) for the canonical template and the rationale.

```typescript
import { createEncryptClient, Chain } from "@encrypt.xyz/pre-alpha-solana-client/grpc";
// browsers / web workers: import { createEncryptWebClient } from "@encrypt.xyz/pre-alpha-solana-client/grpc-web";
// NOTE: do not import { encryptValue } until the package republishes — it ships pre-fix on @0.1.0.

// Hand-rolled 17-byte scalar input encoder. Replace with package helper after npm bumps past 0.1.0.
function mockEncryptScalarBytes(value: bigint, fheType: number): Uint8Array {
  const buf = new Uint8Array(17);
  buf[0] = fheType;
  let v = value;
  for (let i = 0; i < 16; i++) {
    buf[1 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

const encrypt = createEncryptClient();
const ct = mockEncryptScalarBytes(42n, 4); // EUint64 = fheType 4
const { ciphertextIdentifiers } = await encrypt.createInput({
  chain: Chain.Solana,
  inputs: [{ ciphertextBytes: ct, fheType: 4 }],
  authorized: programId.toBytes(),
  networkEncryptionPublicKey: networkKey,
});
```

Exact type names and defaults may differ by client version — treat the **repo examples** and generated client as source of truth.
