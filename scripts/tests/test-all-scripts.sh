#!/usr/bin/env bash
# test-all-scripts.sh — Unit tests for ALL ClawOSS scripts
# Run: bash scripts/tests/test-all-scripts.sh

set -u

PASSED=0
FAILED=0
SCRIPTS="/Users/kevinlin/clawOSS/scripts"
MEMORY="/Users/kevinlin/clawOSS/workspace/memory"

pass() { echo "  ✅ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ❌ $1"; FAILED=$((FAILED + 1)); }

assert_valid_json() {
    echo "$1" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null && pass "$2" || fail "$2 (invalid JSON)"
}

assert_exit_code() {
    [ "$1" -eq "$2" ] && pass "$3" || fail "$3 (expected exit $2, got $1)"
}

assert_contains() {
    echo "$1" | grep -q "$2" && pass "$3" || fail "$3 (missing: $2)"
}

echo "=== ClawOSS Script Unit Tests ==="
echo ""

# ── cleanup-stale-sessions.sh ─────────────────────────────────────
echo "Test: cleanup-stale-sessions.sh"
OUT=$(bash "$SCRIPTS/cleanup-stale-sessions.sh" 2>&1)
assert_valid_json "$OUT" "Returns valid JSON"
assert_contains "$OUT" "stale_locks_removed" "Has stale_locks_removed field"
assert_contains "$OUT" "spawned_pending_reset" "Has spawned_pending_reset field"
# Verify NO "integer expression" error
ERR=$(bash "$SCRIPTS/cleanup-stale-sessions.sh" 2>&1 >/dev/null)
echo "$ERR" | grep -q "integer expression" && fail "Still has integer expression error" || pass "No integer expression error"

# ── heartbeat-status.sh ───────────────────────────────────────────
echo ""
echo "Test: heartbeat-status.sh"
OUT=$(bash "$SCRIPTS/heartbeat-status.sh" 2>&1)
assert_valid_json "$OUT" "Returns valid JSON"
assert_contains "$OUT" "consecutive_wakes" "Has consecutive_wakes"
assert_contains "$OUT" "open_prs" "Has open_prs"
assert_contains "$OUT" "always_on" "Has always_on section"
# Verify numeric values
python3 -c "
import json,sys
d = json.loads('''$OUT''')
assert isinstance(d['consecutive_wakes'], int), 'wakes not int'
assert isinstance(d['queue_depth'], int), 'queue not int'
" 2>/dev/null && pass "Numeric values are integers" || fail "Non-integer values in output"

# ── check-blocklist.sh ────────────────────────────────────────────
echo ""
echo "Test: check-blocklist.sh"
# Non-blocked repo
OUT=$(bash "$SCRIPTS/check-blocklist.sh" "DioCrafts/OxiCloud" 2>&1)
assert_valid_json "$OUT" "Non-blocked repo returns valid JSON"
assert_contains "$OUT" '"blocked": false' "Non-blocked repo shows false"

# Missing argument
OUT=$(bash "$SCRIPTS/check-blocklist.sh" 2>&1)
EC=$?
[ "$EC" -ne 0 ] && pass "Missing arg returns non-zero exit" || fail "Missing arg should fail"

# Repo with special chars
OUT=$(bash "$SCRIPTS/check-blocklist.sh" "owner/repo-with-dashes" 2>&1)
assert_valid_json "$OUT" "Repo with dashes returns valid JSON"

# ── check-already-fixed.sh ────────────────────────────────────────
echo ""
echo "Test: check-already-fixed.sh"
# Non-existent issue (should return fixed=false or error gracefully)
OUT=$(bash "$SCRIPTS/check-already-fixed.sh" "DioCrafts/OxiCloud" "999999" 2>&1)
assert_valid_json "$OUT" "Returns valid JSON for nonexistent issue"

# Missing arguments
OUT=$(bash "$SCRIPTS/check-already-fixed.sh" 2>&1)
EC=$?
[ "$EC" -ne 0 ] && pass "Missing args returns non-zero exit" || fail "Missing args should fail"

