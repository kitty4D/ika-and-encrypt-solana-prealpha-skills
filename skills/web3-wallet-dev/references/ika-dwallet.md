# Ika dWallet Integration Guide

> Drawn directly from `ika-sdk`, `ika-move`, `ika-cli`, and `ika-operator` skills.
> Read those skills for full API reference, operator setup, and CLI usage.

## What is a dWallet?

A dWallet is a zero-trust, programmable signing mechanism on Sui that produces native
signatures for any blockchain — no bridges, no wrapping, no trusted custodians.

The 2PC-MPC protocol splits signing between:
- **User key share** — held by the user, required for every signature
- **Network share** — operated by Ika's decentralized MPC nodes (2/3 threshold)

The full private key is **never reconstructed**.

---

## Install

```bash
pnpm add @ika.xyz/sdk
# Requires @mysten/sui ^2.5.0, Node >=18
```

## Setup

```typescript
import { getNetworkConfig, IkaClient } from '@ika.xyz/sdk';
import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

const suiClient = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl('testnet'),
    network: 'testnet',
});
const ikaClient = new IkaClient({
    suiClient,
    config: getNetworkConfig('testnet'), // or 'mainnet'
    cache: true,
});
await ikaClient.initialize();
```

---

## Enums: Curve, SignatureAlgorithm, Hash

```typescript
import { Curve, SignatureAlgorithm, Hash } from '@ika.xyz/sdk';
```

### Valid Combinations by Target Chain

| Chain | Curve | SignatureAlgorithm | Hash |
|---|---|---|---|
| Ethereum | SECP256K1 | ECDSASecp256k1 | KECCAK256 |
| Bitcoin Taproot | SECP256K1 | Taproot | SHA256 |
| Bitcoin Legacy | SECP256K1 | ECDSASecp256k1 | DoubleSHA256 |
| Solana | ED25519 | EdDSA | SHA512 |
| WebAuthn / P-256 | SECP256R1 | ECDSASecp256r1 | SHA256 |
| Substrate | RISTRETTO | SchnorrkelSubstrate | Merlin |

**Move integer constants** (for Move contracts):

| Chain | Curve int | Sig Algo int | Hash int |
|---|---|---|---|
| Bitcoin Taproot | 0 | 1 | 0 (SHA256) |
| Bitcoin Legacy | 0 | 0 | 2 (DoubleSHA256) |
| Ethereum | 0 | 0 | 0 (KECCAK256) |
| Solana | 2 | 0 | 0 (SHA512) |
| WebAuthn | 1 | 0 | 0 (SHA256) |

---

## dWallet Types

| Kind | User share | Network signs alone? | Use Case |
|---|---|---|---|
| `shared` | Public | Yes | DAOs, contracts, automation |
| `zero-trust` | Encrypted | No — user must participate | Personal wallets, max security |
| `imported-key` | Encrypted (existing key) | No | Migrating existing wallets |
| `imported-key-shared` | Public (existing key) | Yes | Migrated wallets for contracts |

**For a browser extension wallet**: use `zero-trust` for user accounts; `shared` for
contract-governed accounts (DAO treasuries, protocol bots).

---

## Flow 1: Shared dWallet (Most Common)

### Step 1: Create & Register Encryption Keys

```typescript
import { UserShareEncryptionKeys, Curve, IkaTransaction } from '@ika.xyz/sdk';
import { Transaction } from '@mysten/sui/transactions';

const keys = await UserShareEncryptionKeys.fromRootSeedKey(
    new TextEncoder().encode('your-deterministic-seed'), // encrypt & store this in vault
    Curve.SECP256K1,
);
// Persist: keys.toShareEncryptionKeysBytes() → store encrypted in vault
// Restore: UserShareEncryptionKeys.fromShareEncryptionKeysBytes(bytes)

// One-time registration on-chain
const tx = new Transaction();
const ikaTx = new IkaTransaction({ ikaClient, transaction: tx, userShareEncryptionKeys: keys });
await ikaTx.registerEncryptionKey({ curve: Curve.SECP256K1 });
await suiClient.core.signAndExecuteTransaction({ transaction: tx, signer: keypair });
```

### Step 2: DKG (Create dWallet)

