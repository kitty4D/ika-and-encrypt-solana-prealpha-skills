/**
 * Drift rules for encrypt-solana-prealpha.
 *
 * Each rule describes a pattern in a consumer's codebase that the skill's current
 * knowledge says is (or may be) wrong. The audit script's drift scanner applies these
 * rules to every matching file under `--root` and reports prioritized findings.
 *
 * Severity guide:
 *   critical  — the code is definitely broken or contradicts current upstream behavior
 *   high      — the code has a known silent-failure or maintenance hazard
 *   medium    — likely mis-alignment with canonical values or deprecated idiom
 *   low       — stylistic / advisory; benign today but worth a cleanup
 *
 * Regexes err on the side of conservative matches — the script is a first-pass filter.
 * The `fix` line hands the user a prompt they can paste back to the skill; the skill
 * then does the real semantic review before changing any code.
 */

const EXT_ALL_CODE = [/\.rs$/, /\.ts$/, /\.tsx$/, /\.js$/, /\.jsx$/, /\.mjs$/, /\.cjs$/, /\.move$/];
const EXT_RUST_ONLY = [/\.rs$/];
const EXT_JSLIKE = [/\.ts$/, /\.tsx$/, /\.js$/, /\.jsx$/, /\.mjs$/, /\.cjs$/];

/** Collect the 1-based line numbers of every match of `re` in `text`. */
function matchLines(text, re) {
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) hits.push(i + 1);
  }
  return hits;
}

