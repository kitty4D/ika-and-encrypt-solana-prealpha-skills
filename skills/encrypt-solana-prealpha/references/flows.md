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

**gRPC alternative:** batch **`CreateInput`** on `EncryptService` so the executor creates inputs with a shared proof / authorized party — [`grpc-api.md`](grpc-api.md). **Important:** scalar `ciphertext_bytes` must be the 17-byte `[fhe_type(1) || value_le(16)]` form — without the type tag the executor misreads multi-byte scalars. Use `encryptValue` / `mockCiphertext` rather than hand-rolling — see [`gotchas.md`](gotchas.md#grpc-createinput-requires-the-17-byte-input-format).

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

Examples under `chains/solana/examples/` (voting, counter, ACL, `pc-token`, `pc-swap`, coin-flip) ship **Pinocchio, Anchor, Native, and Quasar** variants when present in upstream for each example.

---

## flow 7 — cross-program composability (receipt-gated)

When one program needs to act on whether an FHE op in another program **succeeded** without ever seeing plaintext or the source state (e.g. a from-balance), use **receipt-gated** composability. This is the pattern `pc-swap` switched to in upstream commit `425567e` (2026-04-27); the older delegate-allowance composability sketch in pc-swap docs no longer matches the program.

**Source-program side** (e.g. `pc-token`, instruction `TransferWithReceipt` = disc 22):

1. The same FHE graph that updates `from.balance` and `to.balance` outputs a third ciphertext: a **binary receipt** equal to `amount` if `from_balance >= amount`, otherwise `0`.
2. The handler transfers the receipt's `authorized` ACL to a caller-supplied `target_program` argument — usually the calling program's ID. The receipt is now readable inside that program's own FHE graphs.

**Caller-program side** (e.g. `pc-swap`):

1. **Authorize** the `amount_ct` to the source program: `ctx.transfer_ciphertext(amount_ct, source_program)`.
2. **CPI** the source program's receipt-emitting variant with a fresh receipt-ciphertext keypair and `target = caller_program_id`.
3. **Use** the receipt in the caller's own graphs — every reserve / payout / LP-supply update gates on the receipt. A lying user yields `receipt = 0`, so all gated values collapse to 0 uniformly: pool state stays consistent with no special-case branching, and no plaintext source state ever crosses the boundary.
4. **Close** the receipt at the end with `close_ciphertext` to reclaim its rent.

### refund pattern: returning slipped / unsettled deposits

Receipt-gating prevents *pool* corruption on a lying user, but the user's deposit still moved into the pool's vault during the CPI. Without an explicit refund, slipped or unsettled deposits get stranded. As of upstream commit `f7f410a` (2026-04-29), pc-swap solves this with a **refund slot in the FHE graph output**:

- **Single-receipt op** (`swap_graph`): graph emits `refund = receipt - final_in`. `refund = 0` on success, `refund = receipt` on slippage rejection (or any other path where `final_in = 0`). The dispatch CPIs the pool-signed `vault_in → user` transfer for `refund` after the payout, so the user's deposit comes back when the swap can't settle.
- **Multi-receipt op** (`add_liquidity_graph`): settlement gates on **both** receipts being non-zero **and** `lp_to_mint >= 1` (`settled = both_ok && lp_ok`). When one side lies or the proposed LP amount rounds to zero, reserves / supply / LP **don't update** and the graph emits per-side `refund_a = receipt_a - final_a`, `refund_b = receipt_b - final_b`. Dispatch then fires two pool-signed `vault → user` CPIs to return the truthful side without donating to the pool.

**Output-slot re-tagging convention:** to keep account counts down, the same ciphertext account that carried the input (`min_out_ct`, `amt_a_ct`, `amt_b_ct`) gets re-tagged as the refund output. After the graph runs, the account *is* the refund. Dispatch then transfers it out and `close_ciphertext`s it. Read code carefully: a ciphertext's conceptual identity changes mid-flow.

**Stack-frame trap with multiple CPIs:** building the per-CPI metas/views array inline accumulates onto the caller's stack. Pinocchio's BPF stack frame is small; four CPIs in `add_liquidity` (two `TransferWithReceipt` + two refund transfers) overflowed it. Upstream extracted a `#[inline(never)] pool_signed_transfer<'a>(...)` helper so each CPI builds its metas in its own frame. If you compose more than ~3 CPIs in one handler, do the same.

End-to-end coverage for all of the above (forward / reverse / lying / slippage / partial-LP / removeLiq paths) lives in [`chains/solana/examples/pc-swap/e2e/verified.ts`](https://github.com/dwallet-labs/encrypt-pre-alpha/blob/main/chains/solana/examples/pc-swap/e2e/verified.ts) — useful as a reference if you're building a similar receipt-gated DeFi flow.

**When to prefer allowance-based (`Approve` + `TransferFrom`) instead:** the calling program just needs *authorized delivery* and never reads downstream state (e.g. a streaming-payments program). Both patterns ship in `pc-token` — see [pc-token book](https://docs.encrypt.xyz/examples/pc-token/01-overview.html) and [pc-swap book](https://docs.encrypt.xyz/examples/pc-swap/01-overview.html).
