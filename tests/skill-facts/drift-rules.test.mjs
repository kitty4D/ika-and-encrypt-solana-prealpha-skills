/**
 * For every drift rule in each skill's catalog, assert:
 *   1. a fixtures/drift-positive/<skill>/<rule-id>.* file exists and MUST trigger
 *   2. a fixtures/drift-negative/<skill>/<rule-id>.* file exists and MUST NOT trigger
 *
 * This makes adding a new drift rule fully test-driven — write the fixture before the
 * regex, or the rule cannot land.
 *
 * Keeps the test data small and auditable: every rule is one positive + one negative file
 * under tests/fixtures/, visible in code review.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rules as encryptRules } from "../../skills/encrypt-solana-prealpha/references/drift-rules.mjs";
import { rules as ikaRules } from "../../skills/ika-solana-prealpha/references/drift-rules.mjs";
import { applyRule } from "../../skills/encrypt-solana-prealpha/scripts/lib/drift.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "fixtures");

function findFixture(kind, skill, id) {
  const dir = path.join(FIXTURES, kind, skill);
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(id + ".")) return path.join(dir, name);
  }
  return null;
}

function runSuite(skill, rules) {
  for (const rule of rules) {
    const pos = findFixture("drift-positive", skill, rule.id);
    const neg = findFixture("drift-negative", skill, rule.id);

    test(`[${skill}/${rule.id}] has a drift-positive fixture`, () => {
      assert.ok(pos, `missing tests/fixtures/drift-positive/${skill}/${rule.id}.*`);
    });
    test(`[${skill}/${rule.id}] has a drift-negative fixture`, () => {
      assert.ok(neg, `missing tests/fixtures/drift-negative/${skill}/${rule.id}.*`);
    });

    test(`[${skill}/${rule.id}] positive fixture triggers the rule`, () => {
      if (!pos) return;
      const text = fs.readFileSync(pos, "utf8");
      const finding = applyRule(rule, pos, text);
      assert.ok(
        finding,
        `expected ${path.basename(pos)} to trigger rule ${rule.id} but it did not`,
      );
      assert.equal(finding.id, rule.id);
      assert.equal(finding.severity, rule.severity);
    });

    test(`[${skill}/${rule.id}] negative fixture does NOT trigger the rule`, () => {
      if (!neg) return;
      const text = fs.readFileSync(neg, "utf8");
      const finding = applyRule(rule, neg, text);
      assert.equal(
        finding,
        null,
        `expected ${path.basename(neg)} NOT to trigger ${rule.id}, but it did`,
      );
    });

    test(`[${skill}/${rule.id}] has required rule metadata`, () => {
      assert.ok(rule.severity, "severity required");
      assert.ok(
        ["critical", "high", "medium", "low"].includes(rule.severity),
        `unknown severity: ${rule.severity}`,
      );
      assert.ok(rule.title, "title required");
      assert.ok(rule.evidence, "evidence citation required");
      assert.ok(rule.fixPrompt, "fixPrompt required");
      assert.ok(
        rule.fixPrompt.includes("<LIST>"),
        "fixPrompt must contain the <LIST> placeholder",
      );
      assert.ok(Array.isArray(rule.appliesTo) && rule.appliesTo.length > 0);
      assert.equal(typeof rule.detect, "function");
      assert.ok(rule.since && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rule.since));
    });
  }
}

runSuite("encrypt", encryptRules);
runSuite("ika", ikaRules);

test("rule ids are unique within each skill", () => {
  for (const [skill, rules] of [
    ["encrypt", encryptRules],
    ["ika", ikaRules],
  ]) {
    const ids = rules.map((r) => r.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `duplicate rule ids in ${skill}: ${dupes.join(", ")}`);
  }
});
