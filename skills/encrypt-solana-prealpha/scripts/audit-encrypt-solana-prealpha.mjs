#!/usr/bin/env node
/**
 * OS-agnostic audit helper for encrypt-solana-prealpha skill consumers.
 * From skill folder: node scripts/audit-encrypt-solana-prealpha.mjs [--force] [--root=DIR]
 * From skill-package repo root (contains skills/encrypt-solana-prealpha/): node skills/encrypt-solana-prealpha/scripts/audit-encrypt-solana-prealpha.mjs [...]
 *
 * Exit: 0 ok, 2 docs/ drift on main vs tracked commit (unless --force), 1 fatal / network.
 *
 * Also compares @encrypt.xyz/pre-alpha-solana-client and @solana/kit (when listed in
 * package.json) against npm `latest` if a lockfile yields a concrete semver.
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Parent of `scripts/` — the `encrypt-solana-prealpha` skill directory */
const SKILL_ROOT = path.resolve(__dirname, "..");
const DOCS_REVISION = path.join(SKILL_ROOT, "references", "docs-revision.md");
const SKILL_MD = path.join(SKILL_ROOT, "SKILL.md");

const UPSTREAM_REPO = "dwallet-labs/encrypt-pre-alpha";

function parseArgs(argv) {
  let force = false;
  let root = process.cwd();
  for (const a of argv) {
    if (a === "--force") force = true;
    else if (a.startsWith("--root=")) root = path.resolve(a.slice(7));
  }
  return { force, root };
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function parseTrackedCommit(md) {
  const norm = md.replace(/\r\n/g, "\n");
  const m = norm.match(/\|\s*commit \(full\)\s*\|\s*`([a-f0-9]{40})`/i);
  if (!m) throw new Error("Could not find tracked commit (full) in docs-revision.md");
  return m[1].toLowerCase();
}

function parseSkillCanonical(skillMd) {
  const norm = skillMd.replace(/\r\n/g, "\n");
  const grpc = norm.match(/\|\s*Encrypt gRPC \(TLS\)\s*\|\s*`([^`]+)`/);
  const rpc = norm.match(/\|\s*Solana RPC\s*\|\s*`([^`]+)`/);
  const pid = norm.match(/\|\s*Encrypt program id\s*\|\s*`([^`]+)`/);
  if (!grpc || !rpc || !pid) {
    throw new Error("Could not parse environment table from SKILL.md");
  }
  return {
    grpc: grpc[1],
    rpc: rpc[1],
    programId: pid[1],
  };
}

function httpsJson(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "encrypt-solana-prealpha-audit-script",
          ...extraHeaders,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(`HTTP ${res.statusCode} for ${url}: ${body.slice(0, 400)}`),
            );
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(25_000, () => {
      req.destroy(new Error("Request timeout"));
    });
  });
}

async function docsDriftSince(tracked) {
  const url = `https://api.github.com/repos/${UPSTREAM_REPO}/compare/${tracked}...main`;
  const data = await httpsJson(url, {
    Accept: "application/vnd.github+json",
  });
  const files = Array.isArray(data.files) ? data.files : [];
  const docsFiles = files.filter((f) => f.filename && f.filename.startsWith("docs/"));
  return {
    compareHtml:
      data.html_url || `https://github.com/${UPSTREAM_REPO}/compare/${tracked}...main`,
    status: data.status,
    aheadBy: data.ahead_by,
    behindBy: data.behind_by,
    docsFileCount: docsFiles.length,
    docsSample: docsFiles.slice(0, 8).map((f) => f.filename),
  };
}

function* walkFiles(dir, maxDepth, depth, skipNames) {
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
    if (ent.isDirectory()) yield* walkFiles(full, maxDepth, depth + 1, skipNames);
    else if (ent.isFile()) yield full;
  }
}

const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const NPM_PACKAGES = [
  "@encrypt.xyz/pre-alpha-solana-client",
  "@solana/kit",
];

function isNonRegistrySpec(spec) {
  if (!spec || typeof spec !== "string") return true;
  const s = spec.trim();
  return (
    s.startsWith("workspace:") ||
    s.startsWith("file:") ||
    s.startsWith("link:") ||
    s.startsWith("git+") ||
    s.startsWith("http:") ||
    s.startsWith("https:") ||
    s === "*"
  );
}

