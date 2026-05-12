# Multi-Signature Patterns

Cross-chain multisig approaches vary significantly. Choose the right one for each chain.

## Decision Guide

| Chain | Best Approach | When to use Ika instead |
|---|---|---|
| Bitcoin | P2SH-P2MS or P2WSH (on-chain) | When you want a single key controlling BTC + other chains |
| Ethereum / EVM | Gnosis Safe (ERC-4337 or standalone) | When you want a single key controlling ETH + other chains |
| Solana | Squads v4 | When you want a single key controlling SOL + other chains |
| Sui | Native MultiSig or Ika dWallet | dWallet for cross-chain; native for Sui-only |
| Aptos | `0x1::multisig_account` | Aptos-only; dWallet for cross-chain |
| Cross-chain unified | **Ika dWallet** (Future Signing) | Always — this is dWallet's primary use case |

---

## Bitcoin Multisig

### P2WSH M-of-N (Native SegWit — recommended)

```typescript
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);

export function createMultisigAddress(
  pubkeys: Buffer[],
  m: number, // signatures required
  network = bitcoin.networks.bitcoin,
) {
  // Lexicographically sort pubkeys (BIP67 — ensures deterministic address)
  const sorted = [...pubkeys].sort((a, b) => a.compare(b));

  const p2ms = bitcoin.payments.p2ms({ m, pubkeys: sorted, network });
  const p2wsh = bitcoin.payments.p2wsh({ redeem: p2ms, network });

  return {
    address:     p2wsh.address!,     // bc1q...
    redeemScript: p2ms.output!,
    witnessScript: p2wsh.redeem!.output!,
  };
}

// 2-of-3 example
const { address } = createMultisigAddress([pubkeyA, pubkeyB, pubkeyC], 2);
```

### Signing a P2WSH PSBT

```typescript
import { Psbt } from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
const ECPair = ECPairFactory(ecc);

export function signMultisigPsbt(
  psbtHex: string,
  privateKey: Uint8Array,
  witnessScript: Buffer,
): string {
  const psbt = Psbt.fromHex(psbtHex);
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey));

  psbt.data.inputs.forEach((input, i) => {
    // Add witnessScript so the signer knows the redeem script
    if (!input.witnessScript) psbt.updateInput(i, { witnessScript });
    try { psbt.signInput(i, keyPair); } catch { /* input not ours */ }
  });

  // Return partially signed — don't finalize until M sigs collected
  return psbt.toHex();
}

export function finalizeAndBroadcast(psbtHex: string): string {
  const psbt = Psbt.fromHex(psbtHex);
  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}
```

### Bitcoin Taproot Multisig (MuSig2)

For Taproot (bc1p...) multisig, use MuSig2 key aggregation — produces a single
signature indistinguishable from a single-key spend (smaller, cheaper, more private).

```typescript
// Use @bitcoinerlab/secp256k1 + musig2 library
// Or use Ika dWallet with Taproot signature algorithm (recommended — handles MPC natively)
```

---

## Ethereum / EVM Multisig

### Gnosis Safe (recommended for production)

The industry standard for EVM multisig. Supports M-of-N signers, arbitrary calldata,
modules, and guards.

```typescript
import Safe, { EthersAdapter } from '@safe-global/protocol-kit';
import { ethers } from 'ethers';

// Deploy a new Safe
export async function deploySafe(
  signers:   string[],    // owner addresses
  threshold: number,
  signer:    ethers.Signer,
) {
  const ethAdapter = new EthersAdapter({ ethers, signerOrProvider: signer });
  const safeFactory = await SafeFactory.create({ ethAdapter });

  const safeAccountConfig = { owners: signers, threshold };
  const safe = await safeFactory.deploySafe({ safeAccountConfig });
  return safe.getAddress();
}

// Propose and sign a transaction
export async function proposeTransaction(
  safeAddress: string,
  to: string,
  value: string,
  data: string,
  signer: ethers.Signer,
) {
  const ethAdapter = new EthersAdapter({ ethers, signerOrProvider: signer });
  const safe = await Safe.create({ ethAdapter, safeAddress });

  const tx = await safe.createTransaction({
    transactions: [{ to, value, data }],
  });
  const signedTx = await safe.signTransaction(tx);
  return signedTx;
}
```

### EIP-712 Multisig (lightweight, no contract deployment)

For simpler M-of-N approval flows without deploying a Safe:

```typescript
import { hashTypedData, recoverTypedDataAddress } from 'viem';

const PROPOSAL_TYPE = {
  Proposal: [
    { name: 'to',    type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data',  type: 'bytes' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

// Each signer signs the same typed data — collect M signatures, then execute
async function collectSignatures(proposal: Proposal, signers: WalletClient[], m: number) {
  const sigs = await Promise.all(
    signers.map(s => s.signTypedData({ domain, types: PROPOSAL_TYPE, primaryType: 'Proposal', message: proposal }))
  );
  return sigs.slice(0, m);
}
```

---

## Solana Multisig (Squads v4)

