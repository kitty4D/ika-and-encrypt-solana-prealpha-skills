#!/usr/bin/env node
/**
 * OS-agnostic audit helper for ika-solana-prealpha skill consumers.
 * From skill folder: node scripts/audit-ika-solana-prealpha.mjs [--force] [--no-drift] [--drift=strict] [--root=DIR]
 * From skill-package repo root (contains skills/ika-solana-prealpha/): node skills/ika-solana-prealpha/scripts/audit-ika-solana-prealpha.mjs [...]
 *
 * Exit: 0 ok, 2 docs/ drift on main vs tracked commit (unless --force),
 *       3 if --drift=strict and any `critical` skill-vs-codebase finding,
 *       1 fatal / network.
 *
 * Also compares @ika.xyz/pre-alpha-solana-client and @solana/kit (when listed in
 * package.json) against npm `latest` if a lockfile yields a concrete semver.
 *
 * Extended output: unless --no-drift, a "drift: skill-vs-codebase" block lists places
 * where the skill's current knowledge suggests the user's codebase should change, with
 * ready-to-paste prompts for the skill to fix them.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { parseTrackedCommit } from "./lib/docs-revision.mjs";
import { parseSkillCanonical } from "./lib/canonical.mjs";
import { httpsJsonDefault } from "./lib/http.mjs";
import {
  walkFiles,
  DEFAULT_SKIP,
  CANONICAL_EXT,
  isSkillBundleRoot,
  SKILL_BUNDLE_SELF_SKIPS,
} from "./lib/walker.mjs";
import { semverCompare, isNonRegistrySpec } from "./lib/semver.mjs";
import { resolveLockedVersion } from "./lib/lockfiles.mjs";
import {
  scanProjectForDrift,
  formatDriftReport,
  readStateFile,
  writeStateFile,
  computeNewSinceLastSync,
} from "./lib/drift.mjs";
import { rules as DRIFT_RULES } from "../references/drift-rules.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Parent of `scripts/` — the `ika-solana-prealpha` skill directory */
const SKILL_ROOT = path.resolve(__dirname, "..");
const DOCS_REVISION = path.join(SKILL_ROOT, "references", "docs-revision.md");
const SKILL_MD = path.join(SKILL_ROOT, "SKILL.md");

const UPSTREAM_REPO = "dwallet-labs/ika-pre-alpha";
const NPM_PACKAGES = ["@ika.xyz/pre-alpha-solana-client", "@solana/kit"];

const httpsJson = httpsJsonDefault("ika-solana-prealpha-audit-script");

