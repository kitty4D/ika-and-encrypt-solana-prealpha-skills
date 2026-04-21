// b1 - structure check. like, are the bones of the skill even there.
//
// for both skills we check:
//   - all the required reference files exist (no ghosted imports)
//   - every references/*.md is linked from SKILL.md OR from another reference
//     (orphan md files are so 2004, we don't ship those)
//   - drift-rules.mjs + the audit script are both on disk
//   - audit.md documents every --flag the script actually parses. if u add
//     a flag and forget to doc it, this test will literally drag u for it.

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
    requiredRefs: [
      "docs-revision.md",
      "audit.md",
      "grpc-api.md",
      "account-layouts.md",
      "instructions.md",
      "events.md",
      "frameworks.md",
      "flows.md",
      "examples.md",
      "drift-rules.mjs",
    ],
    script: "audit-ika-solana-prealpha.mjs",
  },
  {
    id: "encrypt-solana-prealpha",
    requiredRefs: [
      "docs-revision.md",
      "audit.md",
      "grpc-api.md",
      "instructions.md",
      "frameworks.md",
      "flows.md",
      "gotchas.md",
      "performance-caveats.md",
      "drift-rules.mjs",
    ],
    script: "audit-encrypt-solana-prealpha.mjs",
  },
];

for (const skill of SKILLS) {
  const root = path.join(REPO, "skills", skill.id);
  const refsDir = path.join(root, "references");

  test(`${skill.id}: required reference files exist`, () => {
    for (const rel of skill.requiredRefs) {
      const p = path.join(refsDir, rel);
      assert.ok(fs.existsSync(p), `missing required reference: ${rel}`);
    }
  });

  test(`${skill.id}: audit script exists`, () => {
    const p = path.join(root, "scripts", skill.script);
    assert.ok(fs.existsSync(p), `missing audit script: ${skill.script}`);
  });

  test(`${skill.id}: every references/*.md is linked from SKILL.md or another reference`, () => {
    const skillText = fs.readFileSync(path.join(root, "SKILL.md"), "utf8");
    const mdFiles = fs
      .readdirSync(refsDir)
      .filter((n) => n.endsWith(".md"))
      .sort();

    const orphans = [];
    for (const name of mdFiles) {
      // basic vibe check: does SKILL.md at least name-drop this file? substring
      // match is fine bc the filenames are unique enough.
      if (skillText.includes(name)) continue;
      // maybe a sibling references/*.md links to it. that also counts.
      let linked = false;
      for (const other of mdFiles) {
        if (other === name) continue;
        const t = fs.readFileSync(path.join(refsDir, other), "utf8");
        if (t.includes(name)) {
          linked = true;
          break;
        }
      }
      if (!linked) orphans.push(name);
    }
    assert.deepEqual(orphans, [], `orphan reference files (not linked anywhere): ${orphans.join(", ")}`);
  });

  test(`${skill.id}: audit.md documents every flag the script parses`, () => {
    const scriptPath = path.join(root, "scripts", skill.script);
    const src = fs.readFileSync(scriptPath, "utf8");
    // grab every `--flag` token the script mentions as a string literal.
    // parseArgs uses `a === "--force"` etc so quoted flags always show up here.
    const flagSet = new Set();
    for (const m of src.matchAll(/["'`](--[a-z][a-z0-9-]*)(?:=[^"'`]*)?["'`]/g)) {
      flagSet.add(m[1]);
    }
    // note: bare (unquoted) --flag references in the script are also caught by
    // the regex above bc we require quotes. if u ever start parsing flags with
    // getopts-style sugar, expand this.

    const auditDoc = fs.readFileSync(path.join(refsDir, "audit.md"), "utf8");
    const undocumented = [];
    for (const flag of flagSet) {
      if (!auditDoc.includes(flag)) undocumented.push(flag);
    }
    assert.deepEqual(
      undocumented,
      [],
      `audit.md does not document these script flags: ${undocumented.join(", ")}`,
    );
  });

  test(`${skill.id}: drift-rules.mjs exists and exports a rules array`, async () => {
    const p = path.join(refsDir, "drift-rules.mjs");
    assert.ok(fs.existsSync(p), "drift-rules.mjs missing");
    const mod = await import(
      "file://" + p.replace(/\\/g, "/") + `?t=${Date.now()}`
    );
    assert.ok(Array.isArray(mod.rules), "drift-rules.mjs must export `rules` array");
    assert.ok(mod.rules.length > 0, "drift-rules.mjs must have at least one rule");
  });
}
