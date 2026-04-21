/**
 * Drift rules for ika-solana-prealpha.
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
 */

const EXT_ALL_CODE = [/\.rs$/, /\.ts$/, /\.tsx$/, /\.js$/, /\.jsx$/, /\.mjs$/, /\.cjs$/, /\.move$/];
const EXT_RUST_ONLY = [/\.rs$/];
const EXT_JSLIKE = [/\.ts$/, /\.tsx$/, /\.js$/, /\.jsx$/, /\.mjs$/, /\.cjs$/];

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
    id: "ika-mock-sign-is-error-assumption",
    since: "2026-04-17",
    severity: "critical",
    category: "deprecated",
    title:
      "Code/comment asserts mock `Sign` always returns `Error` — this contradicts the 2026-04-17 Mock Support table",
    appliesTo: EXT_ALL_CODE,
    detect: (text) => {
      const patterns = [
        /mock.{0,40}Sign.{0,40}(?:always|only|just|usually).{0,40}Error/i,
        /Sign.{0,40}mock.{0,40}Error/i,
        /mock.{0,40}never.{0,40}MessageApproval/i,
        /mock.{0,40}can(?:not|'t|t).{0,40}index/i,
      ];
      const hits = [];
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (patterns.some((re) => re.test(lines[i]))) hits.push(i + 1);
      }
      return hits.length ? hits : false;
    },
    evidence: "CHANGELOG-IKA.md (2026-04-17) + grpc-api.md Mock Support section",
    fixPrompt:
      'Ask the ika-solana-prealpha skill: "Remove/rewrite claims that mock Sign always ' +
      'errors per CHANGELOG-IKA.md 2026-04-17 + grpc-api.md Mock Support. Files: <LIST>"',
  },
  {
    id: "ika-pda-seed-simplified-triple",
    since: "2026-04-17",
    severity: "high",
    category: "silent-bug",
    title:
      "MessageApproval-adjacent code without the chunked `['dwallet','message_approval',scheme_u16_le,…]` seed layout",
    appliesTo: EXT_ALL_CODE,
    detect: (text) => {
      const adjacent = /MessageApproval|message_approval/.test(text);
      if (!adjacent) return false;
      const derives =
        /find(?:_|-)program(?:_|-)address|findProgramAddress|getProgramDerivedAddress/i.test(text);
      if (!derives) return false;
      if (/"message_approval"/.test(text) || /b"message_approval"/.test(text)) return false;
      return matchLines(
        text,
        /find(?:_|-)program(?:_|-)address|findProgramAddress|getProgramDerivedAddress/i,
      );
    },
    evidence: "account-layouts.md + flows.md step 2",
    fixPrompt:
      'Ask the ika-solana-prealpha skill: "Rebuild MessageApproval PDA seeds from the ' +
      'chunked layout per account-layouts.md + flows.md step 2. Files: <LIST>"',
  },
  {
    id: "ika-message-hash-terminology",
    since: "2026-04-17",
    severity: "low",
    category: "idiom",
    title: "`message_hash` / `messageHash` identifier where `message_digest` is now canonical",
    appliesTo: EXT_ALL_CODE,
    detect: (text) => {
      const hits = matchLines(text, /\bmessage_hash\b|\bmessageHash\b/);
      return hits.length ? hits : false;
    },
    evidence: "flows.md + account-layouts.md (digest/seed-field rename)",
    fixPrompt:
      'Ask the ika-solana-prealpha skill: "Rename message_hash/messageHash to ' +
      'message_digest per flows.md + account-layouts.md. Files: <LIST>"',
  },
  {
    id: "ika-non-canonical-grpc-host",
    since: "2026-04-17",
    severity: "medium",
    category: "canonical",
    title: "ika gRPC host mentioned but not the canonical URL from SKILL.md",
    appliesTo: EXT_ALL_CODE,
    detect: (text) => {
      if (!/ika\.ika-network|ika-network\.net|pre-alpha.*ika/i.test(text)) return false;
      if (text.includes("https://pre-alpha-dev-1.ika.ika-network.net:443")) return false;
      return matchLines(text, /ika\.ika-network|ika-network\.net/i);
    },
    evidence: "SKILL.md env table",
    fixPrompt:
      'Ask the ika-solana-prealpha skill: "Align ika gRPC hosts to the canonical URL ' +
      'from SKILL.md env table. Files: <LIST>"',
  },
  {
    id: "ika-non-canonical-program-id",
    since: "2026-04-17",
    severity: "medium",
    category: "canonical",
    title: "Partial dWallet program-id fragment without the full canonical ID",
    appliesTo: EXT_ALL_CODE,
    detect: (text) => {
      if (!text.includes("87W54kGYFQ")) return false;
      if (text.includes("87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY")) return false;
      return matchLines(text, /87W54kGYFQ/);
    },
    evidence: "SKILL.md env table",
    fixPrompt:
      'Ask the ika-solana-prealpha skill: "Replace partial dWallet program-id fragments ' +
      'with the full canonical ID from SKILL.md env table. Files: <LIST>"',
  },
  {
    id: "ika-attestation-no-version-tag",
    since: "2026-04-17",
    severity: "medium",
    category: "silent-bug",
    title:
      "`VersionedDWalletDataAttestation` decoded without an obvious BCS enum-tag byte check",
    appliesTo: EXT_JSLIKE.concat(EXT_RUST_ONLY),
    detect: (text) => {
      if (!/VersionedDWalletDataAttestation/.test(text)) return false;
      const handled =
        /\bbcs\b.{0,80}enum|\bvariant\b|tag\s*[:=]\s*0|\[0\s*\]|\.slice\s*\(\s*0\s*,\s*1\s*\)|V1\b/.test(
          text,
        );
      if (handled) return false;
      return matchLines(text, /VersionedDWalletDataAttestation/);
    },
    evidence: "grpc-api.md (Attestation decode / enum tag)",
    fixPrompt:
      'Ask the ika-solana-prealpha skill: "Verify every VersionedDWalletDataAttestation ' +
      'decode handles the BCS enum tag per grpc-api.md. Files: <LIST>"',
  },
];
