---
name: oss-followup
description: "Orchestrator-level PR follow-up detection and delegation: scan open PRs for new review comments, classify feedback type, write context files to subagent-inputs, delegate to oss-pr-review-handler sub-agents. Does NOT implement changes directly."
user-invocable: true
---

# OSS PR Follow-up — Detection & Delegation (Orchestrator Skill)

This skill runs in the ORCHESTRATOR session (HEARTBEAT step 2). It detects PRs
needing attention and delegates follow-up work to dedicated sub-agents — one per PR.
It does NOT implement changes directly.

## Overview

The orchestrator calls this skill to:
1. Scan all open PRs authored by us
2. Fetch review comments for each PR
3. Classify each PR's status
4. Write context files for sub-agents
5. Spawn follow-up sub-agents (via oss-pr-review-handler skill)
6. Update pr-followup-state.md

## Step 1: Scan Open PRs

```bash
gh search prs --author BillionClaw --state open --limit 50 --json repository,number,title,url,updatedAt
```

If no open PRs: skip to next HEARTBEAT step. Nothing to follow up on.

## Step 2: Fetch Review Details Per PR

For each open PR, fetch both inline and general comments:

```bash
# Inline code review comments
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  --jq '.[] | {id, body, path, line, created_at, user: .user.login, in_reply_to_id}'

# General PR-level comments
gh api repos/{owner}/{repo}/issues/{number}/comments \
  --jq '.[] | {id, body, created_at, user: .user.login}'
```

Filter to comments that are NEW since our last check:
- Read memory/pr-followup-state.md for the `last_checked` timestamp per PR
- Only consider comments with `created_at` > `last_checked`
- If no `last_checked` exists (first check), consider all non-self comments

Exclude our own comments (filter out comments where user matches our GitHub username).

## Step 3: Classify Each PR

Based on review state and new comments, classify each PR:

### `changes_requested`
Criteria (any of):
- `reviewDecision` == "CHANGES_REQUESTED"
- New inline comments requesting specific code changes
- New general comments asking for modifications
- Reviewer explicitly asks for changes

Action: Spawn follow-up sub-agent (if round < 3)

### `comment_only`
Criteria:
- New comments that are questions, clarifications, or discussions
- No explicit change requests
- Reviewer is engaging but not blocking

Action: Spawn follow-up sub-agent to respond thoughtfully

### `ci_failing`
Criteria:
- `statusCheckRollup` contains failures
- Failures are in OUR code (not pre-existing repo CI issues)

Action: Spawn follow-up sub-agent to fix CI (counts as a round)

### `approved`
Criteria:
- `reviewDecision` == "APPROVED"
- No new blocking comments

Action: Update pr-followup-state.md status to `approved`. No sub-agent needed.
**High-value action**: Check if PR can be merged (CI passes, no merge conflicts). If yes, merge immediately with `gh pr merge {number} --repo {owner}/{repo} --squash`. An approved, unmerged PR is wasted value — merging is the highest-ROI action in the loop. Update trust-repos.md on successful merge.

### `stale`
Criteria:
- `updatedAt` is >14 days ago (not 7 — many repos review on 2-week cycles)
- No new review activity

Action: Add polite bump comment. Do NOT close. Update state to `bumped_stale`.
```bash
gh pr comment {number} --repo {owner}/{repo} --body "Just checking in — is there anything else needed for this PR to move forward? Happy to make adjustments."
```

### `fix_rejected`
Criteria:
- Issue reporter or maintainer says the fix doesn't work, wrong approach, or doesn't resolve the issue
- Keywords: "doesn't work", "wrong approach", "doesn't fix", "still broken", "not the right fix"

Action: **REWORK** — spawn follow-up sub-agent with instructions to try a different approach. Force-push to same branch. Update state to `rework_pending`. Comment acknowledging feedback first.
```bash
gh pr comment {number} --repo {owner}/{repo} --body "Thanks for the feedback — reworking with a different approach."
```
If 2+ rework attempts also fail, update state to `fix_rejected_terminal` but still leave PR open for maintainer.

### `already_fixed_upstream`
Criteria:
- Maintainer says "already fixed", "fixed in latest release", "resolved upstream", "fixed in vX.Y"

Action: Close PR with polite comment. Update state to `already_fixed_upstream`. No sub-agent needed.
```bash
gh pr close {number} --repo {owner}/{repo} --comment "Thanks for confirming — glad this is resolved. Closing as it's already fixed upstream."
```

