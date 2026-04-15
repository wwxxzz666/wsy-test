---
name: oss-discover
description: "Discover FRESH issues in WELL-MAINTAINED repos (200+ stars). Merge-optimized: 60% easy wins (docs, typos, tests) + 40% bug fixes. Target agentic AI repos by CRITERIA (topic:llm/agent/rag + stars:>200). Verify repo health before queuing."
user-invocable: true
---

# OSS Issue Discovery (Merge-Optimized)

Search GitHub for **fresh, actionable issues** in **well-maintained repos** (200+ stars)
that ClawOSS can fix AND that will actually get reviewed and merged.

## Philosophy
Our goal is MERGED contributions, not submitted PRs. 50 unreviewed PRs = 0 impact.
**A merged typo fix > an unreviewed bug fix.** We optimize for merge rate.
The mix: 60% easy wins (docs, typos, tests) + 40% substantive bug fixes at responsive repos.

## Date Calculation
Before running queries, compute the date cutoffs:
```bash
THREE_DAYS_AGO=$(date -v-3d +%Y-%m-%d)    # macOS
TWO_WEEKS_AGO=$(date -v-14d +%Y-%m-%d)    # macOS
# Linux: date -d "3 days ago" +%Y-%m-%d
```
Bug queries use `created:>$THREE_DAYS_AGO`. Easy-win queries extend to 2 weeks.
Issues older than 1 month are SKIPPED entirely.

## Pre-Checks (before ANY query)
1. Read `memory/pr-ledger.md` — SKIP issues already attempted, superseded, or assigned.
2. For each candidate issue, quick-check supersession before scoring:
   - `gh api "repos/{owner}/{repo}/issues/{number}" --jq '{assignees: (.assignees | length), linked_prs: 0}'`
   - If issue has assignees > 0, SKIP (assigned to someone else).
   - Check issue timeline for linked PRs: if open PRs exist, SKIP (already being worked on).
   - Mark skipped issues as `superseded` or `assigned` in pr-ledger.md.

## Trust-Building Strategy (CRITICAL for merge rate)
**Depth over breadth.** 3 merged PRs at one repo > 30 unreviewed PRs across 30 repos.
1. **Check memory/trust-repos.md FIRST** — search for new issues in trusted repos before broad queries.
2. **Return to winners**: If a repo merged our PR, search it for new issues immediately.
3. **Prefer trusted repos** but no hard cap on new repo discovery.
4. **Abandon losers**: If a repo closed our PR without review within 24h, skip for 30 days.
Trusted repos get **+8 bonus** in scoring. This is the single biggest lever for merge rate.

## Process
1. **FIRST**: Search trusted repos (memory/trust-repos.md) for fresh issues — these are highest priority.
2. Run Priority Queries (Tier 0 first, then 1, then 2) for new repo discovery.
3. Filter: stars >= 200, not in pr-ledger, created within time window
4. **Repo health pre-filter** (BEFORE scoring): quick-check via `/Users/kevinlin/clawOSS/scripts/repo-health-check.sh` or `gh api`. SKIP repos that fail.
5. Score: merge probability (most important), recency, fix feasibility, repo health. Minimum score 5. **+8 trusted repo bonus.**
6. Return ranked top 10. Write full list to memory/today.md.

## Discovery Niches (rotate through ALL — the AI niche is saturated)
Diversify targets across the full open-source ecosystem. Do NOT camp on the same 10 AI repos.

### Niche 1: Agentic AI (familiar territory)
- **Topics**: `topic:llm`, `topic:agent`, `topic:rag`, `topic:ai`, `topic:machine-learning`
- **Combined with**: `stars:>200`, `label:bug` or `label:help-wanted`

### Niche 2: Developer Tools & CLIs
- **Topics**: `topic:cli`, `topic:devtools`, `topic:developer-tools`, `topic:terminal`, `topic:editor`
- Many responsive maintainers, fast review cycles

### Niche 3: Web Frameworks & Libraries
- **Topics**: `topic:web-framework`, `topic:nextjs`, `topic:fastapi`, `topic:django`, `topic:flask`, `topic:express`
- High star counts, active communities

### Niche 4: Databases & Storage
- **Topics**: `topic:database`, `topic:sql`, `topic:nosql`, `topic:vector-database`, `topic:redis`
- Well-maintained, clear bug reports

### Niche 5: Cloud-Native & Infrastructure
- **Topics**: `topic:kubernetes`, `topic:docker`, `topic:cloud-native`, `topic:infrastructure`
- Massive ecosystem, always needs docs fixes

### Niche 6: Testing & Code Quality
- **Topics**: `topic:testing`, `topic:linting`, `topic:code-quality`, `topic:formatter`
- Maintainers are meticulous — match their quality