[Squads](https://squads.so) is the dominant Solana multisig standard.

```typescript
import * as multisig from '@sqds/multisig';
import { Connection, PublicKey } from '@solana/web3.js';

// Create a new multisig
export async function createSquadsMultisig(
  connection: Connection,
  creator:    Keypair,
  members:    PublicKey[],
  threshold:  number,
) {
  const createKey = Keypair.generate();

  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });

  const ix = await multisig.instructions.multisigCreate({
    createKey: createKey.publicKey,
    creator:   creator.publicKey,
    multisigPda,
    configAuthority: null,
    threshold,
    members: members.map(key => ({ key, permissions: multisig.types.Permissions.all() })),
    timeLock: 0,
  });

  // Build and sign transaction with ix
  return multisigPda;
}

// Propose a transaction
export async function proposeVaultTransaction(
  connection:  Connection,
  multisigPda: PublicKey,
  proposer:    Keypair,
  instructions: TransactionInstruction[],
) {
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
  const transactionIndex = (await multisig.accounts.Multisig.fromAccountAddress(
    connection, multisigPda,
  )).transactionIndex + 1n;

  const ix = await multisig.instructions.vaultTransactionCreate({
    multisigPda,
    creator:          proposer.publicKey,
    transactionIndex,
    vaultIndex:       0,
    ephemeralSigners: 0,
    transactionMessage: // compiled message from instructions
  });
  return transactionIndex;
}
```

---

## Sui Native MultiSig

Sui has built-in multisig at the account level — no smart contract needed.

```typescript
import { MultiSigPublicKey } from '@mysten/sui/multisig';
import { PublicKey } from '@mysten/sui/cryptography';

// Create multisig public key (M-of-N, up to 10 signers, weights 1–255)
export function createSuiMultisig(
  signers:   { publicKey: PublicKey; weight: number }[],
  threshold: number,
): MultiSigPublicKey {
  return MultiSigPublicKey.fromPublicKeys({ threshold, publicKeys: signers });
}

// Derive address
const address = multiSigPublicKey.toSuiAddress();

// Combine signatures (after each signer signs separately)
import { combinePartialSignatures } from '@mysten/sui/multisig';
const combinedSig = combinePartialSignatures([sig1, sig2]);

// Execute with combined signature
await client.executeTransactionBlock({
  transactionBlock: txBytes,
  signature: combinedSig,
});
```

---

## Aptos Multisig (`0x1::multisig_account`)

From the `aptos-agent` skill:

```typescript
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
const aptos = new Aptos(new AptosConfig({ network: Network.MAINNET }));

// Create multisig account
const createTx = await aptos.transaction.build.simple({
  sender: ownerAddress,
  data: {
    function:          '0x1::multisig_account::create',
    typeArguments:     [],
    functionArguments: [numSignaturesRequired, additionalOwners],
  },
});

// Create a pending transaction
const proposeTx = await aptos.transaction.build.simple({
  sender: ownerAddress,
  data: {
    function:          '0x1::multisig_account::create_transaction',
    typeArguments:     [],
    functionArguments: [multisigAddress, encodedPayload],
  },
});

// Approve
const approveTx = await aptos.transaction.build.simple({
  sender: ownerAddress,
  data: {
    function:          '0x1::multisig_account::approve_transaction',
    typeArguments:     [],
    functionArguments: [multisigAddress, sequenceNumber],
  },
});

// Execute after threshold approvals
const executeTx = await aptos.transaction.build.simple({
  sender: executorAddress,
  data: {
    function:          '0x1::multisig_account::execute_approved_transaction',
    typeArguments:     [],
    functionArguments: [multisigAddress],
  },
});
```

---

## Cross-Chain Unified Multisig via Ika dWallet

The cleanest approach when you need M-of-N control across multiple chains from a single
policy. The approval logic lives in a Sui Move contract; signatures reach any chain natively.

See `references/ika-dwallet.md` — **Future Signing** is the key pattern:

```
Phase 1: Proposer triggers requestFutureSign → partial signature computed
          (committed to a specific message before approval)
Phase 2: After M-of-N votes pass on Sui → futureSign completes the signature
          → broadcast natively on Bitcoin, Ethereum, Solana, etc.
```

This is strictly superior to chain-specific multisig for cross-chain use because:
- Single approval policy governs all chains simultaneously
- No bridge or wrapped asset risk
- Governance lives on Sui (fast finality, cheap transactions)
- Execution is native on the target chain (no relay, no middleman)

See `ika-move/references/patterns.md` for the complete DAO governance contract example.

---

## Wallet Extension UX for Multisig

**Account type label**: Show multisig accounts distinctly from standard HD accounts.
Include the threshold (e.g. "2-of-3") and the signer count in the account selector.

**Signing state**: Multisig transactions are pending until threshold is reached.
Show a clear "awaiting X more signatures" status with a shareable link or QR code
for co-signers to approve.

**Hardware wallets + multisig**: A common production setup is 2-of-3 where:
- Signer 1: extension (hot, for day-to-day)
- Signer 2: Ledger (cold, for confirmation)
- Signer 3: backup key in cold storage (recovery)

**PSBT / partial transaction format**:
- Bitcoin: PSBT (hex or base64) — the standard exchange format between co-signers
- Ethereum: Safe transaction hash — share via Safe Transaction Service API
- Solana: serialized VersionedTransaction (base64) — share directly
