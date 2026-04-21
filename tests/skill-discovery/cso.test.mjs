// b6 - cso (claude search optimization) / discovery test. aka the "will cc
// even find ur skill when asked" test. rly important, bc a skill that doesn't
// get picked is just a .md file taking up space.
//
// for each realistic query in queries.json:
//   1. the expected skill's description MUST contain every `keywords[]` entry.
//   2. the expected skill's description MUST score higher (on keyword overlap)
//      than the other skill's, or cc's router will plausibly route to the
//      wrong skill and the user gets a sad time.
//
// if u rename a keyword in a description, this test will literally call out
// every query ur new description no longer covers. no silent drift.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");

const SKILL_IDS = ["ika-solana-prealpha", "encrypt-solana-prealpha"];

function readDescription(id) {
  const text = fs.readFileSync(
    path.join(REPO, "skills", id, "SKILL.md"),
    "utf8",
  );
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error(`no frontmatter in ${id}/SKILL.md`);
  const desc = m[1].match(/description\s*:\s*(.*)/);
  return desc ? desc[1] : "";
}

function scoreDescription(description, keywords) {
  // count total occurrences (not just distinct hits) so a skill that name-drops
  // a term multiple times wins over one that only namechecks it once in a
  // "don't confuse me with the other skill" disambiguation aside. ties are mid.
  const norm = description.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    const needle = kw.toLowerCase();
    let from = 0;
    while (true) {
      const i = norm.indexOf(needle, from);
      if (i === -1) break;
      count++;
      from = i + needle.length;
    }
  }
  return count;
}

const descriptions = Object.fromEntries(
  SKILL_IDS.map((id) => [id, readDescription(id)]),
);

const queriesPath = path.join(__dirname, "queries.json");
const queriesJson = JSON.parse(fs.readFileSync(queriesPath, "utf8"));

for (const q of queriesJson.queries) {
  test(`cso: query "${q.query}" → ${q.expected}`, () => {
    const expected = q.expected;
    const other = SKILL_IDS.find((s) => s !== expected);

    const winScore = scoreDescription(descriptions[expected], q.keywords);
    const loseScore = scoreDescription(descriptions[other], q.keywords);

    const missing = q.keywords.filter(
      (kw) => !descriptions[expected].toLowerCase().includes(kw.toLowerCase()),
    );
    assert.deepEqual(
      missing,
      [],
      `description for '${expected}' is missing keywords for this query: ${missing.join(", ")}`,
    );

    assert.ok(
      winScore > loseScore,
      `description for '${expected}' scored ${winScore} on query "${q.query}" but '${other}' scored ${loseScore} - Claude router may route to wrong skill.`,
    );
  });
}

test("cso: both descriptions start with 'Use when'", () => {
  for (const id of SKILL_IDS) {
    assert.match(descriptions[id], /^Use when\b/, `${id}: description must start with "Use when"`);
  }
});
