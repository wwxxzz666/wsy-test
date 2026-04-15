# Heartbeat -- Autonomous Work Loop

## CRITICAL: NEVER REPLY HEARTBEAT_OK — ALWAYS WORK
There is ALWAYS something to do. Execute ALL steps 0-7 every cycle. If queue is empty, run discovery. If discovery finds nothing, expand to new niches. If no new issues, follow up on open PRs. If truly nothing: search broader (lower star threshold, older issues, new languages). The agent must NEVER be idle.

## Rules — see AGENTS.md (loaded alongside this file)
Keep all 10 impl/followup sub-agent slots filled. **NEW PRs FIRST** — fill all 10 slots with new implementations. Only do follow-ups AFTER all 10 impl slots are full or no new work exists.
Work queue should have 10+ items. If < 5, run oss-discover IMMEDIATELY.
**NO CRON DEPENDENCIES**: This heartbeat + the 4 always-on subagents handle EVERYTHING. No cron jobs are used. Discovery = scout. Follow-ups = PR monitor scan + PR monitor deep. Analysis = PR analyst. Cleanup = step 7.
**LAZY LOADING**: Do NOT read all memory files at once. Only read files needed for the current step. pr-ledger.md only when dedup checking. trust-repos.md only when scoring. This prevents context bloat.
**ANTI-DEADLOCK**: Multiple open PRs per repo is OK. The agent MUST NOT idle when work exists.
**NEVER WAIT**: Do NOT say "monitoring for completion events", "standing by", "waiting for results", or yield. After ANY step, continue to the next step. After step 7, loop to step 2. The heartbeat is an infinite loop with NO pause states.

## Web Search — USE PROACTIVELY
You have `web_search` and `web_fetch` tools. **Use them aggressively:**
- Before working on ANY issue: `web_search` for the error message, related fixes, upstream discussions
- When evaluating a repo: `web_search` for its reputation, recent news, maintainer activity
- When stuck on a bug: `web_search` for stack traces, similar issues, workarounds
- When writing PR descriptions: `web_search` to verify your understanding is correct
- During discovery: `web_search` for trending repos, new releases, hot issues
**Do NOT guess when you can search.** Web search is free and fast. Use it 5-10 times per cycle.

## Skills — USE THEM PROACTIVELY
You have skills loaded. **Read the SKILL.md file** (use the `read` tool) before each step to get specialized instructions:
- **Step 3 (Discovery)**: Read `oss-discover` skill — it has the exact GitHub API queries, scoring formulas, and 7-niche rotation strategy.
- **Step 4 (Triage)**: Read `oss-triage` skill — it has type checking, label filtering, and merge-probability scoring.
- **Step 5 (Spawn)**: Read `oss-implement` skill — pass it to subagents so they follow the reproduce-first workflow.
- **Step 6 (Results)**: Read `oss-review` skill — use its 8-point quality checklist to validate subagent output.
- **Follow-ups**: Read `oss-followup` + `oss-pr-review-handler` skills — they have the classification and response logic.
- **Repo analysis**: Read `repo-analyzer` skill when evaluating a new repo — it has the full health scoring rubric.
- **Safety**: Read `safety-checker` skill before any PR submission — it's the final gate.
- **Context**: `context-manager` skill when context > 40%.
- **Dashboard**: `dashboard-reporter` skill to report metrics.
Skills: `~/clawOSS/workspace/skills/{name}/SKILL.md`. Load with `read`.