function parseArgs(argv) {
  let force = false;
  let root = process.cwd();
  let drift = "on"; // on | off | strict
  for (const a of argv) {
    if (a === "--force") force = true;
    else if (a === "--no-drift") drift = "off";
    else if (a === "--drift=strict") drift = "strict";
    else if (a.startsWith("--root=")) root = path.resolve(a.slice(7));
  }
  return { force, root, drift };
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

async function docsDriftSince(tracked) {
  const url = `https://api.github.com/repos/${UPSTREAM_REPO}/compare/${tracked}...main`;
  const data = await httpsJson(url, { Accept: "application/vnd.github+json" });
  const files = Array.isArray(data.files) ? data.files : [];
  const docsFiles = files.filter((f) => f.filename && f.filename.startsWith("docs/"));
  return {
    compareHtml: data.html_url || `https://github.com/${UPSTREAM_REPO}/compare/${tracked}...main`,
    status: data.status,
    aheadBy: data.ahead_by,
    behindBy: data.behind_by,
    docsFileCount: docsFiles.length,
    docsSample: docsFiles.slice(0, 8).map((f) => f.filename),
  };
}

async function npmLatest(pkgName, cache) {
  if (cache.has(pkgName)) return cache.get(pkgName);
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`;
  try {
    const data = await httpsJson(url, { Accept: "application/json" });
    const v = data.version ? String(data.version) : null;
    cache.set(pkgName, v);
    return v;
  } catch {
    cache.set(pkgName, null);
    return null;
  }
}

async function printNpmSdkOutdated(depRows) {
  const cache = new Map();
  console.log("--- npm registry vs lockfile (SDK age) ---");
  let any = false;
  let outdatedCount = 0;
  let noResolvedLock = 0;
  for (const row of depRows) {
    const dir = path.resolve(row.dir);
    for (const pkgName of NPM_PACKAGES) {
      const specKey = pkgName === "@ika.xyz/pre-alpha-solana-client" ? "ikaSpec" : "kitSpec";
      const hasKey = pkgName === "@ika.xyz/pre-alpha-solana-client" ? "ika" : "kit";
      if (!row[hasKey]) continue;
      any = true;
      const spec = row[specKey];
      const relPkg = row.file;
      if (isNonRegistrySpec(spec)) {
        console.log(`${relPkg} ${pkgName}: spec "${spec}" — skip registry compare (not a plain semver range)`);
        continue;
      }
      const locked = resolveLockedVersion(dir, pkgName);
      if (!locked) {
        noResolvedLock++;
        console.log(
          `${relPkg} ${pkgName}: package.json range "${spec}" — no resolved version found in package-lock / pnpm-lock / yarn.lock next to this manifest (run install or point --root at the package with the lockfile)`,
        );
        continue;
      }
      const latest = await npmLatest(pkgName, cache);
      if (!latest) {
        console.log(`${relPkg} ${pkgName}: locked ${locked.version} (${locked.source}) — could not fetch npm latest (offline or registry error)`);
        continue;
      }
      const cmp = semverCompare(locked.version, latest);
      const note = locked.note ? ` — ${locked.note}` : "";
      if (cmp < 0) {
        outdatedCount++;
        console.log(`${relPkg} ${pkgName}: OUTDATED locked ${locked.version} < npm latest ${latest} (${locked.source})${note}`);
      } else if (cmp > 0) {
        console.log(`${relPkg} ${pkgName}: locked ${locked.version} newer than npm latest ${latest} (pre-release or dist-tag skew; ${locked.source})${note}`);
      } else {
        console.log(`${relPkg} ${pkgName}: locked ${locked.version} matches npm latest ${latest} (${locked.source})${note}`);
      }
    }
  }
  if (!any) {
    console.log("(no package.json with @ika.xyz/pre-alpha-solana-client or @solana/kit under scan root)");
  }
  console.log("");
  return { any, outdatedCount, noResolvedLock };
}

function printFollowUpActions(opts) {
  const {
    blockedByStaleDocs,
    stale,
    usedForce,
    compareUrl,
    mismatchCount,
    npmOutdated,
    npmNoLock,
    hasPackageJsonUnderRoot,
    driftCriticalCount,
    driftHighCount,
  } = opts;
  console.log("--- follow-up (optional — you choose) ---");
  const lines = [];
  if (blockedByStaleDocs) {
    lines.push(`Bump skill [\`docs-revision.md\`] to ika-pre-alpha \`main\` and refresh references, then re-run this script until \`docs/ vs main: fresh\`. Compare: ${compareUrl}`);
    lines.push("Or use audit-force / `--force` only after you accept that book-derived skill text may be wrong for current `docs/`.");
    lines.push("Project scan did not run — re-run without stale (or with `--force`) to get SDK + canonical checks.");
    for (let i = 0; i < lines.length; i++) console.log(`${i + 1}. ${lines[i]}`);
    console.log("");
    return;
  }
  if (stale) {
    lines.push(`Refresh skill: bump docs-revision.md to match ika-pre-alpha main (see compare) or pause using this skill until updated — ${compareUrl}`);
  }
  if (stale && usedForce) {
    lines.push("You used --force while docs/ was stale: re-check flows against the live book; skill prose may lag.");
  }
  if (mismatchCount > 0) {
    lines.push(`Fix ${mismatchCount} canonical literal issue(s) above (ika gRPC URL or full program id vs SKILL.md).`);
  }
  if (driftCriticalCount > 0) {
    lines.push(`Address ${driftCriticalCount} CRITICAL drift finding(s) above — paste the \`fix:\` prompt(s) back to the skill.`);
  }
  if (driftHighCount > 0) {
    lines.push(`Triage ${driftHighCount} HIGH drift finding(s) above.`);
  }
  if (npmOutdated > 0) {
    lines.push(`Review ${npmOutdated} OUTDATED SDK line(s): consider upgrading @ika.xyz/pre-alpha-solana-client / @solana/kit after release notes.`);
  }
  if (npmNoLock > 0) {
    lines.push(`${npmNoLock} manifest(s) had no lockfile-resolved version: run install or pass --root to the app with package-lock / pnpm-lock / yarn.lock.`);
  }
  if (hasPackageJsonUnderRoot && npmOutdated === 0 && npmNoLock === 0) {
    lines.push("SDK pins match npm latest (or were skipped): still verify behavior against devnet.");
  }
  lines.push("Manual pass: trace Sign / MessageApproval / VersionedDWalletDataAttestation per flows.md + grpc-api.md + account-layouts.md; cite file:line.");
  lines.push("If you changed code: run tests and a small devnet smoke check.");
  for (let i = 0; i < lines.length; i++) console.log(`${i + 1}. ${lines[i]}`);
  console.log("");
}

