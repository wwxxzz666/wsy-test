---
name: oss-review
description: "Pre-submission self-review for contributions (bug fixes, docs fixes, typo fixes, test additions): run git diff, check all 8 quality gates (contribution type gate, scope, code quality, tests, security, anti-slop, git hygiene, PR template). ABANDON if not a valid contribution."
user-invocable: true
---

# OSS Contribution Self-Review

Review changes against all 8 quality gates before submission. **Gate 0 (Contribution Type Gate) is the most important — if this PR is not a valid contribution (bug fix, docs fix, typo fix, or test addition), ABANDON immediately.**

## Process
1. Run `git diff main..HEAD` to see all changes
2. Check each gate below — fail fast on any violation
3. If a gate fails, fix the issue and re-check
4. Generate PR description from diff and issue context

## 8-Gate Checklist

**Gate 0 — Contribution Type Gate (MANDATORY FIRST CHECK)**:
- Is this PR a valid contribution? (bug fix, docs fix, typo fix, or test addition)
- Does the diff ONLY contain changes necessary for the reported issue?
- Does the commit message use the correct type? (`fix` for bugs, `docs` for docs/typos, `test` for tests)
- Does the PR description reference a specific issue number?
- **If this is a feature addition, enhancement, or large refactor: ABANDON THE PR.**
- Common red flags:
  - New public API methods or endpoints added
  - New configuration options or feature flags
  - Renamed variables or restructured code without addressing an issue
  - Added functionality that didn't exist before
  - Changes to files unrelated to the issue

**Gate 0.5 — Completeness & Depth**:
- Does this FULLY resolve the reported issue? No partial work allowed.
- For bugs: Does the fix address the ROOT CAUSE, not just the surface symptom?
- For docs/typos: Is the corrected text factually accurate (verified against code)?
- For tests: Does the test meaningfully exercise the target code path?
- Does the PR description include appropriate evidence (root cause analysis for bugs, verification for docs)?
- If the work is incomplete: go back and fix it properly, or ABANDON.

**Gate 1 — Scope**: Changes related to target issue only, no unrelated files, target 25-100 LOC (max 200). Every changed line must be necessary. Multi-file changes are fine if the scope demands it.

**Gate 2 — Code Quality**: Linter passes, no new warnings, matches repo style, no debug statements, no commented-out code, no new dependencies unless essential for the fix

**Gate 3 — Tests**: All existing tests pass (read `.github/workflows/` for full CI matrix — linting, type checking, formatters, not just unit tests). For bugs: new/modified test demonstrates the bug was fixed (fails before fix, passes after). For test additions: new tests pass and exercise the target code path. Test names follow repo conventions.

**Gate 4 — Security**: No hardcoded secrets/API keys, no .env files staged, no eval() or dangerous patterns, no private paths

**Gate 5 — Anti-Slop**: No unnecessary comments restating code, no AI markers, no over-engineered abstractions, no premature optimization, no single-use helper functions, variable names match repo conventions

**Gate 6 — Git Hygiene**: Branch named correctly (clawoss/{fix,docs,test,typo}/...), conventional commits with correct type (`fix`/`docs`/`test`), no merge commits, clean linear history

**Gate 7 — PR Template**: Title clearly indicates contribution type. For bugs: body includes ROOT CAUSE ANALYSIS, before/after test evidence. For docs/typos: body explains what was incorrect and how verified. For tests: body explains what's tested and why. References issue. ClawOSS disclosure present (never "AI agent" or "AI-generated").

## Independent Review (Critical)
Spawn an ISOLATED subagent via `sessions_spawn` with clean context:
- Provide ONLY: `git diff`, issue description, repo style guide
- Subagent must NOT see your implementation journey
- Use a fresh session with clean context (no implementation history)
- Subagent checks: Is this a valid contribution (bug fix/docs/typo/test)? Does it address the issue? Is the work complete? Correctness, slop, bugs, style compliance
- **If the reviewer determines this is a feature addition or large refactor, ABANDON**
- **If the reviewer determines the work is partial or superficial, go back and fix it properly**
- Fix any flagged issues before proceeding to oss-submit
