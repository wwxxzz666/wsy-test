#!/usr/bin/env bash
# lock-repo.sh — Atomic lock for a repo to prevent duplicate work
# Usage: lock-repo.sh <owner/repo> <issue_number> [<reason>]
# Exit 0 = locked, Exit 1 = already locked by another agent

REPO="${1:?Usage: lock-repo.sh <owner/repo> <issue_number> [reason]}"
ISSUE="${2:?Usage: lock-repo.sh <owner/repo> <issue_number>}"
REASON="${3:-workspace-setup}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"

LOCK_DIR="$PROJECT_DIR/workspace/memory/locks"
LOCK_FILE="$LOCK_DIR/${OWNER}_${REPO_NAME}.lock"

mkdir -p "$LOCK_DIR"

# Check existing lock
if [ -f "$LOCK_FILE" ]; then
  # Stale after 30 minutes (1800 seconds)
  LOCK_AGE=$(( ($(date +%s) - $(stat -f %m "$LOCK_FILE" 2>/dev/null || stat -c %Y "$LOCK_FILE" 2>/dev/null || echo $(date +%s))) ))
  if [ "$LOCK_AGE" -gt 1800 ]; then
    rm -f "$LOCK_FILE"
  else
    EXISTING=$(cat "$LOCK_FILE" 2>/dev/null || echo "unknown")
    echo "{\"locked\": false, \"reason\": \"already locked\", \"existing\": $(echo "$EXISTING" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '\"unknown\"')}"
    exit 1
  fi
fi

# Create lock atomically (using temp file + mv for atomicity)
TMPLOCK=$(mktemp "$LOCK_DIR/.tmp.XXXXXX")
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | ${REPO}#${ISSUE} | ${REASON}" > "$TMPLOCK"
mv "$TMPLOCK" "$LOCK_FILE"

echo "{\"locked\": true, \"repo\": \"$REPO\", \"issue\": $ISSUE, \"lock_file\": \"$LOCK_FILE\"}"
exit 0
