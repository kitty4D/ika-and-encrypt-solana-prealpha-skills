/**
 * File-tree walker shared by the canonical-literal scan and the drift scanner.
 * Depth-limited, skips common build/vendor directories.
 */

import fs from "fs";
import path from "path";

export const DEFAULT_SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "target",
  "coverage",
]);

export function* walkFiles(dir, maxDepth = 8, skipNames = DEFAULT_SKIP, depth = 0) {
  if (depth > maxDepth) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (skipNames.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walkFiles(full, maxDepth, skipNames, depth + 1);
    else if (ent.isFile()) yield full;
  }
}

/**
 * true if `root` is literally this skill bundle's own repo clone (has
 * `skills/<skillId>/SKILL.md` inside it). lets the audit script skip its own
 * test fixtures + drift catalog so self-audits don't false-positive on their
 * own tripwires. very awkward to flag ur own homework lol.
 */
export function isSkillBundleRoot(root, skillId) {
  return fs.existsSync(path.join(root, "skills", skillId, "SKILL.md"));
}

/**
 * path substrings to skip when the scan root is the bundle itself. forward-
 * slash only, callers gotta normalize windows backslashes before matching.
 */
export const SKILL_BUNDLE_SELF_SKIPS = ["/tests/fixtures/", "/drift-rules.mjs"];

/** Source-code extensions the drift scanner inspects (TS/JS + Rust + Move). */
export const DRIFT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".rs",
  ".move",
]);

/** Legacy canonical-literal scan extensions (TS/JS only — keeps pre-drift behavior identical). */
export const CANONICAL_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