function semverParts(v) {
  const s = String(v)
    .replace(/^v/i, "")
    .trim();
  const dash = s.indexOf("-");
  const main = dash >= 0 ? s.slice(0, dash) : s;
  const pre = dash >= 0 ? s.slice(dash + 1) : "";
  const nums = main.split(".").map((x) => {
    const n = parseInt(String(x).replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  });
  while (nums.length < 3) nums.push(0);
  return { nums: nums.slice(0, 3), pre };
}

/** negative if a < b, 0 if equal, positive if a > b */
function semverCompare(a, b) {
  const A = semverParts(a);
  const B = semverParts(b);
  for (let i = 0; i < 3; i++) {
    if (A.nums[i] !== B.nums[i]) return A.nums[i] - B.nums[i];
  }
  if (!A.pre && B.pre) return 1;
  if (A.pre && !B.pre) return -1;
  if (!A.pre && !B.pre) return 0;
  return A.pre < B.pre ? -1 : A.pre > B.pre ? 1 : 0;
}

function pnpmVersionsInLock(text, depName) {
  const esc = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `^\\s*['"]${esc}@([^'":\\s]+)(?=['"]|:)`,
    "gm",
  );
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].split("(")[0].trim();
    if (/^\d/.test(raw)) out.push(raw);
  }
  return [...new Set(out)];
}

function maxSemver(versions) {
  if (!versions.length) return null;
  let best = versions[0];
  for (let i = 1; i < versions.length; i++) {
    if (semverCompare(versions[i], best) > 0) best = versions[i];
  }
  return best;
}

