# Solana — Deep Integration Guide

> Drawn from Solflare v2.22.2 analysis. Also read the `solana-dev` skill before coding.

## Derivation Path

```
m/44'/501'/${index}'/0'   ← Phantom/Solflare-compatible standard
```

Solflare uses index offset `+10000` for imported (non-HD) accounts to avoid path collisions.

## Wallet Standard Registration

Always use Wallet Standard as the primary registration method. `window.solana` is a
legacy fallback only.

```typescript
import { registerWallet } from '@wallet-standard/wallet';

const FEATURES = {
  'solana:signTransaction':        { version: '1.0.0', signTransaction },
  'solana:signAndSendTransaction': { version: '1.0.0', signAndSendTransaction },
  'solana:signMessage':            { version: '1.0.0', signMessage },
  'solana:signIn':                 { version: '1.0.0', signIn }, // SIWS
};

const CHAINS = ['solana:mainnet', 'solana:devnet', 'solana:testnet', 'solana:localnet'];

registerWallet(new MyWalletStandardAdapter({ features: FEATURES, chains: CHAINS }));

// Legacy fallback
window.solana = legacyAdapter;
```

## Sign In With Solana (SIWS)

`solana:signIn` lets dApps authenticate users without a backend server.
Equivalent to Sign-In With Ethereum (EIP-4361).

```typescript
import { createSignInMessage } from '@solana/wallet-standard-util';

async function handleSignIn(input: SolanaSignInInput) {
  // Build the human-readable SIWS message from structured input
  const message   = createSignInMessage(input);
  const msgBytes  = new TextEncoder().encode(message);
  const signature = await ed25519.sign(msgBytes, keypair.secretKey);
  return {
    account:       { address, publicKey },
    signature,
    signedMessage: msgBytes,
  };
}
```

## RPC / Connection with Failover

```typescript
const ENDPOINTS = {
  mainnet: [
    'https://rpc-mainnet.solflare.com',          // primary
    'https://rpc-mainnet-failover.solflare.com', // fallback
    'https://api.mainnet-beta.solana.com',        // last resort
  ],
  devnet:  ['https://api.devnet.solana.com'],
  testnet: ['https://api.testnet.solana.com'],
};

class SolanaRpc {
  constructor(private cluster: 'mainnet' | 'devnet' | 'testnet') {}

  async call<T>(method: string, params: unknown[]): Promise<T> {
    for (const url of ENDPOINTS[this.cluster]) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        });
        const { result, error } = await res.json();
        if (error) throw new Error(error.message);
        return result;
      } catch {
        continue; // try next endpoint
      }
    }
    throw new Error('All RPC endpoints failed');
  }
}
```

## Transaction Simulation (Always Before Signing)

```typescript
async function simulateAndSign(tx: VersionedTransaction, connection: Connection) {
  const sim = await connection.simulateTransaction(tx, {
    commitment: 'processed',
    innerInstructions: true,
  });

  if (sim.value.err) {
    throw new SimulationError(sim.value.err, sim.value.logs ?? []);
  }

  // Present decoded simulation result to user BEFORE showing sign button
  await presentSigningUI({
    transaction:  tx,
    simulation:   sim.value,
    logs:         sim.value.logs,
    tokenChanges: parseTokenChanges(sim.value.accounts),
  });
}
```

## Priority Fees & Compute Units

Always include `ComputeBudgetProgram` for reliable transaction landing, especially on congested mainnet:

```typescript
import { ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

async function buildTransactionWithFees(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  priorityFee: number,   // microLamports per compute unit
  computeUnits: number,  // estimated units for this tx
) {
  const budgetIxs = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
  ];
  const { blockhash } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey:    payer,
    recentBlockhash: blockhash,
    instructions: [...budgetIxs, ...instructions],
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}
```

## Jito Bundle Support (MEV Protection)

Offer as an opt-in "fast / protected" send mode:

```typescript
const JITO_URL = 'https://mainnet.block-engine.jito.wtf/api/v1/bundles';

async function sendWithJito(signedTxs: VersionedTransaction[]) {
  const encoded = signedTxs.map(tx =>
    Buffer.from(tx.serialize()).toString('base64')
  );
  const res = await fetch(JITO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'sendBundle',
      params: [encoded],
    }),
  });
  return res.json();
}
```

## Phishing Detection

