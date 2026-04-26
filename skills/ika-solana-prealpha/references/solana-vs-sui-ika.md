# solana pre-alpha vs sui `ika-sdk`

**Sui** uses PTB + `IkaClient`, objects, and effects certificates. **Solana pre-alpha** uses Solana transactions, gRPC **`SubmitTransaction`**, account PDAs, and **`ApprovalProof::Solana`**. BCS layouts and end-to-end lifecycles: [`grpc-api.md`](grpc-api.md), [`flows.md`](flows.md).

**`UserShareEncryptionKeys`:** the class lives in Sui’s `@ika.xyz/sdk` today and is **not** surfaced by `@ika.xyz/pre-alpha-solana-client`. Wallet and extension work that models the real (non-mock) zero-trust key path should use [`user-share-encryption-keys.md`](user-share-encryption-keys.md) alongside this comparison.

**dWallet-type taxonomy** (zero-trust / shared / imported-key) on the Solana instruction surface: [`dwallet-types.md`](dwallet-types.md).
