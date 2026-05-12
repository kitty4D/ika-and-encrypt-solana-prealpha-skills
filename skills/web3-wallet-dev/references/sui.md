# Sui — Wallet Integration Guide

> Read the `sui-ts-sdk` skill for PTB construction and client setup.
> Read the `sui-frontend` skill for React dApp Kit integration.
> For Sui-governed multi-chain signing via Ika, see `references/ika-dwallet.md`.

## Derivation Path

```
m/44'/784'/0'/0'/n'   ← SLIP-10 Ed25519, fully hardened — Sui standard
```

## Key Libraries (from sui-dev-skills)

```bash
npm install @mysten/sui                    # main SDK (v2+)
npm install @mysten/dapp-kit-react         # React dApp Kit
npm install @mysten/dapp-kit-core          # Vue / vanilla JS / Svelte
npm install @mysten/wallet-standard        # Wallet Standard registration
```

**Critical**: Use `@mysten/sui`, NOT `@mysten/sui.js` (deprecated at v1.0).

## Key Generation

```typescript
import { Ed25519Keypair }  from '@mysten/sui/keypairs/ed25519';
import { HDKey }           from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';

export function deriveSuiKeypair(mnemonic: string, index: number): Ed25519Keypair {
  const seed  = mnemonicToSeedSync(mnemonic);
  const root  = HDKey.fromMasterSeed(seed);
  const child = root.derive(`m/44'/784'/0'/0'/${index}'`);
  seed.fill(0);
  return Ed25519Keypair.fromSecretKey(child.privateKey!);
}

// Sui also supports Secp256k1 and Secp256r1 keypairs
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
```

## Client Setup (from sui-ts-sdk skill)

Use **`SuiGrpcClient`** for new code — it's the recommended client. JSON-RPC is deprecated.

```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({
  network: 'mainnet',
  baseUrl:  'https://fullnode.mainnet.sui.io:443',
});

// Networks
const GRPC_URLS = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet:  'https://fullnode.devnet.sui.io:443',
};
```

## PTB Construction (from sui-ts-sdk skill)

```typescript
import { Transaction } from '@mysten/sui/transactions'; // NOT TransactionBlock

const tx = new Transaction();

// Transfer SUI
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100_000_000n)]); // 0.1 SUI
tx.transferObjects([coin], tx.pure.address(recipientAddress));

// Call a Move function
tx.moveCall({
  target: '0xPACKAGE::module::function',
  arguments: [tx.object('0xOBJECT_ID'), tx.pure.u64(amount)],
});

// Execute
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer:      keypair,
});
```

Clone a transaction: `Transaction.from(existingTx)` (not `new TransactionBlock(existing)`).

## Wallet Standard Registration

```typescript
import { registerWallet }    from '@mysten/wallet-standard';
import { SUI_MAINNET_CHAIN } from '@mysten/wallet-standard';

registerWallet({
  version:  '1.0.0',
  name:     'MyWallet',
  icon:     'data:image/svg+xml,...',
  chains:   ['sui:mainnet', 'sui:testnet', 'sui:devnet', 'sui:localnet'],
  features: {
    'standard:connect':                  { version: '1.0.0', connect },
    'standard:disconnect':               { version: '1.0.0', disconnect },
    'standard:events':                   { version: '1.0.0', on },
    'sui:signTransaction':               { version: '2.0.0', signTransaction },
    'sui:signAndExecuteTransaction':     { version: '2.0.0', signAndExecuteTransaction },
    'sui:signPersonalMessage':           { version: '1.0.0', signPersonalMessage },
    'sui:reportTransactionEffects':      { version: '1.0.0', reportTransactionEffects },
  },
  accounts: [],
});
```

## Transaction Signing (background)

```typescript
import { Transaction } from '@mysten/sui/transactions';

async function signSuiTransaction(
  txBytes:   string,   // base64 serialized tx from dApp
  keypair:   Ed25519Keypair,
): Promise<{ signature: string; bytes: string }> {
  const tx = Transaction.from(txBytes);

  // Optionally inspect/decode for display before signing
  const digest = await tx.toJSON(); // human-readable

  const { signature, bytes } = await tx.sign({ signer: keypair });
  return { signature, bytes };
}
```

## On-Chain Queries

```typescript
// Get objects owned by address
const objects = await client.ledgerService.getObject({ objectId: '0x...' });

// SuiNS reverse lookup
const name = await client.nameService.reverseLookupName({ address: '0x...' });

// Query via GraphQL for complex queries
import { SuiGraphQLClient } from '@mysten/sui/graphql';
const gql = new SuiGraphQLClient({
  url:     'https://graphql.mainnet.sui.io/graphql',
  network: 'mainnet',
});
```

## React dApp Kit (from sui-frontend skill)

```tsx
// dapp-kit.ts
import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient }  from '@mysten/sui/grpc';

export const dAppKit = createDAppKit({
  networks:       ['mainnet', 'testnet'],
  defaultNetwork: 'mainnet',
  createClient:   (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
});

// Augment for TypeScript inference
declare module '@mysten/dapp-kit-react' {
  interface Register { dAppKit: typeof dAppKit; }
}

// App.tsx
import { DAppKitProvider, ConnectButton } from '@mysten/dapp-kit-react';
export default function App() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <ConnectButton />
      <YourWalletUI />
    </DAppKitProvider>
  );
}
```

## Non-React (Vue / Vanilla JS)

```ts
import { createDAppKit } from '@mysten/dapp-kit-core'; // same API, different import
```

## Key SDK Rules (from sui-ts-sdk skill)

- Import from subpaths: `@mysten/sui/transactions`, `@mysten/sui/keypairs/ed25519` — **not** from `@mysten/sui` root
- `Transaction` not `TransactionBlock` (renamed at v1.0)
- `SuiGrpcClient` not `SuiClient` (deprecated in v2)
- `tx.toJSON()` is async (runs serialization plugins) — don't use old `tx.serialize()`
- `@mysten/dapp-kit-react` / `@mysten/dapp-kit-core` — NOT old `@mysten/dapp-kit`
