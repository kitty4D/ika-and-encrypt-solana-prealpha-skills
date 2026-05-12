# dApp Provider Injection

## Architecture

The injection flow has two hops:
1. **Content script** (isolated world) → injects `dapp-interface.js` via DOM script tag
2. **dapp-interface.js** (page context) → registers providers on `window`

```typescript
// content-script/index.ts — inject the page script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('dapp-interface.js');
script.onload = () => script.remove();
(document.head || document.documentElement).prepend(script);

// Bridge: page → background (origin-validated)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;           // must be same window
  if (!event.data?.type?.startsWith('@wallet/')) return; // typed messages only
  chrome.runtime.sendMessage(event.data);
});

// Bridge: background → page
chrome.runtime.onMessage.addListener((msg) => {
  window.postMessage(msg, window.location.origin); // restrict to same origin
});
```

## Ethereum (EIP-1193 + EIP-6963)

```typescript
// dapp-interface/ethereum-provider.ts
import { EventEmitter } from 'eventemitter3';

class EthereumProvider extends EventEmitter {
  isMyWallet = true;
  chainId    = '0x1';

  async request({ method, params }: { method: string; params?: unknown[] }) {
    return sendToBackground({ type: '@wallet/eth-request', method, params });
  }

  // Legacy compatibility
  async sendAsync(payload: any, callback: Function) {
    try {
      const result = await this.request(payload);
      callback(null, { id: payload.id, jsonrpc: '2.0', result });
    } catch (e) {
      callback(e);
    }
  }
}

const provider = new EthereumProvider();

// EIP-6963: multi-wallet announcement (preferred)
const WALLET_INFO = {
  uuid:  crypto.randomUUID(),
  name:  'MyWallet',
  icon:  'data:image/svg+xml,...',
  rdns:  'com.mywallet',
};

window.addEventListener('eip6963:requestProvider', () => {
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
    detail: Object.freeze({ info: WALLET_INFO, provider }),
  }));
});

// Announce immediately on load
window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
  detail: Object.freeze({ info: WALLET_INFO, provider }),
}));

// EIP-1193 legacy fallback
window.ethereum = provider;
```

## Solana (Wallet Standard)

```typescript
// dapp-interface/solana-provider.ts
import { registerWallet } from '@wallet-standard/wallet';
import type { Wallet }    from '@wallet-standard/base';

const solanaWallet: Wallet = {
  version: '1.0.0',
  name:    'MyWallet',
  icon:    'data:image/svg+xml,...',
  chains:  ['solana:mainnet', 'solana:devnet', 'solana:testnet', 'solana:localnet'],
  features: {
    'standard:connect':              { version: '1.0.0', connect },
    'standard:disconnect':           { version: '1.0.0', disconnect },
    'standard:events':               { version: '1.0.0', on },
    'solana:signTransaction':        { version: '1.0.0', signTransaction },
    'solana:signAndSendTransaction': { version: '1.0.0', signAndSendTransaction },
    'solana:signMessage':            { version: '1.0.0', signMessage },
    'solana:signIn':                 { version: '1.0.0', signIn },
  },
  accounts: [],
};

registerWallet(solanaWallet);

// Legacy fallback — some older dApps still check window.solana
window.solana = legacySolanaAdapter;
```

## Sui (Wallet Standard)

```typescript
// dapp-interface/sui-provider.ts
import { registerWallet } from '@mysten/wallet-standard';

registerWallet({
  version:  '1.0.0',
  name:     'MyWallet',
  icon:     'data:image/svg+xml,...',
  chains:   ['sui:mainnet', 'sui:testnet', 'sui:devnet', 'sui:localnet'],
  features: {
    'standard:connect':         { version: '1.0.0', connect },
    'standard:disconnect':      { version: '1.0.0', disconnect },
    'standard:events':          { version: '1.0.0', on },
    'sui:signTransaction':      { version: '2.0.0', signTransaction },
    'sui:signAndExecuteTransaction': { version: '2.0.0', signAndExecuteTransaction },
    'sui:signPersonalMessage':  { version: '1.0.0', signPersonalMessage },
    'sui:reportTransactionEffects': { version: '1.0.0', reportTransactionEffects },
  },
  accounts: [],
});
```

## Bitcoin

No standard yet — expose a `window.bitcoin` object compatible with common dApps
(Unisat-compatible API is the de-facto standard):

```typescript
// dapp-interface/bitcoin-provider.ts
window.bitcoin = {
  // Request accounts (triggers approval popup)
  requestAccounts: () =>
    sendToBackground({ type: '@wallet/btc-request', method: 'btc_requestAccounts' }),

  // Get connected accounts without prompt
  getAccounts: () =>
    sendToBackground({ type: '@wallet/btc-request', method: 'btc_getAccounts' }),

  // Sign a PSBT (Partially Signed Bitcoin Transaction)
  signPsbt: (psbtHex: string, options?: { autoFinalize?: boolean }) =>
    sendToBackground({ type: '@wallet/btc-request', method: 'btc_signPsbt', params: [psbtHex, options] }),

  // Sign multiple PSBTs
  signPsbts: (psbtHexs: string[], options?: object) =>
    sendToBackground({ type: '@wallet/btc-request', method: 'btc_signPsbts', params: [psbtHexs, options] }),

  // Sign an arbitrary message
  signMessage: (message: string, type: 'ecdsa' | 'bip322-simple' = 'ecdsa') =>
    sendToBackground({ type: '@wallet/btc-request', method: 'btc_signMessage', params: [message, type] }),

  // Get network (mainnet / testnet)
  getNetwork: () =>
    sendToBackground({ type: '@wallet/btc-request', method: 'btc_getNetwork' }),

  // Push a raw transaction
  pushTx: (rawTxHex: string) =>
    sendToBackground({ type: '@wallet/btc-request', method: 'btc_pushTx', params: [rawTxHex] }),
};
```

## Message Routing (Background)

```typescript
// background/rpc/handlers/dapp-requests.ts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab) return; // only accept from content scripts
  if (!msg.type?.startsWith('@wallet/')) return;

  (async () => {
    // Validate origin
    const origin = new URL(sender.tab!.url!).origin;

    switch (msg.type) {
      case '@wallet/eth-request':
        sendResponse(await handleEthRequest(msg, origin));
        break;
      case '@wallet/btc-request':
        sendResponse(await handleBtcRequest(msg, origin));
        break;
      // ...
    }
  })();

  return true; // keep message channel open for async response
});
```
