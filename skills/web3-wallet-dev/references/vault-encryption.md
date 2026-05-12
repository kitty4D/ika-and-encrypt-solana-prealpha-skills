# Vault: Encryption & Key Storage

## Principles
- Use the **Web Crypto API** only — available in service workers, audited, no dependencies
- Never use `crypto-js` (slow, historically vulnerable)
- Never use `'unsafe-eval'` in CSP — it breaks SubtleCrypto's security model
- Keys only exist decrypted in the background service worker, never in popup or content script

## Storage Strategy

| Store | What | Why |
|-------|------|-----|
| `chrome.storage.local` | Encrypted vault blob | Persistent across sessions |
| `chrome.storage.session` | Decrypted keyring in memory | Cleared on browser close — no residual key material |

## Implementation (AES-GCM + PBKDF2)

From Slush wallet analysis — 900,000 PBKDF2 iterations confirmed in production build.

```typescript
// vault.ts
const ALGO       = 'AES-GCM';
const KDF        = 'PBKDF2';
const ITERATIONS = 900_000;  // Slush production value
const KEY_LEN    = 256;
const SALT_LEN   = 32;
const IV_LEN     = 12;

export async function encryptVault(password: string, plaintext: string): Promise<string> {
  const salt   = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv     = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key    = await deriveKey(password, salt);
  const data   = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: ALGO, iv }, key, data);
  return JSON.stringify({
    salt: toBase64(salt),
    iv:   toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
    iterations: ITERATIONS,
  });
}

export async function decryptVault(password: string, blob: string): Promise<string> {
  const { salt, iv, data, iterations } = JSON.parse(blob);
  const key   = await deriveKey(password, fromBase64(salt), iterations);
  const plain = await crypto.subtle.decrypt(
    { name: ALGO, iv: fromBase64(iv) },
    key,
    fromBase64(data),
  );
  return new TextDecoder().decode(plain);
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = ITERATIONS,
): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), KDF, false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: KDF, salt, iterations, hash: 'SHA-256' },
    raw,
    { name: ALGO, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Helpers
const toBase64   = (buf: Uint8Array) => btoa(String.fromCharCode(...buf));
const fromBase64 = (b64: string)     => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
```

## Auto-Lock

Use `chrome.alarms` — fires even when the service worker is asleep:

```typescript
// lock-manager.ts
const LOCK_ALARM = 'auto-lock';

export function scheduleLock(minutesIdle: number) {
  chrome.alarms.create(LOCK_ALARM, { delayInMinutes: minutesIdle });
}

export function cancelLock() {
  chrome.alarms.clear(LOCK_ALARM);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === LOCK_ALARM) lockWallet();
});
```

## Zero-Memory Pattern for Mnemonic

Wipe sensitive buffers after use:
```typescript
const seed = mnemonicToSeedSync(mnemonic);
deriveAllAccounts(seed);
seed.fill(0); // zero out before GC
```

## Legacy Vault Migration

When changing iteration count or algorithm (e.g. upgrading old vaults):
1. Detect old format by checking `iterations` field in stored blob
2. On next successful unlock, re-encrypt with new parameters
3. Never silently downgrade iteration count
