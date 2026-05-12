# Ethereum & EVM — Wallet Integration Guide

> Read the `ethereum-development` skill for EVM internals, gas optimization, and Foundry tooling.
> This file focuses on wallet-specific integration patterns.

## Derivation Path

```
m/44'/60'/0'/0/n   ← BIP44 standard, used by MetaMask, all major EVM wallets
```

All EVM-compatible chains (Ethereum, Polygon, Arbitrum, Base, Optimism, etc.) use the
same derivation path and address format — only the `chainId` and RPC differ.

## Key Libraries

```bash
npm install viem                  # recommended — modern, tree-shakeable
npm install ethers                # alternative — also widely used
npm install @noble/secp256k1      # raw ECDSA signing
```

The `ethereum-development` skill uses **viem** — prefer it for new code.

## Key Generation

```typescript
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { privateKeyToAddress } from 'viem/accounts';

export function deriveEthereumAccount(mnemonic: string, index: number) {
  const seed    = mnemonicToSeedSync(mnemonic);
  const root    = HDKey.fromMasterSeed(seed);
  const child   = root.derive(`m/44'/60'/0'/0/${index}`);
  seed.fill(0);
  const privateKey = `0x${Buffer.from(child.privateKey!).toString('hex')}` as `0x${string}`;
  const address    = privateKeyToAddress(privateKey);
  return { privateKey, address };
}
```

## RPC Client Setup (viem)

```typescript
import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet, polygon, arbitrum, base, optimism } from 'viem/chains';

// Read-only client for querying
const publicClient = createPublicClient({
  chain:     mainnet,
  transport: http('https://eth.llamarpc.com'), // or Alchemy/Infura
});

// Signing client — keys never leave the extension background
const walletClient = createWalletClient({
  chain:     mainnet,
  transport: http(),
});
```

### Supported EVM Chains (viem built-ins)
`mainnet`, `polygon`, `arbitrum`, `base`, `optimism`, `avalanche`, `bsc`, `linea`,
`zksync`, `scroll`, `mantle`, `blast`, `manta` — and many more via `viem/chains`.

## EIP-1559 Transaction Signing

From the `ethereum-development` skill:

```typescript
import { parseEther, parseGwei, encodeFunctionData } from 'viem';

// Build and sign (background service worker)
async function signEthTransaction(
  privateKey: `0x${string}`,
  to:         `0x${string}`,
  value:      bigint,
  chainId:    number,
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);

  // Estimate gas
  const gas = await publicClient.estimateGas({ account: account.address, to, value });

  // Get fee data
  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

  return walletClient.signTransaction({
    account,
    to,
    value,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    type:    'eip1559',
    chainId,
    nonce:   await publicClient.getTransactionCount({ address: account.address }),
  });
}
```

## Gas Estimation & Fee Strategy

Key patterns from the `ethereum-development` skill:

```typescript
// Always use EIP-1559 fee estimation
const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

// For urgent transactions: 2x the base fee
const urgentMaxFee = maxFeePerGas * 2n;

// Gas limit with safety buffer
const estimated = await publicClient.estimateGas({ ... });
const gasLimit   = estimated * 120n / 100n; // +20% buffer
```

Gas optimization notes (from the skill's cheatsheet):
- Unchecked math saves ~80 gas/op in contract calls
- Custom errors save 200+ gas vs `require(msg, "string")`
- Pack struct fields to minimize storage slots (each slot = 20k gas first write)

## Transaction Simulation

Always simulate before showing the signing UI:

```typescript
import { decodeFunctionData, parseAbi } from 'viem';

// Simulate the call
const result = await publicClient.simulateContract({
  address: contractAddress,
  abi,
  functionName,
  args,
  account: userAddress,
});

// Decode and display human-readable intent
// e.g. "Transfer 100 USDC to 0xabc..."
```

## EIP-1193 Provider (window.ethereum)

```typescript
// dapp-interface/ethereum-provider.ts
import { EventEmitter } from 'eventemitter3';

class EthereumProvider extends EventEmitter {
  isMyWallet  = true;
  chainId     = '0x1';
  networkVersion = '1';
  selectedAddress: string | null = null;

  async request({ method, params = [] }: { method: string; params?: unknown[] }) {
    // Route to background service worker
    return sendToBackground({ type: '@wallet/eth', method, params });
  }

  // EIP-1193 events: accountsChanged, chainChanged, connect, disconnect
}

// EIP-6963 announcement (multi-wallet standard)
const info = { uuid: crypto.randomUUID(), name: 'MyWallet', icon: '...', rdns: 'com.mywallet' };
const provider = new EthereumProvider();

window.addEventListener('eip6963:requestProvider', () => {
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
    detail: Object.freeze({ info, provider }),
  }));
});
window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
  detail: Object.freeze({ info, provider }),
}));
window.ethereum = provider; // legacy fallback
```

## Standard RPC Methods to Handle

```typescript
// Accounts
'eth_requestAccounts'       // connect + return accounts (triggers approval)
'eth_accounts'              // return connected accounts (no prompt)

// Chain
'eth_chainId'               // current chain
'wallet_switchEthereumChain' // switch chain
'wallet_addEthereumChain'    // add custom chain

// Signing
'eth_sendTransaction'       // build, sign, broadcast (triggers approval UI)
'eth_signTypedData_v4'      // EIP-712 typed data signing
'personal_sign'             // sign arbitrary message

// Queries (no approval needed)
'eth_getBalance'
'eth_call'
'eth_getTransactionCount'
'eth_estimateGas'
'eth_gasPrice'
'eth_blockNumber'
```

## EIP-712 Typed Data Signing

Common for DeFi (Uniswap permits, OpenSea orders, etc.):

```typescript
import { hashTypedData, signTypedData } from 'viem';

// Always display decoded typed data to user before signing
function displayTypedData(typedData: TypedData) {
  // Show domain, types, and message fields in human-readable form
  // NOT raw JSON — users should understand what they're signing
}

const signature = await walletClient.signTypedData({
  account,
  domain:      typedData.domain,
  types:       typedData.types,
  primaryType: typedData.primaryType,
  message:     typedData.message,
});
```

## Multi-Chain / L2 Support

Same key, different `chainId` and RPC. Store user's preferred networks:

```typescript
interface EvmNetwork {
  chainId:     number;
  name:        string;
  rpcUrl:      string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

const BUILT_IN_NETWORKS: EvmNetwork[] = [
  { chainId: 1,     name: 'Ethereum',  rpcUrl: 'https://eth.llamarpc.com', ... },
  { chainId: 137,   name: 'Polygon',   rpcUrl: 'https://polygon-rpc.com',  ... },
  { chainId: 42161, name: 'Arbitrum',  rpcUrl: 'https://arb1.arbitrum.io/rpc', ... },
  { chainId: 8453,  name: 'Base',      rpcUrl: 'https://mainnet.base.org', ... },
  { chainId: 10,    name: 'Optimism',  rpcUrl: 'https://mainnet.optimism.io', ... },
];
```

## Troubleshooting (from ethereum-development skill)

```bash
# Transaction underpriced — set maxFeePerGas to 2x current base fee
cast basefee --rpc-url $RPC

# Out of gas — trace to find where
cast run --trace $TX_HASH --rpc-url $RPC

# Nonce too low — get current nonce
cast nonce $ADDRESS --rpc-url $RPC
```
