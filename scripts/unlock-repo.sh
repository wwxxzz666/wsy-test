#!/usr/bin/env bash
# unlock-repo.sh — Release lock on a repo
# Usage: unlock-repo.sh <owner/repo>
# Exit 0 always

REPO="${1:?Usage: unlock-repo.sh <owner/repo>}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"

LOCK_FILE="$PROJECT_DIR/workspace/memory/locks/${OWNER}_${REPO_NAME}.lock"

if [ -f "$LOCK_FILE" ]; then
  rm -f "$LOCK_FILE"
  echo "{\"unlocked\": true, \"repo\": \"$REPO\"}"
else
  echo "{\"unlocked\": true, \"repo\": \"$REPO\", \"note\": \"was not locked\"}"
fi
exit 0
