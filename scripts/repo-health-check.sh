#!/usr/bin/env bash
# repo-health-check.sh — Deterministic repo health scoring
# Usage: ./repo-health-check.sh owner/repo [threshold]
# Exit 0 = healthy (score >= threshold), exit 1 = skip
# Outputs JSON with health metrics + composite score + failure_reason category
#
# Designed to be called from HEARTBEAT step 3g, oss-discover, oss-triage,
# and subagent-scout. API calls are minimized (single repos/ call for metadata).

set -euo pipefail

if [ $# -lt 1 ]; then
  echo '{"error": "Usage: repo-health-check.sh owner/repo [threshold]"}' >&2
  exit 1
fi

REPO="$1"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
THRESHOLD="${2:-5}"  # minimum composite score, default 5

# Date calculations (macOS + Linux compatible)
if date -v-1d +%Y-%m-%d &>/dev/null; then
  TWO_WEEKS_AGO=$(date -v-14d +%Y-%m-%dT00:00:00Z)
  THIRTY_DAYS_AGO=$(date -v-30d +%Y-%m-%dT00:00:00Z)
else
  TWO_WEEKS_AGO=$(date -d "14 days ago" +%Y-%m-%dT00:00:00Z)
  THIRTY_DAYS_AGO=$(date -d "30 days ago" +%Y-%m-%dT00:00:00Z)
fi

score=0
reasons=()
warnings=()

# Helper: emit JSON and exit with failure
fail() {
  local reason="$1"
  local category="$2"
  local reasons_json="[]"
  if [ ${#reasons[@]} -gt 0 ]; then
    reasons_json=$(printf '%s\n' "${reasons[@]}" | jq -R . | jq -s .)
  fi
  local warnings_json="[]"
  if [ ${#warnings[@]} -gt 0 ]; then
    warnings_json=$(printf '%s\n' "${warnings[@]}" | jq -R . | jq -s .)
  fi
  cat <<ENDJSON
{
  "pass": false,
  "score": ${score},
  "threshold": ${THRESHOLD},
  "repo": "${REPO}",
  "reason": $(echo "$reason" | jq -R .),
  "failure_reason": $(echo "$category" | jq -R .),
  "reasons": ${reasons_json},
  "warnings": ${warnings_json}
}
ENDJSON
  exit 1
}

# ─── Single repo metadata call (stars, pushed_at, description, topics, archived) ───
REPO_DATA=$(gh api "repos/${REPO}" --jq '{
  stars: .stargazers_count,
  pushed_at: .pushed_at,
  description: (.description // ""),
  topics: (.topics // []),
  archived: .archived,
  allow_forking: .allow_forking
}' 2>/dev/null || echo '{}')

if [ "$REPO_DATA" = '{}' ]; then
  fail "cannot fetch repo metadata" "tool_error: gh api repos/${REPO} failed"
fi

STARS=$(echo "$REPO_DATA" | jq -r '.stars // 0')
PUSHED_AT=$(echo "$REPO_DATA" | jq -r '.pushed_at // ""')
DESCRIPTION=$(echo "$REPO_DATA" | jq -r '.description // ""' | tr '[:upper:]' '[:lower:]')
TOPICS=$(echo "$REPO_DATA" | jq -r '.topics // [] | join(" ")' | tr '[:upper:]' '[:lower:]')
ARCHIVED=$(echo "$REPO_DATA" | jq -r '.archived // false')
ALLOW_FORKING=$(echo "$REPO_DATA" | jq -r '.allow_forking // true')

# ─── 0. Archived check ───
if [ "$ARCHIVED" = "true" ]; then
  fail "repo is archived" "repo_health_fail: archived"
fi

# ─── 0b. Fork restriction check ───
# GitHub allows repos to disable forking, which blocks external PRs entirely.
# Also covers the Feb 2026 "restrict PRs to collaborators" setting indirectly —
# if we can't fork, we can't submit PRs.
if [ "$ALLOW_FORKING" = "false" ]; then
  fail "forking disabled — cannot submit PRs" "repo_health_fail: forking disabled"
fi

# ─── 1. Stars ───
if [ "$STARS" -lt 200 ]; then
  reasons+=("stars=${STARS} (<200)")
  fail "stars=${STARS} (<200)" "repo_health_fail: stars ${STARS} below 200 minimum"
fi
if [ "$STARS" -ge 5000 ]; then
  score=$((score + 3))
elif [ "$STARS" -ge 1000 ]; then
  score=$((score + 2))
else
  score=$((score + 1))
fi

# ─── 2. Last push (activity check) ───
if [ -z "$PUSHED_AT" ]; then
  fail "cannot read pushed_at" "tool_error: pushed_at field missing"
fi

if [[ "$PUSHED_AT" < "$TWO_WEEKS_AGO" ]]; then
  reasons+=("last_push=${PUSHED_AT} (>2 weeks)")
  fail "last push ${PUSHED_AT} older than 2 weeks" "repo_health_fail: no activity in 2+ weeks"
fi
score=$((score + 1))

# ─── 3. Merged PRs in last 30 days ───
RECENT_MERGES=$(gh api "repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=50" \
  --jq "[.[] | select(.merged_at != null and .merged_at > \"$THIRTY_DAYS_AGO\")] | length" 2>/dev/null || echo "0")

if [ "$RECENT_MERGES" -eq 0 ]; then
  reasons+=("0 merged PRs in 30 days")
  fail "0 merged PRs in last 30 days" "repo_health_fail: zero merge velocity"
fi
if [ "$RECENT_MERGES" -ge 10 ]; then
  score=$((score + 3))
elif [ "$RECENT_MERGES" -ge 3 ]; then
  score=$((score + 2))
else
  score=$((score + 1))
fi

# ─── 3b. Average days to merge (from last 10 merged PRs) ───
# Uses Python for correct date math across month/year boundaries
AVG_MERGE_DAYS=0
MERGE_DATA=$(gh api "repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=10" \
  --jq '[.[] | select(.merged_at != null) | {created: .created_at, merged: .merged_at}]' 2>/dev/null || echo "[]")

if [ "$MERGE_DATA" != "[]" ]; then
  AVG_MERGE_DAYS=$(python3 -c "
import json, sys
from datetime import datetime
data = json.loads(sys.stdin.read())
if not data:
    print(0)
    sys.exit()
days = []
for pr in data:
    try:
        c = datetime.fromisoformat(pr['created'].replace('Z','+00:00'))
        m = datetime.fromisoformat(pr['merged'].replace('Z','+00:00'))
        days.append((m - c).days)
    except (ValueError, KeyError):
        pass
print(int(sum(days)/len(days)) if days else 0)
" <<< "$MERGE_DATA" 2>/dev/null || echo "0")
fi

# Sanitize AVG_MERGE_DAYS: if empty or non-numeric, fail safe (treat as high merge time)
if ! [[ "$AVG_MERGE_DAYS" =~ ^[0-9]+$ ]]; then
  AVG_MERGE_DAYS=999
fi

# Tiered merge time limits: relaxed for large repos (5000+ stars)
if [ "$STARS" -ge 5000 ]; then
  MERGE_LIMIT=30
else
  MERGE_LIMIT=14
fi
if [ "$AVG_MERGE_DAYS" -gt "$MERGE_LIMIT" ]; then
  reasons+=("avg_merge_days=${AVG_MERGE_DAYS} (>${MERGE_LIMIT})")
  fail "avg merge time ${AVG_MERGE_DAYS} days (>${MERGE_LIMIT}d)" "repo_health_fail: avg merge time ${AVG_MERGE_DAYS}d exceeds ${MERGE_LIMIT}d limit"
fi
# Score bonus for fast merge
if [ "$AVG_MERGE_DAYS" -le 3 ]; then
  score=$((score + 3))
elif [ "$AVG_MERGE_DAYS" -le 7 ]; then
  score=$((score + 2))
elif [ "$AVG_MERGE_DAYS" -le 14 ]; then
  score=$((score + 1))
fi

# ─── 4. Open PR backlog (use search API for accurate count beyond 100) ───
OPEN_PRS=$(gh api "/search/issues?q=is:pr+is:open+repo:${REPO}&per_page=1" --jq '.total_count' 2>/dev/null || echo "0")
# Tiered PR limits: relaxed for large repos
if [ "$STARS" -ge 20000 ]; then
  PR_LIMIT=1000  # mega-repos (vllm, langchain, transformers) have huge PR volume
elif [ "$STARS" -ge 5000 ]; then
  PR_LIMIT=500
else
  PR_LIMIT=50
fi
if [ "$OPEN_PRS" -ge "$PR_LIMIT" ]; then
  reasons+=("open_prs=${OPEN_PRS} (>=${PR_LIMIT})")
  fail "${OPEN_PRS} open PRs (>=${PR_LIMIT}, overwhelmed)" "repo_health_fail: ${OPEN_PRS} open PRs, maintainers overwhelmed"
fi
if [ "$OPEN_PRS" -lt 10 ]; then
  score=$((score + 2))
elif [ "$OPEN_PRS" -lt 30 ]; then
  score=$((score + 1))
fi

# ─── 5. PR review rate (% of last 5 merged PRs that have reviews) ───
# Uses 5 PRs instead of 10 to reduce API calls (1 call per PR for reviews).
# 5 is enough signal while halving the API budget for this section.
TOTAL_PRS=0
REVIEWED_PRS=0
MERGED_PR_NUMBERS=$(gh api "repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=5" \
  --jq '[.[] | select(.merged_at != null)] | .[0:5] | .[].number' 2>/dev/null || echo "")

if [ -n "$MERGED_PR_NUMBERS" ]; then
  for PR_NUM in $MERGED_PR_NUMBERS; do
    TOTAL_PRS=$((TOTAL_PRS + 1))
    REVIEW_COUNT=$(gh api "repos/${REPO}/pulls/${PR_NUM}/reviews" --jq 'length' 2>/dev/null || echo "0")
    if [ "$REVIEW_COUNT" -gt 0 ]; then
      REVIEWED_PRS=$((REVIEWED_PRS + 1))
    fi
    if [ "$TOTAL_PRS" -ge 5 ]; then break; fi
  done
fi

if [ "$TOTAL_PRS" -gt 0 ]; then
  REVIEW_RATE=$((REVIEWED_PRS * 100 / TOTAL_PRS))
else
  REVIEW_RATE=0
fi

# Tiered review rate: relaxed for large repos (5000+ stars)
if [ "$STARS" -ge 5000 ]; then
  REVIEW_MIN=30
else
  REVIEW_MIN=50
fi
if [ "$REVIEW_RATE" -lt "$REVIEW_MIN" ]; then
  reasons+=("review_rate=${REVIEW_RATE}% (<${REVIEW_MIN}%)")
  fail "review rate ${REVIEW_RATE}% (<${REVIEW_MIN}%)" "repo_health_fail: review rate ${REVIEW_RATE}% below ${REVIEW_MIN}% minimum"
fi
if [ "$REVIEW_RATE" -ge 80 ]; then
  score=$((score + 3))
elif [ "$REVIEW_RATE" -ge 60 ]; then
  score=$((score + 2))
else
  score=$((score + 1))
fi

# ─── 6. External contributor merges (do they merge outside PRs?) ───
EXTERNAL_MERGES=$(gh api "repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=30" \
  --jq '[.[] | select(.merged_at != null)] | [.[] | select(.author_association != "OWNER" and .author_association != "MEMBER" and .author_association != "COLLABORATOR")] | length' 2>/dev/null || echo "0")

if [ "$EXTERNAL_MERGES" -gt 0 ]; then
  score=$((score + 2))
else
  warnings+=("0 external contributor merges in recent 30 closed PRs")
fi

# ─── 7. CONTRIBUTING.md check (welcoming signal + anti-bot detection) ───
CONTRIBUTING=$(gh api "repos/${REPO}/contents/CONTRIBUTING.md" --jq '.content' 2>/dev/null || echo "")
HAS_CONTRIBUTING=false
ANTI_BOT=false
if [ -n "$CONTRIBUTING" ]; then
  HAS_CONTRIBUTING=true
  score=$((score + 1))  # has CONTRIBUTING.md = welcoming
  # Decode and check for anti-bot/anti-AI policies
  CONTRIB_TEXT=$(echo "$CONTRIBUTING" | base64 -d 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "")
  if echo "$CONTRIB_TEXT" | grep -qiE "\bno (bots?|ai[- ]generated|automated)\b|\bhuman[- ]only\b|\bnot accept.*(bots?|ai)\b|\bban.*(bots?|ai)\b|\bprohibit.*(bots?|ai)\b"; then
    ANTI_BOT=true
    reasons+=("anti-bot policy detected in CONTRIBUTING.md")
    fail "anti-bot/anti-AI policy in CONTRIBUTING.md" "repo_health_fail: anti-bot policy detected"
  fi
fi

# ─── 7b. CLA detection (nuanced: automatable = OK, manual-only = FAIL) ───
# Non-automatable CLA orgs require identity verification or postal mail.
# These are hard-fail because a bot cannot complete their process.
NON_AUTO_CLA_ORGS="apache microsoft google meta-llama"
for org in $NON_AUTO_CLA_ORGS; do
  if [ "$OWNER" = "$org" ]; then
    reasons+=("non-automatable CLA: $org requires manual identity verification")
    fail "non-automatable CLA ($org)" "repo_health_fail: $org CLA requires manual process"
  fi
done

# All other CLA repos are allowed — we sign CLAs via CLA-assistant or DCO.
HAS_CLA=false
AUTOMATABLE_CLA_ORGS="deepset-ai iterative Aider-AI milvus-io BerriAI"
for org in $AUTOMATABLE_CLA_ORGS; do
  if [ "$OWNER" = "$org" ]; then HAS_CLA=true; break; fi
done
if [ "$HAS_CLA" = "false" ]; then
  CLABOT=$(gh api "repos/${REPO}/contents/.clabot" --jq '.content' 2>/dev/null || echo "")
  [ -n "$CLABOT" ] && HAS_CLA=true
fi
if [ "$HAS_CLA" = "false" ]; then
  CLA_ACTION=$(gh api "repos/${REPO}/contents/.github/workflows" \
    --jq '[.[] | select(.name | test("cla|dco"; "i"))] | length' 2>/dev/null || echo "0")
  [ "$CLA_ACTION" -gt 0 ] && HAS_CLA=true
fi
if [ "$HAS_CLA" = "true" ]; then
  warnings+=("CLA/DCO required — sign it before submitting PR")
fi

# ─── 8. Niche fit (agentic AI) ───
REPO_LOWER=$(echo "$REPO" | tr '[:upper:]' '[:lower:]')

NICHE_FIT=false
for kw in agent agentic llm "large language model" rag "retrieval augmented" embedding "vector store" prompt chain "tool-use" "function-calling" ai-assistant copilot chatbot inference transformer fine-tuning mlops langchain langgraph llama-index autogen crewai semantic-kernel haystack dspy instructor openai anthropic ollama vllm litellm chromadb weaviate qdrant milvus pinecone lancedb; do
  if echo "$DESCRIPTION $TOPICS $REPO_LOWER" | grep -qi "$kw"; then
    NICHE_FIT=true
    score=$((score + 3))
    break
  fi
done

# ─── 10. Bot-friendly signals ───
HAS_CI=$(gh api "repos/${REPO}/contents/.github/workflows" --jq 'length' 2>/dev/null || echo "0")
if [ "$HAS_CI" -gt 0 ]; then
  score=$((score + 1))
fi

GFI_COUNT=$(gh api "repos/${REPO}/labels" --jq '[.[] | select(.name == "good first issue" or .name == "good-first-issue" or .name == "help wanted" or .name == "help-wanted")] | length' 2>/dev/null || echo "0")
if [ "$GFI_COUNT" -gt 0 ]; then
  score=$((score + 2))
fi

# ─── Final verdict ───
PASS=true
if [ "$score" -lt "$THRESHOLD" ]; then
  PASS=false
fi

# Build reasons/warnings JSON arrays
REASONS_JSON="[]"
if [ ${#reasons[@]} -gt 0 ]; then
  REASONS_JSON=$(printf '%s\n' "${reasons[@]}" | jq -R . | jq -s .)
fi
WARNINGS_JSON="[]"
if [ ${#warnings[@]} -gt 0 ]; then
  WARNINGS_JSON=$(printf '%s\n' "${warnings[@]}" | jq -R . | jq -s .)
fi

# Output JSON
cat <<ENDJSON
{
  "pass": ${PASS},
  "score": ${score},
  "threshold": ${THRESHOLD},
  "repo": "${REPO}",
  "reasons": ${REASONS_JSON},
  "warnings": ${WARNINGS_JSON},
  "metrics": {
    "stars": ${STARS},
    "pushed_at": "${PUSHED_AT}",
    "recent_merges_30d": ${RECENT_MERGES},
    "avg_merge_days": ${AVG_MERGE_DAYS:-0},
    "open_prs": ${OPEN_PRS},
    "review_rate_pct": ${REVIEW_RATE},
    "external_merges": ${EXTERNAL_MERGES},
    "niche_fit": ${NICHE_FIT},
    "archived": ${ARCHIVED},
    "allow_forking": ${ALLOW_FORKING},
    "has_ci": $([ "$HAS_CI" -gt 0 ] && echo true || echo false),
    "has_contributing": ${HAS_CONTRIBUTING},
    "has_cla": ${HAS_CLA},
    "anti_bot": ${ANTI_BOT},
    "has_gfi_labels": $([ "$GFI_COUNT" -gt 0 ] && echo true || echo false)
  }
}
ENDJSON

if [ "$PASS" = true ]; then
  exit 0
else
  exit 1
fi
