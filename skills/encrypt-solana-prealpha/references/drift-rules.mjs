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
];
