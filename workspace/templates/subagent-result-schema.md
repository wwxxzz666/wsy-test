# Sub-Agent Result Schema

All sub-agent result files MUST use this format. The YAML frontmatter enables
reliable machine parsing by the orchestrator at HEARTBEAT step 6.

## File Naming

- Implementation: `memory/subagent-result-{owner}_{repo}-{issue}.md`
- Follow-up: `memory/subagent-result-followup-{owner}_{repo}-{pr}.md`

Use underscore `_` to join owner/repo (slash is not valid in filenames).

## Format

```markdown
---
type: implementation | followup
status: success | failure | already_fixed | abandoned
repo: owner/repo
issue: 12345
pr_url: https://github.com/owner/repo/pull/67890
pr_number: 67890
pr_category: bug_fix | docs | typo | test | dep_update | dead_code | other
branch: clawoss/{fix,docs,test,typo}/description
files_changed: 3
additions: 25
deletions: 8
has_tests: true
root_cause: Brief one-line root cause explanation
failure_reason: Only present if status is failure or abandoned
followup_round: 2
followup_outcome: changes_pushed | question_answered | scope_adjusted | scope_rejected_terminal | rework_in_progress | fix_rejected_terminal | disengaged_max_rounds | already_fixed_upstream
---

# Result: {owner}/{repo}#{issue or pr}

## Summary
One paragraph describing what was done and the outcome.

## Root Cause Analysis
(Implementation only — skip for follow-ups that only answered questions)
What was broken, why it was broken, how the fix addresses it.

## Changes Made
- List of files modified and what changed in each

## Test Evidence
(If tests were run)
### Before (failing)
```
paste test failure output
```
### After (passing)
```
paste test success output
```

## Reviewer Interaction
(Follow-up only)
- What reviewers asked for
- What was changed or responded
- Any scope concerns raised

## Notes
Any additional context (e.g., "CI not available in environment", "issue was already fixed upstream")
```

## Required Fields by Type

### Implementation (type: implementation)

| Field | Required | Notes |
|-------|----------|-------|
| type | yes | `implementation` |
| status | yes | `success`, `failure`, `already_fixed`, or `abandoned` |
| repo | yes | `owner/repo` format |
| issue | yes | issue number |
| pr_url | if success | full GitHub PR URL |
| pr_number | if success | PR number |
| pr_category | if success | `bug_fix`, `docs`, `typo`, `test`, `dep_update`, `dead_code`, or `other` |
| branch | if success | branch name |
| files_changed | if success | integer |
| additions | if success | integer |
| deletions | if success | integer |
| has_tests | if success | boolean — did the PR include test changes? |
| root_cause | if success | one-line root cause |
| failure_reason | if failure | why it failed or was abandoned |

### Follow-up (type: followup)

| Field | Required | Notes |
|-------|----------|-------|
| type | yes | `followup` |
| status | yes | `success` or `failure` |
| repo | yes | `owner/repo` format |
| pr_number | yes | PR number being followed up on |
| pr_url | yes | full GitHub PR URL |
| followup_round | yes | integer — which round this was (1, 2, or 3) |
| followup_outcome | yes | see enum values above |
| branch | yes | branch name |
| files_changed | if changes pushed | integer |
| additions | if changes pushed | integer |
| deletions | if changes pushed | integer |
| failure_reason | if failure | why the follow-up failed |

## Status Values

- `success` — task completed, PR submitted (implementation) or follow-up handled (follow-up)
- `failure` — task could not be completed (with failure_reason)
- `already_fixed` — the bug was already resolved upstream, no PR needed
- `abandoned` — task was abandoned due to complexity, scope, or quality gate failure

## Failure Reason Taxonomy

When `status` is `failure` or `abandoned`, `failure_reason` MUST use one of these
standard categories (optionally followed by `: <details>`). This enables automated
tracking, pattern detection, and dashboard aggregation.