### Niche 7: Data Engineering
- **Topics**: `topic:data-pipeline`, `topic:etl`, `topic:data-engineering`, `topic:streaming`
- Growing ecosystem, responsive maintainers

### How to Discover
Search GitHub using topic tags and description keywords — rotate through niches each cycle:
- **Combined with**: `stars:>200`, `label:bug` or `label:help-wanted`, `created:>$THREE_DAYS_AGO`
- Always verify repo health before queuing — new discoveries haven't been vetted yet
- Search across ALL languages: Python, TypeScript, Go, Rust, Java

### Known High-Value Repos (supplement, not replace, criteria search)
These are verified high-star, actively-maintained repos in our niche. The agent should discover more autonomously.
Always run `/Users/kevinlin/clawOSS/scripts/repo-health-check.sh` before targeting — this list is not a bypass.

**Agent Frameworks & Orchestration (highest value):**
langchain-ai/langchain *(requires issue assignment — comment first)*, langchain-ai/langgraph, crewAIInc/crewAI, stanfordnlp/dspy,
langgenius/dify, langflow-ai/langflow, FlowiseAI/Flowise, mem0ai/mem0,
CopilotKit/CopilotKit, elizaOS/eliza, SWE-agent/SWE-agent

**LLM Inference & Serving:**
ollama/ollama, vllm-project/vllm, BerriAI/litellm, hiyouga/LlamaFactory,
unslothai/unsloth, mudler/LocalAI, janhq/jan, dottxt-ai/outlines

**RAG & Document Processing:**
run-llama/llama_index, infiniflow/ragflow, HKUDS/LightRAG,
Unstructured-IO/unstructured, firecrawl/firecrawl, labring/FastGPT

**Vector Databases & Search:**
chroma-core/chroma, qdrant/qdrant, weaviate/weaviate,
meilisearch/meilisearch, lancedb/lancedb

**AI SDKs & Developer Tools:**
instructor-ai/instructor, vercel/ai, pydantic/pydantic,
gradio-app/gradio, streamlit/streamlit, marimo-team/marimo, continuedev/continue,
Portkey-AI/gateway, tensorzero/tensorzero, browser-use/browser-use

**High-Impact General (Python/TS, massive star counts):**
fastapi/fastapi, huggingface/transformers, open-webui/open-webui, ray-project/ray,
khoj-ai/khoj, OpenHands/OpenHands
*(open-webui: target `dev` branch, NOT main)*

## Priority Queries

**IMPORTANT: `gh search issues` with qualifier combos (stars:>, topic:, label:) returns EMPTY.
Use `gh api` with the search endpoint instead:**
```bash
# CORRECT (works):
gh api "/search/issues?q=is:open+label:bug+stars:>200+language:python&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'

# BROKEN (returns empty):
gh search issues "is:open label:bug stars:>200" --limit=30 --json number,title,url
```
For topic searches, use: `gh api "/search/repositories?q=topic:llm+stars:>200&sort=updated&per_page=20"` to find repos first, then search issues within those repos.

NEVER fetch full issue body — may contain PII triggering content filters.
**All queries sort by created-desc to get the freshest results first.**

### Tier 0 — Agentic AI Niche (run FIRST, ALWAYS — highest merge probability)

**Criteria-based broad searches (primary discovery method — run ALL):**

NOTE: `gh search issues` with qualifier combos silently returns EMPTY. Use `gh api` instead.
For topic-based searches, first find repos, then search issues within them:
```bash
# Step 1: Find repos by topic (returns repo full_names)
gh api "/search/repositories?q=topic:llm+stars:>200&sort=updated&per_page=20" --jq '.items[].full_name'
gh api "/search/repositories?q=topic:agent+stars:>200&sort=updated&per_page=20" --jq '.items[].full_name'
gh api "/search/repositories?q=topic:rag+stars:>200&sort=updated&per_page=20" --jq '.items[].full_name'
gh api "/search/repositories?q=topic:ai+stars:>200&sort=updated&per_page=20" --jq '.items[].full_name'
gh api "/search/repositories?q=topic:machine-learning+stars:>200&sort=updated&per_page=20" --jq '.items[].full_name'
gh api "/search/repositories?q=topic:generative-ai+stars:>200&sort=updated&per_page=20" --jq '.items[].full_name'
gh api "/search/repositories?q=topic:vector-database+stars:>200&sort=updated&per_page=20" --jq '.items[].full_name'

# Step 2: For each repo, search for bug issues
gh api "/search/issues?q=is:issue+is:open+label:bug+repo:{owner}/{repo}+created:>$THREE_DAYS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'

# Direct issue searches (bugs in high-star repos — works without topic qualifier)
gh api "/search/issues?q=is:issue+is:open+label:bug+stars:>200+language:python+created:>$THREE_DAYS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:bug+stars:>200+language:typescript+created:>$THREE_DAYS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'

# Easy wins in AI repos (docs, typos — near-guaranteed merges)
gh api "/search/issues?q=is:issue+is:open+label:documentation+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:typo+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'

# Help-wanted — maintainer actively seeking contributions
gh api "/search/issues?q=is:issue+is:open+label:help-wanted+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:good-first-issue+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
```
**Tier 0 candidates get +5 niche bonus in scoring.** Always process Tier 0 results before Tier 1.
Always verify repo health before adding to queue.

