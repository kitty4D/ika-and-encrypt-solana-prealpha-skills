// b1 - canonical-consistency. the "one source of truth" police.
//
// the program id + gRPC host basically live in three places and they MUST agree:
//   1. SKILL.md env table (the official word)
//   2. any drift rule that grep's a partial fragment (so it knows what the
//      full canonical looks like to exclude it)
//   3. the audit script's canonical heuristic
//
// if someone bumps the program id in SKILL.md but forgets to update the
// partial-match guard inside drift-rules.mjs, the drift rule will false-positive
// on the new canonical value. rly bad silent regression imo. this test is the
// tripwire so it can't sneak into main.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");

const SKILLS = [
  {
    id: "ika-solana-prealpha",
    programIdRow: /dWallet program id\s*\|\s*`([1-9A-HJ-NP-Za-km-z]{32,44})`/,
    grpcRow: /dWallet gRPC\s*\|\s*`([^`]+)`/,
    partialProgramIdRuleId: "ika-non-canonical-program-id",
    partialGrpcRuleId: "ika-non-canonical-grpc-host",
  },
  {
    id: "encrypt-solana-prealpha",
    programIdRow: /Encrypt program id\s*\|\s*`([1-9A-HJ-NP-Za-km-z]{32,44})`/,
    grpcRow: /Encrypt gRPC[^|]*\|\s*`([^`]+)`/,
    partialProgramIdRuleId: "enc-non-canonical-program-id",
    partialGrpcRuleId: "enc-non-canonical-grpc-host",
  },
];

function skillTable(id) {
  return fs.readFileSync(
    path.join(REPO, "skills", id, "SKILL.md"),
    "utf8",
  );
}

async function loadRules(id) {
  const p = path.join(REPO, "skills", id, "references", "drift-rules.mjs");
  const mod = await import(
    "file://" + p.replace(/\\/g, "/") + `?t=${Date.now()}`
  );
  return mod.rules;
}

function ruleSource(rule) {
  // stringify the detect fn so we can grep its body for literals. the source
  // includes every regex / string it compares against - that's where the
  // canonical-value guard lives, so that's what we have to inspect.
  return String(rule.detect) + "\n" + (rule.fixPrompt || "") + "\n" + (rule.evidence || "");
}

for (const skill of SKILLS) {
  test(`${skill.id}: SKILL.md env table has canonical program id + gRPC host`, () => {
    const t = skillTable(skill.id);
    const pid = t.match(skill.programIdRow);
    const grpc = t.match(skill.grpcRow);
    assert.ok(pid, "program id row not found in SKILL.md env table");
    assert.ok(grpc, "gRPC host row not found in SKILL.md env table");
  });

  test(`${skill.id}: partial-program-id drift rule quotes the canonical full id`, async () => {
    const t = skillTable(skill.id);
    const canonicalId = t.match(skill.programIdRow)[1];
    const rules = await loadRules(skill.id);
    const rule = rules.find((r) => r.id === skill.partialProgramIdRuleId);
    assert.ok(rule, `drift rule ${skill.partialProgramIdRuleId} missing`);
    // The rule's detect function must exclude the canonical full id — its
    // source should reference that exact string.
    const src = ruleSource(rule);
    assert.ok(
      src.includes(canonicalId),
      `drift rule ${rule.id} does not reference the canonical full program id ${canonicalId}. ` +
        "Either SKILL.md was updated without updating the drift rule, or vice-versa.",
    );
  });

  test(`${skill.id}: partial-gRPC drift rule quotes the canonical full URL`, async () => {
    const t = skillTable(skill.id);
    const canonicalUrl = t.match(skill.grpcRow)[1];
    const rules = await loadRules(skill.id);
    const rule = rules.find((r) => r.id === skill.partialGrpcRuleId);
    assert.ok(rule, `drift rule ${skill.partialGrpcRuleId} missing`);
    const src = ruleSource(rule);
    assert.ok(
      src.includes(canonicalUrl),
      `drift rule ${rule.id} does not reference the canonical full gRPC URL ${canonicalUrl}. ` +
        "Either SKILL.md was updated without updating the drift rule, or vice-versa.",
    );
  });

  test(`${skill.id}: audit script references the canonical values`, () => {
    const scriptName =
      skill.id === "ika-solana-prealpha"
        ? "audit-ika-solana-prealpha.mjs"
        : "audit-encrypt-solana-prealpha.mjs";
    const scriptPath = path.join(REPO, "skills", skill.id, "scripts", scriptName);
    const t = skillTable(skill.id);
    const canonicalId = t.match(skill.programIdRow)[1];
    const canonicalUrl = t.match(skill.grpcRow)[1];

    const src = fs.readFileSync(scriptPath, "utf8");
    // the audit script parses canonical values out of SKILL.md at runtime, so
    // hard-coded literals here would rly just invite drift. we only sanity
    // check that the script still points at SKILL.md. that's the source.
    assert.ok(
      src.includes("SKILL.md"),
      "audit script should read SKILL.md for canonical values",
    );
    // not asserting literal program id / URL here bc the script deliberately
    // reads them out at runtime. the actual cross-check lives in the drift
    // rules above + in tests/skill-audit/canonical.test.mjs (parser unit test).
    void canonicalId;
    void canonicalUrl;
  });
}
