// b2 - citation resolver. basically the "u cited it, does it exist tho" police.
//
// every citation in a skill's prose has to actually land somewhere real. two
// shapes we gatekeep:
//
//   1. drift-rule `evidence` strings like "gotchas.md:33-47" or "grpc-api.md ...".
//      we pull out each `<basename>.md[:N[-M]]` and demand the file exists +
//      has at least M (or N) lines. no ghosted line numbers allowed.
//
//   2. markdown links inside SKILL.md + references/*.md: `[x](path.md)`,
//      `(references/foo.md)`, `(../CHANGELOG-X.md)`. each in-repo path has to
//      resolve on disk or this test will drag u.
//
// external URLs (http[s]://) + fragment-only (`#anchor`) links get a pass bc
// we're not out here pinging the whole internet.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");

const SKILLS = [
  { id: "ika-solana-prealpha" },
  { id: "encrypt-solana-prealpha" },
];

async function loadRules(id) {
  const p = path.join(REPO, "skills", id, "references", "drift-rules.mjs");
  const mod = await import(
    "file://" + p.replace(/\\/g, "/") + `?t=${Date.now()}`
  );
  return mod.rules;
}

function lineCount(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/).length;
}

// resolve a bare basename like "gotchas.md" or "grpc-api.md" against the
// skill's references/ first, then the skill root, then the repo root (that
// last one catches CHANGELOG-*.md and friends). first hit wins.
function resolveEvidenceTarget(skillId, name) {
  const candidates = [
    path.join(REPO, "skills", skillId, "references", name),
    path.join(REPO, "skills", skillId, name),
    path.join(REPO, name),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

for (const skill of SKILLS) {
  test(`${skill.id}: drift-rule evidence strings resolve to real files`, async () => {
    const rules = await loadRules(skill.id);
    const unresolved = [];
    const outOfRange = [];
    for (const rule of rules) {
      if (!rule.evidence) continue;
      // yoink every `basename.md[:N[-M]]` we can find in the evidence string.
      const re = /\b([A-Za-z][\w.-]*\.md)(?::(\d+)(?:-(\d+))?)?/g;
      let m;
      while ((m = re.exec(rule.evidence)) !== null) {
        const basename = m[1];
        const start = m[2] ? parseInt(m[2], 10) : null;
        const end = m[3] ? parseInt(m[3], 10) : start;
        const p = resolveEvidenceTarget(skill.id, basename);
        if (!p) {
          unresolved.push(`rule ${rule.id}: evidence names '${basename}' — no file found`);
          continue;
        }
        if (end !== null) {
          const total = lineCount(p);
          if (end > total) {
            outOfRange.push(
              `rule ${rule.id}: evidence '${basename}:${start}${
                end !== start ? "-" + end : ""
              }' — file has only ${total} lines`,
            );
          }
        }
      }
    }
    assert.deepEqual(unresolved, [], unresolved.join("\n"));
    assert.deepEqual(outOfRange, [], outOfRange.join("\n"));
  });

  test(`${skill.id}: markdown links in SKILL.md + references/*.md resolve`, () => {
    const skillRoot = path.join(REPO, "skills", skill.id);
    const refsDir = path.join(skillRoot, "references");
    const files = [
      path.join(skillRoot, "SKILL.md"),
      ...fs
        .readdirSync(refsDir)
        .filter((n) => n.endsWith(".md"))
        .map((n) => path.join(refsDir, n)),
    ];

    const broken = [];
    const linkRe = /\[[^\]]*?\]\(([^)]+)\)/g;

    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      let m;
      while ((m = linkRe.exec(text)) !== null) {
        let target = m[1].trim();
        // kill any "title" suffix like [x](path "title"). rare but exists.
        target = target.split(/\s+/)[0];
        // trim trailing punctuation that markdown parsers sometimes eat.
        target = target.replace(/[),.;]+$/, "");
        if (!target) continue;
        // external link? not our problem, skip.
        if (/^[a-z]+:\/\//i.test(target) || target.startsWith("mailto:")) continue;
        // pure anchor? also skip, nothing to resolve on disk.
        if (target.startsWith("#")) continue;
        // chop the fragment off (path.md#heading -> path.md)
        const hashIdx = target.indexOf("#");
        if (hashIdx >= 0) target = target.slice(0, hashIdx);
        if (!target) continue;

        const resolved = path.resolve(path.dirname(file), target);
        if (!fs.existsSync(resolved)) {
          broken.push(
            `${path.relative(REPO, file).replace(/\\/g, "/")}: [${m[0]}] -> ${target} (missing)`,
          );
        }
      }
    }

    assert.deepEqual(broken, [], broken.slice(0, 10).join("\n"));
  });

  test(`${skill.id}: SKILL.md references its own audit.md, docs-revision.md, drift-rules.mjs`, () => {
    const text = fs.readFileSync(path.join(REPO, "skills", skill.id, "SKILL.md"), "utf8");
    // these three are hard-carrying the user-facing story, they better be in.
    assert.ok(text.includes("audit.md"), "SKILL.md must link to references/audit.md");
    assert.ok(text.includes("docs-revision.md"), "SKILL.md must link to references/docs-revision.md");
    assert.ok(text.includes("drift-rules.mjs"), "SKILL.md must mention drift-rules.mjs");
  });
}