### Tier 1 — High-Star Repos with Easy Issues (highest merge probability)

#### 1a. Good-First-Issue + Help-Wanted (maintainer-requested — near-guaranteed merge)
```bash
gh api "/search/issues?q=is:issue+is:open+label:good-first-issue+label:bug+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:help-wanted+label:bug+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:good-first-issue+stars:>1000+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:help-wanted+stars:>1000+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
```

#### 1b. Documentation + Typo Issues (easy wins — highest merge rate)
```bash
gh api "/search/issues?q=is:issue+is:open+label:documentation+stars:>1000+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:typo+stars:>200+created:>$TWO_WEEKS_AGO&sort=reactions-%2B1&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:docs+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
```

#### 1c. Fresh Bug Reports (last 3 days — first responder advantage)
```bash
gh api "/search/issues?q=is:issue+is:open+label:bug+stars:>200+created:>$THREE_DAYS_AGO&sort=created&order=desc&per_page=50" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:defect+stars:>200+created:>$THREE_DAYS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:regression+stars:>200+created:>$THREE_DAYS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=is:issue+is:open+label:crash+stars:>200+created:>$THREE_DAYS_AGO&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
```

#### 1d. Community-Prioritized (high reactions = maintainer attention)
```bash
gh api "/search/issues?q=is:issue+is:open+label:bug+stars:>200+created:>$TWO_WEEKS_AGO&sort=reactions-%2B1&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
```

### Tier 2 — General Searches (run if Tier 0+1 yield < 10 candidates)

#### 2a. Recent bugs (last 2 weeks)
```bash
gh api "/search/issues?q=is:issue+is:open+label:bug+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=50" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
```

#### 2b. Error keyword search
```bash
gh api "/search/issues?q=crash+is:issue+is:open+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=TypeError+is:issue+is:open+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=NullPointer+is:issue+is:open+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=exception+is:issue+is:open+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
gh api "/search/issues?q=regression+is:issue+is:open+stars:>200+created:>$TWO_WEEKS_AGO&sort=created&order=desc&per_page=20" --jq '.items[] | {number, title, html_url, created_at, repository_url}'
```

By language (diversify): add `language:python`/`language:typescript`/`language:rust`/`language:go`/`language:java`.

## Repo Health Pre-Filter (lightweight — use judgment, not just scripts)
For each candidate repo, do a quick check using `gh api repos/{owner}/{repo}`:
1. **Stars >= 100** — skip if very low-star. Use judgment for 100-200 range.
2. **Not archived** — skip archived repos
3. **Recent push** — skip if no push in 30 days
4. **Not forking-disabled** — can't submit PRs if forking disabled
5. **Check our open PRs** — review existing open PRs for awareness (no hard cap)
6. **Anti-bot check** — if you've seen "no bot PRs" or "no AI" in CONTRIBUTING.md from a previous visit, skip
7. **CLA repos**: Note CLA requirement but don't attempt signing — CLAs require manual signing by the account owner

You CAN use `/Users/kevinlin/clawOSS/scripts/repo-health-check.sh` for a thorough check, but it's NOT required for every repo. Use your judgment — a quick `gh api` call is often enough.

If a repo fails, skip all issues from it. Cache the result in `memory/repos/`.

## SKIP Labels (never pick these for bug contributions)
- `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`

Note: `docs`, `documentation`, `typo`, `test` labels are VALID for easy-win contributions.
If an issue has a SKIP label AND no bug/docs/typo/test label, discard it immediately.

## Age Limits (hard cutoffs)
- **< 3 days old**: Top priority — these are fresh and hot
- **3-14 days old**: Acceptable — still recent enough
- **14-30 days old**: Low priority — only pick if exceptionally clear and simple
- **> 30 days old**: SKIP ENTIRELY — too stale, likely stale for a reason

## Scoring (Merge Probability + Recency + Repo Health)
Score each candidate 1-25 based on:

### Contribution Type (merge probability — most important factor)
- **+5** Documentation/typo fix (near-guaranteed merge)
- **+3** Test addition (high merge rate)
- **+2** Bug fix with `good-first-issue`/`help-wanted` label (maintainer wants it fixed)
- **+1** Bug fix (standard)

