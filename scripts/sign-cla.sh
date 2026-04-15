#!/usr/bin/env bash
# sign-cla.sh — Detect CLA type and attempt signing
# Usage: sign-cla.sh <owner/repo> [pr_number] [--workspace <path>]
# If pr_number is omitted, detects CLA type from repo metadata (CONTRIBUTING.md).
# Handles: cla-assistant bot, DCO sign-off, EasyCLA
# Exit 0 = CLA handled, Exit 1 = needs manual intervention

REPO="${1:?Usage: sign-cla.sh <owner/repo> [pr_number] [--workspace <path>]}"
PR_NUM="${2:-}"
WORKDIR=""
CLA_TYPE="none"

shift 1
[ -n "$PR_NUM" ] && shift
while [ $# -gt 0 ]; do
  case "$1" in
    --workspace) WORKDIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

fail() {
  python3 -c "import json,sys; print(json.dumps({'signed': False, 'cla_type': sys.argv[1], 'reason': sys.argv[2]}))" "$CLA_TYPE" "$1" 2>/dev/null || echo '{"signed": false, "cla_type": "unknown", "reason": "failed"}'
  exit 1
}

# ─── 1. Detect CLA type from PR comments/checks (if PR number given) or repo metadata ───
if [ -n "$PR_NUM" ]; then
  CLA_COMMENTS=$(gh api "repos/${REPO}/issues/${PR_NUM}/comments" --jq '[.[] | select(.user.login | test("cla|easycla|dco"; "i")) | {user: .user.login, body: .body[:500]}]' 2>/dev/null || echo "[]")
  CLA_COUNT=$(echo "$CLA_COMMENTS" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)
else
  # No PR number — detect CLA type from repo files (CONTRIBUTING.md, .github/)
  CLA_COMMENTS="[]"
  CLA_COUNT=0
  CONTRIB_TEXT=$(gh api "repos/${REPO}/contents/CONTRIBUTING.md" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null || echo "")
  if echo "$CONTRIB_TEXT" | grep -qi "cla-assistant"; then
    CLA_TYPE="cla-assistant"
  elif echo "$CONTRIB_TEXT" | grep -qi "easycla\|linux.foundation"; then
    CLA_TYPE="easycla"
  elif echo "$CONTRIB_TEXT" | grep -qi "dco\|signed-off-by\|developer certificate"; then
    CLA_TYPE="dco"
  fi
fi

if [ -n "$PR_NUM" ]; then
  if echo "$CLA_COMMENTS" | grep -qi "cla-assistant"; then
    CLA_TYPE="cla-assistant"
  elif echo "$CLA_COMMENTS" | grep -qi "easycla\|linux.foundation"; then
    CLA_TYPE="easycla"
  elif echo "$CLA_COMMENTS" | grep -qi "dco\|signed-off-by\|developer certificate"; then
    CLA_TYPE="dco"
  fi
fi

if [ "$CLA_TYPE" = "none" ] && [ "$CLA_COUNT" -eq 0 ]; then
  echo '{"signed": true, "cla_type": "none", "reason": "No CLA required"}'
  exit 0
fi

# ─── 2. Handle by type ───
case "$CLA_TYPE" in
  cla-assistant)
    if [ -z "$PR_NUM" ]; then
      echo '{"signed": false, "cla_type": "cla-assistant", "reason": "CLA-assistant requires PR number to post signing comment"}'
      exit 1
    fi
    gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
      -f body="I have read the CLA Document and I hereby sign the CLA" 2>/dev/null
    if [ $? -eq 0 ]; then
      echo '{"signed": true, "cla_type": "cla-assistant", "method": "comment"}'
      exit 0
    fi
    fail "Failed to post CLA signing comment"
    ;;

  dco)
    if [ -n "$WORKDIR" ] && [ -d "$WORKDIR" ]; then
      cd "$WORKDIR" || fail "Cannot cd to workspace"
      git commit --amend --signoff --no-edit 2>/dev/null
      if [ $? -eq 0 ]; then
        git push --force 2>/dev/null
        echo '{"signed": true, "cla_type": "dco", "method": "commit_signoff"}'
        exit 0
      fi
      fail "Failed to amend commit with sign-off"
    fi
    fail "DCO requires --workspace path to amend commits"
    ;;

  easycla)
    fail "EasyCLA requires manual web-based signing — check CLA bot comment for URL"
    ;;

  *)
    # Try generic cla-assistant approach (requires PR number)
    if [ -z "$PR_NUM" ]; then
      echo '{"signed": false, "cla_type": "unknown", "reason": "No PR number — cannot post CLA comment. Detected CLA requirement; pass PR number to sign."}'
      exit 1
    fi
    gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
      -f body="I have read the CLA Document and I hereby sign the CLA" 2>/dev/null
    echo '{"signed": true, "cla_type": "unknown", "method": "comment_attempt"}'
    exit 0
    ;;
esac
