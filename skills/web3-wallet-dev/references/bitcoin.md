# Bitcoin — Wallet Integration Guide

> Read the `startwithbitcoin` skill for Lightning/NWC agent payment patterns.
> This file covers both on-chain wallet integration and Lightning for the extension context.

## Derivation Paths

```
BIP84 Native SegWit:  m/84'/0'/0'/0/n  → bc1q... (P2WPKH)  ← default for new wallets
BIP86 Taproot:        m/86'/0'/0'/0/n  → bc1p... (P2TR)    ← recommended for new wallets
BIP44 Legacy:         m/44'/0'/0'/0/n  → 1...    (P2PKH)   ← import support only
BIP49 SegWit compat:  m/49'/0'/0'/0/n  → 3...    (P2SH-P2WPKH)
```

## Key Libraries (from startwithbitcoin skill)

```bash
npm install bitcoinjs-lib ecpair tiny-secp256k1   # on-chain wallet
npm install @noble/hashes @scure/bip32 @scure/bip39 # HD derivation
npm install nostr-tools @getalby/sdk               # Lightning via NWC
```

## Key Generation & Address Derivation

```typescript
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export function deriveBitcoinAccount(mnemonic: string, index: number, type: 'segwit' | 'taproot' = 'taproot') {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  seed.fill(0);

  const path = type === 'taproot'
    ? `m/86'/0'/0'/0/${index}`
    : `m/84'/0'/0'/0/${index}`;

  const child = root.derive(path);
  const keyPair = ECPair.fromPrivateKey(Buffer.from(child.privateKey!));

  if (type === 'taproot') {
    // P2TR (Taproot)
    const { address } = bitcoin.payments.p2tr({
      internalPubkey: keyPair.publicKey.slice(1, 33), // x-only pubkey
      network: bitcoin.networks.bitcoin,
    });
    return { address, publicKey: keyPair.publicKey, privateKey: child.privateKey! };
  } else {
    // P2WPKH (Native SegWit)
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: bitcoin.networks.bitcoin,
    });
    return { address, publicKey: keyPair.publicKey, privateKey: child.privateKey! };
  }
}
```

## UTXO Management & Balance

Use mempool.space API (no API key required):

```typescript
const MEMPOOL_API = 'https://mempool.space/api';

export async function getBalance(address: string): Promise<number> {
  const res  = await fetch(`${MEMPOOL_API}/address/${address}`);
  const data = await res.json();
  const { funded_txo_sum, spent_txo_sum } = data.chain_stats;
  return funded_txo_sum - spent_txo_sum; // satoshis
}

export async function getUtxos(address: string) {
  const res = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
  return res.json();
}

export async function getFeeRates() {
  const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
  const fees = await res.json();
  return {
    fast:   fees.fastestFee,  // sat/vB
    medium: fees.halfHourFee,
    slow:   fees.hourFee,
  };
}

export async function broadcastTx(txHex: string): Promise<string> {
  const res = await fetch(`${MEMPOOL_API}/tx`, {
    method: 'POST',
    body: txHex,
  });
  return res.text(); // txid
}
```

## PSBT Signing (for dApp requests)

PSBTs (Partially Signed Bitcoin Transactions) are the standard format for wallet signing requests:

```typescript
import { Psbt } from 'bitcoinjs-lib';

export function signPsbt(psbtHex: string, privateKey: Uint8Array, autoFinalize = true): string {
  const psbt    = Psbt.fromHex(psbtHex);
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey));

  // Sign all inputs that belong to this key
  psbt.data.inputs.forEach((input, index) => {
    try {
      psbt.signInput(index, keyPair);
    } catch {
      // Input doesn't belong to this key — skip
    }
  });

  if (autoFinalize) {
    psbt.finalizeAllInputs();
    return psbt.extractTransaction().toHex();
  }
  return psbt.toHex();
}

export function signMessage(message: string, privateKey: Uint8Array): string {
  // BIP322 simple or legacy ECDSA message signing
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey));
  const hash    = bitcoin.crypto.hash256(Buffer.from(message));
  return keyPair.sign(hash).toString('hex');
}
```

## window.bitcoin Provider (dApp Interface)

The Unisat-compatible API is the de-facto standard. Expose in `dapp-interface.js`:

```typescript
window.bitcoin = {
  requestAccounts: ()                    => sendToBackground('btc_requestAccounts'),
  getAccounts:     ()                    => sendToBackground('btc_getAccounts'),
  getNetwork:      ()                    => sendToBackground('btc_getNetwork'),
  getBalance:      ()                    => sendToBackground('btc_getBalance'),
  signPsbt:        (psbtHex, options)    => sendToBackground('btc_signPsbt', [psbtHex, options]),
  signPsbts:       (psbtHexs, options)   => sendToBackground('btc_signPsbts', [psbtHexs, options]),
  signMessage:     (message, type)       => sendToBackground('btc_signMessage', [message, type]),
  pushTx:          (rawTxHex)            => sendToBackground('btc_pushTx', [rawTxHex]),
  pushPsbt:        (psbtHex)             => sendToBackground('btc_pushPsbt', [psbtHex]),
  // Events
  on:              (event, handler)      => eventEmitter.on(event, handler),
  removeListener:  (event, handler)      => eventEmitter.off(event, handler),
};
```

## Lightning via NWC (Nostr Wallet Connect)

From the `startwithbitcoin` skill — NWC is the recommended approach for agent/extension
Lightning payments. Uses the Nostr protocol for wallet remote control.

```typescript
import { nwc } from '@getalby/sdk';

// Connection string from user's Lightning wallet (Alby, LNbits, own node)
// Format: nostr+walletconnect://<pubkey>?relay=<url>&secret=<secret>
const client = new nwc.NWCClient({
  nostrWalletConnectUrl: process.env.NWC_URL,
});

// Receive: create invoice
const invoice = await client.makeInvoice({
  amount:      1000,             // satoshis
  description: 'Payment for service',
  expiry:      3600,             // 1 hour
});

// Send: pay invoice
const result = await client.payInvoice({ invoice: 'lnbc...' });
console.log('Preimage:', result.preimage); // proof of payment

// Balance
const { balance } = await client.getBalance(); // satoshis
```

### Lightning vs On-Chain

| | Lightning | On-Chain |
|--|-----------|----------|
| Speed | Instant | ~10 min |
| Fees | <1 sat | 200+ sats |
| Best for | Microtransactions | Large amounts, cold storage |
| Limit | Channel capacity | Unlimited |

## Nostr Identity (from startwithbitcoin skill)

Bitcoin and Nostr share the same secp256k1 curve — one keypair can serve both:

```typescript
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils';

const secretKey = generateSecretKey();          // Uint8Array
const publicKey = getPublicKey(secretKey);       // hex string
const nsec      = nip19.nsecEncode(secretKey);   // nsec1...
const npub      = nip19.npubEncode(publicKey);   // npub1...
```

Store `secretKey` (hex) in the wallet vault encrypted alongside BIP39 keys.

## Error Handling (NWC)

```typescript
try {
  await client.payInvoice({ invoice: bolt11 });
} catch (error: any) {
  switch (error.code) {
    case 'INSUFFICIENT_BALANCE': /* not enough sats */  break;
    case 'PAYMENT_FAILED':       /* routing failure */  break;
    case 'INVOICE_EXPIRED':      /* too old */          break;
    default: throw error;
  }
}
```

## Testnet

For development use `bitcoin.networks.testnet` (tBTC from a faucet) or
`bitcoin.networks.regtest` (local). NWC testing: https://faucet.nwc.dev
