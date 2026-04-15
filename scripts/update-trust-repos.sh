#!/usr/bin/env bash
# update-trust-repos.sh — Atomic trust-repos.md management
# Usage: update-trust-repos.sh <action> <owner/repo> [--score N] [--reason <text>]
# Actions: promote (add/update in Active), deprioritize (move to Deprioritized), remove
# Exit 0 = updated, Exit 1 = failed

ACTION="${1:?Usage: update-trust-repos.sh <action> <owner/repo> [--score N] [--reason <text>]}"
REPO="${2:?Usage: update-trust-repos.sh <action> <owner/repo>}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
TRUST_FILE="$PROJECT_DIR/workspace/memory/trust-repos.md"
SCORE=""
REASON=""

shift 2
while [ $# -gt 0 ]; do
  case "$1" in
    --score) SCORE="$2"; shift 2 ;;
    --reason) REASON="$2"; shift 2 ;;
    *) shift ;;
  esac
done

OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"

# Create trust file if it doesn't exist
if [ ! -f "$TRUST_FILE" ]; then
  mkdir -p "$(dirname "$TRUST_FILE")"
  cat > "$TRUST_FILE" <<EOMD
# Trust Repos

## Active
| Repo | Score | Notes |
|------|-------|-------|

## Deprioritized
| Repo | Reason | Skip Until |
|------|--------|------------|
EOMD
fi

# ─── Perform action ───
python3 - "$ACTION" "$REPO" "${SCORE:-7}" "${REASON:-}" "$TRUST_FILE" <<'PYEOF'
import sys, re

action = sys.argv[1]
repo = sys.argv[2]
score = sys.argv[3]
reason = sys.argv[4]
trust_file = sys.argv[5]

with open(trust_file, 'r') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
in_active = False
in_depri = False
found_in_active = False
found_in_depri = False

for line in lines:
    lower = line.lower()

    if '## active' in lower:
        in_active = True
        in_depri = False
    elif '## deprioritized' in lower:
        in_active = False
        in_depri = True
    elif line.startswith('## '):
        in_active = False
        in_depri = False

    # Check if this line contains our repo
    repo_lower = repo.lower()
    if repo_lower in lower and '|' in line:
        if in_active:
            found_in_active = True
            if action == 'promote':
                # Update score
                new_lines.append(f'| \`{repo}\` | {score} | {reason} |')
                continue
            elif action == 'deprioritize' or action == 'remove':
                # Skip this line (remove from active)
                continue
        elif in_depri:
            found_in_depri = True
            if action == 'promote' or action == 'remove':
                # Skip this line (remove from deprioritized)
                continue
            elif action == 'deprioritize':
                # Update reason
                new_lines.append(f'| \`{repo}\` | {reason} | permanent |')
                continue

    new_lines.append(line)

# Add new entries if not found
result = '\n'.join(new_lines)

if action == 'promote' and not found_in_active:
    # Add to Active section after the table header
    active_header = '|------|-------|-------|'
    if active_header in result:
        result = result.replace(active_header, active_header + f'\n| \`{repo}\` | {score} | {reason} |')

if action == 'deprioritize' and not found_in_depri:
    # Add to Deprioritized section after its table header
    depri_header = '|------|--------|------------|'
    if depri_header in result:
        result = result.replace(depri_header, depri_header + f'\n| \`{repo}\` | {reason} | permanent |')

with open(trust_file, 'w') as f:
    f.write(result)

import json
print(json.dumps({"success": True, "action": action, "repo": repo, "score": score}))
PYEOF

if [ $? -eq 0 ]; then
  exit 0
else
  echo '{"success": false, "reason": "python script failed"}'
  exit 1
fi
