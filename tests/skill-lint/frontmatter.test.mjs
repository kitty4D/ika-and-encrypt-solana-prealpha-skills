// b1 - frontmatter validator. literally just gatekeeping vibes.
//
// for both skills' SKILL.md we're like:
//   - does the frontmatter even parse? pls say yes
//   - is `name` kebab-case only (lowercase + digits + hyphens, no caps no funny chars)
//   - does `description` open with "Use when"? it has to, it's the law
//   - is the whole fenced block <= 1024 chars? agentskills.io said so, and they're the boss
//
// if any of those break, the skill is sus and CC might not even find it. no bueno.

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
    md: path.join(REPO, "skills", "ika-solana-prealpha", "SKILL.md"),
  },
  {
    id: "encrypt-solana-prealpha",
    md: path.join(REPO, "skills", "encrypt-solana-prealpha", "SKILL.md"),
  },
];

function readFrontmatter(mdPath) {
  const text = fs.readFileSync(mdPath, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const block = m[0]; // includes fences, so the 1024-cap check covers them too
  const inner = m[1];
  const fields = {};
  // baby YAML parser, like the 2008 kind. one-line values only, no nesting.
  // if someone adds multi-line YAML to SKILL.md in the future, rly just reach
  // for a real yaml lib instead of patching this.
  for (const line of inner.split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (mm) fields[mm[1]] = mm[2];
  }
  return { block, inner, fields };
}

for (const skill of SKILLS) {
  test(`${skill.id}: SKILL.md has YAML frontmatter`, () => {
    const fm = readFrontmatter(skill.md);
    assert.ok(fm, `no frontmatter fences found in ${skill.md}`);
    assert.ok(fm.fields.name, "missing `name` field");
    assert.ok(fm.fields.description, "missing `description` field");
  });

  test(`${skill.id}: frontmatter name is kebab-case and matches skill id`, () => {
    const fm = readFrontmatter(skill.md);
    const name = fm.fields.name;
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `name '${name}' is not kebab-case`);
    assert.equal(name, skill.id, "name must equal the skill directory name");
  });

  test(`${skill.id}: description starts with "Use when"`, () => {
    const fm = readFrontmatter(skill.md);
    assert.match(
      fm.fields.description,
      /^Use when\b/,
      `description should start with "Use when ..." (got: ${fm.fields.description.slice(0, 40)}…)`,
    );
  });

  test(`${skill.id}: frontmatter block is <= 1024 chars`, () => {
    const fm = readFrontmatter(skill.md);
    const len = fm.block.length;
    assert.ok(len <= 1024, `frontmatter is ${len} chars (limit: 1024)`);
  });

  test(`${skill.id}: description advertises audit modes`, () => {
    // both skills are supposed to surface audit / audit-force / audit-fix in
    // the description so CC's router can pick it up. plan part C was very
    // literally about this, don't silently drop any of the three.
    const fm = readFrontmatter(skill.md);
    const d = fm.fields.description;
    assert.match(d, /\baudit\b/, "description should mention 'audit'");
    assert.match(d, /audit-force/, "description should mention 'audit-force'");
    assert.match(d, /audit-fix/, "description should mention 'audit-fix'");
  });
}