```typescript
import { prepareDKGAsync, createRandomSessionIdentifier } from '@ika.xyz/sdk';

const networkKey     = await ikaClient.getLatestNetworkEncryptionKey();
const sessionIdBytes = createRandomSessionIdentifier();
const dkgData        = await prepareDKGAsync(ikaClient, Curve.SECP256K1, keys, sessionIdBytes, senderAddress);
// dkgData: { userDKGMessage, userPublicOutput, encryptedUserShareAndProof, userSecretKeyShare }

const tx = new Transaction();
const ikaTx = new IkaTransaction({ ikaClient, transaction: tx, userShareEncryptionKeys: keys });
const sessionId = ikaTx.registerSessionIdentifier(sessionIdBytes);
const [dwalletCap] = await ikaTx.requestDWalletDKGWithPublicUserShare({
    publicKeyShareAndProof:   dkgData.userDKGMessage,
    publicUserSecretKeyShare: dkgData.userSecretKeyShare,
    userPublicOutput:         dkgData.userPublicOutput,
    ikaCoin:   tx.splitCoins(tx.object(ikaCoinId), [1_000_000]),
    suiCoin:   tx.splitCoins(tx.gas, [1_000_000]),
    sessionIdentifier: sessionId,
    dwalletNetworkEncryptionKeyId: networkKey.id,
    curve: Curve.SECP256K1,
});
await suiClient.core.signAndExecuteTransaction({ transaction: tx, signer: keypair });
// Extract dwalletId from result events
```

### Step 3: Get Public Key & Chain Addresses

```typescript
import { publicKeyFromDWalletOutput } from '@ika.xyz/sdk';

const dWallet   = await ikaClient.getDWalletInParticularState(dwalletId, 'Active');
const publicKey = await publicKeyFromDWalletOutput(
    Curve.SECP256K1,
    Uint8Array.from(dWallet.state.Active.public_output),
);
// Use publicKey to derive Bitcoin/Ethereum address via standard derivation
```

### Step 4: Request Presign

Each signature consumes one presign. Maintain a pool, request in advance.

```typescript
const tx = new Transaction();
const ikaTx = new IkaTransaction({ ikaClient, transaction: tx });
ikaTx.requestGlobalPresign({
    dwalletNetworkEncryptionKeyId: networkKey.id,
    curve: Curve.SECP256K1,
    signatureAlgorithm: SignatureAlgorithm.ECDSASecp256k1,
    ikaCoin: tx.splitCoins(tx.object(ikaCoinId), [1_000_000]),
    suiCoin: tx.splitCoins(tx.gas, [1_000_000]),
});
await suiClient.core.signAndExecuteTransaction({ transaction: tx, signer: keypair });
// Extract presignId from events
```

### Step 5: Create User Signature & Sign

```typescript
import { createUserSignMessageWithPublicOutput } from '@ika.xyz/sdk';

const presign = await ikaClient.getPresignInParticularState(presignId, 'Completed');
const pp      = await ikaClient.getProtocolPublicParameters(dWallet);

const msgSig = await createUserSignMessageWithPublicOutput(
    pp,
    Uint8Array.from(dWallet.state.Active.public_output),
    Uint8Array.from(dWallet.public_user_secret_key_share), // available in shared mode
    Uint8Array.from(presign.state.Completed.presign),
    message, Hash.KECCAK256, SignatureAlgorithm.ECDSASecp256k1, Curve.SECP256K1,
);

const tx = new Transaction();
const ikaTx = new IkaTransaction({ ikaClient, transaction: tx, userShareEncryptionKeys: keys });
await ikaTx.requestSign({
    dWallet,
    messageApproval: ikaTx.approveMessage({
        dWalletCap, curve: Curve.SECP256K1,
        signatureAlgorithm: SignatureAlgorithm.ECDSASecp256k1,
        hashScheme: Hash.KECCAK256, message,
    }),
    hashScheme: Hash.KECCAK256,
    verifiedPresignCap: ikaTx.verifyPresignCap({ presign }),
    presign, message,
    signatureScheme: SignatureAlgorithm.ECDSASecp256k1,
    ikaCoin: tx.splitCoins(tx.object(ikaCoinId), [1_000_000]),
    suiCoin: tx.splitCoins(tx.gas, [1_000_000]),
});
await suiClient.core.signAndExecuteTransaction({ transaction: tx, signer: keypair });
```

### Step 6: Retrieve Signature

```typescript
import { parseSignatureFromSignOutput } from '@ika.xyz/sdk';

const sign = await ikaClient.getSignInParticularState(
    signId, Curve.SECP256K1, SignatureAlgorithm.ECDSASecp256k1, 'Completed',
);
// sign.state.Completed.signature — ready to broadcast on target chain
```

