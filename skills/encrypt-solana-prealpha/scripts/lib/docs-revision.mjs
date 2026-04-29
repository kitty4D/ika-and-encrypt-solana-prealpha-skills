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

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse the optional `## tracked npm package` section in docs-revision.md.
 * Returns { name, version, publishedDate, recordedDate, status } or null if the section is absent.
 * Throws if the section heading is present but the required fields are missing or malformed.
 *
 * The section format mirrors the `## tracked revision` table; rows are:
 *   | package           | `<scoped-package-name>`         |
 *   | version           | `<semver>`                      |
 *   | published (UTC)   | YYYY-MM-DD                      |
 *   | recorded in skill | YYYY-MM-DD                      |
 *   | status            | <free-form note, optional>      |
 */
export function parseTrackedNpmPackage(md) {
  const norm = md.replace(/\r\n/g, "\n");
  const headingRe = /^##\s+tracked npm package\s*$/m;
  const headingMatch = norm.match(headingRe);
  if (!headingMatch) return null;

  const sectionStartRaw = headingMatch.index;
  const afterHeading = norm.indexOf("\n", sectionStartRaw);
  if (afterHeading < 0) {
    throw new Error("tracked npm package section in docs-revision.md is empty");
  }
  const body = norm.slice(afterHeading + 1);
  const nextHeading = body.search(/^##\s/m);
  const section = nextHeading < 0 ? body : body.slice(0, nextHeading);

  const get = (label) => {
    const re = new RegExp(
      `\\|\\s*${escapeRegex(label)}\\s*\\|\\s*([^\\n|]+?)\\s*\\|`,
      "i",
    );
    const m = section.match(re);
    return m ? m[1].trim() : null;
  };

  const stripBackticks = (s) => (s ? s.replace(/^`+|`+$/g, "").trim() : s);

  const name = stripBackticks(get("package"));
  const version = stripBackticks(get("version"));
  const publishedRaw = get("published (UTC)");
  const recordedRaw = get("recorded in skill");
  const status = get("status"); // optional

  const missing = [];
  if (!name) missing.push("package");
  if (!version) missing.push("version");
  if (!publishedRaw) missing.push("published (UTC)");
  if (!recordedRaw) missing.push("recorded in skill");
  if (missing.length) {
    throw new Error(
      `tracked npm package section in docs-revision.md is malformed - missing fields: ${missing.join(", ")}`,
    );
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(publishedRaw)) {
    throw new Error(
      `tracked npm package: "published (UTC)" is not YYYY-MM-DD: ${publishedRaw}`,
    );
  }
  if (!dateRe.test(recordedRaw)) {
    throw new Error(
      `tracked npm package: "recorded in skill" is not YYYY-MM-DD: ${recordedRaw}`,
    );
  }

  return {
    name,
    version,
    publishedDate: publishedRaw,
    recordedDate: recordedRaw,
    status: status || null,
  };
}
