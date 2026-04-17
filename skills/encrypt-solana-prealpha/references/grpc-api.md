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
| `EncryptedInput` | `ciphertext_bytes`, `fhe_type` (uint32, 0–44 validated server-side) |
| `CreateInputRequest` | `chain`, `repeated inputs`, `proof`, **`authorized`** (who may use ciphertexts), **`network_encryption_public_key`** (32 bytes, must match active on-chain key) |
| `CreateInputResponse` | `repeated bytes ciphertext_identifiers` |

Align `authorized` with your program’s address / access-control story and the **NetworkEncryptionKey** PDAs documented in the [on-chain guide](https://docs.encrypt.xyz/).

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

```typescript
import { createEncryptClient, Chain } from "@encrypt.xyz/pre-alpha-solana-client/grpc";

const encrypt = createEncryptClient();
const { ciphertextIdentifiers } = await encrypt.createInput({
  chain: Chain.Solana,
  inputs: [{ ciphertextBytes: Buffer.from(/* ... */), fheType: 4 }],
  authorized: programId.toBytes(),
  networkEncryptionPublicKey: networkKey,
});
```

Exact type names and defaults may differ by client version — treat the **repo examples** and generated client as source of truth.
