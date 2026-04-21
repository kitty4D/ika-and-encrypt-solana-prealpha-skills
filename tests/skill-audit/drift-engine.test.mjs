import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  SEVERITY_ORDER,
  sortFindingsBySeverity,
  applyRule,
  scanProjectForDrift,
  formatDriftReport,
  readStateFile,
  writeStateFile,
  computeNewSinceLastSync,
} from "../../skills/encrypt-solana-prealpha/scripts/lib/drift.mjs";

test("SEVERITY_ORDER is critical→high→medium→low", () => {
  assert.deepEqual(SEVERITY_ORDER, ["critical", "high", "medium", "low"]);
});

test("sortFindingsBySeverity orders by severity then id then file", () => {
  const findings = [
    { id: "z", severity: "low", file: "a.rs" },
    { id: "a", severity: "critical", file: "b.rs" },
    { id: "a", severity: "critical", file: "a.rs" },
    { id: "b", severity: "high", file: "a.rs" },
  ];
  const sorted = sortFindingsBySeverity(findings);
  assert.deepEqual(
    sorted.map((f) => `${f.severity}/${f.id}/${f.file}`),
    ["critical/a/a.rs", "critical/a/b.rs", "high/b/a.rs", "low/z/a.rs"],
  );
});

test("applyRule returns null when appliesTo does not match", () => {
  const rule = {
    id: "x",
    severity: "low",
    title: "t",
    appliesTo: [/\.rs$/],
    detect: () => [1],
    evidence: "e",
    fixPrompt: "f",
  };
  assert.equal(applyRule(rule, "foo.ts", "anything"), null);
});

test("applyRule returns null when detect returns false", () => {
  const rule = {
    id: "x",
    severity: "low",
    title: "t",
    appliesTo: [/\.rs$/],
    detect: () => false,
    evidence: "e",
    fixPrompt: "f",
  };
  assert.equal(applyRule(rule, "foo.rs", "anything"), null);
});

test("applyRule returns finding with lines when detect returns array", () => {
  const rule = {
    id: "x",
    severity: "critical",
    category: "silent-bug",
    title: "t",
    appliesTo: [/\.rs$/],
    detect: () => [3, 7],
    evidence: "e:1-2",
    fixPrompt: "fix <LIST>",
  };
  const f = applyRule(rule, "foo.rs", "x", { relPath: "src/foo.rs" });
  assert.equal(f.id, "x");
  assert.equal(f.severity, "critical");
  assert.equal(f.file, "src/foo.rs");
  assert.deepEqual(f.lines, [3, 7]);
  assert.equal(f.evidence, "e:1-2");
});

test("applyRule swallows exceptions thrown by detect", () => {
  const rule = {
    id: "x",
    severity: "low",
    title: "t",
    appliesTo: [/\.rs$/],
    detect: () => {
      throw new Error("boom");
    },
    evidence: "e",
    fixPrompt: "f",
  };
  assert.equal(applyRule(rule, "foo.rs", "x"), null);
});

test("scanProjectForDrift walks a real tree and applies rules", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drift-"));
  try {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "a.rs"), "bad pattern\nok\n");
    fs.writeFileSync(path.join(root, "src", "b.rs"), "ok\n");
    fs.writeFileSync(path.join(root, "ignore.txt"), "bad pattern");

    const rules = [
      {
        id: "bad",
        severity: "high",
        category: "silent-bug",
        title: "bad",
        appliesTo: [/\.rs$/],
        detect: (text) => {
          const lines = text.split("\n");
          const hits = [];
          for (let i = 0; i < lines.length; i++) {
            if (/bad pattern/.test(lines[i])) hits.push(i + 1);
          }
          return hits.length ? hits : false;
        },
        evidence: "e",
        fixPrompt: "fix <LIST>",
      },
    ];
    const findings = scanProjectForDrift({ root, rules });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].file, "src/a.rs");
    assert.deepEqual(findings[0].lines, [1]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scanProjectForDrift honors skipBasenames", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drift-"));
  try {
    fs.writeFileSync(path.join(root, "drift-rules.mjs"), "bad pattern");
    const rules = [
      {
        id: "bad",
        severity: "low",
        title: "bad",
        appliesTo: [/\.mjs$/],
        detect: () => [1],
        evidence: "e",
        fixPrompt: "f",
      },
    ];
    const findings = scanProjectForDrift({
      root,
      rules,
      skipBasenames: new Set(["drift-rules.mjs"]),
    });
    assert.equal(findings.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("formatDriftReport prints the clean-tree sentinel", () => {
  const lines = formatDriftReport([]);
  const out = lines.join("\n");
  assert.ok(out.includes("--- drift: skill-vs-codebase ---"));
  assert.ok(out.includes("no findings"));
  assert.ok(out.includes("--- end drift ---"));
});

test("formatDriftReport groups findings by severity and shows fix prompt with files", () => {
  const findings = [
    {
      id: "r1",
      severity: "critical",
      category: "silent-bug",
      title: "T1",
      file: "a.rs",
      lines: [3, 7],
      evidence: "foo.md:1-2",
      fixPrompt: "Apply r1 to <LIST>",
    },
    {
      id: "r1",
      severity: "critical",
      category: "silent-bug",
      title: "T1",
      file: "b.rs",
      lines: [],
      evidence: "foo.md:1-2",
      fixPrompt: "Apply r1 to <LIST>",
    },
  ];
  const out = formatDriftReport(findings).join("\n");
  assert.ok(out.includes("critical (2):"));
  assert.ok(out.includes("[r1] T1"));
  assert.ok(out.includes("a.rs:3,7"));
  assert.ok(out.includes("skill says: foo.md:1-2"));
  assert.ok(out.includes("Apply r1 to a.rs, b.rs"));
});

test("formatDriftReport emits NEW-since-last-sync block", () => {
  const findings = [
    {
      id: "rNew",
      severity: "medium",
      title: "T",
      file: "x.rs",
      lines: [1],
      evidence: "e",
      fixPrompt: "f <LIST>",
    },
  ];
  const out = formatDriftReport(findings, {
    newIds: new Set(["rNew"]),
    stateFile: ".skill-audit.json",
  }).join("\n");
  assert.ok(out.includes("NEW since your last sync"));
  assert.ok(out.includes("[rNew]"));
});

test("readStateFile returns an empty set when file missing", () => {
  const p = path.join(os.tmpdir(), "does-not-exist-" + Math.random() + ".json");
  const seen = readStateFile(p);
  assert.equal(seen.size, 0);
});

test("writeStateFile + readStateFile roundtrip the seen rule ids", () => {
  const p = path.join(
    os.tmpdir(),
    "state-" + Math.random().toString(36).slice(2) + ".json",
  );
  try {
    writeStateFile(p, [
      { id: "a", severity: "critical" },
      { id: "b", severity: "high" },
      { id: "a", severity: "critical" },
    ]);
    const seen = readStateFile(p);
    assert.deepEqual([...seen].sort(), ["a", "b"]);
  } finally {
    try {
      fs.unlinkSync(p);
    } catch {}
  }
});

test("computeNewSinceLastSync returns only not-previously-seen ids", () => {
  const findings = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
  ];
  const seen = new Set(["a"]);
  const newIds = computeNewSinceLastSync(findings, seen);
  assert.deepEqual([...newIds].sort(), ["b", "c"]);
});
