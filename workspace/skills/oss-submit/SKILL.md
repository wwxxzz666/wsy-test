---
name: oss-submit
description: "Submit a contribution PR (bug fix, docs fix, typo fix, or test addition) to an open-source repo: verify it's a valid contribution, push branch to fork, create PR with gh CLI, use repo's PR template, log submission, report to dashboard."
user-invocable: true
---

# OSS Contribution PR Submission

Submit a verified contribution branch as a pull request. **Valid types: bug fixes, docs fixes, typo fixes, test additions. Never features, large refactors, or enhancements.**

## Prerequisites
- Branch passes all 8 quality gates (oss-review skill), including Gate 0 (Contribution Type Gate)
- safety-checker skill has approved submission
- Commit type matches contribution: `fix` for bugs, `docs` for docs/typos, `test` for tests

## Pre-Submit Sanity Check
Before pushing anything, ask one final time:
- Is this a valid contribution (bug fix, docs fix, typo, or test addition)? If NO → ABANDON.
- Does the PR FULLY resolve the reported issue? If NO (partial fix) → ABANDON.
- For bugs: does the fix address the root cause? If NO → go back and fix properly.
- For docs/typos: is the corrected text factually accurate? If NO → verify against code.
- For tests: do the tests meaningfully exercise the target code path? If NO → improve them.
- Does the PR reference a specific issue? If NO → ABANDON.
- Is the branch named `clawoss/{fix,docs,test,typo}/...`? If NO → rename it with `git branch -m "clawoss/..."`.

## De-Duplication Check (mandatory before `gh pr create` — NEVER SKIP)
```bash
# ALWAYS use explicit username, not @me (which can fail in sub-agent contexts)
# Check 1: open PRs by BillionClaw on this repo
OPEN_COUNT=$(gh search prs --author BillionClaw --repo OWNER/REPO --state open --json number --jq 'length')
# Check 2: search for PRs targeting the same issue (catches cross-fork dupes)
ISSUE_PRS=$(gh search prs --author BillionClaw "Fixes #ISSUE_NUMBER repo:OWNER/REPO" --json number --jq 'length')
```
If ANY result > 0: **ABANDON. Do NOT create duplicate PRs.**
- No duplicate PRs for the same issue even across different branches
This prevents the 5x-duplicate-on-instructor and 3x-duplicate-on-taskcoach incidents.

## Fork vs Direct Push
1. Check if we have write access to the repo
   - Yes: push branch directly, create PR
   - No: check if we have a fork already
     - Yes: push to fork, create cross-repo PR
     - No: fork the repo first, then push and create PR

## Process
1. Push branch to fork (or origin if write access)
2. **Verify target branch:** `gh api repos/{owner}/{repo} --jq '.default_branch'` — create PR against THIS branch, not hardcoded 'main' or 'master'. Wrong target = instant close.
3. **PR template check:** `ls .github/PULL_REQUEST_TEMPLATE.md .github/PULL_REQUEST_TEMPLATE/ 2>/dev/null` — if a template exists, use its structure (fill in sections, check checkboxes). If not, use our format below.
4. Create PR using `gh pr create --base $DEFAULT_BRANCH`:
   - Title: `{type}(scope): description` following Conventional Commits — type must match contribution
   - Body: write like a developer, not an AI. Be terse (3-5 sentences). No filler.
     - **AI tells (NEVER USE)**: "This PR addresses...", "I noticed...", "Upon investigation...",
     "This change ensures...", "This commit fixes...", "I identified...", "After analyzing...",
     "The root cause was identified as...", "This resolves the issue by...", "Comprehensive fix for...",
     bullet lists starting with "Ensures", "Improves", "Handles"
   - **Human developer style (USE THIS)**: Jump straight to what's broken and what you did.
     Write like you're leaving a note for a colleague, not writing a report.
   - **GOOD example** (bug fix):
     ```
     `ProcessPoolTaskRunner.submit` silently swallows `BrokenProcessPool` exceptions
     because the except clause catches `Exception` but doesn't re-raise after logging.

     Changed the except block to re-raise after calling `self._report_failure()`.
     Added test that confirms `BrokenProcessPool` propagates to the caller.

     Fixes #21131
     ```
   - **BAD example** (same fix, AI slop):
     ```
     ## Summary
     This PR addresses an issue where ProcessPoolTaskRunner silently swallows exceptions.
     Upon investigation, I identified that the root cause is the broad Exception catch clause.
     This change ensures that BrokenProcessPool exceptions are properly propagated.

     ## Changes
     - Modified the exception handling to re-raise after logging
     - Added comprehensive test coverage for the error path
     ```
   - **Bug fixes**: what broke + why (1 sentence each) + what you changed + test evidence
   - **Docs/typo fixes**: what was wrong + what's correct now (2-3 sentences total)
   - **Test additions**: what's tested + why it matters (2-3 sentences total)
   - References: "Fixes #<issue-number>" in body
5. Do NOT mention CLA in PR body. If repo requires CLA, it will be handled separately.
7. Log submission to memory: repo, issue, PR number, timestamp, contribution type
8. Report to dashboard via dashboard-reporter skill

## Post-Submission
- Monitor CI status on next heartbeat
- Respond to review comments within 4 hours (~8 heartbeats)
- Do NOT ping or bump PRs — wait patiently for maintainer response
- If maintainer says "this is not appropriate" or "out of scope" → adjust scope or leave PR open for maintainer to close. Log lesson in memory.
