// b5a - knowledge probes. like a pop quiz but for the skill's own prose.
//
// deterministic check that each skill still carries the canonical facts a
// model consuming the skill would need. no LLM, no network, no vibes-based
// grading. just "is the phrase in the corpus y/n".
//
// schema:
//   facts[]              - every `allOf` phrase MUST appear in the corpus. if
//                          one goes missing the skill silently got dumber.
//   warningFacts[]       - same shape as facts, just grouped separately so the
//                          answer sheet can say "these disclaimers/warnings
//                          have to stay in".
//   forbiddenSubstrings[] - every `patterns[]` phrase MUST NOT appear. for
//                          phrases the skill legitimately talks about (e.g.
//                          "real FHE" in an educational aside), use a narrower
//                          pattern so u only catch the cringe usage.
//
// matching: lowercase + whitespace-squished, so formatting drift doesn't break us.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");

const SHEETS = [
  { id: "ika-solana-prealpha", sheet: path.join(__dirname, "answer-sheet.ika.json") },
  { id: "encrypt-solana-prealpha", sheet: path.join(__dirname, "answer-sheet.encrypt.json") },
];

function corpusFor(skillId) {
  const root = path.join(REPO, "skills", skillId);
  const files = [path.join(root, "SKILL.md")];
  const refs = path.join(root, "references");
  if (fs.existsSync(refs)) {
    for (const name of fs.readdirSync(refs)) {
      if (name.endsWith(".md")) files.push(path.join(refs, name));
    }
  }
  return files.map((f) => fs.readFileSync(f, "utf8")).join("\n\n");
}

function norm(s) {
  return s.replace(/\s+/g, " ").toLowerCase();
}

for (const { id, sheet } of SHEETS) {
  const sheetJson = JSON.parse(fs.readFileSync(sheet, "utf8"));
  const corpus = norm(corpusFor(id));

  const positiveGroups = [
    ...(sheetJson.facts || []).map((f) => ({ kind: "fact", ...f })),
    ...(sheetJson.warningFacts || []).map((f) => ({ kind: "warning", ...f })),
  ];

  for (const fact of positiveGroups) {
    test(`${id} ${fact.kind} [${fact.id}]: all required phrases present`, () => {
      const missing = fact.allOf.filter((p) => !corpus.includes(norm(p)));
      assert.deepEqual(
        missing,
        [],
        `skill bundle is missing phrases for ${fact.kind} "${fact.id}" (${fact.why}): ${missing.join(" | ")}`,
      );
    });
  }

  for (const forb of sheetJson.forbiddenSubstrings || []) {
    test(`${id} forbidden [${forb.id}]: no banned substring leaks through`, () => {
      const hits = forb.patterns.filter((p) => corpus.includes(norm(p)));
      assert.deepEqual(
        hits,
        [],
        `forbidden pattern(s) found in skill "${forb.id}" (${forb.why}): ${hits.join(" | ")}`,
      );
    });
  }
}
