---
name: web3-wallet-dev
description: >
  Expert skill for building a secure, open-source, multi-chain Web3 browser extension wallet
  supporting Bitcoin, Ethereum/EVM L2s, Solana, Sui, and Ika dWallets. Use this skill whenever
  the user asks to: build a crypto wallet, add chain support to a wallet, implement key
  management or BIP39/HD wallet derivation, integrate hardware wallets (Ledger/Trezor), handle
  transaction signing, review wallet security, audit wallet code, scaffold a wallet extension,
  or work with Ika dWallet multi-chain signing. Trigger on any mention of "wallet extension",
  "chrome extension wallet", "self-custody", "seed phrase", "private key management",
  "transaction signing", "multi-chain wallet", "dWallet", or any combination of
  "wallet" + a chain name (Bitcoin, Ethereum, Solana, Sui, EVM). When in doubt: use this skill.
---

# Web3 Browser Extension Wallet — Development Skill

Multi-chain browser extension wallet using **React + TypeScript + Chrome Manifest V3**.

**Chains**: Bitcoin · Ethereum + EVM L2s · Solana · Sui · Aptos · Ika dWallets (multi-chain from Sui)

---

## First Steps

**1. Ask which blockchain** — ask the user:
> "Which blockchain will you target? Multi-chain, Bitcoin, Ethereum, EVM L2s, Solana, Sui, Aptos, or Ika dWallets?"

**2. Load chain sub-skills** before writing chain-specific code:

| Chain | Skill(s) | Reference |
|-------|----------|-----------|
| Bitcoin | `startwithbitcoin` | `references/bitcoin.md` |
| Ethereum / EVM | `ethereum-development` | `references/ethereum.md` |
| Solana | `solana-dev` | `references/solana.md` |
| Sui | `sui-ts-sdk`, `sui-frontend` | `references/sui.md` |
| Aptos | `aptos-agent` | `references/aptos.md` |
| Ika dWallets | `ika-sdk`, `ika-cli`, `ika-move` | `references/ika-dwallet.md` |
| UI/UX | `frontend-design` | — |

---

## Extension Architecture (Manifest V3)

Four isolated execution contexts. Key material must **never** cross boundaries unencrypted.

```
┌──────────────────────────────────────────────────────────┐
│  Popup UI  (React SPA — index.html)                      │
│  + Side Panel  (side_panel.html — optional but recommended)│
│  • Sends typed commands via tRPC → Background            │
│  ↕  chrome.runtime.sendMessage                           │
├──────────────────────────────────────────────────────────┤
│  Background Service Worker  (background.js)              │
│  • Vault: AES-GCM encrypted keystore (PBKDF2 900k iter)  │
│  • KeyringController: BIP39/32/44 HD derivation          │
│  • Chain RPC clients (BTC, ETH, SOL, SUI, IKA)           │
│  • Hardware wallet bridge (Ledger/Trezor via WebHID)      │
│  • Ika dWallet 2PC-MPC signing coordinator               │
│  • Phishing detector (eth-phishing-detect + webRequest)  │
│  • Auto-lock via chrome.alarms                           │
│  ↕  chrome.runtime.sendMessage                           │
├──────────────────────────────────────────────────────────┤
│  Content Script  (content.js — isolated world)           │
│  • all_frames: true (inject into iframes too)            │
│  • Injects dapp-interface.js via DOM script tag          │
│  • Bridges page ↔ background (origin-validated)          │
│  ↕  window.postMessage (origin + source checked)         │
├──────────────────────────────────────────────────────────┤
│  Injected Page Script  (dapp-interface.js)               │
│  • EIP-1193 + EIP-6963 (Ethereum)                        │
│  • Wallet Standard (Solana + Sui)                        │
│  • window.bitcoin (Bitcoin — Unisat-compatible)          │
└──────────────────────────────────────────────────────────┘
  + SharedWorker (notification-worker.js) — syncs state
    between popup and side panel when both open
  + Offscreen Document — for DOM/localStorage operations
```

