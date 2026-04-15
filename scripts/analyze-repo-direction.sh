#!/usr/bin/env bash
# analyze-repo-direction.sh — Analyze codebase direction for a repo
# Usage: ./analyze-repo-direction.sh owner/repo
# Outputs JSON with active areas, frozen areas, maintainer priorities, recent release info
# Exit 0 always (data in JSON)

if [ "${1:-}" = "--help" ] || [ $# -lt 1 ]; then
  echo "Usage: analyze-repo-direction.sh <owner/repo>"
  echo "Outputs JSON with codebase direction analysis"
  exit 0
fi

REPO="$1"

# 1. Recent commits — what are maintainers actively working on?
RECENT_COMMITS=$(gh api "repos/${REPO}/commits?per_page=20" \
  --jq '[.[].commit.message | split("\n")[0]]' 2>/dev/null || echo '[]')

# 2. High-engagement issues — what do maintainers care about?
HIGH_COMMENT_ISSUES=$(gh api "repos/${REPO}/issues?state=open&sort=comments&direction=desc&per_page=10" \
  --jq '[.[] | {number, title, comments}]' 2>/dev/null || echo '[]')

# 3. Active PRs — what external contributions get attention?
ACTIVE_PRS=$(gh api "repos/${REPO}/pulls?state=open&sort=updated&direction=desc&per_page=10" \
  --jq '[.[] | {number, title, user: .user.login}]' 2>/dev/null || echo '[]')

# 4. Priority labels — maintainer focus areas
PRIORITY_LABELS=$(gh api "repos/${REPO}/labels?per_page=50" \
  --jq '[.[] | select(.name | test("priority|p0|p1|critical|next|planned|urgent"; "i")) | .name]' 2>/dev/null || echo '[]')

# 5. Recent release — post-release = best window for bug fixes
LATEST_RELEASE=$(gh api "repos/${REPO}/releases?per_page=1" \
  --jq '.[0] | {tag: .tag_name, date: .published_at, name: .name}' 2>/dev/null || echo '{"tag": null, "date": null, "name": null}')

# 6. CHANGELOG excerpt (first 30 lines)
CHANGELOG=$(gh api "repos/${REPO}/contents/CHANGELOG.md" \
  --jq '.content' 2>/dev/null | base64 -d 2>/dev/null | head -30 | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')

# 7. Default branch
DEFAULT_BRANCH=$(gh api "repos/${REPO}" --jq '.default_branch' 2>/dev/null || echo "main")

# Extract active modules from commit messages
ACTIVE_MODULES=$(echo "$RECENT_COMMITS" | python3 -c "
import json, sys, re
from collections import Counter
commits = json.load(sys.stdin)
modules = []
for msg in commits:
    # Extract conventional commit scopes: fix(module), feat(module), etc.
    m = re.match(r'\w+\(([^)]+)\)', msg)
    if m:
        modules.append(m.group(1))
    # Extract file paths mentioned
    paths = re.findall(r'[\w-]+/[\w.-]+', msg)
    modules.extend(p.split('/')[0] for p in paths)
counts = Counter(modules).most_common(10)
print(json.dumps([{'module': m, 'commits': c} for m, c in counts]))
" 2>/dev/null || echo '[]')

# Output JSON
cat <<EOF
{
  "repo": "${REPO}",
  "default_branch": "${DEFAULT_BRANCH}",
  "recent_commits": ${RECENT_COMMITS},
  "active_modules": ${ACTIVE_MODULES},
  "high_engagement_issues": ${HIGH_COMMENT_ISSUES},
  "active_prs": ${ACTIVE_PRS},
  "priority_labels": ${PRIORITY_LABELS},
  "latest_release": ${LATEST_RELEASE},
  "changelog_excerpt": ${CHANGELOG}
}
EOF
