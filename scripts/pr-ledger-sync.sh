#!/usr/bin/env bash
set -euo pipefail

# pr-ledger-sync.sh — Keeps workspace/memory/pr-ledger.md in sync with GitHub
#
# Two data sources:
#   1. GitHub API: all PRs authored by BillionClaw (authoritative for status)
#   2. Subagent result files: picks up PRs before GitHub search indexes them
#
# Can run standalone or be called from dashboard-sync.sh every ~60s.
# Idempotent — safe to run repeatedly.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LEDGER="$PROJECT_DIR/workspace/memory/pr-ledger.md"
RESULT_DIR="$PROJECT_DIR/workspace/memory"
AGENT_USER="${CLAW_AGENT_USERNAME:-BillionClaw}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] pr-ledger-sync: $*"; }

# Ensure gh is authenticated
if ! gh auth status >/dev/null 2>&1; then
    log "ERROR: gh not authenticated, skipping sync"
    exit 1
fi

# --- Collect PRs from GitHub ---
# Search returns all PRs by the agent, sorted by most recent
GH_PRS=$(gh search prs --author "$AGENT_USER" --limit 200 \
    --json repository,number,url,state,createdAt 2>/dev/null || echo '[]')

# --- Collect PRs from unprocessed subagent result files ---
# Build result PRs JSON safely via Python (no shell interpolation into code)
RESULT_PRS="[]"
for f in "$RESULT_DIR"/subagent-result-*.md; do
    [ ! -f "$f" ] && continue
    # Extract PR URL from result file (looks for github.com/.../pull/NNN)
    PR_URL=$(grep -oE 'https://github\.com/[^/]+/[^/]+/pull/[0-9]+' "$f" 2>/dev/null | head -1 || true)
    [ -z "$PR_URL" ] && continue

    # Extract repo and issue from the PR URL
    REPO=$(echo "$PR_URL" | sed -E 's|https://github\.com/([^/]+/[^/]+)/pull/.*|\1|')
    PR_NUM=$(echo "$PR_URL" | sed -E 's|.*/pull/([0-9]+)|\1|')

    # Extract issue number from filename (subagent-result-<repo>-<issue>.md)
    BASENAME=$(basename "$f" .md)
    ISSUE_NUM=$(echo "$BASENAME" | grep -oE '[0-9]+$' || echo "")

    # Pass variables via env vars to Python (safe — no interpolation into code)
    RESULT_PRS=$(echo "$RESULT_PRS" | \
        _REPO="$REPO" _ISSUE="$ISSUE_NUM" _PR_URL="$PR_URL" _PR_NUM="$PR_NUM" \
        python3 -c "
import json, sys, os
prs = json.load(sys.stdin)
prs.append({
    'repo': os.environ['_REPO'],
    'issue': os.environ['_ISSUE'],
    'pr_url': os.environ['_PR_URL'],
    'pr_num': os.environ['_PR_NUM'],
    'status': 'open',
    'source': 'result_file'
})
json.dump(prs, sys.stdout)
" 2>/dev/null)
done

# --- Merge both sources and rebuild ledger ---
# Pass all data via env vars (safe — no shell interpolation into Python code)
_GH_PRS="$GH_PRS" _RESULT_PRS="$RESULT_PRS" _LEDGER="$LEDGER" \
python3 -c "
import json, sys, os
from datetime import datetime

gh_raw = os.environ.get('_GH_PRS', '[]')
result_raw = os.environ.get('_RESULT_PRS', '[]')
ledger_path = os.environ['_LEDGER']

try:
    gh_prs = json.loads(gh_raw)
except (json.JSONDecodeError, ValueError):
    gh_prs = []

try:
    result_prs = json.loads(result_raw)
except (json.JSONDecodeError, ValueError):
    result_prs = []

# Build map keyed by PR URL (authoritative)
pr_map = {}

# First, add GitHub PRs (these have accurate status)
for pr in gh_prs:
    repo = pr.get('repository', {})
    if isinstance(repo, dict):
        repo_name = repo.get('nameWithOwner', '')
    elif isinstance(repo, str):
        repo_name = repo
    else:
        continue

    url = pr.get('url', '')
    if not url:
        continue

    state = pr.get('state', 'OPEN').lower()
    if state == 'merged':
        status = 'merged'
    elif state == 'closed':
        status = 'closed'
    else:
        status = 'open'

    created = pr.get('createdAt', '')
    date = created[:10] if created else datetime.utcnow().strftime('%Y-%m-%d')

    number = pr.get('number', 0)

    pr_map[url] = {
        'repo': repo_name,
        'issue': '',  # populated from result files below
        'pr_url': url,
        'pr_num': number,
        'status': status,
        'date': date,
    }

# Then, merge result file PRs (these have issue numbers)
for rpr in result_prs:
    url = rpr.get('pr_url', '')
    if url in pr_map:
        # Update issue number from result file (GitHub doesn't give us this)
        if rpr.get('issue') and not pr_map[url]['issue']:
            pr_map[url]['issue'] = rpr['issue']
    else:
        # PR not yet in GitHub search -- add it from result file
        date = datetime.utcnow().strftime('%Y-%m-%d')
        pr_map[url] = {
            'repo': rpr.get('repo', ''),
            'issue': rpr.get('issue', ''),
            'pr_url': url,
            'pr_num': rpr.get('pr_num', ''),
            'status': rpr.get('status', 'open'),
            'date': date,
        }

# Also preserve issue numbers from existing ledger (if it exists)
if os.path.exists(ledger_path):
    with open(ledger_path) as f:
        for line in f:
            line = line.strip()
            if not line.startswith('|') or line.startswith('| repo') or line.startswith('|--'):
                continue
            parts = [p.strip() for p in line.split('|')[1:-1]]
            if len(parts) >= 3:
                old_repo, old_issue, old_url = parts[0], parts[1], parts[2]
                if old_url in pr_map and not pr_map[old_url]['issue']:
                    pr_map[old_url]['issue'] = old_issue

# Sort by date descending, then repo
entries = sorted(pr_map.values(), key=lambda x: (x['date'], x['repo']), reverse=True)

# Write ledger
lines = []
lines.append('# PR Ledger — DO NOT submit PRs for issues already in this list')
lines.append('')
lines.append('| repo | issue | pr_url | status | date |')
lines.append('|------|-------|--------|--------|------|')
for e in entries:
    lines.append(f\"| {e['repo']} | {e['issue']} | {e['pr_url']} | {e['status']} | {e['date']} |\")
lines.append('')

with open(ledger_path, 'w') as f:
    f.write('\n'.join(lines))

print(f'Synced {len(entries)} PRs ({sum(1 for e in entries if e[\"status\"]==\"open\")} open, {sum(1 for e in entries if e[\"status\"]==\"merged\")} merged, {sum(1 for e in entries if e[\"status\"]==\"closed\")} closed)')
"

log "$(_LEDGER="$LEDGER" python3 -c "
import os
ledger = os.environ['_LEDGER']
if os.path.exists(ledger):
    lines = [l for l in open(ledger) if l.startswith('|') and not l.startswith('| repo') and not l.startswith('|--')]
    print(f'{len(lines)} entries in ledger')
else:
    print('ledger not found')
" 2>/dev/null)"
