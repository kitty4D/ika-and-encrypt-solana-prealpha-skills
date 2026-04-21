// b1 - changelog vs pin freshness check. basically a paternity test for releases.
//
// catches two classic L moves:
//   1. u bumped `docs-revision.md` but ghosted the CHANGELOG
//   2. u wrote a CHANGELOG entry but forgot to actually bump the pin
//
// rules: the top dated entry in CHANGELOG-<SKILL>.md (## YYYY-MM-DD ... `sha`)
// must match the `recorded in skill` date in references/docs-revision.md within
// +/- 30 days, AND the short sha from the CHANGELOG has to equal the first 7
// chars of the full commit recorded in docs-revision.md. if they disagree, the
// skill is literally lying about which version of the book it tracks. not cute.

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
    changelog: path.join(REPO, "CHANGELOG-IKA.md"),
    docsRevision: path.join(REPO, "skills", "ika-solana-prealpha", "references", "docs-revision.md"),
  },
  {
    id: "encrypt-solana-prealpha",
    changelog: path.join(REPO, "CHANGELOG-ENCRYPT.md"),
    docsRevision: path.join(
      REPO,
      "skills",
      "encrypt-solana-prealpha",
      "references",
      "docs-revision.md",
    ),
  },
];

// find the first heading that looks like "## 2026-04-17 - align with ... @ `abcdef1`".
// we grab the date and the commit short-sha and call it a day.
function parseTopChangelogEntry(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^##\s+(\d{4}-\d{2}-\d{2}).*?`([0-9a-f]{7,40})`/i);
    if (m) return { date: m[1], shortSha: m[2].toLowerCase().slice(0, 7) };
  }
  return null;
}

function parseRecordedDate(text) {
  const m = text.match(/recorded in skill\s*\|\s*(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function parseTrackedCommit(text) {
  const m = text.match(/commit\s*\(full\)\s*\|\s*`([0-9a-f]{40})`/i);
  return m ? m[1].toLowerCase() : null;
}

function daysBetween(a, b) {
  const da = Date.parse(a);
  const db = Date.parse(b);
  return Math.abs(da - db) / 86400000;
}

for (const skill of SKILLS) {
  test(`${skill.id}: top changelog entry parses`, () => {
    const text = fs.readFileSync(skill.changelog, "utf8");
    const entry = parseTopChangelogEntry(text);
    assert.ok(entry, "could not find top dated `## YYYY-MM-DD ... \\`sha\\`` entry");
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(entry.date), "entry date is YYYY-MM-DD");
    assert.ok(/^[0-9a-f]{7}$/.test(entry.shortSha), "entry short-sha is 7 hex chars");
  });

  test(`${skill.id}: CHANGELOG date matches docs-revision "recorded in skill" (±30d)`, () => {
    const cl = parseTopChangelogEntry(fs.readFileSync(skill.changelog, "utf8"));
    const recorded = parseRecordedDate(fs.readFileSync(skill.docsRevision, "utf8"));
    assert.ok(cl, "changelog entry missing");
    assert.ok(recorded, "docs-revision.md missing 'recorded in skill' date");
    const delta = daysBetween(cl.date, recorded);
    assert.ok(
      delta <= 30,
      `CHANGELOG date ${cl.date} and docs-revision ${recorded} differ by ${delta} days`,
    );
  });

  test(`${skill.id}: CHANGELOG short-sha matches docs-revision tracked commit`, () => {
    const cl = parseTopChangelogEntry(fs.readFileSync(skill.changelog, "utf8"));
    const tracked = parseTrackedCommit(fs.readFileSync(skill.docsRevision, "utf8"));
    assert.ok(cl, "changelog entry missing");
    assert.ok(tracked, "docs-revision.md missing full tracked commit");
    assert.equal(
      tracked.slice(0, 7),
      cl.shortSha,
      `tracked commit ${tracked} does not match CHANGELOG sha ${cl.shortSha}`,
    );
  });
}