---

## Flow 2: Zero-Trust dWallet

Use `requestDWalletDKG` instead of `requestDWalletDKGWithPublicUserShare`. After DKG,
the dWallet enters `AwaitingKeyHolderSignature` — the user must accept the encrypted share
to activate it:

```typescript
const awaitingDWallet = await ikaClient.getDWalletInParticularState(dwalletId, 'AwaitingKeyHolderSignature');
// encryptedUserSecretKeyShareId comes from DKG transaction events, NOT from dwalletId
const encShare = await ikaClient.getEncryptedUserSecretKeyShare(encryptedUserSecretKeyShareId);

const tx = new Transaction();
const ikaTx = new IkaTransaction({ ikaClient, transaction: tx, userShareEncryptionKeys: keys });
await ikaTx.acceptEncryptedUserShare({
    dWallet: awaitingDWallet,
    encryptedUserSecretKeyShareId: encShare.id,
    userPublicOutput: new Uint8Array(dkgData.userPublicOutput),
});
await suiClient.core.signAndExecuteTransaction({ transaction: tx, signer: keypair });
// dWallet is now Active

// For signing: decrypt user share first
const pp = await ikaClient.getProtocolPublicParameters(dWallet);
const { secretShare } = await keys.decryptUserShare(dWallet, encShare, pp);
// Pass secretShare to createUserSignMessageWithPublicOutput (instead of public_user_secret_key_share)
```

---

## Flow 3: Future Signing (Two-Phase — DAOs / Governance)

Phase 1 computes a partial signature; Phase 2 completes it after approval.

```typescript
// Phase 1: commit (off-chain computation, on-chain commitment)
await ikaTx.requestFutureSign({ dWallet, hashScheme, verifiedPresignCap, presign, message, ... });
// Extract partialUserSignatureId from events

const partialSig = await ikaClient.getPartialUserSignatureInParticularState(
    partialUserSignatureId, 'NetworkVerificationCompleted',
);

// Phase 2: complete after governance approval
ikaTx.futureSign({
    partialUserSignatureCap: partialSig.cap_id,
    messageApproval: ikaTx.approveMessage({ dWalletCap, ... }),
    ikaCoin: ..., suiCoin: ...,
});
```

---

## Flow 4: Imported Key

```typescript
import { prepareImportedKeyDWalletVerification } from '@ika.xyz/sdk';

const importData = await prepareImportedKeyDWalletVerification(
    ikaClient, Curve.SECP256K1, sessionIdBytes, signerAddress, keys,
    privateKey, // Uint8Array of existing private key
);
// importData: { userPublicOutput, userMessage, encryptedUserShareAndProof }
// Then call ikaTx.requestImportedKeyDWalletVerification(...) with importData
// Followed by acceptEncryptedUserShare (same as zero-trust)
```

---

## KeySpring Pattern

Derive a cross-chain dWallet from any deterministic auth source (wallet signature,
WebAuthn PRF, KDF output). Same seed always produces same keys.

```typescript
// Any deterministic 32+ byte secret works as seed
const seed = await existingWallet.signMessage('ika-keyspring-v1');
const keys = await UserShareEncryptionKeys.fromRootSeedKey(
    new Uint8Array(seed), Curve.SECP256K1,
);
// DKG → dWallet public key maps to ETH/BTC addresses
```

---

## IkaClient Reference

```typescript
// dWallet
await ikaClient.getDWallet(id);
await ikaClient.getDWalletInParticularState(id, 'Active', { timeout: 60000 });
await ikaClient.getOwnedDWalletCaps(address);

// Presign / sign polling
await ikaClient.getPresignInParticularState(id, 'Completed');
await ikaClient.getSignInParticularState(id, curve, sigAlgo, 'Completed');
await ikaClient.getPartialUserSignatureInParticularState(id, 'NetworkVerificationCompleted');

// Keys & config
await ikaClient.getLatestNetworkEncryptionKey();
await ikaClient.getProtocolPublicParameters(dWallet);
const coordinatorId = ikaClient.ikaConfig.objects.ikaDWalletCoordinator.objectID;
```

Polling options for all `*InParticularState` methods:
```typescript
{ timeout?: number,        // default 30000ms
  interval?: number,       // default 1000ms
  maxInterval?: number,    // default 5000ms
  backoffMultiplier?: number, // default 1.5
  signal?: AbortSignal }
```

