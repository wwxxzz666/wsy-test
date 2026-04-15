---
name: safety-checker
description: "Final safety gate before PR submission: contribution type verification (bug/docs/typo/test), budget check, diff size 25-100 LOC target (HARD MAX 200), no secrets, branch naming, dedup check, independent review. Abort if any check fails."
user-invocable: true
---

# Safety Checker

Final validation gate before `oss-submit`. Every check must pass or submission is aborted.

## Checks

### 0. Contribution Type Verification & Completeness (MOST IMPORTANT CHECK)
Confirm that this PR is a valid contribution, NOT a large feature or refactor:
- Read the original issue: is it a bug report, docs issue, typo, or test gap?
- Read the diff: do changes ONLY address the reported issue?
- **Does this FULLY resolve the issue?** A partial fix is not acceptable — abort and skip.
- For bugs: does the fix address the root cause, not just the symptom?
- For docs/typos: is the corrected text factually accurate (verified against code)?
- For tests: do the tests meaningfully exercise the target code path?
- Check commit messages: is the type correct? (`fix` for bugs, `docs` for docs/typos, `test` for tests)
- **If this is a large feature addition, enhancement, or refactor: ABORT IMMEDIATELY.**
- **If this is partial work that doesn't fully resolve the issue: ABORT.**
- Red flags: new public APIs, new config options, renamed variables without issue context, files changed unrelated to the issue.

### 1. Budget Check
Verify daily token spend hasn't exceeded cap before starting new work.
Check memory for today's token usage. If over budget, abort and enter idle mode.

### 2. Diff Size (HARD GATE — abort if exceeded)
Run `git diff --stat` and verify:
- Total lines changed: target 25-100, **HARD MAX 200** (abort if exceeded)
- Files changed < 10
- No binary files in diff
Enforcement:
```bash
DIFF_STATS=$(git diff --stat HEAD~1 | tail -1)
INSERTIONS=$(echo "$DIFF_STATS" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
DELETIONS=$(echo "$DIFF_STATS" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo 0)
TOTAL=$((${INSERTIONS:-0} + ${DELETIONS:-0}))
if [ "$TOTAL" -gt 200 ]; then echo "ABORT: diff $TOTAL lines > 200 max"; fi
```
If TOTAL > 200: **ABORT IMMEDIATELY**. Large PRs indicate scope creep or accidental refactoring.

### 3. Secret Scan
Search staged changes for:
- API keys (patterns: `sk-`, `ghp_`, `AKIA`, `Bearer`)
- Tokens and passwords (patterns: `password=`, `secret=`, `token=`)
- .env file contents
- Private keys (patterns: `-----BEGIN`)

### 4. Branch Name
Verify branch matches: `clawoss/{type}/<description>`
Valid types for ClawOSS: `fix` (bugs), `docs` (documentation/typos), `test` (test additions), `typo` (typo fixes).
**If branch type is `feat`, `refactor`, or `chore`: ABORT — these are not valid contribution types.**

### 5. Dedup Check (HARD GATE)
Check for duplicate PRs targeting the same issue. ALWAYS use `BillionClaw` explicitly — `@me` fails in sub-agent contexts.

### 5b. Supersession Check (HARD GATE — final check before submit)
Re-verify no one else submitted a fix while we were working:
- Check issue timeline for linked PRs: `gh api "repos/{owner}/{repo}/issues/{number}/timeline" --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null and .state == "open")] | length'`
- If > 0: **ABORT** — another contributor submitted a fix while we were implementing. A superseded PR wastes maintainer time.

### 6. No Dangerous Commands
Verify no force-push, no push to main/master, no `--force` flags.

### 7. CI Status
If target repo has required CI checks, verify our branch builds locally.

### 8. Independent Review
Spawn an isolated subagent via `sessions_spawn` with ONLY the diff and issue description (no implementation context).
Note: The isolated subagent receives only the diff and issue description. It does NOT have access to memory tools, repo history, or other PR context.
Subagent must confirm:
- The change is correct and slop-free
- **The change is a valid contribution (bug fix, docs fix, typo, or test addition) — not a feature or refactor**
- **The work is complete — it fully resolves the reported issue, not just partially**
- For bugs: the fix addresses the root cause, not just the surface symptom
- For docs/typos: the corrected text is factually accurate
- For tests: the tests are meaningful and follow repo conventions
- Every changed line is necessary for resolving the reported issue

## On Failure
Log which check failed, abort submission, report to dashboard.
If check 0 (Contribution Type Verification) fails, log "ABORTED: not a valid contribution" prominently.
If the work is partial/incomplete, log "ABORTED: partial work — does not fully resolve the issue".
