#!/usr/bin/env bash
# check-blocklist.sh — Check if a repo is in the blocklist
# Usage: check-blocklist.sh <owner/repo>
# Exit 0 = clear, Exit 1 = blocklisted (reason in JSON output)

REPO="${1:?Usage: check-blocklist.sh <owner/repo>}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
TRUST_FILE="$PROJECT_DIR/workspace/memory/trust-repos.md"

if [ ! -f "$TRUST_FILE" ]; then
  echo '{"blocked": false, "repo": "'"$REPO"'", "reason": "no trust file"}'
  exit 0
fi

# Extract the deprioritized section and check for this repo
DEPRIORITIZED=$(awk '/^## Deprioritized/,/^$/' "$TRUST_FILE")
MATCH=$(echo "$DEPRIORITIZED" | grep -i "${REPO}" || true)

if [ -n "$MATCH" ]; then
  # Extract reason and skip date
  REASON=$(echo "$MATCH" | sed 's/.*| *\(.*\) *|.*/\1/' | head -1 | xargs)
  SKIP_UNTIL=$(echo "$MATCH" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | tail -1 || echo "permanent")
  IS_PERMANENT=$(echo "$MATCH" | grep -ic "permanent" || true)
  IS_PERMANENT=${IS_PERMANENT:-0}

  # Check if skip period has expired (unless permanent)
  if [ "$IS_PERMANENT" -eq 0 ] && [ -n "$SKIP_UNTIL" ] && [ "$SKIP_UNTIL" != "permanent" ]; then
    TODAY=$(date +%Y-%m-%d)
    if [[ "$TODAY" > "$SKIP_UNTIL" ]]; then
      echo '{"blocked": false, "repo": "'"$REPO"'", "reason": "skip period expired (was until '"$SKIP_UNTIL"')"}'
      exit 0
    fi
  fi

  python3 -c "
import json, sys
print(json.dumps({
    'blocked': True,
    'repo': sys.argv[1],
    'reason': sys.argv[2],
    'skip_until': sys.argv[3],
    'permanent': sys.argv[4] == 'true'
}))
" "$REPO" "$REASON" "$SKIP_UNTIL" "$([ "$IS_PERMANENT" -gt 0 ] && echo true || echo false)"
  exit 1
fi

echo '{"blocked": false, "repo": "'"$REPO"'"}'
exit 0
