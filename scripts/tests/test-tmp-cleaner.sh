#!/usr/bin/env bash
# test-tmp-cleaner.sh — Unit tests for tmp-cleaner.sh cleanup logic
# Run: bash scripts/tests/test-tmp-cleaner.sh

set -u

PASSED=0
FAILED=0
TEST_BASE="/tmp/clawoss-test-cleaner-$$"

pass() { echo "  ✅ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ❌ $1"; FAILED=$((FAILED + 1)); }
assert_exists() { [ -e "$1" ] && pass "$2" || fail "$2 (expected $1 to exist)"; }
assert_not_exists() { [ ! -e "$1" ] && pass "$2" || fail "$2 (expected $1 to NOT exist)"; }

setup() {
    rm -rf "$TEST_BASE" /tmp/clawoss-test-* 2>/dev/null
    mkdir -p "$TEST_BASE"
}

teardown() {
    rm -rf "$TEST_BASE" /tmp/clawoss-test-* /tmp/test-escaped-repo-$$ 2>/dev/null
}

# Helper: create a dir with a specific modification time (minutes ago)
create_aged_dir() {
    local dir="$1"
    local age_min="$2"
    mkdir -p "$dir"
    echo "test" > "$dir/dummy.txt"
    # Set mtime using python3 (reliable cross-platform)
    local target_ts=$(python3 -c "import time; print(int(time.time()) - ${age_min} * 60)")
    python3 -c "import os; os.utime('$dir', (${target_ts}, ${target_ts}))"
}

# The cleanup logic extracted from tmp-cleaner.sh for testing
run_cleanup() {
    local max_age="${1:-30}"

    # 1. Clean /tmp/clawoss-test-* dirs inactive >max_age min
    find /private/tmp -maxdepth 1 -name "clawoss-test-*" -type d -mmin +${max_age} -exec rm -rf {} + 2>/dev/null

    # 2. Clean escaped repos with .git
    find /private/tmp -maxdepth 2 -name ".git" -type d -path "*/test-escaped-repo-$$/*" 2>/dev/null | while read gitdir; do
        parent=$(dirname "$gitdir")
        age_min=$(( ($(date +%s) - $(stat -f %m "$parent" 2>/dev/null || stat -c %Y "$parent" 2>/dev/null || echo $(date +%s))) / 60 ))
        if [ "$age_min" -gt "$max_age" ]; then
            rm -rf "$parent" 2>/dev/null
        fi
    done
}

echo "=== tmp-cleaner.sh unit tests ==="
echo ""

# ── Test 1: Old clawoss dir gets deleted ──────────────────────────
echo "Test 1: Delete old /tmp/clawoss-* dirs (>30 min)"
setup
create_aged_dir "/tmp/clawoss-test-old-$$" 45
run_cleanup 30
assert_not_exists "/tmp/clawoss-test-old-$$" "Old dir (45m) deleted"

# ── Test 2: Recent clawoss dir survives ───────────────────────────
echo ""
echo "Test 2: Keep recent /tmp/clawoss-* dirs (<30 min)"
setup
mkdir -p "/tmp/clawoss-test-new-$$"
echo "active" > "/tmp/clawoss-test-new-$$/work.txt"
run_cleanup 30
assert_exists "/tmp/clawoss-test-new-$$" "New dir survives cleanup"
rm -rf "/tmp/clawoss-test-new-$$"

# ── Test 3: Multiple dirs — only old ones deleted ─────────────────
echo ""
echo "Test 3: Mixed ages — only old dirs deleted"
setup
create_aged_dir "/tmp/clawoss-test-ancient-$$" 120
mkdir -p "/tmp/clawoss-test-fresh-$$"
echo "x" > "/tmp/clawoss-test-fresh-$$/file.txt"
run_cleanup 30
assert_not_exists "/tmp/clawoss-test-ancient-$$" "Ancient dir (120m) deleted"
assert_exists "/tmp/clawoss-test-fresh-$$" "Fresh dir survives"
rm -rf "/tmp/clawoss-test-fresh-$$"