---

## Project Scaffold

```
wallet-extension/
├── src/
│   ├── background/
│   │   ├── index.ts           # Service worker entry (type: "module")
│   │   ├── vault.ts           # AES-GCM keystore — see references/vault-encryption.md
│   │   ├── keyring/
│   │   │   ├── KeyringController.ts
│   │   │   ├── HdKeyring.ts   # BIP39/32/44 — see references/hd-derivation.md
│   │   │   └── chains/        # bitcoin.ts, ethereum.ts, solana.ts, sui.ts, ika.ts
│   │   ├── hardware/          # see references/hardware-wallets.md
│   │   ├── rpc/               # tRPC router + per-chain handlers
│   │   └── lock-manager.ts    # chrome.alarms auto-lock
│   ├── content-script/        # Injects dapp-interface, bridges messages
│   ├── dapp-interface/        # Provider injection — see references/provider-injection.md
│   ├── popup/                 # React app
│   ├── side-panel/            # Same app, different entry point
│   ├── notification-worker.js # SharedWorker for multi-window sync
│   └── offscreen/
└── public/
    ├── manifest.json
    ├── index.html
    ├── side_panel.html
    ├── offscreen.html
    └── phishing.html          # Shown when phishing domain detected
```

---

## manifest.json Template

```json
{
  "manifest_version": 3,
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [{
    "js": ["content.js"],
    "matches": ["<all_urls>"],
    "run_at": "document_start",
    "all_frames": true
  }],
  "content_security_policy": {
    "extension_pages": "default-src 'none'; object-src 'none'; connect-src *; font-src 'self'; img-src * data:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'none'; frame-ancestors 'none';"
  },
  "permissions": ["storage", "tabs", "alarms", "unlimitedStorage", "identity",
                  "offscreen", "webRequest", "sidePanel"],
  "host_permissions": ["http://*/*", "https://*/*"],
  "side_panel": { "default_path": "side_panel.html" },
  "web_accessible_resources": [
    { "matches": ["<all_urls>"], "resources": ["dapp-interface.js"] }
  ]
}
```

**CSP rules** (never break these):
- No `unsafe-eval` — ever
- `wasm-unsafe-eval` only if WASM crypto libs are used
- `connect-src *` is fine — the extension needs to reach RPC endpoints

---

## Key Dependencies

```json
{
  "dependencies": {
    "@mysten/sui": "latest",
    "@ika.xyz/sdk": "latest",
    "@solana/web3.js": "^1.x",
    "ethers": "^6.x",
    "bitcoinjs-lib": "^6.x",
    "@scure/bip32": "^1.x",
    "@scure/bip39": "^1.x",
    "@noble/secp256k1": "^2.x",
    "@noble/ed25519": "^2.x",
    "@ledgerhq/hw-transport-webhid": "latest",
    "@ledgerhq/hw-app-eth": "latest",
    "@ledgerhq/hw-app-btc": "latest",
    "@ledgerhq/hw-app-solana": "latest",
    "@trezor/connect-web": "latest",
    "@trpc/server": "^11.x",
    "@trpc/client": "^11.x",
    "@wallet-standard/wallet": "latest",
    "@mysten/wallet-standard": "latest",
    "eth-phishing-detect": "latest",
    "webextension-polyfill": "^0.10.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "vite-plugin-web-extension": "latest",
    "@types/chrome": "latest",
    "typescript": "^5.x"
  }
}
```

Use `@scure` and `@noble` for all crypto — audited, zero-dependency. Avoid `elliptic` and `bip32`.

---

## Security Checklist

### Key Management
- [ ] Keys only decrypted in background service worker
- [ ] `chrome.storage.session` for in-memory key material (clears on browser close)
- [ ] PBKDF2 ≥ 900,000 iterations + AES-256-GCM
- [ ] Mnemonic buffer zeroed after derivation (`buffer.fill(0)`)
- [ ] Auto-lock via `chrome.alarms` after inactivity

