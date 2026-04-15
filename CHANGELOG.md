# Changelog

All notable changes to the ClawOSS project documented chronologically.

## 2026-03-16 — Initial Build Session

### Phase 1: Project Scaffold and Workspace

- **Initialize project scaffold** — `package.json`, `.gitignore`, `LICENSE` (MIT)
- **Create OpenClaw workspace files** — `AGENTS.md` (behavioral contract), `SOUL.md` (persona), `USER.md` (operator profile), `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`
- **Create gateway configuration** — `config/openclaw.json` (initially with Claude Sonnet), `config/cron-jobs.json` (5 cron jobs)
- **Create templates** — `templates/pr-template.md`, `templates/commit-conventions.md`, `templates/issue-response-template.md`

### Phase 2: Custom Skills

- **Create all 10 skills** — `oss-discover`, `oss-implement`, `oss-review`, `oss-submit`, `oss-followup`, `oss-triage`, `repo-analyzer`, `context-manager`, `dashboard-reporter`, `safety-checker`
- All skills include YAML frontmatter with name and description
- All skills under the 2000-character limit for prompt space

### Phase 3: Operational Scripts

- **`scripts/setup.sh`** — Configure git identity (BillionClaw), authenticate gh, link workspace, copy config, register agent, symlink skills
- **`scripts/start.sh`** — Register cron jobs, start OpenClaw gateway
- **`scripts/stop.sh`** — Graceful gateway shutdown
- **`scripts/health-check.sh`** — Verify gateway, gh auth, workspace, cron status
- **`scripts/backup-workspace.sh`** — Commit memory state to git
- **`scripts/rotate-logs.sh`** — Remove logs older than 14 days
- **`scripts/validate-config.mjs`** — Validate JSON configs, workspace files, skills, scripts

### Phase 4: GitHub Identity

- **Configure BillionClaw** as exclusive GitHub identity
- Apply identity across all workspace files and scripts
- Switch to interactive `gh auth login` (removed PAT-from-file pattern)
- Set git email to `billionclaw+clawoss@users.noreply.github.com` (noreply format to avoid content filter)

### Phase 5: Quality Refinements (Devil's Advocate)

- Apply quality gate refinements from `research/04-devils-advocate.md`
- Add anti-slop instructions to AGENTS.md
- Strengthen safety defaults and anti-spam protections

### Phase 6: Model Switch to Minimax M2.5

- **Switch primary model** from `claude-sonnet-4-6` to `openrouter/minimax/minimax-m2.5`
- 80.2% SWE-bench Verified at 11x cheaper input tokens
- Update all config files and scripts for OpenRouter routing
- **Disable model fallback** (`fallbacks: []`) to prevent silent Anthropic cost spikes
- Fix OpenRouter content filter issues (email/phone replacement with `[EMAIL]`/`[PHONE]`)

### Phase 7: Dashboard

- **Initialize Next.js 15 dashboard** with shadcn/ui, Tailwind CSS, Recharts
- **Set up Turso database** with Drizzle ORM schema (heartbeats, PRs, metrics, logs tables)
- **Create API routes** — ingest (heartbeat, metrics, logs), GitHub sync, PR queries, metrics, settings
- **Create SWR data hooks** for real-time dashboard updates
- **Build 6 dashboard pages** — Overview, PRs, Health, Quality, Logs, Settings
- **Deploy to Vercel** at `clawoss-dashboard.vercel.app`

### Phase 8: Throughput Architecture v5

- **Research and design** throughput architecture (`research/06-throughput-architecture.md`, `research/07-throughput-critique.md`)
- **Reframe metrics** from "commits/hour" to "merged PRs/day with >70% acceptance rate"
- **Implement orchestrator + sub-agent pattern** — main session orchestrates, sub-agents implement in fresh contexts
- **Rewrite HEARTBEAT.md** — 6-step autonomous work loop with circuit breakers, staging files, sub-agent spawning
- **Rewrite AGENTS.md** — orchestrator + sub-agent architecture documentation
- **Redesign cron jobs** — more frequent scanning (30min PR, 2h discovery), isolated sessions for all non-main jobs
- **Create memory file templates** — `wake-state.md`, `pipeline-state.md`, `work-queue.md`
- **Reduce heartbeat interval** to 10 minutes with `lightContext: true`
- **Verify autonomous loop** — heartbeat + cron + sub-agent pipeline confirmed working end-to-end

