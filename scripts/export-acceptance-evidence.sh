#!/usr/bin/env bash
set -euo pipefail

# Export acceptance evidence for demo:
# - model/budget env snapshot (sanitized)
# - dashboard status snapshot
# - GitHub PR activity snapshot

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="$PROJECT_DIR/reports/acceptance"
mkdir -p "$REPORT_DIR"

TIMESTAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_MD="$REPORT_DIR/acceptance-evidence-$TIMESTAMP_UTC.md"
OUT_JSON="$REPORT_DIR/acceptance-evidence-$TIMESTAMP_UTC.json"

# Load .env if present
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

MODEL_PRIMARY="${CLAWOSS_MODEL_PRIMARY:-unknown}"
MODEL_FALLBACKS="${CLAWOSS_MODEL_FALLBACKS:-}"
MODEL_BASE_URL="${CLAWOSS_LLM_BASE_URL:-unknown}"
TOKEN_BUDGET_TOTAL="${CLAWOSS_TOKEN_BUDGET_TOTAL:-0}"
DASHBOARD_URL="${DASHBOARD_URL:-https://clawoss-dashboard.vercel.app}"
GITHUB_USERNAME="${GITHUB_USERNAME:-}"
if [ -z "$GITHUB_USERNAME" ] && command -v gh >/dev/null 2>&1; then
  GITHUB_USERNAME="$(gh api user --jq .login 2>/dev/null || true)"
fi
GITHUB_USERNAME="${GITHUB_USERNAME:-unknown}"

HAS_GH=false
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  HAS_GH=true
fi

HAS_CLAW_KEY=false
if [ -n "${CLAW_API_KEY:-}" ]; then
  HAS_CLAW_KEY=true
fi

CONNECTION_JSON="{}"
OVERVIEW_JSON="{}"
if [ "$HAS_CLAW_KEY" = true ] && command -v curl >/dev/null 2>&1; then
  CONNECTION_JSON="$(curl -s --max-time 15 "$DASHBOARD_URL/api/connection-status" \
    -H "Authorization: Bearer ${CLAW_API_KEY}" || echo '{}')"
  OVERVIEW_JSON="$(curl -s --max-time 15 "$DASHBOARD_URL/api/metrics/overview" \
    -H "Authorization: Bearer ${CLAW_API_KEY}" || echo '{}')"
fi

PRS_JSON='[]'
PR_TOTAL=0
PR_OPEN=0
PR_MERGED=0
PR_CLOSED=0
PR_LAST_30D=0
if [ "$HAS_GH" = true ]; then
  PRS_JSON="$(gh search prs --author "$GITHUB_USERNAME" --state all --limit 200 \
    --json repository,number,title,url,state,createdAt,mergedAt,closedAt 2>/dev/null || echo '[]')"

  PR_TOTAL="$(echo "$PRS_JSON" | jq 'length' 2>/dev/null || echo 0)"
  PR_OPEN="$(echo "$PRS_JSON" | jq '[.[] | select(.state=="OPEN")] | length' 2>/dev/null || echo 0)"
  PR_MERGED="$(echo "$PRS_JSON" | jq '[.[] | select(.mergedAt != null)] | length' 2>/dev/null || echo 0)"
  PR_CLOSED="$(echo "$PRS_JSON" | jq '[.[] | select(.state=="CLOSED" and .mergedAt == null)] | length' 2>/dev/null || echo 0)"
  PR_LAST_30D="$(echo "$PRS_JSON" | jq '[.[] | select((now - (.createdAt | fromdateiso8601)) <= (30*24*60*60))] | length' 2>/dev/null || echo 0)"
fi

# Optional local OpenClaw model snapshot (sanitized, no keys)
OPENCLAW_DEPLOYED="$HOME/.openclaw/openclaw.json"
DEPLOYED_MODEL_JSON='{}'
if [ -f "$OPENCLAW_DEPLOYED" ] && command -v jq >/dev/null 2>&1; then
  DEPLOYED_MODEL_JSON="$(jq '{
    agentPrimaryModel: .agents.defaults.model.primary,
    agentFallbacks: .agents.defaults.model.fallbacks,
    subagentModel: .agents.defaults.subagents.model,
    providers: (.models.providers | keys)
  }' "$OPENCLAW_DEPLOYED" 2>/dev/null || echo '{}')"
