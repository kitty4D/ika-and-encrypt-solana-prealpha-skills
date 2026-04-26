# user share encryption keys (Solana pre-alpha)

The **user share encryption key** is what protects the user's centralized secret share for **zero-trust** dWallets (and for **imported-key** dWallets configured in the encrypted variant — see [`dwallet-types.md`](dwallet-types.md)). Without it, the encrypted share is unrecoverable; with it, the user can decrypt their share, sign with the network, and re-encrypt for storage.

The canonical SDK class for managing this material lives in the **Sui-side** `@ika.xyz/sdk` package as **`UserShareEncryptionKeys`**, documented at [docs.ika.xyz/docs/sdk/user-share-encryption-keys](https://docs.ika.xyz/docs/sdk/user-share-encryption-keys). The Solana pre-alpha client (`@ika.xyz/pre-alpha-solana-client`, currently `0.1.0`) does **not** surface this class — its `src/index.ts` exports nothing, and the upstream TypeScript example helpers (`chains/solana/examples/_shared/ika-setup.ts`) pass **zero-byte placeholders** for `encrypted_centralized_secret_share_and_proof` and `encryption_key` because the pre-alpha mock signer skips proof validation.

This file exists so a wallet / extension integrator working on Solana can model the real key flow now (against the Sui SDK API surface) and have a clean migration path when the Solana pre-alpha bindings catch up.

---

## what the Sui SDK exposes (the canonical model)

`UserShareEncryptionKeys` has three constructors:

| constructor | purpose | when to reach for it |
| --- | --- | --- |
| `UserShareEncryptionKeys.fromRootSeedKey(seed: Uint8Array, curve: Curve)` | deterministic derivation from a 32-byte seed | **default for new code**; the curve must match the dWallet's curve |
| `UserShareEncryptionKeys.fromRootSeedKeyLegacyHash(seed, curve)` | legacy back-compat for non-SECP256K1 dWallets registered before the curve-byte fix | **do not use for new registrations** — the legacy hash has a bug where the curve byte is always `0` |
| `UserShareEncryptionKeys.fromShareEncryptionKeysBytes(bytes: Uint8Array)` | restore from a serialized blob (produced by `toShareEncryptionKeysBytes()`) | recovery, device migration, session resume |

Underlying primitive (per [docs.ika.xyz/docs/sdk/cryptography](https://docs.ika.xyz/docs/sdk/cryptography)):

```typescript
async function createClassGroupsKeypair(
  seed: Uint8Array, // exactly 32 bytes
  curve: Curve,
): Promise<{ encryptionKey: Uint8Array; decryptionKey: Uint8Array }>;
```

Persistence helpers:

- `toShareEncryptionKeysBytes(): Uint8Array` — opaque blob; encrypt at rest before storing
- `getEncryptionKeySignature()` — ownership proof
- `decryptUserShare(dWallet, encryptedUserShare, protocolParameters)` — async, requires the protocol parameters object

Curves supported: **SECP256K1**, **SECP256R1**, **ED25519**, **RISTRETTO**. The chosen curve **must match** the curve of the dWallet you're encrypting a share for.

---

## the four ways to source the 32-byte seed

The `fromRootSeedKey` constructor takes a 32-byte seed. Where you get those 32 bytes is the actual integration decision.

### 1. random + persisted

```typescript
const seed = new Uint8Array(32);
crypto.getRandomValues(seed);
const keys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.SECP256K1);
const blob = keys.toShareEncryptionKeysBytes();
// encrypt `blob` at rest with WebCrypto / OS keychain / KMS, then store
```

**Best for:** server-side daemons, CI bots, custodial services where you control storage and can encrypt the blob with an HSM-backed key. **Avoid for browser extensions** unless paired with a strong at-rest encryption key the user authenticates against.

### 2. wallet-signature-derived (recommended for browser extensions)

```typescript
const message = new TextEncoder().encode("ika.user-share-encryption-key.v1");
const signature = await wallet.signMessage(message); // user's existing wallet
const seed = keccak_256(signature); // 32-byte digest
const keys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.SECP256K1);
```

The user's existing wallet stays the root of trust. The extension can re-derive the same `UserShareEncryptionKeys` instance every time the popup mounts, so **nothing secret needs to live in extension storage**. Use a versioned, domain-separated message string to keep the derivation rotatable.

**Best for:** wallet browser extensions, mobile wallets with secure enclave-backed signing, any flow where the user already trusts a primary wallet for key custody.

### 3. BIP-39 mnemonic + BIP-32 path

```typescript
const seedBuffer = await mnemonicToSeed(mnemonic); // 64 bytes
const node = HDKey.fromMasterSeed(seedBuffer);
const child = node.derive("m/44'/784'/0'/0/0"); // pick a path you own
const seed = child.privateKey!.slice(0, 32);
const keys = await UserShareEncryptionKeys.fromRootSeedKey(seed, Curve.SECP256K1);
```

**Best for:** wallets that already manage a recovery phrase and want the dWallet user-share to be recoverable from that phrase. Document the derivation path explicitly so a future wallet can re-derive.

### 4. hardware wallet / secure enclave

Derive a 32-byte child key on the device (Ledger app, Secure Enclave, YubiKey OpenPGP, etc.), export the bytes only into the `fromRootSeedKey` call, and never persist the seed in the host process.

**Best for:** air-gapped or HSM-backed integrations, threat models where the host browser/OS is not trusted with the seed at any point.

---

## decision matrix

| use case | seed source | persistence |
| --- | --- | --- |
| **wallet browser extension** | wallet-signature-derived (#2) | none — re-derive on popup mount; optional `toShareEncryptionKeysBytes()` + WebCrypto-encrypted in IndexedDB as a "remember me" cache, never the primary path |
| custodial backend | random (#1) | encrypted blob in KMS / HSM-backed storage |
| recovery-phrase wallet | BIP-39 (#3) | none — re-derive from mnemonic |
| HSM / hardware wallet integration | hardware (#4) | none — re-derive on demand from device |
| device migration / session resume | n/a — restore via `fromShareEncryptionKeysBytes` | ciphertext blob synced via the user's existing encrypted backup channel |

---

## current Solana pre-alpha state (2026-04-26)

The TypeScript example flow in upstream `chains/solana/examples/_shared/ika-setup.ts` builds the `DWalletRequest::DKG` body like this:

```typescript
user_secret_key_share: {
  Encrypted: {
    encrypted_centralized_secret_share_and_proof: Array.from(new Uint8Array(32)), // ZEROS
    encryption_key: Array.from(new Uint8Array(32)),                                // ZEROS
    signer_public_key: Array.from(payer.publicKey.toBytes()),
  },
}
```

The mock signer accepts these because it skips proof validation (per the **pre-alpha disclaimer** in [`../SKILL.md`](../SKILL.md) — single mock signer, no real MPC security). A wallet/extension dev prototyping the **real** zero-trust flow on Solana today should:

1. model the user-share encryption key using the Sui SDK API surface above (it's the conceptual contract the Solana bindings will eventually expose);
2. expect that `encrypted_centralized_secret_share_and_proof` will become a real ciphertext + proof produced by a class-groups encryption of the centralized share against the network encryption key;
3. expect that `encryption_key` will become the user's class-groups public encryption key (derived from the seed via `createClassGroupsKeypair`);
4. **not** ship a "production" wallet against pre-alpha — the mock signer offers no real custody guarantees regardless of how good your client-side key management is.

When the Solana client surfaces a real `UserShareEncryptionKeys` analogue, this file should be updated to reference the Solana-side class names directly. Until then, treat [docs.ika.xyz/docs/sdk/user-share-encryption-keys](https://docs.ika.xyz/docs/sdk/user-share-encryption-keys) as the source of truth for the conceptual model and migrate the key-management code first; the gRPC body shape above is the only Solana-specific glue.

---

## related references

- [`dwallet-types.md`](dwallet-types.md) — which dWallet types actually need an encryption key (zero-trust + encrypted-variant imported-key)
- [`grpc-api.md`](grpc-api.md) — `UserSecretKeyShare::Encrypted` field shape, `DWalletRequest::DKG` body, and the **mock-zeros** caveat in the same section
- [`flows.md`](flows.md) — flow 1 (where the encrypted share is submitted), flow 9 (where the share gets made public, retiring the encryption key for that dWallet)
- [`account-layouts.md`](account-layouts.md) — `EncryptedUserSecretKeyShare` PDA (disc 11), `NetworkEncryptionKey` PDA (disc 3)
- upstream Sui SDK docs: [docs.ika.xyz/docs/sdk/user-share-encryption-keys](https://docs.ika.xyz/docs/sdk/user-share-encryption-keys), [docs.ika.xyz/docs/sdk/cryptography](https://docs.ika.xyz/docs/sdk/cryptography), [docs.ika.xyz/docs/sdk/cryptographic-primitives](https://docs.ika.xyz/docs/sdk/cryptographic-primitives)
