#!/usr/bin/env bash
# heartbeat-status.sh — Quick status dump for the agent
# Usage: heartbeat-status.sh
# Outputs JSON with: active sessions, open PRs, queue depth, lock files,
#   wake state, scout status, PR monitor status, PR analyst status

if [ "${1:-}" = "--help" ]; then
  echo "Usage: heartbeat-status.sh"
  echo "Quick status snapshot for heartbeat step 0."
  exit 0
fi

PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
MEMORY_DIR="$PROJECT_DIR/workspace/memory"

# Wake state (macOS grep doesn't support -P, use sed instead)
WAKE_STATE=$(cat "$MEMORY_DIR/wake-state.md" 2>/dev/null || echo "unavailable")
CONSECUTIVE=$(echo "$WAKE_STATE" | sed -n 's/.*consecutive_wakes: *\([0-9]*\).*/\1/p' | head -1)
CONSECUTIVE=${CONSECUTIVE:-0}
ERRORS=$(echo "$WAKE_STATE" | sed -n 's/.*errors_this_hour: *\([0-9]*\).*/\1/p' | head -1)
ERRORS=${ERRORS:-0}

# Lock files
LOCK_COUNT=$(ls "$MEMORY_DIR/locks/"*.lock 2>/dev/null | wc -l | tr -d ' ')

# Queue depth
QUEUE_DEPTH=$(grep -c '^\- \[' "$MEMORY_DIR/work-queue.md" 2>/dev/null || true)
QUEUE_DEPTH=${QUEUE_DEPTH:-0}

# Staging queue
STAGING_DEPTH=$(grep -c '^\- \[' "$MEMORY_DIR/work-queue-staging.md" 2>/dev/null || true)
STAGING_DEPTH=${STAGING_DEPTH:-0}

# Open PRs
OPEN_PRS=$(gh search prs --author BillionClaw --state open --json number --jq 'length' 2>/dev/null || echo 0)

# Scout status
SCOUT_STATUS="unknown"
SCOUT_REPORT=""
LATEST_SCOUT=$(ls -t "$MEMORY_DIR"/scout-report-*.md 2>/dev/null | head -1)
if [ -n "$LATEST_SCOUT" ]; then
  MTIME=$(stat -f %m "$LATEST_SCOUT" 2>/dev/null || stat -c %Y "$LATEST_SCOUT" 2>/dev/null || echo 0)
  [ "$MTIME" -eq 0 ] 2>/dev/null && SCOUT_AGE_MIN=9999 || SCOUT_AGE_MIN=$(( ($(date +%s) - MTIME) / 60 ))
  if [ "$SCOUT_AGE_MIN" -lt 30 ]; then
    SCOUT_STATUS="active"
  else
    SCOUT_STATUS="stale (${SCOUT_AGE_MIN}min ago)"
  fi
  SCOUT_REPORT=$(basename "$LATEST_SCOUT")
else
  SCOUT_STATUS="no reports"
fi

# PR Monitor status
MONITOR_STATUS="unknown"
if [ -f "$MEMORY_DIR/pr-monitor-report.md" ]; then
  MTIME=$(stat -f %m "$MEMORY_DIR/pr-monitor-report.md" 2>/dev/null || stat -c %Y "$MEMORY_DIR/pr-monitor-report.md" 2>/dev/null || echo 0)
  [ "$MTIME" -eq 0 ] 2>/dev/null && MONITOR_AGE_MIN=9999 || MONITOR_AGE_MIN=$(( ($(date +%s) - MTIME) / 60 ))
  if [ "$MONITOR_AGE_MIN" -lt 30 ]; then
    MONITOR_STATUS="active"
  else
    MONITOR_STATUS="stale (${MONITOR_AGE_MIN}min ago)"
  fi
else
  MONITOR_STATUS="no reports"
fi

# PR Analyst status
ANALYST_STATUS="unknown"
if [ -f "$MEMORY_DIR/pr-strategy.md" ]; then
  MTIME=$(stat -f %m "$MEMORY_DIR/pr-strategy.md" 2>/dev/null || stat -c %Y "$MEMORY_DIR/pr-strategy.md" 2>/dev/null || echo 0)
  [ "$MTIME" -eq 0 ] 2>/dev/null && ANALYST_AGE_MIN=9999 || ANALYST_AGE_MIN=$(( ($(date +%s) - MTIME) / 60 ))
  if [ "$ANALYST_AGE_MIN" -lt 30 ]; then
    ANALYST_STATUS="active"
  else
    ANALYST_STATUS="stale (${ANALYST_AGE_MIN}min ago)"
  fi
else
  ANALYST_STATUS="no reports"
fi

# Followup staging
FOLLOWUP_COUNT=$(grep -c '^\- ' "$MEMORY_DIR/followup-staging.md" 2>/dev/null || true)
FOLLOWUP_COUNT=${FOLLOWUP_COUNT:-0}

# Pending spawns
PENDING_SPAWNS=$(grep -c "spawned_pending" "$MEMORY_DIR/impl-spawn-state.md" 2>/dev/null || true)
PENDING_SPAWNS=${PENDING_SPAWNS:-0}

cat <<ENDJSON
{
  "consecutive_wakes": $CONSECUTIVE,
  "errors_this_hour": $ERRORS,
  "lock_files": $LOCK_COUNT,
  "queue_depth": $QUEUE_DEPTH,
  "staging_depth": $STAGING_DEPTH,
  "open_prs": $OPEN_PRS,
  "followup_pending": $FOLLOWUP_COUNT,
  "spawned_pending": $PENDING_SPAWNS,
  "always_on": {
    "scout": "$SCOUT_STATUS",
    "scout_latest_report": "$SCOUT_REPORT",
    "pr_monitor": "$MONITOR_STATUS",
    "pr_analyst": "$ANALYST_STATUS"
  },
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON
