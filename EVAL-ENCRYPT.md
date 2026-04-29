# eval - `encrypt-solana-prealpha` skill

written 2026-04-29 against the skill at commit-tip after the description workflow-summary tail got yeeted per writing-skills cso guidance. previous eval (in-session, not committed) flagged one P1 issue; this re-eval confirms it's resolved + walks the rest of the rubric for a clean reading.

## tl;dr

skill is in **really good shape, frfr**. drift catalog + audit script + 208-test suite cover what writing-skills calls the RED→GREEN cycle empirically, gotchas reflect actual user-encountered bugs, and the description now passes the cso "no workflow summary" rule. only outstanding nudges are P2 / P3 polish - no P1 issues currently open.

| dimension | score | notes |
| --- | --- | --- |
| skill type fit | ✓ | hybrid reference + technique + pattern, expected for a domain wrapper |
| frontmatter / cso | ✓ | description trimmed to 530 chars, no workflow summary, all keywords intact |
| structure | ✓ | every recommended section present in canonical order |
| token efficiency | ⚠ borderline | SKILL.md 767 words (target <500) but reasonable for a complex hub |
| anti-patterns | ✓ | clean - no narrative, no multi-language dilution, no force-loads |
| retrieval test (reference) | ✓ | knowledge-probe answer sheet automated |
| application test (technique) | ✓ | 9 drift rules × pos/neg fixtures = 18 application tests |
| gap detection (the dimension we just improved) | ✓ now | non-docs/ commits advisory landed today, was the gap that bit us |

## skill type classification

still a **hybrid**:
- primarily a reference skill (gRPC / instruction / fee tables, FHE type discriminants, etc.)
- with technique elements (audit / audit-force / audit-fix workflow, drift remediation)
- and pattern elements (receipt-gated composability, npm-vs-upstream tracking)

writing-skills says reference skills get retrieval + application + gap-testing. this skill needs ALL three because it's a hybrid. it has all three, automated. ✓

## tdd lifecycle mapping (RED → GREEN → REFACTOR)

unusual in the best way: this skill has a **real automated harness** that closely approximates the writing-skills RED→GREEN cycle without needing subagent pressure tests. ya girl loves to see it.

| writing-skills concept | how this skill realizes it |
| --- | --- |
| RED (failing test / baseline) | `tests/skill-effectiveness/knowledge-probe.test.mjs` "answer sheet" - if a canonical fact disappears from the corpus, it fails. real-world RED = the npm `@0.1.0` trap, surfaced by a user actually getting bit |
| GREEN (skill complies) | `tests/skill-discovery/cso.test.mjs` (each query routes to the right skill); `tests/skill-lint/*` (frontmatter contract); `tests/skill-facts/drift-rules.test.mjs` (every drift rule needs +/- fixtures); `tests/skill-audit/*` (parser + lib unit tests). **208 / 208 passing** |
| REFACTOR (close loopholes) | drift catalog (`drift-rules.mjs`) with stable rule ids + `since` dates; new `enc-encryptvalue-from-stale-npm-package` rule was added precisely bc agents would still hit the npm bug even after reading the gotcha |

this is the top-decile of skill quality re: empirical validation. like, most skills don't even have ONE real test harness, this has FIVE.

## frontmatter / cso evaluation (post-trim)

| check | status | notes |
| --- | --- | --- |
| `name` is kebab-case | ✓ | `encrypt-solana-prealpha` |
| description starts with "Use when" | ✓ | line 3 |
| third person | ✓ | |
| under 1024 chars (hard limit) | ✓ | 530 chars |
| under 500 chars (soft target) | **6 chars over**, basically chill | 530 total / 517 body |
| triggering conditions only, no workflow summary | ✓ **NEWLY FIXED** | the trailing "for freshness gating and drift remediation" got yeeted, audit verbs remain as triggering conditions only |
| keyword density | ✓ | strong: `FHE`, `execute_graph`, `CreateInput`, `ReadCiphertext`, `NEK`, `authorized`, `vector vs scalar`, `mock executor`, `BPF`, `ika dWallet`, `audit` / `audit-force` / `audit-fix` |
| disambiguation from sibling skill | ✓ | "disambiguating Encrypt from ika dWallet signing" is explicit and tested via cso query routing |

**what changed since last eval:** description was 573 chars with a trailing workflow-summary tail (`for freshness gating and drift remediation`). that tail was the cso violation - writing-skills says descriptions should describe **when to use**, not **what the skill does**, bc otherwise claude treats the description as a shortcut and skips the actual skill body. dropped the tail, kept the audit verb names (which ARE valid triggering conditions: "the user is invoking the audit verb" → use the skill). all 208 tests still green afterwards, including the lint test that requires those verb substrings to be present. literally a free win.

## structure evaluation

every recommended SKILL.md section is present, in the canonical order:

| recommended | status |
| --- | --- |
| Overview (core principle) | ✓ |
| When to Use | ✓ |
| When NOT to use | ✓ |
| Quick Reference table | ✓ |
| Implementation / install | ✓ "install & tooling" |
| Common Mistakes | ✓ |
| Real-World Impact | n/a (optional, not needed) |
| references (load on demand) | ✓ - well-organized table with "load for" hints per file |

plus a **pre-alpha disclaimer** block which is appropriate domain-specific scope-setting. nothing missing.

## token efficiency

| target | actual | verdict |
| --- | --- | --- |
| SKILL.md ≤ 500 words ("other skills") | 767 | **53% over soft target**, but reasonable for a complex multi-system hub |
| heavy reference in separate files | ✓ | references/ totals 14,087 words across 22 files |
| cross-reference rather than duplicate | ✓ | strong use of `[file](path#anchor)` deep links |
| `gotchas.md` size | 1978 words | acceptable - on-demand load only, real bugs cluster |

