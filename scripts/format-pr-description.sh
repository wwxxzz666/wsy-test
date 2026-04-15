#!/usr/bin/env bash
# format-pr-description.sh — Generate human-sounding PR description
# Usage: format-pr-description.sh <type> <scope> <issue_number> [--repo owner/repo] [--title "title"]
# Types: fix, docs, test, typo
# Anti-AI-slop: no "This PR addresses", no "Upon investigation", no "I identified"

TYPE="${1:?Usage: format-pr-description.sh <type> <scope> <issue_number>}"
SCOPE="${2:?Usage: format-pr-description.sh <type> <scope> <issue_number>}"
ISSUE="${3:?Usage: format-pr-description.sh <type> <scope> <issue_number>}"
REPO=""
TITLE=""

shift 3
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Issue reference
ISSUE_REF="#${ISSUE}"
if [ -n "$REPO" ]; then
  ISSUE_REF="${REPO}#${ISSUE}"
fi

case "$TYPE" in
  fix)
    cat <<EOF
Fixes ${ISSUE_REF}

**Problem**
<!-- What's broken — 1-2 sentences, jump straight to the bug -->

**Root cause**
<!-- Why it's broken — trace to the specific line/condition -->

**Fix**
<!-- What you changed and why this approach -->

**Testing**
- [ ] Added/updated test that reproduces the bug
- [ ] All existing tests pass
- [ ] Tested manually (describe how)
EOF
    ;;
  docs|documentation)
    cat <<EOF
Fixes ${ISSUE_REF}

**What was wrong**
<!-- Specific incorrect/outdated content -->

**What's correct**
<!-- Verified against actual code behavior in \`${SCOPE}\` -->
EOF
    ;;
  typo)
    cat <<EOF
Fixes ${ISSUE_REF}

Typo fix in \`${SCOPE}\`.
EOF
    ;;
  test)
    cat <<EOF
Fixes ${ISSUE_REF}

**Uncovered path**
<!-- What code path wasn't tested -->

**Test coverage**
<!-- What the new test(s) verify -->

- [ ] Tests pass locally
- [ ] No existing tests broken
EOF
    ;;
  *)
    cat <<EOF
Fixes ${ISSUE_REF}

<!-- Describe the change -->
EOF
    ;;
esac