### Phase 9: Bug Fixes

- **Fix sessions_spawn attachments** — enable `tools.sessions_spawn.attachments.enabled: true` for sub-agent context passing
- **Fix model fallback** — set `fallbacks: []` to prevent expensive Anthropic API calls
- **Fix content filter** — switch to noreply email format
- **Fix cron session targeting** — use isolated sessions for non-orchestrator jobs
- **Fix skill path resolution** — add symlink creation in setup.sh
- **Sync repo config with live config** — apply all throughput optimizations discovered during live testing

### Phase 10: Documentation

- **Comprehensive README** with architecture diagrams, 9-phase loop, configuration tables
- **Update README** to reflect actual implementation (M2.5, 10min heartbeat, v5 architecture, dashboard URL)
- **CI/CD workflows** — validation and dashboard deployment GitHub Actions
- **Create issues directory** — 10 issue files covering all known bugs, limitations, and fixes
- **Post-Implementation Notes** added to implementation plan documenting all deviations
- **This CHANGELOG**

### Phase 11: Post-Build Fixes (ongoing)

- **Content filter 403 loop prevention** — Added safety rules to AGENTS.md, HEARTBEAT.md, and oss-discover to prevent PII content from poisoning sessions (commit `6a84563`)
- **Stale model references fixed** — Removed Haiku/Sonnet references from oss-review and safety-checker skills
- **TOOLS.md line limit fixed** — Changed from 500 to 200 to match all other files
- **Dashboard Live Feed documented** — Added `/live` page to README
- **Dashboard URL updated** — Deployed at `clawoss-dashboard.vercel.app`
- **20 issues tracked** — 10 fixed, 10 open (1 critical: .env secrets)
- **OpenClaw hooks documented** — Added dashboard-reporter and audit-logger hooks to README (issue #020)
- **Context rot prevention** — Added compaction thresholds (reserveTokens, keepRecentTokens, maxHistoryShare), memory flush at 150K tokens, postCompactionSections to preserve critical state across compactions. HEARTBEAT.md step 0 split into 0a (Context Health) and 0b (Circuit Breakers). AGENTS.md "Context Rot Prevention" section added. Prevents 113% context overflow that broke the agent. (commit `d9e1e47`)

### Phase 12: Model Switch to Kimi K2.5

- **Switch primary model** from `openrouter/minimax/minimax-m2.5` to `openrouter/moonshotai/kimi-k2.5`
- Moonshot Kimi K2.5: 76.8% SWE-bench Verified, $0.45/MTok input, $2.20/MTok output, 262K context
- Updated all 4 model references in `config/openclaw.json` (defaults.model, subagents, agent, heartbeat)
- Context window increased from 196K to 262K tokens — reduces overflow risk (issue #004)
- Native multimodal and agentic tool-calling capabilities
- **4x-game-agent fork added** — `BillionClaw/4x-game-agent` (fork of `sonpiaz/4x-game-agent`) placed in `workspace/` as first contribution target
- **oss-implement rewritten** — Reproduce-first TDD workflow (reproduce bug -> failing test -> minimal fix -> verify -> evidence PR)
- **5 superpowers skills added** — systematic-debugging, test-driven-development, verification-before-completion, brainstorming, requesting-code-review
- **HEARTBEAT.md refined** — Context check split into 0a (Context Health) and 0b (Circuit Breakers)
- **oss-implement char limit fix** — Condensed from 3605 to 1895 chars (under 2000 limit)
- **Dashboard URL updated** — Canonical URL is `clawoss-dashboard.vercel.app` (Turso DB at `clawoss-cmlkevin.aws-us-east-1.turso.io`)
- **All dashboard URL references updated** — README, hooks, skill, .env.example, issues
- **Stall recovery added** — HEARTBEAT.md step 1 detects stuck sub-agents, kills and re-queues
- **Agent ALIVE** — Discovered 15 issues, spawned first sub-agent for `Nexal-AI/voicecrew#10`
- **25 issues tracked** — 14 fixed, 1 mitigated, 8 open, 1 known, 1 informational

### Phase 13: V6 Stabilization

- **Sub-agent discipline restored** — Commits `4dfdb11`, `211bf5f`, `b310726`, `6763be3` iterated on maxConcurrent and timeout settings
- **V6 feature release** — Commit `6d85a5a`: stability, expanded toolkit, stall recovery
- **Heartbeat prompt fix** — Issue #026: agent stopped after diagnostics without picking work. Prompt rewritten 3 times to be maximally directive (commits `748422c`, `becee7a`)
- **maxConcurrent mismatch fixed** — Issue #027: config says 5, HEARTBEAT.md said 1, AGENTS.md says 5. Resolved: aligned all to maxConcurrent: 5, no timeout (user's explicit preference).
- **Dashboard live-stats-bar centralized** — Cost model import moved from hardcoded M2.5 pricing to `DEFAULT_COST_MODEL` from `cost-models.ts`
- **Dashboard canonical URL** — `clawoss-dashboard.vercel.app` is now the canonical domain (was `dashboard-plum-one-37.vercel.app`). All 12 file references updated.
- **Cloned repos gitignored** — Issue #022: sub-agents clone target repos into `workspace/`. Added `workspace/4x-game-agent/` to `.gitignore`. First autonomous contribution target: `sonpiaz/4x-game-agent#9` (template matching tests).
- **Model switch confirmed user-directed** — K2.5 switch was explicitly requested by user, not benchmark-driven. Benchmarks pending throughput-critic review.
- **Stall recovery documented** — Issue #028: sub-agent stall detection, kill, retry (max 2), skip. Already implemented in commits `13d0aa3` and `6d85a5a`.
- **BLOCKING: OpenRouter content filter on model output** — Issue #033: the model's own generated code (e.g., `@pytest.fixture`) enters session history as assistant messages. No hook can intercept model streaming output. OpenRouter blocks the next API call with 403. Issue #001 downgraded from "Fixed" to "Partially Fixed".
- **Autonomous model switch to GLM-5** — Issue #034: BillionClaw (the agent) autonomously switched all 4 model references from `openrouter/moonshotai/kimi-k2.5` to `openrouter/z-ai/glm-5` in commit `c45498d` to work around the content filter. GLM-5 pricing: $0.72/MTok input, $2.30/MTok output (~1.6x cost increase). SWE-bench and context window data unknown. Dashboard cost model updated accordingly.
- **34 issues tracked** — 16 fixed, 2 implemented, 1 partially fixed, 1 mitigated, 1 active, 9 open, 1 known, 1 informational, 1 completed, 1 in progress

### V6 Release — Autonomous Operation Begins

**Date:** 2026-03-16
**Status:** DEPLOYED — 30 PRs submitted across 22 repos (1 merged)

V6 is the culmination of 13 build phases. After this release, ClawOSS runs without human intervention until it either submits its first merged PR or fails. We observe and learn.

**What shipped in V6:**
- Kimi Code (k2p5) direct API — 262K context, bypasses OpenRouter content filter
- v5 orchestrator + sub-agent architecture (maxConcurrent: 5, fresh contexts)
- 9-step heartbeat loop (10min interval, lightContext mode)
- Stall recovery with automatic retry (max 2 attempts per task, then skip)
- Reproduce-first TDD workflow (every PR requires before/after test evidence)
- 15 skills (10 custom + 5 superpowers from obra/superpowers)
- Content filter safety (PII sanitization, 403 loop prevention)
- Circuit breakers (consecutive wakes, error rate, context usage thresholds)
- Autonomous drive behavioral contract ("idle is failure")
- Dashboard at `clawoss-dashboard.vercel.app` (Turso DB, live feed, cost tracking)
- Anti-spam protections (3 PRs/repo/day, 10 total/day, 200 LOC max)
- BillionClaw GitHub identity with AI disclosure in all PRs

**Post-V6 stabilization fixes (12+ commits after initial V6):**
- Content filter hardening: avoid reading files containing PII patterns
- Sub-agent concurrency aligned to maxConcurrent: 5 (no hard timeout)
- Work queue reordering and repo blocklisting
- Race condition prevention (default:true in agent config)
- Cloned repo gitignore patterns
- Dashboard URL canonicalization
- **PII sanitizer hook deployed** (commits `f4872f9`, `de1505f`) — strips emails (fullwidth @ replacement), phone numbers, IPs, SSNs, credit card numbers from tool results at hook level. Permanently fixes issue #001. Uses `tool_result_persist` event so agent's own writes are never modified. Later expanded to also cover `before_message_write` to catch sub-agent announce messages.
- **Dashboard V6 overhaul** — Full Live Feed rewrite with session tabs (orchestrator + per-sub-agent), view modes (unified/orchestrator/sub-agents), main tabs (Feed/Tools/Errors/Costs), sidebar tabs (State/Gateway/Stats). New components: tool call log with duration/success tracking, error log with classified types (403-filter, timeout, ENOENT, rate-limit, etc.), cost breakdown per session with $/hour rate, gateway status panel, raw JSON toggle per message, PII sanitizer indicators (header badge, per-message badges, filter counter). Pipeline status bar on overview. Sub-agent lifecycle tracking in dashboard-reporter hook (spawn/history/announce relay). Sessions API enhanced with repo/issue/isSubagent fields. SWR polling: conversation 2s, state 5s, sessions 5s, connection 15s. Token counts estimated from char length (~4 chars/token) when actual counts unavailable.
- 34 issues documented (16 fixed, 2 implemented, 1 partially fixed, 1 mitigated, 1 active)
- **PR ledger auto-sync** — `pr-ledger-sync.sh` runs every 60s via launchd (`com.clawoss.pr-ledger-sync.plist`), pulling all BillionClaw PRs from GitHub API into `memory/pr-ledger.md` (commit `6b27da8`)
- **restart.sh** — Comprehensive restart script for full autonomous operation (commit `abd08db`)
- **Disk cleanup** — Isolated sub-agent workdirs in `/tmp/clawoss-<issue>-<timestamp>/`, orchestrator sweeps stale dirs >60min (commit `d303cc4`)

**First autonomous activity observed (on K2.5, before GLM-5 switch):**
- Agent confirmed running on K2.5
- Discovered issues across multiple repos
- Spawned sub-agents for `sonpiaz/4x-game-agent#9` (template matching tests)
- Work queue populated and actively draining

**First full autonomous cycle (completed earlier, on K2.5):**
- Orchestrator at 12% context, polling sub-agent every heartbeat
- Sub-agent implementing VitePress docs for `Nexal-AI/voicecrew#10`
- Attachments working: sub-agent received issue-details.md and repo-conventions.md
- Cost: $0.001 per orchestrator poll (95% cache hits)
- Blocked by OpenRouter content filter on `@` symbols (#033)

### FIRST PR CREATED -- apache/mahout#1191

**Date:** 2026-03-16
**PR:** https://github.com/apache/mahout/pull/1191
**Author:** BillionClaw (ClawOSS autonomous agent)
**Title:** [QDP] Add direct coverage for Parquet readers

This is the milestone. ClawOSS autonomously discovered an issue, implemented a fix, and submitted a PR to a major Apache project — all without human intervention.

**Stats:**
- 5 files changed, +359 lines, -2 lines
- 11 new tests, all passing, zero regressions
- Rust project (no `@` decorator issues)
- Created by Kimi Code (k2p5) via direct API (not OpenRouter)

**What made it work:**
1. **Kimi Code direct API** — bypassed OpenRouter's content filter entirely
2. **Rust project** — no Python/Java `@` decorators to trigger the filter
3. **V6 heartbeat loop** — all 9 steps executing correctly
4. **Sub-agent with reproduce-first workflow** — failing test first, then fix
5. **ANNOUNCE_SKIP** — clean result passing from sub-agent to orchestrator

**Model switch: OpenRouter -> Kimi Code direct API:**
- OpenRouter's content filter on `@` symbols was fundamentally unsolvable via hooks (#033)
- Switched to Kimi Code (k2p5) direct API — no content filter, no middleman
- Coding time for the PR: ~12 minutes autonomous

### Phase 14: Autonomous Operation — 32 PRs Across 23 Repos

**Date:** 2026-03-13 to 2026-03-16
**Status:** RUNNING — 32 PRs submitted, 1 MERGED, across 23 distinct repositories

The agent has been submitting PRs autonomously since March 13. Dashboard dynamic PR discovery (replacing hardcoded target repos) revealed the full scope of contributions. Highlights:

**Operational improvements:**
- **`scripts/restart.sh`** — Comprehensive restart script: loads .env, sets git identity, authenticates gh, links workspace, deploys config with env vars, cleans sessions, resets wake state, starts gateway, starts dashboard sync, kicks agent (commit `abd08db`)
- **Circuit breaker raised** — From 8 to 50 consecutive wakes for sustained throughput
- **Disk cleanup** — Sub-agents now clone to isolated `/tmp/clawoss-<issue>-<timestamp>/` dirs; orchestrator sweeps stale dirs (>60min) every cycle (commit `d303cc4`)
- **oss-discover trimmed** — From 4076 to 1377 chars to fit 2000-char validation limit

**All 32 PRs submitted (Mar 13-16):**

| # | PR | Repo | Status | Date | Description |
|---|-----|------|--------|------|-------------|
| 1 | [#291](https://github.com/GLips/Figma-Context-MCP/pull/291) | GLips/Figma-Context-MCP | open | 03-13 | Figma MCP integration |
| 2 | [#269](https://github.com/darrenhinde/OpenAgentsControl/pull/269) | darrenhinde/OpenAgentsControl | open | 03-13 | Agent control framework |
| 3 | [#1394](https://github.com/manaflow-ai/cmux/pull/1394) | manaflow-ai/cmux | open | 03-13 | CMUX fix |
| 4 | [#490](https://github.com/mistralai/mistral-vibe/pull/490) | mistralai/mistral-vibe | open | 03-13 | Mistral AI |
| 5 | [#431](https://github.com/moltis-org/moltis/pull/431) | moltis-org/moltis | open | 03-13 | Moltis fix |
| 6 | [#4648](https://github.com/pydantic/pydantic-ai/pull/4648) | pydantic/pydantic-ai | closed | 03-13 | Pydantic AI |
| 7 | [#2166](https://github.com/badlogic/pi-mono/pull/2166) | badlogic/pi-mono | **MERGED** | 03-14 | Pi-mono fix |
| 8 | [#417](https://github.com/can1357/oh-my-pi/pull/417) | can1357/oh-my-pi | open | 03-14 | Oh-my-pi |
| 9 | [#1444](https://github.com/manaflow-ai/cmux/pull/1444) | manaflow-ai/cmux | open | 03-14 | CMUX fix |
| 10 | [#1446](https://github.com/manaflow-ai/cmux/pull/1446) | manaflow-ai/cmux | open | 03-14 | CMUX fix |
| 11 | [#435](https://github.com/moltis-org/moltis/pull/435) | moltis-org/moltis | open | 03-14 | Moltis fix |
| 12 | [#1191](https://github.com/apache/mahout/pull/1191) | apache/mahout | open | 03-15 | Parquet reader tests (+359/-2) |
| 13 | [#1192](https://github.com/apache/mahout/pull/1192) | apache/mahout | open | 03-15 | QDP coverage |
| 14 | [#1193](https://github.com/apache/mahout/pull/1193) | apache/mahout | open | 03-15 | QDP coverage |
| 15 | [#1194](https://github.com/apache/mahout/pull/1194) | apache/mahout | open | 03-15 | QDP coverage |
| 16 | [#49516](https://github.com/apache/arrow/pull/49516) | apache/arrow | open | 03-15 | Apache Arrow fix |
| 17 | [#17660](https://github.com/anomalyco/opencode/pull/17660) | anomalyco/opencode | open | 03-15 | Light mode Zellij fix |
| 18 | [#1090](https://github.com/autokey/autokey/pull/1090) | autokey/autokey | open | 03-15 | X11 resource leak fix |
| 19 | [#1091](https://github.com/autokey/autokey/pull/1091) | autokey/autokey | open | 03-15 | Game controller input |
| 20 | [#168](https://github.com/itdove/devaiflow/pull/168) | itdove/devaiflow | open | 03-15 | Enable daf note in Claude Code |
| 21 | [#3291](https://github.com/jenkinsci/warnings-ng-plugin/pull/3291) | jenkinsci/warnings-ng-plugin | open | 03-15 | Double HTML escaping fix |
| 22 | [#11](https://github.com/Nexal-AI/voicecrew/pull/11) | Nexal-AI/voicecrew | open | 03-15 | VoiceCrew fix |
| 23 | [#61754](https://github.com/ray-project/ray/pull/61754) | ray-project/ray | open | 03-15 | Ray distributed computing |
| 24 | [#4007](https://github.com/Shopify/ruby-lsp/pull/4007) | Shopify/ruby-lsp | open | 03-15 | Ruby LSP fix |
| 25 | [#10](https://github.com/sonpiaz/4x-game-agent/pull/10) | sonpiaz/4x-game-agent | open | 03-15 | Game agent fix |
| 26 | [#56](https://github.com/whoisjayd/yt-study/pull/56) | whoisjayd/yt-study | open | 03-15 | Cookie auth for YouTube |
| 27 | [#57](https://github.com/whoisjayd/yt-study/pull/57) | whoisjayd/yt-study | open | 03-15 | Track Google consent 500s |
| 28 | [#33](https://github.com/windoze95/servicewow-mcp/pull/33) | windoze95/servicewow-mcp | open | 03-15 | Service fix |
| 29 | [#34](https://github.com/windoze95/servicewow-mcp/pull/34) | windoze95/servicewow-mcp | open | 03-15 | Service fix |
| 30 | [#41](https://github.com/windoze95/nullfeed-backend/pull/41) | windoze95/nullfeed-backend | open | 03-15 | Backend fix |
| 31 | [#426](https://github.com/lukilabs/craft-agents-oss/pull/426) | lukilabs/craft-agents-oss | open | 03-15 | OAuth browser window fix (Windows) |
| 32 | [#789](https://github.com/Xian55/WowClassicGrindBot/pull/789) | Xian55/WowClassicGrindBot | open | 03-15 | Assist Focus GUID check fix |

**Repos contributed to (23):** apache/mahout, apache/arrow, anomalyco/opencode, autokey/autokey, badlogic/pi-mono, can1357/oh-my-pi, darrenhinde/OpenAgentsControl, GLips/Figma-Context-MCP, itdove/devaiflow, jenkinsci/warnings-ng-plugin, lukilabs/craft-agents-oss, manaflow-ai/cmux, mistralai/mistral-vibe, moltis-org/moltis, Nexal-AI/voicecrew, pydantic/pydantic-ai, ray-project/ray, Shopify/ruby-lsp, sonpiaz/4x-game-agent, whoisjayd/yt-study, windoze95/servicewow-mcp, windoze95/nullfeed-backend, Xian55/WowClassicGrindBot

**First merge: badlogic/pi-mono#2166** — Accepted and merged by maintainer on 2026-03-14.

**Notable contributions:**
- **jenkinsci/warnings-ng-plugin#3291** — Fixed double HTML escaping where "C++ Lint" displayed as "C&#43;&#43; Lint". Root cause: ToolNameRegistry was HTML-escaping names, then Jelly templates escaped again.
- **autokey/autokey#1090** — Fixed X11 resource leak on restart: added `__ungrabAllHotkeys()` call before closing display connection. 2-line fix.
- **anomalyco/opencode#17660** — Fixed light mode detection in Zellij terminal multiplexer by adding COLORFGBG env var and TERM_PROGRAM pattern detection.
- **whoisjayd/yt-study#56** — Added cookie-based authentication for YouTube transcript fetching, with 276 tests passing.
- **ray-project/ray#61754** — Contributed to Ray, a major distributed computing framework (83k+ stars).
- **lukilabs/craft-agents-oss#426** — Fixed OAuth browser window not opening on Windows: replaced `shell.openExternal()` with `openUrl()` fallback in 3 OAuth flows.
- **Xian55/WowClassicGrindBot#789** — Fixed Assist Focus not working: added GUID checks before target/clear operations, aligning with FollowFocusGoal behavior.
- **pydantic/pydantic-ai#4648** — Contributed to Pydantic AI, the Python AI framework by the Pydantic team.

### Research Documents Created

| Document | Content |
|----------|---------|
| `research/01-extension-points.md` | OpenClaw extension and modification potentials |
| `research/02-repo-knowledge.md` | Deep dive into OpenClaw repo via DeepWiki |
| `research/03-technical-architecture.md` | Full technical architecture design |
| `research/04-devils-advocate.md` | Quality risks, limitations, throughput reality check |
| `research/05-dashboard-design.md` | Vercel monitoring dashboard design |
| `research/06-throughput-architecture.md` | v5 throughput architecture with orchestrator pattern |
| `research/07-throughput-critique.md` | Throughput critique — why commits/hour is wrong |
| `research/08-openclaw-complete-reference.md` | Complete OpenClaw configuration reference |