fi

cat > "$OUT_JSON" <<EOF
{
  "generatedAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "projectDir": "$PROJECT_DIR",
  "envSnapshot": {
    "modelPrimary": "$MODEL_PRIMARY",
    "modelFallbacks": "$MODEL_FALLBACKS",
    "modelBaseUrl": "$MODEL_BASE_URL",
    "tokenBudgetTotal": "$TOKEN_BUDGET_TOTAL",
    "dashboardUrl": "$DASHBOARD_URL",
    "githubUsername": "$GITHUB_USERNAME"
  },
  "openclawDeployedModel": $DEPLOYED_MODEL_JSON,
  "dashboardConnection": $CONNECTION_JSON,
  "dashboardOverview": $OVERVIEW_JSON,
  "githubPrStats": {
    "total": $PR_TOTAL,
    "open": $PR_OPEN,
    "merged": $PR_MERGED,
    "closedNotMerged": $PR_CLOSED,
    "createdLast30d": $PR_LAST_30D
  },
  "githubPrs": $PRS_JSON
}
EOF

{
  echo "# ClawOSS Acceptance Evidence"
  echo
  echo "- Generated (UTC): \`$(date -u +%Y-%m-%dT%H:%M:%SZ)\`"
  echo "- Dashboard URL: \`$DASHBOARD_URL\`"
  echo "- GitHub account: \`$GITHUB_USERNAME\`"
  echo
  echo "## 1) Model + Budget Config (Env)"
  echo "- Primary model: \`$MODEL_PRIMARY\`"
  echo "- Fallback models: \`${MODEL_FALLBACKS:-none}\`"
  echo "- API base URL: \`$MODEL_BASE_URL\`"
  echo "- Total token budget: \`$TOKEN_BUDGET_TOTAL\`"
  echo
  echo "## 2) Dashboard Snapshot"
  if [ "$HAS_CLAW_KEY" = true ]; then
    echo "- Connection status API: available"
    echo "- Overview API: available"
    echo
    echo "### connection-status"
    echo '```json'
    echo "$CONNECTION_JSON" | jq . 2>/dev/null || echo "$CONNECTION_JSON"
    echo '```'
    echo
    echo "### metrics-overview (runtime excerpt)"
    echo '```json'
    echo "$OVERVIEW_JSON" | jq '{runtime, stats: {activeModel: .stats.activeModel, tokensUsedToday: .stats.tokensUsedToday, costToday: .stats.costToday}}' 2>/dev/null || echo "$OVERVIEW_JSON"
    echo '```'
  else
    echo "- Skipped: \`CLAW_API_KEY\` not set"
  fi
  echo
  echo "## 3) GitHub PR Activity Snapshot"
  if [ "$HAS_GH" = true ]; then
    echo "- Total PRs (sample window <=200): **$PR_TOTAL**"
    echo "- Open: **$PR_OPEN**"
    echo "- Merged: **$PR_MERGED**"
    echo "- Closed (not merged): **$PR_CLOSED**"
    echo "- Created in last 30 days: **$PR_LAST_30D**"
    echo
    echo "### Recent PR Links (Top 20)"
    echo "$PRS_JSON" | jq -r 'sort_by(.createdAt) | reverse | .[:20] | .[] | "- " + .url + " (" + .repository.nameWithOwner + " #" + (.number|tostring) + ")"' 2>/dev/null || true
  else
    echo "- Skipped: gh CLI not authenticated"
  fi
  echo
  echo "## 4) Raw Evidence JSON"
  echo "- \`$OUT_JSON\`"
} > "$OUT_MD"

echo "Evidence exported:"
echo "  $OUT_MD"
echo "  $OUT_JSON"