/** @returns {{ version: string, source: string, note?: string } | null} */
function resolveLockedVersionInDir(packageDir, depName) {
  const lockPath = path.join(packageDir, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readText(lockPath));
      const key = `node_modules/${depName}`;
      const pkg = lock.packages?.[key];
      if (pkg?.version)
        return { version: String(pkg.version), source: "package-lock.json" };
      if (lock.dependencies?.[depName]?.version)
        return {
          version: String(lock.dependencies[depName].version),
          source: "package-lock.json (dependencies)",
        };
      if (lock.packages) {
        for (const k of Object.keys(lock.packages)) {
          if (k === key || k.endsWith(`/node_modules/${depName}`)) {
            const v = lock.packages[k]?.version;
            if (v) return { version: String(v), source: "package-lock.json" };
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const pnpmPath = path.join(packageDir, "pnpm-lock.yaml");
  if (fs.existsSync(pnpmPath)) {
    const text = readText(pnpmPath);
    const vers = pnpmVersionsInLock(text, depName);
    if (vers.length === 1)
      return { version: vers[0], source: "pnpm-lock.yaml" };
    if (vers.length > 1) {
      const best = maxSemver(vers);
      return {
        version: best,
        source: "pnpm-lock.yaml",
        note: `multiple locked entries (${vers.join(", ")}); using ${best} for compare`,
      };
    }
  }

  const yarnPath = path.join(packageDir, "yarn.lock");
  if (fs.existsSync(yarnPath)) {
    const text = readText(yarnPath);
    const esc = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `"${esc}@[^"]+":\\s*\\r?\\n(?:[^\\r\\n]*\\r?\\n)*?\\s+version\\s+"([^"]+)"`,
      "m",
    );
    const m = text.match(re);
    if (m?.[1]) return { version: m[1], source: "yarn.lock" };
  }

  return null;
}

/** Walk up from package.json dir to find a workspace / monorepo lockfile */
function resolveLockedVersion(packageJsonDir, depName) {
  let dir = path.resolve(packageJsonDir);
  for (let depth = 0; depth < 8; depth++) {
    const hit = resolveLockedVersionInDir(dir, depName);
    if (hit) {
      const rel = path.relative(packageJsonDir, dir);
      const suffix =
        rel && rel !== "."
          ? ` (lockfile in ${rel.replace(/\\/g, "/")})`
          : "";
      return {
        version: hit.version,
        source: hit.source + suffix,
        note: hit.note,
      };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
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

/** @returns {{ any: boolean, outdatedCount: number, noResolvedLock: number }} */
async function printNpmSdkOutdated(depRows) {
  const cache = new Map();
  console.log("--- npm registry vs lockfile (SDK age) ---");
  let any = false;
  let outdatedCount = 0;
  let noResolvedLock = 0;
  for (const row of depRows) {
    const dir = path.resolve(row.dir);
    for (const pkgName of NPM_PACKAGES) {
      const specKey =
        pkgName === "@encrypt.xyz/pre-alpha-solana-client"
          ? "encryptSpec"
          : "kitSpec";
      const hasKey =
        pkgName === "@encrypt.xyz/pre-alpha-solana-client" ? "encrypt" : "kit";
      if (!row[hasKey]) continue;
      any = true;
      const spec = row[specKey];
      const relPkg = row.file;
      if (isNonRegistrySpec(spec)) {
        console.log(
          `${relPkg} ${pkgName}: spec "${spec}" — skip registry compare (not a plain semver range)`,
        );
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
        console.log(
          `${relPkg} ${pkgName}: locked ${locked.version} (${locked.source}) — could not fetch npm latest (offline or registry error)`,
        );
        continue;
      }
      const cmp = semverCompare(locked.version, latest);
      const note = locked.note ? ` — ${locked.note}` : "";
      if (cmp < 0) {
        outdatedCount++;
        console.log(
          `${relPkg} ${pkgName}: OUTDATED locked ${locked.version} < npm latest ${latest} (${locked.source})${note}`,
        );
      } else if (cmp > 0) {
        console.log(
          `${relPkg} ${pkgName}: locked ${locked.version} newer than npm latest ${latest} (pre-release or dist-tag skew; ${locked.source})${note}`,
        );
      } else {
        console.log(
          `${relPkg} ${pkgName}: locked ${locked.version} matches npm latest ${latest} (${locked.source})${note}`,
        );
      }
    }
  }
  if (!any) {
    console.log(
      "(no package.json with @encrypt.xyz/pre-alpha-solana-client or @solana/kit under scan root)",
    );
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
  } = opts;
  console.log("--- follow-up (optional — you choose) ---");
  const lines = [];
  if (blockedByStaleDocs) {
    lines.push(
      `Bump skill [\`docs-revision.md\`] to encrypt-pre-alpha \`main\` and refresh references, then re-run this script until \`docs/ vs main: fresh\`. Compare: ${compareUrl}`,
    );
    lines.push(
      "Or use audit-force / `--force` only after you accept that book-derived skill text may be wrong for current `docs/`.",
    );
    lines.push(
      "Project scan did not run — re-run without stale (or with `--force`) to get SDK + canonical checks.",
    );
    for (let i = 0; i < lines.length; i++) {
      console.log(`${i + 1}. ${lines[i]}`);
    }
    console.log("");
    return;
  }
  if (stale) {
    lines.push(
      `Refresh skill: bump docs-revision.md to match encrypt-pre-alpha main (see compare) or pause using this skill until updated — ${compareUrl}`,
    );
  }
  if (stale && usedForce) {
    lines.push(
      "You used --force while docs/ was stale: re-check flows against the live book; skill prose may lag.",
    );
  }
  if (mismatchCount > 0) {
    lines.push(
      `Fix ${mismatchCount} canonical literal issue(s) above (Encrypt gRPC URL or full program id vs SKILL.md).`,
    );
  }
  if (npmOutdated > 0) {
    lines.push(
      `Review ${npmOutdated} OUTDATED SDK line(s): consider upgrading @encrypt.xyz/pre-alpha-solana-client / @solana/kit after release notes.`,
    );
  }
  if (npmNoLock > 0) {
    lines.push(
      `${npmNoLock} manifest(s) had no lockfile-resolved version: run install or pass --root to the app with package-lock / pnpm-lock / yarn.lock.`,
    );
  }
  if (hasPackageJsonUnderRoot && npmOutdated === 0 && npmNoLock === 0) {
    lines.push(
      "SDK pins match npm latest (or were skipped): still verify behavior against devnet.",
    );
  }
  lines.push(
    "Manual pass: trace CreateInput / ReadCiphertext, execute_graph, fees & events per flows.md + grpc-api.md + gotchas.md; cite file:line.",
  );
  lines.push(
    "If you changed code: run tests and a small devnet smoke check.",
  );
  for (let i = 0; i < lines.length; i++) {
    console.log(`${i + 1}. ${lines[i]}`);
  }
  console.log("");
}

function scanProject(root, canonical) {
  const skip = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "target",
    "coverage",
  ]);
  const pkgPaths = [];
  for (const f of walkFiles(root, 6, 0, skip)) {
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
      encrypt: Boolean(deps["@encrypt.xyz/pre-alpha-solana-client"]),
      encryptSpec: deps["@encrypt.xyz/pre-alpha-solana-client"] ?? null,
      kit: Boolean(deps["@solana/kit"]),
      kitSpec: deps["@solana/kit"] ?? null,
    });
  }

  const mismatches = [];

  for (const f of walkFiles(root, 8, 0, skip)) {
    if (path.basename(f) === "audit-encrypt-solana-prealpha.mjs") continue;
    const ext = path.extname(f);
    if (!SCAN_EXT.has(ext)) continue;
    let text;
    try {
      text = readText(f);
    } catch {
      continue;
    }
    const rel = path.relative(root, f);
    if (/encrypt\.ika-network|pre-alpha-dev-1\.encrypt/i.test(text)) {
      if (!text.includes(canonical.grpc)) {
        mismatches.push({
          rel,
          kind: "mentions Encrypt gRPC host but not the canonical URL from SKILL.md",
        });
      }
    }
    if (text.includes("4ebfzWdKnrnGseuQ") && !text.includes(canonical.programId)) {
      mismatches.push({
        rel,
        kind: "contains 4ebfzWdKnrnGseuQ… fragment but not full canonical program id string",
      });
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
  const { force, root } = parseArgs(process.argv.slice(2));

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

  console.log("encrypt-solana-prealpha audit");
  console.log("tracked docs commit:", tracked);
  console.log("scan root:", root);
  console.log("canonical (from SKILL.md): program", canonical.programId);
  console.log("canonical gRPC:", canonical.grpc);
  console.log("");

  let drift = null;
  try {
    drift = await docsDriftSince(tracked);
  } catch (e) {
    console.error("GitHub compare failed:", e.message);
    process.exit(1);
  }

  const stale = drift.docsFileCount > 0;
  console.log("docs/ vs main:", stale ? "STALE (files under docs/ changed)" : "fresh (no docs/ diffs in compare)");
  console.log("compare:", drift.compareHtml);
  if (stale && drift.docsSample.length) {
    console.log("sample docs paths:", drift.docsSample.join(", "));
  }
  console.log("");

  if (stale && !force) {
    console.error(
      "Blocked: update docs-revision / skill or re-run with --force (audit-force mode).",
    );
    console.error("");
    printFollowUpActions({
      blockedByStaleDocs: true,
      stale: true,
      usedForce: false,
      compareUrl: drift.compareHtml,
      mismatchCount: 0,
      npmOutdated: 0,
      npmNoLock: 0,
      hasPackageJsonUnderRoot: false,
    });
    process.exit(2);
  }
  if (stale && force) {
    console.warn(
      "WARNING: skill docs pin is behind encrypt-pre-alpha main for docs/; results may not match current book.",
    );
    console.warn("");
  }

  if (!fs.existsSync(root)) {
    console.error("scan root does not exist:", root);
    process.exit(1);
  }

  const { depReport, mismatches } = scanProject(root, canonical);
  console.log("--- package.json dependency hints ---");
  if (!depReport.length) {
    console.log("(no package.json found under scan root)");
  } else {
    for (const r of depReport) {
      console.log(
        `${r.file}: @encrypt.xyz/pre-alpha-solana-client=${r.encrypt} @solana/kit=${r.kit}`,
      );
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
  printFollowUpActions({
    blockedByStaleDocs: false,
    stale,
    usedForce: Boolean(stale && force),
    compareUrl: drift.compareHtml,
    mismatchCount: mismatches.length,
    npmOutdated: npmStats.outdatedCount,
    npmNoLock: npmStats.noResolvedLock,
    hasPackageJsonUnderRoot: depReport.length > 0,
  });
  console.log("Done. Exit 0.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
