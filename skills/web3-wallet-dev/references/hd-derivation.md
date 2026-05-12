# HD Key Derivation (BIP39 / BIP32 / BIP44)

## Libraries

Use the `@scure` family — audited by independent security researchers, zero extra deps:
- `@scure/bip39` — mnemonic generation + validation
- `@scure/bip32` — HD key derivation (replaces `bip32` npm package)
- `@noble/secp256k1` — ECDSA signing (Bitcoin, Ethereum, EVM chains)
- `@noble/ed25519` — EdDSA signing (Solana, Sui, Ika EdDSA chains)

Avoid the older `bip32` + `bip39` npm packages and `elliptic` — less maintained, more deps.

## Derivation Paths

```
Bitcoin SegWit  (BIP84):  m/84'/0'/0'/0/n       → bc1q... addresses
Bitcoin Taproot (BIP86):  m/86'/0'/0'/0/n       → bc1p... addresses
Bitcoin Legacy  (BIP44):  m/44'/0'/0'/0/n       → 1...   addresses (avoid for new wallets)
Ethereum / EVM  (BIP44):  m/44'/60'/0'/0/n      → 0x...  addresses
Solana          (BIP44):  m/44'/501'/n'/0'      → ...    base58 addresses
Sui             (SLIP10):  m/44'/784'/0'/0'/n'   → 0x...  addresses
```

For Solana, Solflare uses index offset `+10000` for imported (non-HD) accounts to
avoid path collisions with HD-derived accounts.

## Core Implementation

```typescript
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';

export const STRENGTH = { WORDS_12: 128, WORDS_24: 256 } as const;

export function newMnemonic(strength: 128 | 256 = 128): string {
  return generateMnemonic(wordlist, strength);
}

export function validateMnemonicWords(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist);
}

export function deriveHDKey(mnemonic: string, path: string): HDKey {
  if (!validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid mnemonic');
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  seed.fill(0); // zero seed after use
  return root.derive(path);
}
```

## Per-Chain Key Extraction

```typescript
import * as secp256k1 from '@noble/secp256k1';
import * as ed25519   from '@noble/ed25519';
import { HDKey }      from '@scure/bip32';

// Ethereum / EVM — compressed public key, ECDSA
export function deriveEthereumKey(root: HDKey, index: number) {
  const child = root.derive(`m/44'/60'/0'/0/${index}`);
  if (!child.privateKey) throw new Error('No private key');
  const pubKey  = secp256k1.getPublicKey(child.privateKey, false); // uncompressed
  const address = ethereumAddressFromPubKey(pubKey); // keccak256(pubKey[1:])[12:]
  return { privateKey: child.privateKey, publicKey: pubKey, address };
}

// Solana — Ed25519 keypair
export function deriveSolanaKey(root: HDKey, index: number) {
  const child = root.derive(`m/44'/501'/${index}'/0'`);
  if (!child.privateKey) throw new Error('No private key');
  const publicKey = ed25519.getPublicKey(child.privateKey);
  return { privateKey: child.privateKey, publicKey };
}

// Sui — Ed25519, different path
export function deriveSuiKey(root: HDKey, index: number) {
  const child = root.derive(`m/44'/784'/0'/0'/${index}'`);
  if (!child.privateKey) throw new Error('No private key');
  const publicKey = ed25519.getPublicKey(child.privateKey);
  return { privateKey: child.privateKey, publicKey };
}

// Bitcoin SegWit — BIP84
export function deriveBitcoinSegwitKey(root: HDKey, index: number, account = 0) {
  const child = root.derive(`m/84'/0'/${account}'/0/${index}`);
  if (!child.privateKey) throw new Error('No private key');
  return { privateKey: child.privateKey, publicKey: child.publicKey! };
  // derive P2WPKH address from publicKey using bitcoinjs-lib
}
```

## KeyringController

Manages multiple keyrings (HD + imported + hardware):

```typescript
export class KeyringController {
  private hdKeyring: HdKeyring | null = null;
  private importedKeys: Map<string, Uint8Array> = new Map();

  async createHD(mnemonic: string) {
    this.hdKeyring = new HdKeyring(mnemonic);
  }

  async addAccount(): Promise<string> {
    return this.hdKeyring!.addAccount();
  }

  async sign(address: string, payload: Uint8Array, chain: ChainId): Promise<Uint8Array> {
    const key = this.getKeyForAddress(address);
    return signForChain(key, payload, chain);
  }

  serialize(): EncryptedKeyringState {
    // Only called when writing to vault — keys encrypted before leaving this class
  }

  wipe() {
    this.hdKeyring = null;
    this.importedKeys.forEach(k => k.fill(0));
    this.importedKeys.clear();
  }
}
```
