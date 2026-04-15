#!/usr/bin/env bash
# scan-pr-reviews.sh — Classify a single PR's review state and determine next action
# Usage: scan-pr-reviews.sh <owner/repo> <pr_number>
# Outputs JSON with review state, action needed, reviewer feedback
# Exit 0 always

REPO="${1:?Usage: scan-pr-reviews.sh <owner/repo> <pr_number>}"
PR_NUM="${2:?Usage: scan-pr-reviews.sh <owner/repo> <pr_number>}"

# ─── 1. Fetch reviews ───
REVIEWS=$(gh api "repos/${REPO}/pulls/${PR_NUM}/reviews" --jq '[.[] | {
  state: .state, user: .user.login, submitted_at: .submitted_at, body: (.body // "")[:500]
}]' 2>/dev/null || echo "[]")

# ─── 2. Fetch issue comments ───
COMMENTS=$(gh api "repos/${REPO}/issues/${PR_NUM}/comments?per_page=10&sort=created&direction=desc" --jq '[.[] | {
  user: .user.login, body: (.body // "")[:300], created_at: .created_at
}]' 2>/dev/null || echo "[]")

# ─── 3. Fetch CI status ───
HEAD_SHA=$(gh api "repos/${REPO}/pulls/${PR_NUM}" --jq '.head.sha' 2>/dev/null || echo "")
CI_STATUS="unknown"
[ -n "$HEAD_SHA" ] && CI_STATUS=$(gh api "repos/${REPO}/commits/${HEAD_SHA}/status" --jq '.state' 2>/dev/null || echo "unknown")

# ─── 4. Check runs (GitHub Actions) ───
CI_CHECKS="unknown"
[ -n "$HEAD_SHA" ] && CI_CHECKS=$(gh api "repos/${REPO}/commits/${HEAD_SHA}/check-runs" --jq '{
  total: .total_count,
  success: [.check_runs[] | select(.conclusion == "success")] | length,
  failure: [.check_runs[] | select(.conclusion == "failure")] | length,
  pending: [.check_runs[] | select(.status == "in_progress" or .status == "queued")] | length
}' 2>/dev/null || echo '{"total": 0}')

# ─── 5. Classify ───
python3 -c "
import json

reviews = $REVIEWS
comments = $COMMENTS
ci = '$CI_STATUS'
ci_checks = $CI_CHECKS

# Latest review per reviewer
latest = {}
for r in reviews:
    u = r['user']
    if u not in latest or r['submitted_at'] > latest[u]['submitted_at']:
        latest[u] = r

states = [v['state'] for v in latest.values()]
has_approval = 'APPROVED' in states
has_changes = 'CHANGES_REQUESTED' in states

# Unanswered maintainer comments
unanswered = [c for c in comments if c['user'] != 'BillionClaw'][:1]

# Determine state + action
if has_changes:
    state, action = 'changes_requested', 'address_review'
elif has_approval and ci in ('success', 'unknown'):
    state, action = 'approved', 'ready_to_merge'
elif has_approval:
    state, action = 'approved_ci_pending', 'wait_for_ci'
elif ci == 'failure' or (isinstance(ci_checks, dict) and ci_checks.get('failure', 0) > 0):
    state, action = 'ci_failing', 'fix_ci'
elif unanswered:
    state, action = 'comment_pending', 'respond_to_comment'
elif len(reviews) == 0:
    state, action = 'awaiting_review', 'wait'
else:
    state, action = 'in_review', 'wait'

# Extract feedback from changes_requested reviews
feedback = [r['body'] for r in latest.values() if r['state'] == 'CHANGES_REQUESTED' and r['body']]

result = {
    'repo': '$REPO',
    'pr_number': $PR_NUM,
    'state': state,
    'action': action,
    'has_approval': has_approval,
    'has_changes_requested': has_changes,
    'ci_status': ci,
    'ci_checks': ci_checks if isinstance(ci_checks, dict) else {},
    'review_count': len(reviews),
    'unique_reviewers': len(latest),
    'reviewer_feedback': feedback[:3],
    'unanswered_comments': len(unanswered),
    'reviews': reviews[-5:]
}
print(json.dumps(result, indent=2))
" 2>/dev/null || echo "{\"repo\": \"$REPO\", \"pr_number\": $PR_NUM, \"state\": \"unknown\", \"action\": \"wait\"}"

exit 0