function isSelfExcluded(filePath, isBundleSelf) {
  if (!isBundleSelf) return false;
  const normalized = filePath.replace(/\\/g, "/");
  return SKILL_BUNDLE_SELF_SKIPS.some((s) => normalized.includes(s));
}

function scanProject(root, canonical, isBundleSelf) {
  const pkgPaths = [];
  for (const f of walkFiles(root, 6, DEFAULT_SKIP)) {
    if (isSelfExcluded(f, isBundleSelf)) continue;
    if (path.basename(f) === "package.json") pkgPaths.push(f);
  }

  const depReport = [];
  for (const pj of pkgPaths) {
    let j;
    try {
      j = JSON.parse(readText(pj));
    } catch {
      continue;
    }
    const deps = { ...j.dependencies, ...j.devDependencies, ...j.peerDependencies };
    depReport.push({
      file: path.relative(root, pj),
      dir: path.dirname(pj),
      ika: Boolean(deps["@ika.xyz/pre-alpha-solana-client"]),
      ikaSpec: deps["@ika.xyz/pre-alpha-solana-client"] ?? null,
      kit: Boolean(deps["@solana/kit"]),
      kitSpec: deps["@solana/kit"] ?? null,
    });
  }

  const mismatches = [];
  for (const f of walkFiles(root, 8, DEFAULT_SKIP)) {
    if (isSelfExcluded(f, isBundleSelf)) continue;
    if (path.basename(f) === "audit-ika-solana-prealpha.mjs") continue;
    const ext = path.extname(f);
    if (!CANONICAL_EXT.has(ext)) continue;
    let text;
    try {
      text = readText(f);
    } catch {
      continue;
    }
    const rel = path.relative(root, f);
    if (/ika\.ika-network|ika-network\.net|pre-alpha.*ika/i.test(text)) {
      if (!text.includes(canonical.grpc)) {
        mismatches.push({ rel, kind: "mentions ika gRPC host but not the canonical URL from SKILL.md" });
      }
    }
    if (text.includes("87W54kGYFQ") && !text.includes(canonical.programId)) {
      mismatches.push({ rel, kind: "contains 87W54kGYFQ… fragment but not full canonical program id string" });
    }
  }

  return { depReport, mismatches: dedupeMismatches(mismatches) };
}

