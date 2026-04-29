import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseTrackedCommit,
  parseRecordedDate,
  parseTrackedNpmPackage,
} from "../../skills/encrypt-solana-prealpha/scripts/lib/docs-revision.mjs";

const GOOD = `| field | value |
| --- | --- |
| commit (full) | \`3bd794534cb36e1a9d8c4f1a4e7d8e9f02b9a1cd\` |
| recorded in skill | 2026-04-17 |
`;

test("parseTrackedCommit finds the full 40-char sha", () => {
  assert.equal(
    parseTrackedCommit(GOOD),
    "3bd794534cb36e1a9d8c4f1a4e7d8e9f02b9a1cd",
  );
});

test("parseTrackedCommit tolerates CRLF line endings", () => {
  const crlf = GOOD.replace(/\n/g, "\r\n");
  assert.equal(
    parseTrackedCommit(crlf),
    "3bd794534cb36e1a9d8c4f1a4e7d8e9f02b9a1cd",
  );
});

test("parseTrackedCommit lowercases the hash", () => {
  const upper = GOOD.replace(
    "3bd794534cb36e1a9d8c4f1a4e7d8e9f02b9a1cd",
    "3BD794534CB36E1A9D8C4F1A4E7D8E9F02B9A1CD",
  );
  assert.equal(
    parseTrackedCommit(upper),
    "3bd794534cb36e1a9d8c4f1a4e7d8e9f02b9a1cd",
  );
});

test("parseTrackedCommit throws on a short/missing sha", () => {
  assert.throws(() => parseTrackedCommit("nothing here"));
  assert.throws(() => parseTrackedCommit("| commit (full) | `deadbeef` |"));
});

test("parseRecordedDate pulls YYYY-MM-DD", () => {
  assert.equal(parseRecordedDate(GOOD), "2026-04-17");
});

test("parseRecordedDate returns null when absent", () => {
  assert.equal(parseRecordedDate("no date row"), null);
});

const NPM_GOOD = `# header

## tracked revision

| field | value |
| --- | --- |
| commit (full) | \`3bd794534cb36e1a9d8c4f1a4e7d8e9f02b9a1cd\` |
| recorded in skill | 2026-04-17 |

## tracked npm package

| field | value |
| --- | --- |
| package | \`@encrypt.xyz/pre-alpha-solana-client\` |
| version | \`0.1.0\` |
| published (UTC) | 2026-04-03 |
| recorded in skill | 2026-04-28 |
| status | **KNOWN STALE vs upstream** - ships pre-fix scalar input encoder. |

## detecting updates
`;

test("parseTrackedNpmPackage extracts every field", () => {
  const r = parseTrackedNpmPackage(NPM_GOOD);
  assert.equal(r.name, "@encrypt.xyz/pre-alpha-solana-client");
  assert.equal(r.version, "0.1.0");
  assert.equal(r.publishedDate, "2026-04-03");
  assert.equal(r.recordedDate, "2026-04-28");
  assert.match(r.status, /KNOWN STALE/);
});

test("parseTrackedNpmPackage returns null when section absent", () => {
  const noSection = `# header\n\n## tracked revision\n\n| field | value |\n| --- | --- |\n| commit (full) | \`3bd794534cb36e1a9d8c4f1a4e7d8e9f02b9a1cd\` |\n`;
  assert.equal(parseTrackedNpmPackage(noSection), null);
});

test("parseTrackedNpmPackage tolerates CRLF line endings", () => {
  const crlf = NPM_GOOD.replace(/\n/g, "\r\n");
  const r = parseTrackedNpmPackage(crlf);
  assert.equal(r.version, "0.1.0");
  assert.equal(r.publishedDate, "2026-04-03");
});

test("parseTrackedNpmPackage status is optional", () => {
  const noStatus = NPM_GOOD.replace(
    /\| status \|.*\|\n/,
    "",
  );
  const r = parseTrackedNpmPackage(noStatus);
  assert.equal(r.status, null);
  assert.equal(r.version, "0.1.0");
});

test("parseTrackedNpmPackage throws when required fields missing", () => {
  // Section heading present but no version row
  const broken = `## tracked npm package

| field | value |
| --- | --- |
| package | \`@encrypt.xyz/pre-alpha-solana-client\` |
| published (UTC) | 2026-04-03 |
| recorded in skill | 2026-04-28 |
`;
  assert.throws(() => parseTrackedNpmPackage(broken), /version/);
});

test("parseTrackedNpmPackage throws on malformed dates", () => {
  const badPublished = NPM_GOOD.replace("2026-04-03", "April 3rd");
  assert.throws(() => parseTrackedNpmPackage(badPublished), /YYYY-MM-DD/);
});