the 767-word SKILL.md is borderline but not a problem in practice: it's a hub that routes to references, and a simpler split would just add navigation tax. would only flag if it grew past ~1000.

## anti-patterns scan

| anti-pattern | present? |
| --- | --- |
| narrative storytelling ("In session 2025-10-03...") | ❌ none |
| multi-language dilution (5 langs of the same example) | ❌ TS-primary with one Rust example |
| code in flowcharts | ❌ no flowcharts at all |
| generic labels (step1, helper2) | ❌ |
| force-loading via `@` syntax | ❌ all links are markdown, lazy-load |

clean as a whistle.

## reference-skill specific tests

### retrieval

`knowledge-probe.test.mjs` mechanically validates that key facts (canonical URLs, program ID, fee model, vector type IDs, etc.) are present in the corpus. this is **exactly** the writing-skills "retrieval scenario" test, automated. 

### application

drift catalog is the application test in disguise: each rule is a "given user code, does the skill catch the misuse" check. each rule has `tests/fixtures/drift-positive/<rule>.<ext>` (must trigger) and `drift-negative/<rule>.<ext>` (must NOT trigger). 9 rules × 2 = 18 application tests. this is the writing-skills GREEN test in code.

### gap testing (the dimension that bit us most recently)

this is the dimension that produced today's biggest improvement:

- **failure mode caught:** the audit's `docs/`-only freshness gate let `f7f410a` (pc-swap refund mechanics) and `6c9f7f9` (TS sdk Buffer→Uint8Array) slip past. two material upstream changes were invisible to maintainers because they only touched `chains/...` paths.
- **resolution shipped today:** new `--- non-docs/ commits since pin (advisory) ---` block prints on every audit run, lists every commit between pin and `main` regardless of paths touched, never blocks. documented in `audit.md` with `f7f410a` and `6c9f7f9` cited as the prompting examples.

### remaining gap-detection weaknesses

1. there's no equivalent advisory for the **npm package surface itself** if a republish lands at the same version (rare but possible) - we'd silently miss behavior changes.
2. the skill relies on **users reporting bugs** to trigger gotcha additions (the npm 0.1.0 trap, the receipt-gated composability fix). there's no proactive "scan upstream for new gotchas" pass. arguably no skill could fully automate that, but it's a known asymmetry.

## strengths worth callin out

1. **drift catalog with stable ids + fixture pairs.** this is exemplary writing-skills practice. every loophole has a reproducible test. `since` dates let you garbage-collect rules when their underlying bug is fixed upstream.
2. **two-tier freshness model.** hard `docs/` gate (exit 2) for normative content + non-blocking advisories for code/npm churn. matches the severity tiering writing-skills recommends for discipline-enforcing rules. 10/10 no notes.
3. **real-world feedback loop is observable.** CHANGELOG entries trace gotchas back to user-encountered failures. the npm 0.1.0 trap's commit chain is a textbook RED → GREEN cycle in production.
4. **cso disambiguation is tested.** `cso.test.mjs` queries directly check "does query X route to skill Y over skill Z." this is the keyword-overlap discipline writing-skills recommends, automated.
5. **hub-and-spoke reference architecture.** SKILL.md is a router, references/ are leaves, deep links use anchors. clean lazy-load semantics.

## findings ordered by priority

### P1 - actionable, low effort

(none currently open. previous P1 was the description workflow-summary tail, resolved this turn.)

### P2 - worth considering

**1. add a proactive npm-package-surface review prompt** to the audit follow-ups. currently the audit only flags `NPM AHEAD OF SKILL` if the version number changed. a republish at the same version (or a behavior shift caught only by reading release notes) is invisible. could add a soft note when `recorded in skill` date in `docs-revision.md` is >30 days old: "tracked npm package was reviewed N days ago - consider re-reading the package surface even if version is unchanged." mechanically detectable via the existing parser.

**2. surface the receipt-gated composability pattern as a top-level common-mistake row.** it's there now (line 77), but the entry is dense - reads more as "don't reach for Approve" than "the *technique* is receipt-gating." could split into two rows: one negative ("don't reach for Approve when the caller gates state on the transfer"), one positive ("use receipt-gated: pc-token disc 22 → caller's graph → close - flow 7"). marginal.

### P3 - tradeoffs, not bugs

**3. SKILL.md word count.** 767 words is over the soft target but reasonable for a complex domain hub. trimming `## install & tooling` to point at `frameworks.md` could save ~10%. not urgent.

**4. no explicit "Red Flags / STOP" list.** writing-skills recommends this for discipline-enforcing skills. the single discipline rule here ("if `docs/` moved, tell the user, don't silently rewrite") is enforced **mechanically** by the audit's exit-2 gate, so the documentation rule is redundant with code. acceptable - mechanical enforcement > prose enforcement when both are available.

**5. no flowchart usage.** writing-skills says "use flowcharts only for non-obvious decision points." two candidates qualify: (a) "Encrypt vs ika? routing" decision and (b) "audit vs audit-force vs audit-fix" workflow. both currently handled by tables, which is also valid per writing-skills. marginal call - tables are easier to scan and don't break in non-graphviz contexts.

## bottom line

this is a **mature, well-instrumented reference skill** that has cycled through multiple real RED → GREEN refactors tied to upstream churn and user-encountered bugs. with the description trim landing today, there are **no open P1 findings**. P2 / P3 items are nice-to-haves that can wait for a natural refresh window.

ya girl approves.

next natural refresh trigger: either `@encrypt.xyz/pre-alpha-solana-client` republishes past `0.1.0` (then the npm-tracking block prompts the maintainer review), OR upstream lands more code-only commits and the new non-docs/ advisory surfaces them on the next audit run. system is set up for both. mhm.
