/**
 * Drift-rule engine. Loads a catalog of rules from `references/drift-rules.mjs` and
 * scans a project tree for matches.
 *
 * Rule shape:
 *   {
 *     id: "enc-vec-is-equal-scalar",
 *     since: "2026-04-01",
 *     severity: "critical" | "high" | "medium" | "low",
 *     category: "silent-bug" | "deprecated" | "missing-feature" | "canonical" | "idiom",
 *     title: "short human-readable title",
 *     appliesTo: [RegExp, ...],          // file-path regexes (at least one must match)
 *     detect: (text, filePath) => boolean | number[],  // true or array of 1-based line numbers
 *     evidence: "gotchas.md:33-47",     // skill file:line citation (source of truth)
 *     fixPrompt: "Ask the skill: ...<LIST>",  // <LIST> is replaced with the matched files
 *   }
 */

import fs from "fs";
import path from "path";
import { walkFiles, DEFAULT_SKIP, DRIFT_EXT } from "./walker.mjs";

export const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

export function sortFindingsBySeverity(findings) {
  const idx = Object.fromEntries(SEVERITY_ORDER.map((s, i) => [s, i]));
  return [...findings].sort((a, b) => {
    const sa = idx[a.severity] ?? 99;
    const sb = idx[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return a.file < b.file ? -1 : 1;
  });
}

/** Apply one rule to one file's text. Returns null or a finding. */
export function applyRule(rule, filePath, text, { relPath } = {}) {
  if (rule.appliesTo && rule.appliesTo.length) {
    const hit = rule.appliesTo.some((re) => re.test(filePath));
    if (!hit) return null;
  }
  let match;
  try {
    match = rule.detect(text, filePath);
  } catch {
    return null;
  }
  if (!match) return null;
  if (Array.isArray(match) && match.length === 0) return null;
  const lines = Array.isArray(match) ? match : [];
  return {
    id: rule.id,
    severity: rule.severity,
    category: rule.category,
    title: rule.title,
    file: relPath || filePath,
    lines,
    evidence: rule.evidence,
    fixPrompt: rule.fixPrompt,
    since: rule.since,
  };
}

/** Scan a project root against a list of rules. Deterministic, returns sorted findings. */
export function scanProjectForDrift({
  root,
  rules,
  maxDepth = 8,
  skipNames = DEFAULT_SKIP,
  extensions = DRIFT_EXT,
  readFile = (p) => fs.readFileSync(p, "utf8"),
  skipBasenames = new Set(),
  skipPathContains = [],
}) {
  const findings = [];
  for (const f of walkFiles(root, maxDepth, skipNames)) {
    if (skipBasenames.has(path.basename(f))) continue;
    const normalized = f.replace(/\\/g, "/");
    if (skipPathContains.some((s) => normalized.includes(s))) continue;
    const ext = path.extname(f);
    if (!extensions.has(ext)) continue;
    let text;
    try {
      text = readFile(f);
    } catch {
      continue;
    }
    const rel = path.relative(root, f).replace(/\\/g, "/");
    for (const rule of rules) {
      const finding = applyRule(rule, f, text, { relPath: rel });
      if (finding) findings.push(finding);
    }
  }
  return sortFindingsBySeverity(findings);
}

/** Format findings for human reading. Returns an array of lines; caller prints. */
export function formatDriftReport(findings, { newIds = null, stateFile = null } = {}) {
  const out = [];
  out.push("--- drift: skill-vs-codebase ---");
  if (!findings.length) {
    out.push("(no findings — skill knowledge aligns with your code as scanned)");
    out.push("--- end drift ---");
    out.push("");
    return out;
  }
  const byBucket = new Map();
  for (const f of findings) {
    if (!byBucket.has(f.severity)) byBucket.set(f.severity, []);
    byBucket.get(f.severity).push(f);
  }
  for (const sev of SEVERITY_ORDER) {
    const list = byBucket.get(sev);
    if (!list || !list.length) continue;
    out.push(`${sev} (${list.length}):`);
    const byId = new Map();
    for (const f of list) {
      if (!byId.has(f.id)) byId.set(f.id, { rule: f, files: [] });
      byId.get(f.id).files.push(f);
    }
    for (const [id, group] of byId) {
      out.push(`  [${id}] ${group.rule.title}`);
      for (const f of group.files) {
        const linesText = f.lines && f.lines.length ? `:${f.lines.slice(0, 5).join(",")}` : "";
        out.push(`    - ${f.file}${linesText}`);
      }
      out.push(`    skill says: ${group.rule.evidence}`);
      const fileList = group.files.map((f) => f.file).join(", ");
      const fixText = group.rule.fixPrompt.replace("<LIST>", fileList);
      out.push(`    fix: ${fixText}`);
    }
  }
  if (newIds && newIds.size) {
    out.push("");
    out.push(`NEW since your last sync (per ${stateFile || ".skill-audit.json"}):`);
    for (const id of newIds) out.push(`  [${id}]`);
  }
  out.push("");
  out.push("how to use this list:");
  out.push("  1. read a finding.");
  out.push('  2. copy the `fix:` line back to the skill: /<skill> audit-fix <id>');
  out.push("  3. the skill will confirm before touching any code.");
  out.push("--- end drift ---");
  out.push("");
  return out;
}

/** Read/write the .skill-audit.json state file. Returns the set of seen rule ids. */
export function readStateFile(p) {
  try {
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw);
    return new Set(j.seenRuleIds || []);
  } catch {
    return new Set();
  }
}

export function writeStateFile(p, findings, extra = {}) {
  const seen = [...new Set(findings.map((f) => f.id))].sort();
  const body = {
    version: 1,
    seenRuleIds: seen,
    lastRun: new Date().toISOString(),
    ...extra,
  };
  try {
    fs.writeFileSync(p, JSON.stringify(body, null, 2));
  } catch {
    /* state-file writes are best-effort */
  }
}

export function computeNewSinceLastSync(findings, seenIds) {
  const currentIds = new Set(findings.map((f) => f.id));
  const newIds = new Set();
  for (const id of currentIds) if (!seenIds.has(id)) newIds.add(id);
  return newIds;
}