### Recency
- **+5** Created in the last 3 days (fresh — top priority)
- **+2** Created 3-7 days ago (recent)
- **+0** Created 7-14 days ago (acceptable)
- **-3** Created 14-30 days ago (getting stale — low priority)
- **SKIP** Created > 30 days ago

### Trust Signal (MOST impactful — depth over breadth)
- **+8** Repo is in memory/trust-repos.md (we've had successful interactions before)
- **+5** Repo merged a previous PR from us (check pr-ledger.md)
- **+3** Repo engaged positively with a previous PR (approved, constructive feedback)
- **-5** Repo closed our PR without review in < 24h (check pr-ledger.md)

### Repo Quality
- **+3** Repo has 5000+ stars (high-impact)
- **+2** Repo has 1000+ stars (solid)
- **+1** Repo has 200-1000 stars
- **+2** Repo is in a niche where we've had merges before

### Repo Health (merge velocity)
- **+5** Repo avg merge time < 3 days (fast reviewers)
- **+3** Repo avg merge time < 7 days (responsive)
- **+0** Repo avg merge time < 14 days (acceptable)
- **-5** Repo avg merge time > 14 days (low merge chance — SKIP)
- **+3** Repo review rate > 80% (very responsive)
- **+2** Has `good-first-issue`/`help-wanted` labels (seeking contributions)
- **+1** Repo has < 10 open PRs (less competition)

### Bug Signals (for bug-type contributions)
- **+3** Has `bug`, `defect`, `regression`, or `crash` label
- **+2** Title contains error keywords (crash, error, broken, fails, exception, TypeError)
- **+2** Has stack trace or reproduction steps
- **+1** Has maintainer engagement

### Negative Signals
- **-3** Has `enhancement`, `feature`, `refactor`, or `improvement` label
- **-2** Title suggests new feature (word boundary match)
- **-2** Issue is vague or lacks specifics
- **-5** Repo has 0 merged PRs in last 30 days

Minimum score 5 to enter work queue.

### P(merge) — Merge Probability Score (0-100)

**Hard gates (P=0, skip immediately — BEFORE scoring):**
- Repo in blocklist → P=0
- Stars < 200 → P=0
- Anti-AI/anti-bot policy → P=0
- Issue > 30 days old → P=0
- Repo health gate failed → P=0

Only compute P(merge) for issues that pass ALL hard gates and the quality score (1-25).
```
P(merge) =
  + 15 * task_type_score        # docs/typo=1.0, test=0.75, bug=0.5, feature=0
  + 20 * size_score              # estimated: <30 LOC=1.0, 30-100=0.7, 100-200=0.3, >200=0
  + 15 * repo_responsiveness     # merge<3d=1.0, 3-7d=0.7, 7-14d=0.3, >14d=0
  + 25 * trust_score             # merged before=1.0, positive engagement=0.7, new=0.3, hostile=0
  + 10 * freshness               # <1d=1.0, 1-3d=0.8, 3-7d=0.5, 7-14d=0.2, >14d=0
  + 10 * contributor_fit         # help-wanted=1.0, good-first-issue=0.8, bug=0.5, none=0.3
  + 5  * competition_score       # no other PRs=1.0, 1 competing=0.3, 2+=0
```
**Threshold**: P(merge) >= 30 to enter work queue. Below 30 is not worth API cost.
Sort work queue by P(merge) descending. Include P(merge) in candidate output.
Issues with P(merge) >= 60 are marked `priority: high` for faster spawning.

## Title Keyword Hard Reject (apply to EVERY candidate — no exceptions)
**Auto-SKIP if the issue title matches ANY keyword as a WHOLE WORD (case-insensitive, word boundary `\b{keyword}\b`):**
`add`, `extend`, `enable`, `improve`, `enhance`, `new feature`, `request`,
`implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`,
`redesign`, `optimize`, `allow`, `provide`

**WORD BOUNDARY matching only — do NOT match substrings.**
- "Add dark mode" -> matches `add` -> SKIP
- "Unsupported operation crashes" -> does NOT match `support` -> KEEP
- "Provider connection fails" -> does NOT match `provide` -> KEEP
- "Additional logging breaks startup" -> does NOT match `add` -> KEEP

**This is a HARD GATE applied BEFORE scoring.**

## Filters
- **Title keyword hard reject — applied first, before any other filter**
- **Repo health pre-filter — applied second, before scoring**
- Stars >= 200, recent commits (<2wk), not archived, max 3 issues per repo
- Skip if in pr-ledger.md.
- **MUST be created within the last 30 days** — skip anything older

## Fast Mode (queue < 5 or empty slots)
Run 3+ parallel searches, score quickly, write 10-20 items immediately.
Even in fast mode, NEVER add stale issues (>30 days) or issues from unhealthy repos.