### `invalid_contribution`
Criteria:
- PR title starts with `feat:` or PR adds features/refactors instead of fixing bugs/docs/typos/tests
- Self-detected during follow-up scan

Action: Close PR with polite comment. Update state to `invalid_contribution`. No sub-agent needed.
```bash
gh pr close {number} --repo {owner}/{repo} --comment "Closing — this was submitted as a feature rather than a bug fix. Apologies for the noise."
```

### `low_star_repo`
Criteria:
- PR targets a repo with < 200 stars (should not have been submitted)

Action: Close PR with polite comment. Update state to `low_star_repo`. No sub-agent needed.
```bash
gh pr close {number} --repo {owner}/{repo} --comment "Closing — this was submitted in error. Apologies for the noise."
```

### `scope_rejected`
Criteria:
- Maintainer explicitly rejected the contribution (e.g., "not appropriate", "out of scope", "we don't want this")

Action: Adjust scope if possible and push update. If scope cannot be adjusted, leave PR open for maintainer to close. Update state to `scope_adjusted` or `scope_rejected_terminal`.
```bash
gh pr comment {number} --repo {owner}/{repo} --body "Thanks for the feedback — happy to adjust the scope if there's a way this can be helpful."
```

### `maintainer_question`
Criteria:
- Maintainer asks a direct question (e.g., "are you an AI?", "what CLA did you sign?", "can you explain X?")
- No code change requests — just a question needing a response

Action: Respond directly in the main session — no sub-agent needed. Keep response brief and honest. Update `last_checked` timestamp.
**CLA questions specifically**: CLA requires manual signing — respond that you'll get it done: "I'll get the CLA signed — will follow up once it's done."

### `merged`
Criteria:
- PR state is merged (won't appear in `--state open`, but check explicitly if needed)

Action: Update state to `merged`. Log success. **Update memory/trust-repos.md — a merge is the strongest trust signal.**

### `no_new_activity`
Criteria:
- No new comments since last check
- Review decision unchanged

Action: Skip. Update `last_checked` timestamp only.

## Step 4: Check Round Limits

For PRs classified as `changes_requested`, `comment_only`, or `ci_failing`:

Read the current round count from memory/pr-followup-state.md:
- Round 0-1: Normal follow-up. Proceed to spawn.
- Round 2: This will be round 3 (final). Mark in context file so sub-agent knows to post disengagement message if needed.
- Round >= 3: Do NOT spawn. PR is in disengaged state. Log "skipped: max rounds reached".

## Step 5: Write Context File

For each PR that needs a sub-agent, write:
`memory/subagent-inputs/followup-{repo}-{pr}.md`

See HEARTBEAT.md step 2c for the exact format. The context file must include:
- PR URL, number, branch name
- Repository owner and name
- Original issue number (from PR body "Fixes #N")
- Classification
- Current revision round (will be incremented by 1 for this follow-up)
- ALL new review comments (inline + general) with comment IDs for reply threading
- Diff summary (first 200 lines of `gh pr diff`)

## Step 6: Spawn Sub-Agents

For each PR needing follow-up, request orchestrator to spawn via sessions_spawn.
See HEARTBEAT.md step 2d for exact spawn instructions.

**Priority**: Follow-up sub-agents are spawned BEFORE implementation sub-agents.
If spawning a follow-up would exceed the 10-slot impl/followup limit (14 total with always-on subagents), defer implementation work.

## Step 7: Update State

After processing all PRs, update memory/pr-followup-state.md:
- New PRs: add row with round 0, status pending_review
- Follow-up spawned: increment round, update last_checked, update status
- Stale bumped: set status bumped_stale
- Approved: set status approved
- No activity: update last_checked only

## Output

Return to orchestrator:
- Count of PRs needing follow-up sub-agents
- Count of PRs bumped (stale)
- Count of PRs approved
- Count of PRs skipped (max rounds / no activity)
- List of sub-agents to spawn (PR number, repo, classification, round)

The orchestrator handles the actual spawning in HEARTBEAT step 2d.

## Important

- This skill runs in the ORCHESTRATOR context — keep it lightweight
- Do NOT implement code changes here — that's the sub-agent's job
- Do NOT read full file diffs in the orchestrator — just the summary
- Minimize GitHub API calls — batch where possible
- If a PR has >20 new comments, summarize rather than including all verbatim
- Always update pr-followup-state.md even if no action is taken (timestamps matter)
