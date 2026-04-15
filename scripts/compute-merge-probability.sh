#!/usr/bin/env bash
# compute-merge-probability.sh — Calculate P(merge) score for an issue/repo pair
# Usage: compute-merge-probability.sh <owner/repo> <issue_number> [--type fix|docs|test|typo]
# Outputs JSON with score 0-100 and component breakdown
# Exit 0 always (score=0 means skip)

REPO="${1:?Usage: compute-merge-probability.sh <owner/repo> <issue_number> [--type TYPE]}"
ISSUE="${2:?Usage: compute-merge-probability.sh <owner/repo> <issue_number>}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
TYPE="fix"

shift 2
while [ $# -gt 0 ]; do
  case "$1" in
    --type) TYPE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"

# Weights: 15% task_type + 20% size + 15% responsiveness + 25% trust + 10% freshness + 10% contributor_fit + 5% competition
W_TYPE=15 W_SIZE=20 W_RESPONSIVE=15 W_TRUST=25 W_FRESH=10 W_FIT=10 W_COMP=5

# ─── 1. Task type score (0-100) ───
case "$TYPE" in
  docs|typo) S_TYPE=90 ;;
  test)      S_TYPE=80 ;;
  fix)       S_TYPE=70 ;;
  *)         S_TYPE=50 ;;
esac

# ─── 2. Size estimate from issue body length (0-100, smaller = better) ───
BODY_LEN=$(gh api "repos/${REPO}/issues/${ISSUE}" --jq '.body | length' 2>/dev/null || echo 500)
if [ "$BODY_LEN" -lt 200 ]; then
  S_SIZE=90
elif [ "$BODY_LEN" -lt 1000 ]; then
  S_SIZE=70
elif [ "$BODY_LEN" -lt 3000 ]; then
  S_SIZE=50
else
  S_SIZE=30
fi

# ─── 3. Repo responsiveness (0-100) ───
AVG_COMMENTS=$(gh api "repos/${REPO}/issues?state=closed&per_page=5&sort=updated" --jq '[.[].comments] | add / length' 2>/dev/null || echo 0)
if python3 -c "exit(0 if float('${AVG_COMMENTS:-0}') > 3 else 1)" 2>/dev/null; then
  S_RESPONSIVE=85
elif python3 -c "exit(0 if float('${AVG_COMMENTS:-0}') > 1 else 1)" 2>/dev/null; then
  S_RESPONSIVE=65
elif python3 -c "exit(0 if float('${AVG_COMMENTS:-0}') > 0 else 1)" 2>/dev/null; then
  S_RESPONSIVE=40
else
  S_RESPONSIVE=20
fi

# ─── 4. Trust score (0-100) ───
TRUST_FILE="$PROJECT_DIR/workspace/memory/trust-repos.md"
S_TRUST=50
if [ -f "$TRUST_FILE" ]; then
  TRUST_LINE=$(awk '/^## Active/,/^## /' "$TRUST_FILE" | grep -i "${OWNER}/${REPO_NAME}" || true)
  if [ -n "$TRUST_LINE" ]; then
    TRUST_VAL=$(echo "$TRUST_LINE" | grep -oE '\| *[0-9]+(\.[0-9]+)? *\|' | head -1 | grep -oE '[0-9]+' | head -1)
    S_TRUST=$(( ${TRUST_VAL:-7} * 10 ))
    [ "$S_TRUST" -gt 100 ] && S_TRUST=100
  fi
  DEPRI=$(awk '/^## Deprioritized/,/^## /' "$TRUST_FILE" | grep -i "${OWNER}/${REPO_NAME}" || true)
  [ -n "$DEPRI" ] && S_TRUST=5
fi

# ─── 5. Freshness score (0-100) ───
CREATED_AT=$(gh api "repos/${REPO}/issues/${ISSUE}" --jq '.created_at' 2>/dev/null || echo "")
S_FRESH=50
if [ -n "$CREATED_AT" ]; then
  CREATED_TS=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$CREATED_AT" +%s 2>/dev/null || date -d "$CREATED_AT" +%s 2>/dev/null || python3 -c "from datetime import datetime; print(int(datetime.fromisoformat('${CREATED_AT}'.replace('Z','+00:00')).timestamp()))" 2>/dev/null || echo 0)
  NOW_TS=$(date +%s)
  AGE_DAYS=$(( (NOW_TS - CREATED_TS) / 86400 ))
  if [ "$AGE_DAYS" -lt 3 ]; then S_FRESH=95
  elif [ "$AGE_DAYS" -lt 7 ]; then S_FRESH=80
  elif [ "$AGE_DAYS" -lt 14 ]; then S_FRESH=60
  elif [ "$AGE_DAYS" -lt 30 ]; then S_FRESH=40
  else S_FRESH=15; fi
fi

# ─── 6. Contributor fit (0-100) ───
PREV_PRS=$(gh search prs --author BillionClaw --repo "$REPO" "is:merged" --json number --jq 'length' 2>/dev/null || echo 0)
if [ "$PREV_PRS" -gt 2 ]; then S_FIT=95
elif [ "$PREV_PRS" -gt 0 ]; then S_FIT=80
else S_FIT=50; fi

# ─── 7. Competition (0-100) ───
OPEN_PRS=$(gh api "repos/${REPO}/issues/${ISSUE}/timeline" --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null and .state == "open")] | length' 2>/dev/null || echo 0)
if [ "$OPEN_PRS" -eq 0 ]; then S_COMP=95
elif [ "$OPEN_PRS" -eq 1 ]; then S_COMP=40
else S_COMP=10; fi

# ─── Calculate weighted score ───
SCORE=$(python3 -c "
t=$S_TYPE; sz=$S_SIZE; r=$S_RESPONSIVE; tr=$S_TRUST; f=$S_FRESH; ft=$S_FIT; c=$S_COMP
wt=$W_TYPE; wsz=$W_SIZE; wr=$W_RESPONSIVE; wtr=$W_TRUST; wf=$W_FRESH; wft=$W_FIT; wc=$W_COMP
score = (t*wt + sz*wsz + r*wr + tr*wtr + f*wf + ft*wft + c*wc) / 100
print(round(score))
" 2>/dev/null || echo 50)

cat <<ENDJSON
{
  "score": $SCORE,
  "repo": "$REPO",
  "issue": $ISSUE,
  "type": "$TYPE",
  "components": {
    "task_type": {"score": $S_TYPE, "weight": $W_TYPE},
    "size": {"score": $S_SIZE, "weight": $W_SIZE},
    "responsiveness": {"score": $S_RESPONSIVE, "weight": $W_RESPONSIVE},
    "trust": {"score": $S_TRUST, "weight": $W_TRUST},
    "freshness": {"score": $S_FRESH, "weight": $W_FRESH},
    "contributor_fit": {"score": $S_FIT, "weight": $W_FIT},
    "competition": {"score": $S_COMP, "weight": $W_COMP}
  },
  "recommendation": $(python3 -c "s=$SCORE; print('\"strong_yes\"' if s>=75 else '\"yes\"' if s>=55 else '\"maybe\"' if s>=35 else '\"skip\"')" 2>/dev/null || echo '"unknown"')
}
ENDJSON
exit 0
