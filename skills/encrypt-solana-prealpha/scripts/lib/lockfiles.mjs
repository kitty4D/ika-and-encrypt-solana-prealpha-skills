/**
 * Lockfile parsers for package-lock.json, pnpm-lock.yaml, yarn.lock.
 * Extracted so the audit script's lockfile logic can be tested against fixture lockfiles.
 * Walks up from `packageJsonDir` to support monorepo root lockfiles.
 */

import fs from "fs";
import path from "path";
import { maxSemver } from "./semver.mjs";

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

export function pnpmVersionsInLock(text, depName) {
  const esc = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /* pnpm keys look like `  '@scope/pkg@0.1.0':` — version ends before the closing quote, not before `:`. */
  const re = new RegExp(`^\\s*['"]${esc}@([^'":\\s]+)(?=['"]|:)`, "gm");
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].split("(")[0].trim();
    if (/^\d/.test(raw)) out.push(raw);
  }
  return [...new Set(out)];
}

/** @returns {{ version: string, source: string, note?: string } | null} */
export function resolveLockedVersionInDir(packageDir, depName, { readFile = readText, existsSync = fs.existsSync } = {}) {
  const lockPath = path.join(packageDir, "package-lock.json");
  if (existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readFile(lockPath));
      const key = `node_modules/${depName}`;
      const pkg = lock.packages?.[key];
      if (pkg?.version) return { version: String(pkg.version), source: "package-lock.json" };
      if (lock.dependencies?.[depName]?.version) {
        return {
          version: String(lock.dependencies[depName].version),
          source: "package-lock.json (dependencies)",
        };
      }
      if (lock.packages) {
        for (const k of Object.keys(lock.packages)) {
          if (k === key || k.endsWith(`/node_modules/${depName}`)) {
            const v = lock.packages[k]?.version;
            if (v) return { version: String(v), source: "package-lock.json" };
          }
        }
      }
    } catch {
      /* ignore malformed lockfile */
    }
  }

  const pnpmPath = path.join(packageDir, "pnpm-lock.yaml");
  if (existsSync(pnpmPath)) {
    const text = readFile(pnpmPath);
    const vers = pnpmVersionsInLock(text, depName);
    if (vers.length === 1) return { version: vers[0], source: "pnpm-lock.yaml" };
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
  if (existsSync(yarnPath)) {
    const text = readFile(yarnPath);
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

/** Walk up from package.json dir to find a workspace / monorepo lockfile. */
export function resolveLockedVersion(packageJsonDir, depName, opts) {
  let dir = path.resolve(packageJsonDir);
  for (let depth = 0; depth < 8; depth++) {
    const hit = resolveLockedVersionInDir(dir, depName, opts);
    if (hit) {
      const rel = path.relative(packageJsonDir, dir);
      const suffix = rel && rel !== "." ? ` (lockfile in ${rel.replace(/\\/g, "/")})` : "";
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