Solflare uses `eth-phishing-detect` (MetaMask's library) with `webRequest` to actively block
known phishing domains, redirecting to a `phishing.html` warning page.

```typescript
// manifest.json: add "webRequest" permission + "http://*/*" host_permissions
import EthPhishingDetect from 'eth-phishing-detect';

class PhishingDetectorService {
  private detector: EthPhishingDetect;
  private userWhitelist: string[] = [];

  async load() {
    const { blacklist, whitelist, fuzzylist } = await fetchBlocklist();
    this.detector = new EthPhishingDetect({
      whitelist: [...whitelist, ...this.userWhitelist],
      blacklist,
      fuzzylist,
      tolerance: 2,
    });
  }

  check(hostname: string): boolean {
    return this.detector.check(hostname).result;
  }

  async whitelist(origin: string) {
    this.userWhitelist.push(origin);
    await this.load(); // reload with new whitelist
  }
}

// In background.js — block before request fires:
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { hostname } = new URL(details.url);
    if (phishingService.check(hostname)) {
      return { redirectUrl: chrome.runtime.getURL('phishing.html') };
    }
  },
  { urls: ['http://*/*', 'https://*/*'] },
  ['blocking'],
);
```

Include a proper `phishing.html` page that explains why the site was blocked and lets
the user whitelist if it's a false positive.

## Side Panel Support

A major UX upgrade — the wallet stays open while the user browses:

```json
// manifest.json
"permissions": ["sidePanel"],
"side_panel": { "default_path": "side_panel.html" },
"commands": {
  "toggle-side-panel": {
    "description": "Toggle wallet side panel",
    "suggested_key": { "default": "Alt+Shift+X" }
  }
}
```

```typescript
// background.ts — toggle side panel per tab
async function toggleSidePanel(tabId: number) {
  const isOpen = openSidePanels.has(tabId);
  if (isOpen) {
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
    openSidePanels.delete(tabId);
  } else {
    await chrome.sidePanel.setOptions({ tabId, enabled: true, path: 'side_panel.html' });
    await chrome.sidePanel.open({ tabId });
    openSidePanels.add(tabId);
  }
}
```

## SharedWorker for Multi-Window State Sync

When popup and side panel can be open simultaneously, use a `SharedWorker` to sync state:

```typescript
// notification-worker.js (SharedWorker — not a service worker)
const peers: MessagePort[] = [];

self.addEventListener('connect', (e: MessageEvent) => {
  const port = e.ports[0];
  peers.push(port);

  port.addEventListener('message', (msg) => {
    switch (msg.data.type) {
      case 'NOTIFICATION':
        // Broadcast to all OTHER peers (not sender)
        peers.filter(p => p !== port).forEach(p => p.postMessage(msg.data));
        break;
      case 'STATE_CHANGED':
        peers.filter(p => p !== port).forEach(p => p.postMessage(msg.data));
        break;
    }
  });
  port.start();
});

// In popup/side_panel:
const worker = new SharedWorker('/notification-worker.js');
worker.port.onmessage = (e) => handleStateUpdate(e.data);
worker.port.start();
```

## Background as ES Module

Set `"type": "module"` in the background entry — supported in all MV3-capable browsers
(Chrome 116+). Enables top-level `await`, native imports, and cleaner code splitting:

```json
"background": {
  "service_worker": "background.js",
  "type": "module"
}
```

## Solana Actions (Blinks)

Solflare supports Solana Actions — on-chain transactions embedded in shareable links:

```typescript
interface SignRequest {
  transaction: string;  // base64-encoded serialized transaction
  blinkUrl?: string;    // e.g. https://dial.to/?action=solana-action:...
  logoUrl?: string;
  title?: string;
  origin: string;
}

// In the signing confirmation UI:
function SigningConfirmation({ request }: { request: SignRequest }) {
  return (
    <div>
      {request.logoUrl && <img src={request.logoUrl} />}
      <h2>{request.title ?? request.origin}</h2>
      {request.blinkUrl && <BlinkBadge url={request.blinkUrl} />}
      <TransactionDetails tx={request.transaction} />
      <SimulationResults />
    </div>
  );
}
```

## Content Script: `all_frames: true`

Inject into all iframes as well as the top-level frame. Many DeFi dApps render their
wallet UI inside iframes (dashboards, embedded trading widgets, etc.):

```json
"content_scripts": [{
  "js": ["content.js"],
  "matches": ["<all_urls>"],
  "run_at": "document_start",
  "all_frames": true
}]
```