---

## Move Contract Integration

For contracts that incorporate dWallet signing (DAO treasuries, automated bots).
Read the `ika-move` skill for full patterns.

### Move.toml

```toml
[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }
ika_dwallet_2pc_mpc = { git = "https://github.com/dwallet-labs/ika.git", subdir = "deployed_contracts/testnet/ika_dwallet_2pc_mpc", rev = "main" }
ika = { git = "https://github.com/dwallet-labs/ika.git", subdir = "deployed_contracts/testnet/ika", rev = "main" }
```

### Core Move Imports

```rust
use ika::ika::IKA;
use ika_dwallet_2pc_mpc::{
    coordinator::DWalletCoordinator,
    coordinator_inner::{ DWalletCap, UnverifiedPresignCap, VerifiedPresignCap,
                         MessageApproval, UnverifiedPartialUserSignatureCap },
    sessions_manager::SessionIdentifier,
};
use sui::{balance::Balance, coin::Coin, sui::SUI};
```

### Essential Move Helpers

```rust
// Required for every operation — never reuse a session
fun random_session(c: &mut DWalletCoordinator, ctx: &mut TxContext): SessionIdentifier {
    c.register_session_identifier(ctx.fresh_object_address().to_bytes(), ctx)
}

// Pattern: withdraw → ops (auto-deduct fees) → return remainder
fun withdraw_coins(self: &mut MyContract, ctx: &mut TxContext): (Coin<IKA>, Coin<SUI>) {
    (self.ika_balance.withdraw_all().into_coin(ctx), self.sui_balance.withdraw_all().into_coin(ctx))
}
fun return_coins(self: &mut MyContract, ika: Coin<IKA>, sui: Coin<SUI>) {
    self.ika_balance.join(ika.into_balance());
    self.sui_balance.join(sui.into_balance());
}
```

### Shared dWallet DKG in Move

```rust
let session = coordinator.register_session_identifier(session_bytes, ctx);
let (dwallet_cap, _) = coordinator.request_dwallet_dkg_with_public_user_secret_key_share(
    encryption_key_id, SECP256K1,
    dkg_msg, user_public_output, public_user_secret_key_share,
    option::none(), // sign_during_dkg — pass option::some(sign_req) to sign at DKG time
    session, &mut ika, &mut sui, ctx,
);
```

### Direct Signing in Move

```rust
let verified  = coordinator.verify_presign_cap(self.presigns.swap_remove(0), ctx);
let approval  = coordinator.approve_message(&self.dwallet_cap, sig_algo, hash_scheme, message);
let sign_id   = coordinator.request_sign_and_return_id(
    verified, approval, message_centralized_signature, session, &mut ika, &mut sui, ctx,
);
```

### Presign Pool in Move (auto-replenish)

```rust
// After signing, replenish if pool is low
if (self.presigns.length() < MIN_POOL) {
    let s = random_session(coordinator, ctx);
    self.presigns.push_back(coordinator.request_global_presign(
        self.dwallet_network_encryption_key_id, SECP256K1, TAPROOT, s, &mut ika, &mut sui, ctx,
    ));
};
```

> See `ika-move/references/patterns.md` for complete Bitcoin Treasury and DAO governance examples.

---

## Wallet Extension UX Notes

**Presign pool**: Request 3–5 presigns ahead of time. Each signing operation consumes one.
Show a "preparing" state when the pool is empty and a new presign is being requested.

**Gas requirements**: Users need both SUI (Sui gas) and IKA tokens (Ika protocol fees).
Warn if either balance is insufficient before initiating a signing operation.

**Signing latency**: Sub-second but not instant. Show a spinner/progress indicator during
both presign and signing steps. Don't block the UI thread.

**EdDSA (Solana, Cardano, Zcash)**: Live on Ika mainnet since December 2025.
Use `Curve.ED25519` + `SignatureAlgorithm.EdDSA` + `Hash.SHA512` for Solana.

**Address display**: Each dWallet has one public key but different address formats per chain
(0x... for ETH, bc1... for BTC, base58 for Solana). Label each clearly in the UI.

---

## Error Classes

```typescript
import {
    IkaClientError,      // Base error
    ObjectNotFoundError, // Object not found on-chain
    InvalidObjectError,  // Object parsing failed
    NetworkError,        // Network operation failure
    CacheError,          // Cache operation failure
} from '@ika.xyz/sdk';
```
