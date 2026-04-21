/**
 * Parse the tracked upstream commit out of references/docs-revision.md.
 * The file has a table with a `commit (full)` row whose value is a 40-char hex SHA in backticks.
 */

export function parseTrackedCommit(md) {
  const norm = md.replace(/\r\n/g, "\n");
  const m = norm.match(/\|\s*commit \(full\)\s*\|\s*`([a-f0-9]{40})`/i);
  if (!m) throw new Error("Could not find tracked commit (full) in docs-revision.md");
  return m[1].toLowerCase();
}

/** Parse the "recorded in skill" date column — used by the changelog-vs-pin lint test. */
export function parseRecordedDate(md) {
  const norm = md.replace(/\r\n/g, "\n");
  const m = norm.match(/\|\s*recorded in skill\s*\|\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  return m ? m[1] : null;
}
