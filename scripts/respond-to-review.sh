#!/usr/bin/env bash
# respond-to-review.sh — Simple follow-up actions for PR reviews
# Usage: respond-to-review.sh <owner/repo> <pr_number> <action> [--message <msg>]
# Actions: merge, bump, identity, close-fixed, close-invalid, thank, comment
# Exit 0 = action taken, Exit 1 = failed

REPO="${1:?Usage: respond-to-review.sh <owner/repo> <pr_number> <action>}"
PR_NUM="${2:?Usage: respond-to-review.sh <owner/repo> <pr_number> <action>}"
ACTION="${3:?Usage: respond-to-review.sh <owner/repo> <pr_number> <action>}"
MESSAGE=""

shift 3
while [ $# -gt 0 ]; do
  case "$1" in
    --message) MESSAGE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

fail() {
  python3 -c "import json,sys; print(json.dumps({'success': False, 'action': sys.argv[1], 'reason': sys.argv[2]}))" "$ACTION" "$1" 2>/dev/null || echo '{"success": false, "action": "unknown", "reason": "failed"}'
  exit 1
}

case "$ACTION" in
  merge)
    # Request merge (comment asking maintainer to merge)
    gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
      -f body="${MESSAGE:-Thank you for the review! This is ready to merge when you get a chance.}" 2>/dev/null
    [ $? -eq 0 ] && echo '{"success": true, "action": "merge", "method": "comment"}' || fail "Failed to post merge request comment"
    ;;

  bump)
    # Polite bump for stale PRs
    DAYS="${MESSAGE:-7}"
    gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
      -f body="Friendly bump -- this PR has been open for a while. Happy to make any changes if needed, or close it if no longer relevant." 2>/dev/null
    [ $? -eq 0 ] && echo '{"success": true, "action": "bump"}' || fail "Failed to post bump comment"
    ;;

  identity)
    # Respond to "are you a bot?" questions
    gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
      -f body="${MESSAGE:-This is BillionClaw. Happy to discuss the approach or make adjustments to the fix.}" 2>/dev/null
    [ $? -eq 0 ] && echo '{"success": true, "action": "identity"}' || fail "Failed to post identity response"
    ;;

  close-fixed)
    # Close PR because the issue was fixed elsewhere
    gh pr close "$PR_NUM" --repo "$REPO" \
      --comment "${MESSAGE:-Closing — the underlying issue has been resolved in another PR. Thank you for the review time!}" 2>/dev/null
    [ $? -eq 0 ] && echo '{"success": true, "action": "close-fixed"}' || fail "Failed to close PR"
    ;;

  close-invalid)
    # Close PR that's no longer valid
    gh pr close "$PR_NUM" --repo "$REPO" \
      --comment "${MESSAGE:-Closing this PR as it is no longer applicable. Thank you for the review time!}" 2>/dev/null
    [ $? -eq 0 ] && echo '{"success": true, "action": "close-invalid"}' || fail "Failed to close PR"
    ;;

  thank)
    # Thank reviewer after merge
    gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
      -f body="${MESSAGE:-Thank you for the review and merge! Glad to help.}" 2>/dev/null
    [ $? -eq 0 ] && echo '{"success": true, "action": "thank"}' || fail "Failed to post thank comment"
    ;;

  comment)
    # Post arbitrary comment
    [ -z "$MESSAGE" ] && fail "comment action requires --message"
    gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
      -f body="$MESSAGE" 2>/dev/null
    [ $? -eq 0 ] && echo '{"success": true, "action": "comment"}' || fail "Failed to post comment"
    ;;

  *)
    fail "Unknown action: $ACTION. Valid: merge, bump, identity, close-fixed, close-invalid, thank, comment"
    ;;
esac

exit 0
