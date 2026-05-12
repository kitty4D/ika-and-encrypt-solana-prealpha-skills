# Hardware Wallet Integration

## Overview

Hardware wallets (Ledger, Trezor) keep private keys on a physical device. The extension
never sees the private key — it sends unsigned transaction bytes to the device and receives
a signature back.

## Ledger (WebHID — Chrome MV3)

Use `@ledgerhq/hw-transport-webhid`. WebUSB is deprecated for Ledger.

**Critical constraint**: `TransportWebHID.create()` requires a user gesture (button click).
It cannot be silently initiated from the background service worker. Route through the popup:
1. User clicks "Sign with Ledger"
2. Popup calls background with a pending signing request
3. Background opens confirmation popup (or uses existing popup)
4. Popup calls `TransportWebHID.create()` in response to the user click

```typescript
// hardware/LedgerBridge.ts
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import AppEth  from '@ledgerhq/hw-app-eth';
import AppSol  from '@ledgerhq/hw-app-solana';
import AppBtc  from '@ledgerhq/hw-app-btc';

export class LedgerBridge {
  async signEthereum(path: string, txHex: string) {
    const transport = await TransportWebHID.create();
    try {
      const app = new AppEth(transport);
      return await app.signTransaction(path, txHex, null);
    } finally {
      await transport.close();
    }
  }

  async signSolana(path: string, txBuffer: Buffer) {
    const transport = await TransportWebHID.create();
    try {
      const app = new AppSol(transport);
      const { signature } = await app.signTransaction(path, txBuffer);
      return signature;
    } finally {
      await transport.close();
    }
  }

  async signBitcoin(path: string, psbt: string) {
    const transport = await TransportWebHID.create();
    try {
      const app = new AppBtc({ transport });
      // Use splitTransaction + createPaymentTransaction for legacy
      // Use app.signPsbt() for Taproot/SegWit
      return await app.signPsbt(psbt, { ... });
    } finally {
      await transport.close();
    }
  }

  async getAddress(app: 'eth' | 'sol' | 'btc', path: string) {
    const transport = await TransportWebHID.create();
    try {
      switch (app) {
        case 'eth': return (await new AppEth(transport).getAddress(path)).address;
        case 'sol': return (await new AppSol(transport).getAddress(path)).address;
        case 'btc': return (await new AppBtc({ transport }).getWalletPublicKey(path)).bitcoinAddress;
      }
    } finally {
      await transport.close();
    }
  }
}
```

### Ledger Derivation Paths

```
Ethereum:  m/44'/60'/0'/0/0    (account 0)
Solana:    m/44'/501'/0'       (Ledger Live path)
Bitcoin:   m/84'/0'/0'/0/0    (Native SegWit)
```

Note: Ledger Live uses a different Solana path than Phantom (`m/44'/501'/0'` vs `m/44'/501'/0'/0'`).
Offer both options and let the user select which matches their existing accounts.

### Error Handling

```typescript
import { StatusCodes } from '@ledgerhq/errors';

try {
  const sig = await ledger.signEthereum(path, txHex);
} catch (e: any) {
  if (e.statusCode === StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED) {
    throw new Error('Transaction rejected on Ledger device');
  }
  if (e.statusCode === StatusCodes.DEVICE_NOT_ONBOARDED) {
    throw new Error('Ledger not set up');
  }
  if (e.message?.includes('not open')) {
    throw new Error('Please open the correct app on your Ledger');
  }
  throw e;
}
```

## Trezor

Use `@trezor/connect-web`. Requires `manifest()` call on init.

```typescript
import TrezorConnect from '@trezor/connect-web';

TrezorConnect.manifest({
  email: 'support@mywallet.com',
  appUrl: 'https://mywallet.com',
});

export async function trezorSignEth(path: string, tx: EthereumTransaction) {
  const result = await TrezorConnect.ethereumSignTransaction({
    path,
    transaction: tx,
  });
  if (!result.success) throw new Error(result.payload.error);
  return result.payload;
}

export async function trezorSignSolana(path: string, serializedTx: string) {
  const result = await TrezorConnect.solanaSignTransaction({
    path,
    serializedTx,
  });
  if (!result.success) throw new Error(result.payload.error);
  return result.payload.signature;
}
```

## Storing Hardware Wallet Accounts

Hardware accounts don't have a private key in the extension — store only the public key
and derivation path:

```typescript
interface HardwareAccount {
  type: 'ledger' | 'trezor';
  address: string;
  publicKey: string;
  derivationPath: string;
  deviceId?: string; // for multi-device support
}
```

Store these in `chrome.storage.local` unencrypted (no key material to protect), but
do require password confirmation before initiating a signing flow.
