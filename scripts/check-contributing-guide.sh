#!/usr/bin/env bash
# check-contributing-guide.sh — Parse CONTRIBUTING.md and extract metadata
# Usage: check-contributing-guide.sh <owner/repo> [--workspace <path>]
# Outputs JSON with branch target, PR conventions, CLA, testing requirements
# Exit 0 always

REPO="${1:?Usage: check-contributing-guide.sh <owner/repo>}"
WORKDIR=""

shift
while [ $# -gt 0 ]; do
  case "$1" in
    --workspace) WORKDIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

DEFAULT_BRANCH=$(gh api "repos/${REPO}" --jq '.default_branch' 2>/dev/null || echo "main")

# ─── 1. Find and read CONTRIBUTING.md ───
CONTRIBUTING=""
SOURCE="none"

if [ -n "$WORKDIR" ] && [ -d "$WORKDIR" ]; then
  for f in CONTRIBUTING.md .github/CONTRIBUTING.md docs/CONTRIBUTING.md; do
    if [ -f "$WORKDIR/$f" ]; then
      CONTRIBUTING=$(head -300 "$WORKDIR/$f")
      SOURCE="$f"
      break
    fi
  done
fi

# Fallback: fetch from GitHub
if [ -z "$CONTRIBUTING" ]; then
  for f in CONTRIBUTING.md .github/CONTRIBUTING.md docs/CONTRIBUTING.md; do
    CONTENT=$(curl -sL "https://raw.githubusercontent.com/${REPO}/${DEFAULT_BRANCH}/${f}" 2>/dev/null)
    if [ -n "$CONTENT" ] && ! echo "$CONTENT" | head -1 | grep -q "^404"; then
      CONTRIBUTING="$CONTENT"
      SOURCE="$f (remote)"
      break
    fi
  done
fi

if [ -z "$CONTRIBUTING" ]; then
  echo '{"has_contributing": false, "repo": "'"$REPO"'", "source": "none"}'
  exit 0
fi

# ─── 2. Extract metadata ───
echo "$CONTRIBUTING" | python3 -c "
import json, re, sys

text = sys.stdin.read()
_repo = sys.argv[1]
_source = sys.argv[2]
_default_branch = sys.argv[3]
result = {
    'has_contributing': True,
    'repo': _repo,
    'source': _source,
    'default_branch': _default_branch,
}

# Branch target
m = re.search(r'(?:branch|target|base).*?[\x60\"]([\w./-]+)[\x60\"]', text, re.I)
result['branch_target'] = m.group(1) if m else _default_branch

# PR title format
if re.search(r'conventional.commit|feat:|fix:|chore:', text, re.I):
    result['pr_title_format'] = 'conventional-commits'
else:
    result['pr_title_format'] = 'freeform'

# CLA
has_cla = False
cla_type = 'none'
if re.search(r'contributor license agreement|sign.*(cla|contributor)', text, re.I):
    has_cla = True
    cla_type = 'cla-assistant'
if re.search(r'developer certificate of origin|dco|signed-off-by', text, re.I):
    has_cla = True
    cla_type = 'dco'
result['has_cla'] = has_cla
result['cla_type'] = cla_type

# Testing
test_cmds = re.findall(r'[\x60]((?:npm|yarn|make|cargo|go|pytest|bundle|gradle|mvn)\s+\w+)[\x60]', text)
result['test_commands'] = test_cmds[:5]
result['tests_required'] = bool(re.search(r'run.*test|test.*required|make test', text, re.I))

# Linting
lint_cmds = re.findall(r'[\x60]((?:npm|yarn|make|cargo|go)\s+(?:lint|fmt|format|check)\w*)[\x60]', text)
result['lint_commands'] = lint_cmds[:5]
result['lint_required'] = bool(re.search(r'lint|format|style', text, re.I))

# Anti-bot
result['anti_bot'] = bool(re.search(r'no (bot|ai[- ]generated|automated)|human[- ]only|not accept.*(bot|ai)', text, re.I))

# AI disclosure
result['ai_disclosure'] = bool(re.search(r'ai.*(disclos|label|tag)|disclose.*ai|generated.*by.*ai', text, re.I))

# Issue linking
result['requires_issue_link'] = bool(re.search(r'link.*issue|reference.*issue|fixes #|closes #|must.*issue', text, re.I))

print(json.dumps(result, indent=2))
" "$REPO" "$SOURCE" "$DEFAULT_BRANCH" 2>/dev/null || echo "{\"has_contributing\": true, \"repo\": \"$REPO\", \"source\": \"$SOURCE\", \"parse_error\": true}"

exit 0