function dedupeMismatches(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = `${x.rel}|${x.kind}|${x.literal || ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out.slice(0, 50);
}

async function main() {
  const { force, root, drift: driftMode } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(DOCS_REVISION)) {
    console.error("Missing docs-revision.md at", DOCS_REVISION);
    process.exit(1);
  }
  if (!fs.existsSync(SKILL_MD)) {
    console.error("Missing SKILL.md at", SKILL_MD);
    process.exit(1);
  }

  const docsMd = readText(DOCS_REVISION);
  const tracked = parseTrackedCommit(docsMd);
  const canonical = parseSkillCanonical(readText(SKILL_MD));

  console.log("ika-solana-prealpha audit");
  console.log("tracked docs commit:", tracked);
  console.log("scan root:", root);
  console.log("canonical (from SKILL.md): program", canonical.programId);
  console.log("canonical gRPC:", canonical.grpc);
  console.log("drift mode:", driftMode);
  console.log("");

  let ghDrift = null;
  try {
    ghDrift = await docsDriftSince(tracked);
  } catch (e) {
    console.error("GitHub compare failed:", e.message);
    process.exit(1);
  }

  const stale = ghDrift.docsFileCount > 0;
  console.log("docs/ vs main:", stale ? "STALE (files under docs/ changed)" : "fresh (no docs/ diffs in compare)");
  console.log("compare:", ghDrift.compareHtml);
  if (stale && ghDrift.docsSample.length) {
    console.log("sample docs paths:", ghDrift.docsSample.join(", "));
  }
  console.log("");

  if (stale && !force) {
    console.error("Blocked: update docs-revision / skill or re-run with --force (audit-force mode).");
    console.error("");
    printFollowUpActions({
      blockedByStaleDocs: true,
      stale: true,
      usedForce: false,
      compareUrl: ghDrift.compareHtml,
      mismatchCount: 0,
      npmOutdated: 0,
      npmNoLock: 0,
      hasPackageJsonUnderRoot: false,
      driftCriticalCount: 0,
      driftHighCount: 0,
    });
    process.exit(2);
  }
  if (stale && force) {
    console.warn("WARNING: skill docs pin is behind ika-pre-alpha main for docs/; results may not match current book.");
    console.warn("");
  }

  if (!fs.existsSync(root)) {
    console.error("scan root does not exist:", root);
    process.exit(1);
  }

  const isBundleSelf = isSkillBundleRoot(root, "ika-solana-prealpha");
  if (isBundleSelf) {
    console.log(
      "(scan root looks like the ika skill bundle itself - excluding tests/fixtures/ and drift-rules.mjs from literal/drift scans)",
    );
    console.log("");
  }

  const { depReport, mismatches } = scanProject(root, canonical, isBundleSelf);
  console.log("--- package.json dependency hints ---");
  if (!depReport.length) {
    console.log("(no package.json found under scan root)");
  } else {
    for (const r of depReport) {
      console.log(`${r.file}: @ika.xyz/pre-alpha-solana-client=${r.ika} @solana/kit=${r.kit}`);
    }
  }
  console.log("");
  const npmStats = await printNpmSdkOutdated(depReport);
  console.log("--- canonical literal heuristics (best-effort) ---");
  if (!mismatches.length) {
    console.log("(no mismatches flagged; still do manual flow/grpc/account review)");
  } else {
    for (const m of mismatches) {
      console.log(`${m.rel}: ${m.kind}${m.literal ? ` (${m.literal})` : ""}`);
    }
  }
  console.log("");

  // --- Skill-vs-codebase drift (default-on) ---
  let driftCriticalCount = 0;
  let driftHighCount = 0;
  if (driftMode !== "off") {
    const stateFilePath = path.join(root, ".skill-audit.json");
    const seenIds = readStateFile(stateFilePath);
    const findings = scanProjectForDrift({
      root,
      rules: DRIFT_RULES,
      skipBasenames: new Set(["audit-ika-solana-prealpha.mjs", "drift-rules.mjs"]),
      skipPathContains: isBundleSelf ? SKILL_BUNDLE_SELF_SKIPS : [],
    });
    const newIds = computeNewSinceLastSync(findings, seenIds);
    for (const line of formatDriftReport(findings, { newIds, stateFile: ".skill-audit.json" })) {
      console.log(line);
    }
    writeStateFile(stateFilePath, findings, { tracked });
    for (const f of findings) {
      if (f.severity === "critical") driftCriticalCount++;
      else if (f.severity === "high") driftHighCount++;
    }
  }

  printFollowUpActions({
    blockedByStaleDocs: false,
    stale,
    usedForce: Boolean(stale && force),
    compareUrl: ghDrift.compareHtml,
    mismatchCount: mismatches.length,
    npmOutdated: npmStats.outdatedCount,
    npmNoLock: npmStats.noResolvedLock,
    hasPackageJsonUnderRoot: depReport.length > 0,
    driftCriticalCount,
    driftHighCount,
  });

  if (driftMode === "strict" && driftCriticalCount > 0) {
    console.log(`Done. Exit 3 (drift=strict + ${driftCriticalCount} critical finding(s)).`);
    process.exit(3);
  }
  console.log("Done. Exit 0.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