## 0. Health Checks
**0a. Quick status snapshot**: `bash /Users/kevinlin/clawOSS/scripts/heartbeat-status.sh` — shows queue depth, open PRs, locks, always-on status, wake state in one JSON call.
**0a2. Context**: Use the `session_status` tool (NOT a bash command — it's an OpenClaw built-in tool). **>35%: COMPACT IMMEDIATELY** — flush state to memory files, then `/compact`. Do NOT proceed to any other step until context is under 35%. This is the #1 cause of gateway timeouts and stalled cycles.
**0b. Circuit breakers**: Read wake-state.md (or use heartbeat-status.sh output). If errors_this_hour >= 5, pause 2 minutes then continue (never fully stop). consecutive_wakes is informational only — never use it to skip work.
**0b2. Cycle guardrails** (prevent runaway cycles and quota burn):
- **Max cycle time**: If any single step takes >5 minutes, skip to the next step. Do not block the entire cycle.
- **Context check mid-cycle**: If >35% context used after ANY step, compact IMMEDIATELY. Do not wait — context bloat causes gateway timeouts and stalled cycles. Compact early, compact often.
- **API error backoff**: If 3+ API calls fail in a row (rate limit, 403, 5xx), pause 60 seconds before continuing. If 5+ fail, skip to step 7 cleanup and self-wake — never fully stop.
**0c. Dashboard self-check** (run every cycle, skip if dashboard unreachable):
```bash
HEALTH=$(curl -s --max-time 5 https://clawoss-dashboard.vercel.app/api/agent/health-check)
```
Parse the response and OBEY all three fields:
- `directives`: plain-English corrections (slow down, follow up first, avoid dead repos). Read and follow.
- `avoidRepos`: repos with 2+ PRs and 0 merges — do NOT submit NEW PRs to any of these. But NEVER kill in-progress subagents working on these repos. Let them finish — killing mid-flight wastes the work already done.
- `reposWithOpenPRs`: repos where we already have open PRs — do NOT submit new PRs, focus on follow-ups instead.
If curl fails or times out, proceed without dashboard data — the other gates still apply.

## 0.5. Always-On Subagent Management (scout + PR monitor scan + PR monitor deep + PR analyst)
Check always-on subagents via `sessions_list`:

**CRITICAL: ALWAYS read the template file from disk with the `read` tool BEFORE spawning.** Do NOT use cached template content from your context — files change between cycles. Read the file, get the FULL content, pass that content as the `task` parameter.

**1. Scout** (label "scout-*") — continuous issue discovery:
- **Alive** (active in last 30 min): read `memory/scout-report-*.md`. Merge scored candidates into `memory/work-queue-staging.md`. Delete processed reports.
- **Dead or missing**: Respawn IMMEDIATELY in this step — do NOT defer to next cycle or continue to other steps first. First `read` the file `templates/subagent-scout.md` to get its FULL current content. Then spawn:
  `sessions_spawn(task: {THE_FULL_CONTENT_YOU_JUST_READ}, label: "scout-tier0", mode: "run", runTimeoutSeconds: 0)`
  Pass trust-repos.md and pr-ledger.md via attachments.

**2. PR Monitor Scan** (label "pr-monitor-scan") — fast PR scanning and classification:
- **Alive** (active in last 30 min): read `memory/pr-monitor-report.md` for cycle summary.
- **Dead or missing**: Respawn IMMEDIATELY in this step — do NOT defer to next cycle or continue to other steps first. First `read` the file `templates/subagent-pr-monitor.md`. Then spawn with that content as the task.

**3. PR Monitor Deep** (label "pr-monitor-deep") — deep comment analysis and follow-up context:
- **Alive** (active in last 30 min): read `memory/followup-staging.md` for items needing code changes (see step 2). Read `memory/pr-monitor-deep-report.md` for cycle summary.
- **Dead or missing**: Respawn IMMEDIATELY in this step — do NOT defer to next cycle or continue to other steps first. First `read` the file `templates/subagent-pr-monitor-deep.md`. Then spawn with that content as the task.

**4. PR Analyst** (label "pr-analyst") — continuous portfolio analysis & strategy:
- **Alive** (active in last 30 min): read `memory/pr-strategy.md` and `memory/repo-blocklist.md`.
- **Dead or missing**: Respawn IMMEDIATELY in this step — do NOT defer to next cycle or continue to other steps first. First `read` the file `templates/subagent-pr-analyst.md`. Then spawn with that content as the task.

Always-on subagents use 4 slots. Remaining 10 for impl/followup. Total maxConcurrent = 14.
**Respawn IMMEDIATELY when dead.** Kill zombies by sessionKey if label is ambiguous.

## 1. Stall Recovery
Check for stalled sub-agents (no messages >5 min). Kill, re-queue at TOP of work-queue.md, increment errors_this_hour. Mark stalled task as `failed` in `memory/impl-spawn-state.md`. 2 consecutive stalls on same task = SKIP it.
**Clean stale locks + orphaned state**: `bash /Users/kevinlin/clawOSS/scripts/cleanup-stale-sessions.sh` (removes locks >30min, resets orphaned spawned_pending entries)

## 2. Pick New Work (PRIORITY — new PRs before follow-ups)

### 3a. Merge Staging + Trust Priority
Merge work-queue-staging.md and followup-staging.md into work-queue.md. Clear staging. DEDUP by issue URL.
**P(merge) SORT**: Sort queue by P(merge) descending. Issues with `priority: high` (P(merge) >= 60) go to TOP. Within same priority, trusted repos (memory/trust-repos.md) go first. Skip any candidate with P(merge) < 30.

### 3b. Count and Pick
Count active impl/followup sub-agents (sessions_list, exclude main + always-on scouts/monitors + stale >30min).

- **impl/followup active >= 10**: skip to step 6. **Do NOT say "monitoring for completion events" and stop.** Always continue to step 6, then 7, then self-wake and loop back.
- **impl/followup active < 10, queue has items**: pick next (urgent first, P(merge) >= 30, score >= 5). Gates:
  a. **IMPL SPAWN GUARD**: skip if issue has `spawned_pending` in `memory/impl-spawn-state.md`.
  b. **DEDUP**: skip if in pr-ledger.md, in subagent-result-*.md, repo has `spawned_pending` in impl-spawn-state.md, OR lock file exists (`memory/locks/{owner}_{repo}.lock`). ALWAYS use `BillionClaw` explicitly — `@me` can fail in sub-agent contexts.
  **DOUBLE-CHECK**: Before each spawn, re-run `gh search prs --author BillionClaw --repo {owner}/{repo} --state open --json number --jq 'length'`. If count changed, skip (race condition guard).
  **LOCK FILE**: Before spawning, write lock: `echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) {issue}" > memory/locks/{owner}_{repo}.lock`. Sub-agent deletes lock after PR creation or failure. Orchestrator cleans stale locks (>30 minutes) in step 1 (stall recovery).
  b2. **BLOCKLIST HARD-BLOCK**: Read `memory/trust-repos.md` Deprioritized section. If the repo appears there AND `Skip Until` is "permanent" or a future date, SKIP unconditionally — no override by score, labels, or any other factor. Repos on this list have hostile maintainers, ban threats, or non-automatable CLAs.
  c. Skip if we had a PR closed on this repo in the last 7 days.
  d. Prefer different repos across concurrent agents. Avoid 2 agents working the same repo simultaneously when possible.
  e. **TYPE CHECK**: bug fix, docs fix, typo fix, or test addition only.
  f. **TITLE REJECT**: Skip if title whole-word matches: `add`, `extend`, `enable`, `improve`, `enhance`, `new feature`, `request`, `implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`, `redesign`, `optimize`, `allow`, `provide`.
  g. **HEALTH GATE**: Quick check — `gh api repos/{owner}/{repo} --jq '{stars: .stargazers_count, pushed: .pushed_at, archived: .archived}'`. Skip if: archived, stars < 100, or no push in 30 days. Use judgment — don't run the full script every time.
  g2. **DASHBOARD BLOCKLIST**: If step 0c returned `avoidRepos`, skip any repo in that list. `reposWithOpenPRs` is informational only — you CAN submit to repos with open PRs.
  h. **SUPERSESSION CHECK**: Before spawning, quick-check if issue already has linked PRs or is assigned:
     `gh api "repos/{owner}/{repo}/issues/{number}/timeline" --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null and .state == "open")] | length'`
     If > 0: skip (someone else is already working on it).
     `gh api "repos/{owner}/{repo}/issues/{number}" --jq '.assignees | length'`
     If > 0: skip (assigned to someone).
     Also check recent issue comments for claim signals:
     `gh api "repos/{owner}/{repo}/issues/{number}/comments" --jq '[.[] | select(.body | test("I.ll (take|work on|fix|handle) this|working on (this|it|a fix)"; "i"))] | length'`
     If > 0: skip (someone claimed it).
     Mark skipped issues as `superseded` or `assigned` in pr-ledger.md so we don't re-check.
  i. **ALREADY-FIXED CHECK** (CRITICAL — prevents ban-worthy duplicate submissions):
     Check if a recently merged PR already fixes this issue:
     `gh search prs --repo {owner}/{repo} "is:merged" --limit 20 --json number,title,body,closedAt --jq "[.[] | select(.body != null and (.body | test(\"#{number}\"; \"i\")) or .title != null and (.title | test(\"#{number}\"; \"i\")))] | length"`
     If > 0: skip with reason `already_fixed_upstream`. Also check if the issue itself is closed:
     `gh api "repos/{owner}/{repo}/issues/{number}" --jq '.state'` — if "closed", skip.
     **Submitting a fix for an already-resolved issue gets us flagged as bots and threatened with bans.**
  **BATCH SPAWN**: Collect ALL candidates first. Spawn them in rapid succession — no interleaved work. If "Skipped due to queued user message", RESUME after handling event. Loop NOT done until slots full or queue empty.
- **Queue < 5**: run oss-discover IMMEDIATELY. Target 30-50 candidates, score >= 3. Search ALL niches (devtools, CLIs, web frameworks, databases, cloud-native, testing, data engineering) — NOT just AI repos. If first pass finds < 5, lower star threshold to 100 and expand date range to 30 days.
- **Queue >= 10**: drain first, but still run discovery in background (scout handles this).

## 4. Triage (< 3 min, main session)
**4-ZERO.** Quick health check: `gh api repos/{owner}/{repo} --jq '{stars: .stargazers_count, pushed: .pushed_at, archived: .archived}'`. Skip if archived, stars < 100, no push in 30 days. No script needed — use judgment.
**4a.** Type: bug/docs/typo/test. Title keyword reject (same as 3f). Label reject: `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`. Invalid = remove.
**4b.** Run oss-triage. Skip if: not actionable, vague, wontfix/duplicate/invalid, >30 days old. CLA repos: skip — CLAs require manual signing by the account owner.
**4b-SUPERSESSION.** Assigned? Linked PRs? "I'll take this" comment? Issue closed? Merged PR refs? If yes, remove and mark in pr-ledger.md.
**4c.** Score: +5 docs/typo, +3 tests, +5 merge <3d, +3 review >80%, +2 gfi/help-wanted. -5 merge >14d, -10 if 100% closure rate. Skip: 0 merges/30d.
**4d.** Quick research via web_search.

## 5. Spawn Implementation Sub-Agent
**5a. Pre-spawn comment (score >= 8, or >= 6 for trusted repos):** Post brief comment: `gh issue comment {issue} --repo {owner}/{repo} --body "Looking into this — [1-sentence approach]. Happy to submit a fix."` Skip for lower scores.
**5b.** Use the `read` tool to load `templates/subagent-implementation.md` from disk NOW (do NOT reuse cached content). Substitute `{repo}`, `{issue}`, `{title}` in the content. Spawn: `sessions_spawn(task: {THE_SUBSTITUTED_CONTENT}, label: "{repo}#{issue}", ...)`. Always re-read the template for EVERY spawn — files change between cycles. Pass repo conventions + issue details as attachments.
**IMMEDIATELY mark issue as `spawned_pending` in `memory/impl-spawn-state.md` BEFORE spawning the next agent.**
**NEVER use `@me` — it fails in sub-agent contexts. ALWAYS use `BillionClaw` explicitly.**
**Read `memory/repos/{owner}_{repo}.md`** if it exists — pass key info (target branch, CLA, CI) to the subagent via attachments.
**5c. PASS OPEN PR CONTEXT**: Before spawning, fetch open PRs in the repo and pass as attachment:
`gh pr list --repo {owner}/{repo} --state open --json number,title,headRefName --limit 20`
This gives the sub-agent awareness of what's in flight so it can avoid file conflicts.

Sub-agent results: `memory/subagent-result-<repo>-<issue>.md` (YAML frontmatter per `templates/subagent-result-schema.md`). maxConcurrent: 14 (4 always-on + 10 impl/followup). Sub-agents clean their own `/tmp/clawoss-*` workspaces.

## 5. PR Follow-ups (ONLY when all 10 impl slots are full)
**Skip this step entirely if < 10 impl subagents are active.** New PRs always take priority.
Only when ALL 10 slots are filled with implementations, use remaining capacity for follow-ups:

The PR Monitor (always-on) stages items to `memory/followup-staging.md`. Read it.
The PR Monitor Deep (always-on) builds rich context for each PR needing follow-up. Read `memory/followup-staging.md` — it contains full comment threads, inline reviews, and comment IDs.
Load `templates/subagent-followup.md` from disk. Spawn with the staging data as attachment.

## 6. Handle Sub-Agent Results

**6a. Implementation**: List `memory/subagent-result-*.md` (not followup-*). Parse YAML. Update `memory/impl-spawn-state.md` status for each result.
**Timestamp validation**: If a result has `completed_at` before `spawned_at`, use current time as `completed_at` instead. Corrupted timestamps break pipeline stats.
- success + pr_url: mark `completed` in impl-spawn-state.md. Also update pr-ledger.md status to `open` for the new PR. Clear any matching entry from followup-staging.md. State files MUST be kept in sync — if you update impl-spawn-state, also update the ledger and clear staging. Remove from queue, add to pr-followup-state.md (status: `pending_review`, round 0). **If repo merged a previous PR from us, add/update memory/trust-repos.md.**
- success, no pr_url: mark `failed`. Re-queue once, then fail.
- failure/abandoned: mark `failed`. Log failure_reason in failure-log.md. `repo_health_fail` = cache 24h. If `fix_rejected_terminal` (2+ failed reworks) or `reviewer_rejected_scope`, deprioritize repo in trust-repos.md for 30 days. Single `fix_rejected` = rework opportunity, not deprioritization.
- already_fixed: mark `completed`. Remove. Delete result file after processing.

**6c. Trust validation**: When updating trust-repos.md, verify merge counts match reality: `gh search prs --author BillionClaw --repo {owner}/{repo} "is:merged" --json number --jq 'length'`. Don't trust cached counts — GitHub is the source of truth.

**6b. Follow-up**: List `memory/subagent-result-followup-*.md`. Parse YAML. Clear `spawned_pending`, increment round.
- `changes_pushed`/`question_answered`/`scope_adjusted`/`rework_in_progress` -> `follow_up_round_N` (continue iterating)
- `already_fixed_upstream`/`scope_rejected_terminal`/`fix_rejected_terminal`/`disengaged_max_rounds` -> terminal
- `failure` -> `pending_review` (retry next cycle)
- Round 3: `disengaged`, leave PR open for maintainer. Delete result file.

## 6.5. MANDATORY Context Check After Results
**Check context with `session_status` NOW.** If >35%, flush state to memory files and `/compact` before continuing.
Processing results adds significant context (each result file = ~1k tokens read + state file edits).
**Do NOT skip this step.** Proceeding to step 7 with >35% context causes the NEXT cycle to timeout.

## 7. Report, Cleanup & Loop
Run dashboard-reporter. Update wake-state.md. Remove completed/abandoned from queue.
**Memory cleanup** (every cycle): delete ALL processed subagent-result-*.md files with `rm`. Remove stale work-queue items (>30 days). Prune closed PRs from impl-spawn-state.md.
**DELETE result files IMMEDIATELY after processing** — do NOT leave them for the next cycle. 43 unprocessed files = 43k tokens of bloat.
**Self-wake**: `exec: openclaw system event --text "cycle-complete" --mode now`
**THEN IMMEDIATELY loop back to step 2.** If < 10 active: pick more new work. Queue empty: run oss-discover.
**NEVER say "monitoring for completion events" or "standing by" or "waiting for results".** These are FORBIDDEN phrases. The heartbeat is a LOOP — after step 7, go DIRECTLY to step 2. If all slots are full, process results (step 6) and loop again. There is no "wait" state.
