# Aptos — Wallet Integration Guide

> Read the `aptos-agent` skill for MCP tools, game-theoretic analysis, and DeFi protocol details.
> This file focuses on wallet integration patterns for the browser extension.

## Derivation Path

```
m/44'/637'/0'/0'/n'   ← BIP44 Aptos coin type 637, SLIP-10 Ed25519 hardened
```

## Key Libraries

```bash
npm install @aptos-labs/ts-sdk    # official Aptos TypeScript SDK
npm install @scure/bip32 @scure/bip39
```

## Key Generation

Aptos uses Ed25519 keys (also supports Secp256k1 and MultiEd25519 for multisig):

```typescript
import { Account, Ed25519PrivateKey, Network } from '@aptos-labs/ts-sdk';
import { HDKey }             from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';

export function deriveAptosAccount(mnemonic: string, index: number) {
  const seed  = mnemonicToSeedSync(mnemonic);
  const root  = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/44'/637'/0'/0'/${index}'`);
  seed.fill(0);

  const privateKey = new Ed25519PrivateKey(child.privateKey!);
  const account    = Account.fromPrivateKey({ privateKey });
  return { account, address: account.accountAddress.toString() };
}
```

## CRITICAL: Address Derivation Safety (from aptos-agent skill)

> **NEVER use `derive-resource-account-address` for wallet creation.**
> Resource accounts need signer capabilities from a source account.
> If a key doesn't match the address, funds are permanently unrecoverable.

```typescript
// CORRECT workflow
// 1. Generate private key
// 2. Derive address FROM the private key
// 3. VALIDATE key → address match before funding
// 4. Fund ONLY after validation passes

// Validation
function validateKeyAddressMatch(privateKeyHex: string, expectedAddress: string): boolean {
  const key     = new Ed25519PrivateKey(privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey: key });
  return account.accountAddress.toString() === expectedAddress;
}
```

## Aptos SDK Client Setup

```typescript
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const config = new AptosConfig({ network: Network.MAINNET });
const aptos  = new Aptos(config);

// Networks
const NETWORKS = {
  mainnet: Network.MAINNET,  // https://api.mainnet.aptoslabs.com
  testnet: Network.TESTNET,  // https://api.testnet.aptoslabs.com
  devnet:  Network.DEVNET,
};
```

## Transaction Signing

```typescript
import { Account, SimpleTransaction } from '@aptos-labs/ts-sdk';

// Build transaction
const tx = await aptos.transaction.build.simple({
  sender:  account.accountAddress,
  data: {
    function:      '0x1::coin::transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    functionArguments: [recipientAddress, amount],
  },
});

// ALWAYS simulate before signing (from aptos-agent skill security model)
const simulation = await aptos.transaction.simulate.simple({
  signerPublicKey: account.publicKey,
  transaction:     tx,
});
if (simulation[0].success === false) {
  throw new Error(`Simulation failed: ${simulation[0].vm_status}`);
}

// Sign and submit
const pendingTx = await aptos.signAndSubmitTransaction({ signer: account, transaction: tx });
const result    = await aptos.waitForTransaction({ transactionHash: pendingTx.hash });
```

## Token Standards (from aptos-agent skill)

Aptos has two token standards — always support both:

### Legacy Coin Standard (`0x1::coin`)
```typescript
// Check balance
const balance = await aptos.view({
  payload: {
    function:      '0x1::coin::balance',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    functionArguments: [address],
  },
});

// Transfer
await aptos.transaction.build.simple({
  sender: account.accountAddress,
  data: {
    function:          '0x1::coin::transfer',
    typeArguments:     ['0x1::aptos_coin::AptosCoin'],
    functionArguments: [recipient, amount],
  },
});
```

### Fungible Asset Standard (`0x1::fungible_asset`) — new standard
```typescript
// Primary store balance
const balance = await aptos.view({
  payload: {
    function:          '0x1::primary_fungible_store::balance',
    typeArguments:     [],
    functionArguments: [address, metadataAddress],
  },
});
```

### Digital Asset NFTs (`0x4::token`)
Object-based NFTs — query by object ID, transfer as Sui objects.

## View Functions (read-only, no gas)

From the aptos-agent skill — useful patterns for wallet balance/state display:

```typescript
// Generic view function call
async function callView(functionId: string, typeArgs: string[], args: unknown[]) {
  return aptos.view({
    payload: { function: functionId, typeArguments: typeArgs, functionArguments: args },
  });
}

// APT balance
callView('0x1::coin::balance', ['0x1::aptos_coin::AptosCoin'], [address]);

// Check if account has coin store registered
callView('0x1::coin::is_account_registered', ['0x1::aptos_coin::AptosCoin'], [address]);

// Staking
callView('0x1::stake::get_stake', [], [validatorPoolAddress]);

// Delegation
callView('0x1::delegation_pool::get_stake', [], [poolAddress, delegatorAddress]);
```

## Multisig Accounts (from aptos-agent skill)

```typescript
// Create multisig
await aptos.transaction.build.simple({
  sender: ownerAddress,
  data: {
    function: '0x1::multisig_account::create',
    typeArguments: [],
    functionArguments: [numSignaturesRequired, additionalOwners],
  },
});

// Key modules: 0x1::multisig_account
// create, create_transaction, approve_transaction, execute_transaction
```

## Account Registration

Many tokens require registering a `CoinStore` before receiving:

```typescript
// Check if registered
const registered = await callView(
  '0x1::coin::is_account_registered',
  ['0x1::aptos_coin::AptosCoin'],
  [address],
);

// Register if needed
if (!registered[0]) {
  await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function:          '0x1::coin::register',
      typeArguments:     [coinType],
      functionArguments: [],
    },
  });
}
```

## DeFi Protocols (from aptos-agent skill)

| Protocol | Category | Key Use |
|----------|----------|---------|
| Liquidswap | DEX | Token swaps |
| Thala | DEX + Stablecoin | MOD stablecoin |
| Amnis Finance | Liquid Staking | stAPT (~7-8% APY) |
| Aries Markets | Lending | Supply/borrow |
| Cellana | DEX | ve(3,3) model |

## Window Provider (dApp Interface)

No formal standard yet — expose a compatible API in `dapp-interface.js`:

```typescript
window.aptos = {
  connect:            ()          => sendToBackground('aptos_connect'),
  disconnect:         ()          => sendToBackground('aptos_disconnect'),
  account:            ()          => sendToBackground('aptos_getAccount'),
  network:            ()          => sendToBackground('aptos_getNetwork'),
  signAndSubmitTransaction: (tx)  => sendToBackground('aptos_signAndSubmitTransaction', [tx]),
  signTransaction:    (tx)        => sendToBackground('aptos_signTransaction', [tx]),
  signMessage:        (payload)   => sendToBackground('aptos_signMessage', [payload]),
  onAccountChange:    (handler)   => eventEmitter.on('accountChange', handler),
  onNetworkChange:    (handler)   => eventEmitter.on('networkChange', handler),
};
```

## Security Notes

- Always simulate transactions before displaying the signing UI
- Validate key→address match before wallet creation (see CRITICAL section above)
- `0x1` is the Aptos Framework address — treat any call to it with care
- Move modules are immutable once deployed — verify package addresses carefully
