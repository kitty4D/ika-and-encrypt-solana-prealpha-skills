import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseTrackedCommit,
  parseRecordedDate,
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