### Extension Architecture
- [ ] CSP: no `unsafe-eval`, no external script sources
- [ ] All `postMessage` handlers check `event.origin` AND `event.source`
- [ ] Background validates all incoming messages — never trust content script blindly
- [ ] `type: "module"` on service worker (enables ES modules, top-level await)

### dApp Interaction
- [ ] Transaction simulation before signing UI (show decoded intent, not raw hex)
- [ ] Phishing domain detection + blocking (`eth-phishing-detect` + `webRequest`)
- [ ] Rate-limit signing requests from dApps

### Supply Chain
- [ ] All dep versions locked (`package-lock.json` committed)
- [ ] `npm audit` in CI
- [ ] Minimal `web_accessible_resources`

---

## Common Pitfalls

1. **MV3 service worker lifecycle** — Workers terminate when idle. Use `chrome.storage.session`
   for in-memory state; never rely on module-level variables surviving between messages.

2. **Ledger WebHID requires a user gesture** — Cannot be initiated from background.
   Route through popup: user clicks → popup calls WebHID → popup forwards to background.

3. **tRPC transport** — Use `chrome.runtime.onMessage` as the adapter, not HTTP.

4. **Ika signing latency** — Sub-second but not instant. Show a progress indicator;
   don't block the UI thread during 2PC-MPC.

5. **Side panel + popup simultaneously** — Both can be open at once. Use the SharedWorker
   (`notification-worker.js`) pattern from Solflare to sync state between them.

6. **dWallet addresses** — Each chain has a different address format from the same dWallet.
   Label chain-specific addresses clearly in the UI.

7. **all_frames injection** — Needed for DeFi dApps that render wallet UI inside iframes.
   Set `"all_frames": true` in `content_scripts`.

---

## Reference Files

Read these when working on specific areas:

| File | When to read |
|------|-------------|
| `references/vault-encryption.md` | Implementing keystore, encryption, auto-lock |
| `references/hd-derivation.md` | Key derivation, per-chain paths, KeyringController |
| `references/bitcoin.md` | Bitcoin on-chain (PSBT, UTXOs, BIP84/86), Lightning/NWC |
| `references/ethereum.md` | EVM wallets, viem, EIP-1559, EIP-1193/6963, L2s |
| `references/solana.md` | Wallet Standard, SIWS, Jito, phishing, side panel, Blinks |
| `references/sui.md` | @mysten/sui v2, gRPC client, PTB, dApp Kit, Wallet Standard |
| `references/aptos.md` | @aptos-labs/ts-sdk, FA/legacy tokens, multisig, view functions |
| `references/ika-dwallet.md` | dWallet creation, 2PC-MPC signing, UX patterns |
| `references/hardware-wallets.md` | Ledger/Trezor integration, error handling |
| `references/provider-injection.md` | EIP-1193/6963, Wallet Standard, Bitcoin/Aptos providers |
| `references/multisig.md` | Bitcoin P2WSH, Gnosis Safe, Squads, Sui MultiSig, Aptos, Ika cross-chain |
| `references/security-threats.md` | Threat model, supply chain, blind signing, audit grep patterns |

---

## Code Audit Checklist

1. **Key storage** — Keys ever in `chrome.storage.local` unencrypted?
2. **CSP** — Any `unsafe-eval`, `unsafe-inline`, or external script sources?
3. **Message validation** — `event.origin` + `event.source` checked in content script?
4. **Background validation** — Does background validate sender identity on all messages?
5. **Dependency audit** — `npm audit`. Flag `elliptic`, old `bip32`, outdated crypto libs.
6. **Transaction display** — Decoded intent shown, not raw hex? (Blind signing = red flag)
7. **Supply chain** — Deps locked? Any packages with suspicious recent commits?
8. **web_accessible_resources** — Minimal? Does `dapp-interface.js` expose internals?
9. **Offscreen/iframe access** — What does any offscreen document touch?
10. **Auto-lock** — Inactivity timeout present and enforced in background?