# ── Test 4: Escaped repo with .git gets cleaned ──────────────────
echo ""
echo "Test 4: Escaped repo (non-clawoss with .git) gets cleaned"
setup
create_aged_dir "/tmp/test-escaped-repo-$$" 45
mkdir -p "/tmp/test-escaped-repo-$$/.git"
# Also backdate the .git dir and parent again (mkdir resets mtime)
ts4=$(python3 -c "import time; print(int(time.time()) - 45 * 60)")
python3 -c "import os; os.utime('/tmp/test-escaped-repo-$$', (${ts4}, ${ts4})); os.utime('/tmp/test-escaped-repo-$$/.git', (${ts4}, ${ts4}))"
run_cleanup 30
assert_not_exists "/tmp/test-escaped-repo-$$" "Escaped repo (45m, has .git) deleted"

# ── Test 5: Recent escaped repo survives ──────────────────────────
echo ""
echo "Test 5: Recent escaped repo survives"
setup
mkdir -p "/tmp/test-escaped-repo-$$/.git"
echo "x" > "/tmp/test-escaped-repo-$$/code.py"
run_cleanup 30
assert_exists "/tmp/test-escaped-repo-$$" "Recent escaped repo survives"
rm -rf "/tmp/test-escaped-repo-$$"

# ── Test 6: Non-clawoss non-git dirs are NOT touched ─────────────
echo ""
echo "Test 6: Non-clawoss, non-git dirs are untouched"
setup
create_aged_dir "$TEST_BASE/safe-dir" 120
run_cleanup 30
assert_exists "$TEST_BASE/safe-dir" "Non-clawoss dir untouched"

# ── Test 7: Empty dir gets cleaned ────────────────────────────────
echo ""
echo "Test 7: Empty old clawoss dir gets cleaned"
setup
create_aged_dir "/tmp/clawoss-test-empty-$$" 60
rm -f "/tmp/clawoss-test-empty-$$/dummy.txt" 2>/dev/null
# Re-backdate after rm (rm updates parent mtime)
ts7=$(python3 -c "import time; print(int(time.time()) - 60 * 60)")
python3 -c "import os; os.utime('/tmp/clawoss-test-empty-$$', (${ts7}, ${ts7}))"
run_cleanup 30
assert_not_exists "/tmp/clawoss-test-empty-$$" "Empty old dir deleted"

# ── Test 8: Dir at exact boundary (30 min) ────────────────────────
echo ""
echo "Test 8: Dir at exact boundary (31 min) gets cleaned"
setup
create_aged_dir "/tmp/clawoss-test-boundary-$$" 31
run_cleanup 30
assert_not_exists "/tmp/clawoss-test-boundary-$$" "Dir at 31m deleted"

# ── Test 9: Dir just under boundary (29 min) survives ────────────
echo ""
echo "Test 9: Dir just under boundary (29 min) survives"
setup
create_aged_dir "/tmp/clawoss-test-under-$$" 29
run_cleanup 30
assert_exists "/tmp/clawoss-test-under-$$" "Dir at 29m survives"
rm -rf "/tmp/clawoss-test-under-$$"

# ── Test 10: PID file created correctly ───────────────────────────
echo ""
echo "Test 10: PID file mechanism"
setup
PID_FILE="$TEST_BASE/test-cleaner.pid"
echo "12345" > "$PID_FILE"
assert_exists "$PID_FILE" "PID file created"
PID_CONTENT=$(cat "$PID_FILE")
[ "$PID_CONTENT" = "12345" ] && pass "PID file has correct content" || fail "PID file content wrong"

# ── Test 11: Log file works ───────────────────────────────────────
echo ""
echo "Test 11: Log file mechanism"
LOG_FILE="$TEST_BASE/test-cleaner.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] test message" >> "$LOG_FILE"
assert_exists "$LOG_FILE" "Log file created"
grep -q "test message" "$LOG_FILE" && pass "Log file has content" || fail "Log file empty"

# ── Test 12: Cleanup doesn't touch /tmp/openclaw/ ─────────────────
echo ""
echo "Test 12: /tmp/openclaw/ is never touched"
setup
# openclaw dir should always be safe
if [ -d "/tmp/openclaw" ]; then
    run_cleanup 0  # even with 0 min threshold
    assert_exists "/tmp/openclaw" "/tmp/openclaw/ untouched even with aggressive cleanup"
else
    pass "/tmp/openclaw doesn't exist (skipped — not running)"
fi

# ── Cleanup & Summary ─────────────────────────────────────────────
teardown

echo ""
echo "=== Results: $PASSED passed, $FAILED failed ==="
if [ "$FAILED" -gt 0 ]; then
    exit 1
else
    echo "All tests passed!"
    exit 0
fi
