#!/usr/bin/env bash
# cleanup-stale-sessions.sh — Clean stale locks and report stale state
# Usage: cleanup-stale-sessions.sh
# Cleans lock files older than 30 minutes
# Resets spawned_pending entries in state files
# Exit 0 always, outputs JSON summary

WORKSPACE_DIR="${WORKSPACE_DIR:-/Users/kevinlin/clawOSS/workspace}"
LOCK_DIR="${WORKSPACE_DIR}/memory/locks"
IMPL_STATE="${WORKSPACE_DIR}/memory/impl-spawn-state.md"
FOLLOWUP_STATE="${WORKSPACE_DIR}/memory/pr-followup-state.md"

STALE_LOCKS=0
RESET_PENDING=0

# Clean stale lock files (> 30 minutes old)
if [ -d "$LOCK_DIR" ]; then
  STALE_LOCKS=$(find "$LOCK_DIR" -name "*.lock" -mmin +30 2>/dev/null | wc -l | tr -d ' ')
  find "$LOCK_DIR" -name "*.lock" -mmin +30 -delete 2>/dev/null
fi

# Reset orphaned spawned_pending entries
# These occur when a subagent dies without writing a result
if [ -f "$IMPL_STATE" ]; then
  PENDING_COUNT=$(grep -c "spawned_pending" "$IMPL_STATE" 2>/dev/null || true)
  PENDING_COUNT=${PENDING_COUNT:-0}
  if [ "$PENDING_COUNT" -gt 0 ]; then
    sed -i '' 's/spawned_pending/stale_reset/g' "$IMPL_STATE" 2>/dev/null || \
    sed -i 's/spawned_pending/stale_reset/g' "$IMPL_STATE" 2>/dev/null || true
    RESET_PENDING=$((RESET_PENDING + PENDING_COUNT))
  fi
fi

if [ -f "$FOLLOWUP_STATE" ]; then
  PENDING_COUNT=$(grep -c "spawned_pending" "$FOLLOWUP_STATE" 2>/dev/null || true)
  PENDING_COUNT=${PENDING_COUNT:-0}
  if [ "$PENDING_COUNT" -gt 0 ]; then
    sed -i '' 's/spawned_pending/stale_reset/g' "$FOLLOWUP_STATE" 2>/dev/null || \
    sed -i 's/spawned_pending/stale_reset/g' "$FOLLOWUP_STATE" 2>/dev/null || true
    RESET_PENDING=$((RESET_PENDING + PENDING_COUNT))
  fi
fi

cat <<ENDJSON
{
  "stale_locks_removed": $STALE_LOCKS,
  "spawned_pending_reset": $RESET_PENDING,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON
