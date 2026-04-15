#!/usr/bin/env bash
# check-supersession.sh — Check if someone else is already working on an issue
# Usage: check-supersession.sh <owner/repo> <issue_number>
# Exit 0 = clear, Exit 1 = superseded

REPO="${1:?Usage: check-supersession.sh <owner/repo> <issue_number>}"
ISSUE="${2:?Usage: check-supersession.sh <owner/repo> <issue_number>}"

# 1. Linked open PRs
LINKED=$(gh api "repos/${REPO}/issues/${ISSUE}/timeline" --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null and .state == "open")] | length' 2>/dev/null || echo 0)
[[ "$LINKED" =~ ^[0-9]+$ ]] || LINKED=0
if [ "$LINKED" -gt 0 ]; then
  echo "{\"superseded\": true, \"repo\": \"$REPO\", \"issue\": $ISSUE, \"reason\": \"${LINKED} open PR(s) already linked\"}"
  exit 1
fi

# 2. Assignees (validate response is not an error)
ASSIGNEES=$(gh api "repos/${REPO}/issues/${ISSUE}" --jq '.assignees[].login' 2>/dev/null || echo "")
# Filter out API error responses (404s contain "message" field)
if echo "$ASSIGNEES" | grep -q "message"; then
  ASSIGNEES=""
fi
if [ -n "$ASSIGNEES" ]; then
  python3 -c "import json,sys; print(json.dumps({'superseded': True, 'repo': sys.argv[1], 'issue': int(sys.argv[2]), 'reason': 'assigned to: ' + sys.argv[3]}))" "$REPO" "$ISSUE" "$ASSIGNEES"
  exit 1
fi

# 3. Someone claimed it
CLAIMED=$(gh api "repos/${REPO}/issues/${ISSUE}/comments" --jq '[.[] | select(.body | test("I.ll take|I.m working|I will fix|working on a fix"; "i"))] | length' 2>/dev/null || echo 0)
[[ "$CLAIMED" =~ ^[0-9]+$ ]] || CLAIMED=0
if [ "$CLAIMED" -gt 0 ]; then
  echo "{\"superseded\": true, \"repo\": \"$REPO\", \"issue\": $ISSUE, \"reason\": \"someone claimed this in comments\"}"
  exit 1
fi

# 4. Competing open PRs
COMPETING=$(gh pr list --repo "$REPO" --state open --search "$ISSUE" --json number,author --jq '[.[] | select(.author.login != "BillionClaw")] | length' 2>/dev/null || echo 0)
[[ "$COMPETING" =~ ^[0-9]+$ ]] || COMPETING=0
if [ "$COMPETING" -gt 0 ]; then
  echo "{\"superseded\": true, \"repo\": \"$REPO\", \"issue\": $ISSUE, \"reason\": \"${COMPETING} competing PR(s)\"}"
  exit 1
fi

echo "{\"superseded\": false, \"repo\": \"$REPO\", \"issue\": $ISSUE}"
exit 0