### Discovery / Triage Failures (caught before spawn)
| Category | When to Use |
|----------|-------------|
| `repo_health_fail` | Repo failed health gate (dead, overwhelmed, no merges, low review rate) |
| `not_a_bug` | Issue is a feature request, enhancement, refactor, or discussion |
| `issue_stale` | Issue older than 30 days |
| `issue_closed` | Issue was closed before we started |
| `issue_assigned` | Issue is already assigned to someone |
| `title_keyword_reject` | Issue title matched hard-reject keywords (add, extend, etc.) |
| `label_reject` | Issue has hard-reject labels (enhancement, feature-request, etc.) |
| `dedup_existing_pr` | We already have a PR for this issue or repo |
| `superseded` | Another contributor already has an open PR linked to this issue (found via timeline API) |

### Implementation Failures (caught during sub-agent work)
| Category | When to Use |
|----------|-------------|
| `cannot_reproduce` | Bug could not be reproduced with a failing test |
| `too_complex` | Fix requires changes beyond our scope (>200 lines, >10 files, architectural) |
| `tests_fail_after_fix` | Fix introduced regressions, could not resolve after 2 attempts |
| `ci_incompatible` | Cannot run repo's test suite (missing deps, unsupported platform) |
| `scope_creep` | Fix would require feature additions or refactoring beyond bug fix |
| `content_filter_blocked` | Content filter blocked file reads (PII in files) |
| `clone_failed` | Could not clone or access the repository |
| `self_review_fail` | Fix failed 3+ self-review checks |
| `already_fixed_upstream` | Bug was fixed in a newer commit or PR before we could submit |
| `duplicate_pr_other` | Another contributor already has an open PR for this issue |
| `cla_required` | Repo requires CLA that needs manual signing by account owner |
| `wrong_target_branch` | PR targeted wrong branch (e.g., main instead of dev) |

### Follow-up Failures (caught during PR review handling)
| Category | When to Use |
|----------|-------------|
| `reviewer_rejected_scope` | Reviewer said the contribution is out of scope / not appropriate |
| `reviewer_requested_rewrite` | Reviewer wants a fundamentally different approach |
| `fix_rejected` | Issue reporter or maintainer says the fix doesn't work / wrong approach |
| `max_rounds_exceeded` | Hit 3-round follow-up limit |
| `pr_closed_by_maintainer` | Maintainer closed the PR |
| `branch_conflict` | PR branch has merge conflicts we cannot resolve |
| `already_fixed_upstream` | Maintainer confirmed bug is fixed in a newer release |

### Infrastructure Failures
| Category | When to Use |
|----------|-------------|
| `api_rate_limited` | GitHub API rate limit exceeded |
| `model_error` | LLM error (timeout, 500, context overflow) |
| `tool_error` | Tool call failed (git, gh, web_search) |
| `context_overflow` | Sub-agent ran out of context window |
| `stalled` | Sub-agent produced no output for >5 minutes |

### Format
```yaml
failure_reason: "category: optional details"
```
Examples:
```yaml
failure_reason: "not_a_bug: issue is requesting a new dark mode feature"
failure_reason: "too_complex: fix requires rewriting the entire auth middleware (500+ lines)"
failure_reason: "repo_health_fail: 0 merged PRs in 30 days, 87 open PRs"
failure_reason: "tests_fail_after_fix: 3 test regressions in auth module after 2 fix attempts"
```

## Orchestrator Parsing

The orchestrator reads these files at HEARTBEAT step 6. It relies on the YAML
frontmatter for structured data extraction. The markdown body is for human
review and dashboard ingestion only.

Parsing pseudocode:
```
1. Read file content
2. Extract YAML between first --- and second ---
3. Parse YAML into key-value pairs
4. Route based on type field:
   - implementation → step 6a logic
   - followup → step 6b logic
5. Check status field:
   - success → validate pr_url is present and valid
   - failure/abandoned → log failure_reason
   - already_fixed → remove from queue, no PR to track
6. Delete result file after processing
```
