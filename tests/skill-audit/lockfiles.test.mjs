import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  pnpmVersionsInLock,
  resolveLockedVersionInDir,
  resolveLockedVersion,
} from "../../skills/encrypt-solana-prealpha/scripts/lib/lockfiles.mjs";

test("pnpmVersionsInLock finds a single locked version", () => {
  const text = `packages:
  '@encrypt.xyz/pre-alpha-solana-client@0.3.1':
    resolution: {integrity: sha512-...}
`;
  assert.deepEqual(
    pnpmVersionsInLock(text, "@encrypt.xyz/pre-alpha-solana-client"),
    ["0.3.1"],
  );
});

test("pnpmVersionsInLock strips transitive peer markers in parens", () => {
  const text = `packages:
  '@encrypt.xyz/pre-alpha-solana-client@0.4.0(@solana/kit@2.0.0)':
    resolution: {integrity: sha512-...}
`;
  assert.deepEqual(
    pnpmVersionsInLock(text, "@encrypt.xyz/pre-alpha-solana-client"),
    ["0.4.0"],
  );
});

test("pnpmVersionsInLock dedupes and finds multiple versions", () => {
  const text = `packages:
  '@solana/kit@2.0.0':
    resolution: {}
  '@solana/kit@2.1.0':
    resolution: {}
  '@solana/kit@2.0.0(extra)':
    resolution: {}
`;
  const vers = pnpmVersionsInLock(text, "@solana/kit");
  assert.deepEqual([...vers].sort(), ["2.0.0", "2.1.0"]);
});

test("resolveLockedVersionInDir reads package-lock.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-audit-"));
  try {
    fs.writeFileSync(
      path.join(dir, "package-lock.json"),
      JSON.stringify({
        packages: {
          "node_modules/@encrypt.xyz/pre-alpha-solana-client": { version: "0.3.1" },
        },
      }),
    );
    const hit = resolveLockedVersionInDir(dir, "@encrypt.xyz/pre-alpha-solana-client");
    assert.equal(hit.version, "0.3.1");
    assert.equal(hit.source, "package-lock.json");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveLockedVersionInDir reads pnpm-lock.yaml with multiple versions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-audit-"));
  try {
    fs.writeFileSync(
      path.join(dir, "pnpm-lock.yaml"),
      `packages:
  '@solana/kit@2.0.0':
    resolution: {}
  '@solana/kit@2.1.0':
    resolution: {}
`,
    );
    const hit = resolveLockedVersionInDir(dir, "@solana/kit");
    assert.equal(hit.version, "2.1.0");
    assert.equal(hit.source, "pnpm-lock.yaml");
    assert.ok(hit.note?.includes("multiple"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveLockedVersionInDir reads yarn.lock", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-audit-"));
  try {
    fs.writeFileSync(
      path.join(dir, "yarn.lock"),
      `"@solana/kit@^2.0.0":
  version "2.0.0"
  resolved "https://registry.yarnpkg.com/..."
`,
    );
    const hit = resolveLockedVersionInDir(dir, "@solana/kit");
    assert.equal(hit.version, "2.0.0");
    assert.equal(hit.source, "yarn.lock");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveLockedVersionInDir returns null when nothing matches", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-audit-"));
  try {
    assert.equal(
      resolveLockedVersionInDir(dir, "@solana/kit"),
      null,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveLockedVersion walks up to a monorepo root lockfile", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-audit-"));
  try {
    const pkgDir = path.join(root, "apps", "web");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(root, "pnpm-lock.yaml"),
      `packages:
  '@solana/kit@2.0.0':
    resolution: {}
`,
    );
    const hit = resolveLockedVersion(pkgDir, "@solana/kit");
    assert.equal(hit.version, "2.0.0");
    assert.ok(hit.source.includes("lockfile in"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