# ── check-supersession.sh ─────────────────────────────────────────
echo ""
echo "Test: check-supersession.sh"
OUT=$(bash "$SCRIPTS/check-supersession.sh" "DioCrafts/OxiCloud" "999999" 2>&1)
assert_valid_json "$OUT" "Returns valid JSON"
assert_contains "$OUT" "superseded" "Has superseded field"

# ── lock-repo.sh + unlock-repo.sh ─────────────────────────────────
echo ""
echo "Test: lock-repo.sh + unlock-repo.sh"
OUT=$(bash "$SCRIPTS/lock-repo.sh" "test-unit/test-repo" "12345" 2>&1)
assert_valid_json "$OUT" "Lock returns valid JSON"
assert_contains "$OUT" '"locked": true' "Lock shows true"
[ -f "$MEMORY/locks/test-unit_test-repo.lock" ] && pass "Lock file created" || fail "Lock file not created"

OUT=$(bash "$SCRIPTS/unlock-repo.sh" "test-unit/test-repo" 2>&1)
assert_valid_json "$OUT" "Unlock returns valid JSON"
[ ! -f "$MEMORY/locks/test-unit_test-repo.lock" ] && pass "Lock file removed" || fail "Lock file still exists"

# Double unlock (should not error)
OUT=$(bash "$SCRIPTS/unlock-repo.sh" "test-unit/test-repo" 2>&1)
assert_valid_json "$OUT" "Double unlock returns valid JSON (no error)"

# ── sign-cla.sh ───────────────────────────────────────────────────
echo ""
echo "Test: sign-cla.sh"
OUT=$(bash "$SCRIPTS/sign-cla.sh" "DioCrafts/OxiCloud" 2>&1)
assert_valid_json "$OUT" "Returns valid JSON"
assert_contains "$OUT" "signed" "Has signed field"
assert_contains "$OUT" "cla_type" "Has cla_type field"

# ── respond-to-review.sh ──────────────────────────────────────────
echo ""
echo "Test: respond-to-review.sh"
# Missing args
OUT=$(bash "$SCRIPTS/respond-to-review.sh" 2>&1)
EC=$?
[ "$EC" -ne 0 ] && pass "Missing args returns non-zero" || fail "Missing args should fail"

# ── check-ci-matrix.sh ────────────────────────────────────────────
echo ""
echo "Test: check-ci-matrix.sh"
# Non-existent dir (should return empty/default)
OUT=$(bash "$SCRIPTS/check-ci-matrix.sh" "/tmp/nonexistent-dir-$$" 2>&1)
assert_valid_json "$OUT" "Returns valid JSON for missing dir"

# ── compute-merge-probability.sh ──────────────────────────────────
echo ""
echo "Test: compute-merge-probability.sh"
OUT=$(bash "$SCRIPTS/compute-merge-probability.sh" "DioCrafts/OxiCloud" "227" --type bug 2>&1)
assert_valid_json "$OUT" "Returns valid JSON"
assert_contains "$OUT" "score" "Has score field"
assert_contains "$OUT" "recommendation" "Has recommendation field"

# ── pr-portfolio-stats.sh ─────────────────────────────────────────
echo ""
echo "Test: pr-portfolio-stats.sh"
OUT=$(bash "$SCRIPTS/pr-portfolio-stats.sh" 2>&1)
assert_valid_json "$OUT" "Returns valid JSON"

# ── format-pr-description.sh ──────────────────────────────────────
echo ""
echo "Test: format-pr-description.sh"
OUT=$(bash "$SCRIPTS/format-pr-description.sh" "Fixed null pointer" "Fixes #123" 2>&1)
[ -n "$OUT" ] && pass "Returns non-empty output" || fail "Returns empty"

# ── Summary ───────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASSED passed, $FAILED failed ==="
if [ "$FAILED" -gt 0 ]; then
    exit 1
else
    echo "All tests passed!"
    exit 0
fi