export const rules = [
  {
    id: "enc-non-canonical-grpc-host",
    since: "2026-04-17",
    severity: "medium",
    category: "canonical",
    title: "Encrypt gRPC host mentioned, but not the canonical URL from SKILL.md",
    appliesTo: EXT_ALL_CODE,
    detect: (text) => {
      if (!/encrypt\.ika-network|pre-alpha-dev-1\.encrypt/i.test(text)) return false;
      if (text.includes("https://pre-alpha-dev-1.encrypt.ika-network.net:443")) return false;
      return matchLines(text, /encrypt\.ika-network|pre-alpha-dev-1\.encrypt/i);
    },
    evidence: "SKILL.md env table",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Align Encrypt gRPC hosts to the canonical URL ' +
      'from SKILL.md env table. Files: <LIST>"',
  },
  {
    id: "enc-non-canonical-program-id",
    since: "2026-04-17",
    severity: "medium",
    category: "canonical",
    title: "Partial Encrypt program-id fragment without the full canonical ID",
    appliesTo: EXT_ALL_CODE,
    detect: (text) => {
      if (!text.includes("4ebfzWdKnrnGseuQ")) return false;
      if (text.includes("4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8")) return false;
      return matchLines(text, /4ebfzWdKnrnGseuQ/);
    },
    evidence: "SKILL.md env table",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Replace partial Encrypt program-id fragments ' +
      'with the full canonical ID from SKILL.md env table. Files: <LIST>"',
  },
  {
    id: "enc-vec-is-equal-scalar-review",
    since: "2026-04-17",
    severity: "high",
    category: "silent-bug",
    title:
      "`.is_equal(&...)` on a vector ciphertext may silently return all-false when the arg is a runtime scalar",
    appliesTo: EXT_RUST_ONLY,
    detect: (text) => {
      const vectorish = /EUint\d+Vector|EVectorU\d+|EBitVector\d+/.test(text);
      if (!vectorish) return false;
      return matchLines(text, /\.is_equal\s*\(\s*&/);
    },
    evidence: "gotchas.md:33-47",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Review each .is_equal(&...) call per ' +
      'gotchas.md:33-47 — if the RHS is a runtime scalar ciphertext, splat to a vector. Files: <LIST>"',
  },
  {
    id: "enc-include-bytes-graph-without-dump-test",
    since: "2026-04-17",
    severity: "high",
    category: "silent-bug",
    title:
      '`include_bytes!("…graph.bin")` without a sibling `dump_*_graph_bytes` test — stale bytecode risk',
    appliesTo: EXT_RUST_ONLY,
    detect: (text) => {
      const hasInclude = /include_bytes!\s*\(\s*"[^"]*graph[^"]*\.bin"\s*\)/i.test(text);
      if (!hasInclude) return false;
      if (/fn\s+dump_\w*graph\w*_bytes\s*\(/i.test(text)) return false;
      return matchLines(text, /include_bytes!\s*\(\s*"[^"]*graph[^"]*\.bin"\s*\)/i);
    },
    evidence: "gotchas.md:49-52",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Audit each include_bytes!(...graph.bin) ' +
      'for a matching dump_*_graph_bytes test per gotchas.md:49-52. Files: <LIST>"',
  },
  {
    id: "enc-read-ciphertext-no-prefix-skip",
    since: "2026-04-17",
    severity: "medium",
    category: "silent-bug",
    title:
      "`ReadCiphertext` response parsed without an obvious byte-0 FHE-type prefix skip",
    appliesTo: EXT_ALL_CODE,
    detect: (text) => {
      if (!/ReadCiphertext|readCiphertext/.test(text)) return false;
      // crude positive signals for "they remembered the prefix":
      const handled =
        /\.slice\(1\b|\[1\.\.\]|\bfhe_type_byte\b|response\s*\.\s*body\s*\.\s*slice\s*\(\s*1/i.test(
          text,
        );
      if (handled) return false;
      return matchLines(text, /ReadCiphertext|readCiphertext/);
    },
    evidence: "gotchas.md:81-83",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Verify every ReadCiphertext response parse ' +
      'skips the 1-byte FHE-type prefix per gotchas.md:81-83. Files: <LIST>"',
  },
  {
    id: "enc-execute-graph-token-transfer-same-file",
    since: "2026-04-17",
    severity: "medium",
    category: "silent-bug",
    title:
      "`execute_graph` and an SPL token transfer appear in the same file — confirm they are in separate transactions",
    appliesTo: EXT_ALL_CODE,
    detect: (text) => {
      const hasGraph = /\bexecute_graph\b/.test(text);
      const hasToken = /\bspl_token\b|\btoken::transfer\b|\btoken_2022\b|TokenProgram\.transfer/.test(text);
      if (!hasGraph || !hasToken) return false;
      return matchLines(text, /\bexecute_graph\b|\btoken::transfer\b|TokenProgram\.transfer/);
    },
    evidence: "gotchas.md:141-145",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Confirm execute_graph and token transfers ' +
      'live in separate instructions per gotchas.md:141-145. Files: <LIST>"',
  },
  {
    id: "enc-missing-quasar-awareness",
    since: "2026-04-17",
    severity: "low",
    category: "missing-feature",
    title:
      "Code/docs mention Pinocchio/Anchor/Native Encrypt CPI but not Quasar (added 2026-04-17)",
    appliesTo: EXT_JSLIKE.concat(EXT_RUST_ONLY),
    detect: (text) => {
      const mentionsAny = /\bpinocchio\b|\bencrypt-anchor\b|\bencrypt-native\b/i.test(text);
      if (!mentionsAny) return false;
      if (/\bquasar\b|\bencrypt-quasar\b/i.test(text)) return false;
      return matchLines(text, /\bpinocchio\b|\bencrypt-anchor\b|\bencrypt-native\b/i);
    },
    evidence: "CHANGELOG-ENCRYPT.md (2026-04-17) + frameworks.md",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Add Quasar to the list of supported ' +
      'Encrypt CPI frameworks per frameworks.md. Files: <LIST>"',
  },
  {
    id: "enc-mock-ciphertext-16-byte-no-type-tag",
    since: "2026-04-28",
    severity: "high",
    category: "silent-bug",
    title:
      "`mockCiphertext` / `encryptValue` called without an `fheType` argument — emits 16 raw bytes, executor falls into a fallback that misreads multi-byte scalars",
    appliesTo: EXT_JSLIKE,
    detect: (text) => {
      // Two failure modes:
      //  (a) calls to mockCiphertext / encryptValue with a single arg
      //  (b) hand-rolled `new Uint8Array(16)` near a `ciphertext` / `mockCiphertext` mention
      const callPattern = /\b(mockCiphertext|encryptValue)\s*\(\s*[^,)]+\s*\)/;
      const handRolled =
        /new\s+Uint8Array\s*\(\s*16\s*\)/.test(text) &&
        /\bciphertext|mockCiphertext|encryptValue\b/i.test(text);
      if (!callPattern.test(text) && !handRolled) return false;
      return matchLines(
        text,
        /\b(mockCiphertext|encryptValue)\s*\(\s*[^,)]+\s*\)|new\s+Uint8Array\s*\(\s*16\s*\)/,
      );
    },
    evidence: "gotchas.md grpc-createinput-requires-the-17-byte-input-format",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Audit every mockCiphertext / encryptValue call ' +
      "and any hand-rolled 16-byte ciphertext buffer; switch to the 17-byte " +
      "[fhe_type || value_le] form per gotchas.md. Files: <LIST>\"",
  },
  {
    id: "enc-encryptvalue-from-stale-npm-package",
    since: "2026-04-28",
    severity: "high",
    category: "silent-bug",
    title:
      "Imports `encryptValue` from `@encrypt.xyz/pre-alpha-solana-client/grpc-web` - npm @0.1.0 still ships the pre-fix 16-byte helper",
    // Narrow scope: only flags files that BOTH name encryptValue AND mention the package.
    // The package implementation on npm @0.1.0 emits 16 bytes regardless of how the caller
    // invokes it, so even the 2-arg form is broken. See gotchas.md for the rationale.
    appliesTo: EXT_JSLIKE,
    detect: (text) => {
      if (!/\bencryptValue\b/.test(text)) return false;
      if (!/@encrypt\.xyz\/pre-alpha-solana-client/.test(text)) return false;
      return matchLines(text, /\bencryptValue\b/);
    },
    evidence: "gotchas.md grpc-createinput-requires-the-17-byte-input-format",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Replace `encryptValue` from ' +
      "@encrypt.xyz/pre-alpha-solana-client with a hand-rolled 17-byte helper " +
      'until the package republishes past 0.1.0. Files: <LIST>"',
  },
  {
    id: "enc-pc-swap-delegate-allowance-stale-pattern",
    since: "2026-04-28",
    severity: "medium",
    category: "missing-feature",
    title:
      "Code mentions pc-swap composability via Approve / TransferFrom delegate-allowance — pc-swap switched to receipt-gated (2026-04-27)",
    // Walker only yields code extensions (see walker.mjs DRIFT_EXT), so .md docs
    // are out of scope here. The rule fires when pinocchio/anchor/native pc-swap
    // implementations or TS clients cling to the older delegate flow.
    appliesTo: EXT_JSLIKE.concat(EXT_RUST_ONLY),
    detect: (text) => {
      const mentionsPcSwap = /\bpc[-_]?swap\b/i.test(text);
      if (!mentionsPcSwap) return false;
      const hasAllowanceTalk =
        /\b(approve|transfer_from|allowance|delegate)\b/i.test(text);
      if (!hasAllowanceTalk) return false;
      // If the file already knows about receipts / TransferWithReceipt, skip.
      if (/\bTransferWithReceipt\b|\breceipt[_-]?ct\b|\breceipt[-_ ]?gated\b/i.test(text))
        return false;
      return matchLines(text, /\bpc[-_]?swap\b/i);
    },
    evidence: "flows.md flow 7 + gotchas.md cross-program-composability",
    fixPrompt:
      'Ask the encrypt-solana-prealpha skill: "Update pc-swap composability references ' +
      'to the receipt-gated TransferWithReceipt pattern per flows.md flow 7. Files: <LIST>"',
  },
];
