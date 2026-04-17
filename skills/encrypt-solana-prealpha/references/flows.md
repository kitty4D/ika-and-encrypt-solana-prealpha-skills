# flows (Encrypt Solana pre-alpha)

Normative detail: [Encrypt Developer Guide](https://docs.encrypt.xyz/) — especially **on-chain** chapters (`execute-graph`, `ciphertexts`, `decryption`, `access-control`) and **testing**.

**Broader book coverage:** Step-by-step **confidential voting tutorial**, **DSL** (types / ops / conditionals / graph compilation), **framework** pages, **mock vs real FHE**, and **examples** (counter, coin-flip, voting, ACL, PC-token, PC-swap) are indexed in [`developer-guide-map.md`](developer-guide-map.md) — load that file instead of assuming the Encrypt surface is only gRPC + `execute_graph`.

---

## flow 0 — author FHE logic

1. Write functions with **`#[encrypt_fn]`** (scalars; **vectors** element-wise per book [`dsl-vectors.md`](dsl-vectors.md)) or **`#[encrypt_fn_graph]`** (graph bytes when you need the chain-agnostic path or manual CPI) using encrypted types.
2. Macro expands to a **computation graph** (DAG of FHE ops) consumed by the Solana program SDK.

**`#[encrypt_fn]`** (from `encrypt-solana-dsl`) is the usual Solana path; the book **Vectors** chapter documents element-wise **`#[encrypt_fn]`** with `EUint*Vector` types ([`dsl-vectors.md`](dsl-vectors.md)). If your toolchain still rejects vectors on the Solana CPI macro (`HasFheTypeId`), or you need graph-only bytecode, use **`#[encrypt_fn_graph]`** (from base `encrypt-dsl`) and invoke CPI via `EncryptContext::execute_graph()` manually. See [`gotchas.md`](gotchas.md).

See **DSL reference** in the book and `encrypt-dsl` in the repo.

---

## flow 1 — register graph (when required)

Some deployments use **`register_graph`** then **`execute_registered_graph`** instead of inlining graph bytes on every `execute_graph` — see [execute-graph](https://docs.encrypt.xyz/) in the book and [`instructions.md`](instructions.md) discriminator **5–6**.

---

## flow 2 — ciphertext creation

Two major paths (see [instructions reference](https://docs.encrypt.xyz/reference/instructions.html)):

| path | discriminator | who | gist |
| --- | ---: | --- | --- |
| `create_input_ciphertext` | 1 | authority | Verified ciphertext from off-chain encrypted payload + proof flow |
| `create_plaintext_ciphertext` | 2 | user signer or CPI | Plaintext → pending ciphertext; executor fills digest later |

**gRPC alternative:** batch **`CreateInput`** on `EncryptService` so the executor creates inputs with a shared proof / authorized party — [`grpc-api.md`](grpc-api.md).

---

## flow 3 — execute graph

1. Transaction invokes **`execute_graph` (disc 4)** with graph inputs + output account plan (signer or CPI path — CPI inserts `cpi_authority` per book).
2. Chain records pending outputs; **`GraphExecuted`** (and related) events fire — see [events reference](https://docs.encrypt.xyz/reference/events.html).

---

## flow 4 — executor commit

Off-chain executor runs FHE (or mock), then authority submits **`commit_ciphertext` (disc 3)** with the **32-byte digest** to move **PENDING → VERIFIED**.

Pre-alpha README: executor handles create_input, graph eval + commit, and decryption responses automatically at the hosted endpoint.

---

## flow 5 — decryption

1. On-chain **`request_decryption`** (gateway group).
2. Decryptor / executor **`respond_decryption`** with plaintext path per book.
3. **`ReadCiphertext`** gRPC may return plaintext in **mock** mode — see proto comments in [`grpc-api.md`](grpc-api.md).

---

## flow 6 — local testing

- **Fast:** `just test-unit` (no SBF).
- **Integration:** `just test-examples` (needs SBF builds).
- **Harness:** `encrypt-solana-test`, LiteSVM, `MockComputeEngine` — see **testing** chapters in the book.

Examples under `chains/solana/examples/` (voting, counter, ACL, `pc-token`, `pc-swap`, coin-flip) ship **Pinocchio, Native, and Anchor** variants.
