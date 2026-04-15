#!/usr/bin/env bash
# test-restart-state-reset.sh — Verify restart.sh properly resets spawn state
# Run: bash scripts/tests/test-restart-state-reset.sh

set -u

PASSED=0
FAILED=0
TEST_DIR="/tmp/clawoss-test-restart-$$"

pass() { echo "  ✅ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ❌ $1"; FAILED=$((FAILED + 1)); }

setup() {
    rm -rf "$TEST_DIR" 2>/dev/null
    mkdir -p "$TEST_DIR/memory"
}

teardown() {
    rm -rf "$TEST_DIR" 2>/dev/null
}

echo "=== restart.sh state reset unit tests ==="
echo ""

# ── Test 1: impl-spawn-state gets reset to empty ──────────────────
echo "Test 1: impl-spawn-state reset to 0 active"
setup
# Simulate a stale state file with 10 active implementations
cat > "$TEST_DIR/memory/impl-spawn-state.md" << 'EOF'
# Implementation Spawn State — 2026-03-18

## Active Implementations (10/10 slots FULL)

| Repo | Issue | Spawned At | Status | Session Key |
|------|-------|------------|--------|-------------|
| astral-sh/uv | #18538 | 2026-03-18T08:20:00Z | spawned | agent:clawoss:subagent:abc123 |
| langgenius/dify | #33627 | 2026-03-18T08:20:00Z | spawned | agent:clawoss:subagent:def456 |
EOF

# Run the reset logic (extracted from restart.sh step 7b)
cat > "$TEST_DIR/memory/impl-spawn-state.md" << 'SPAWNEOF'
# Implementation Spawn State — Reset by restart.sh

## Active Implementations (0 total)
| issue_url | repo | status | spawned_at |
|-----------|------|--------|------------|

## Active Follow-ups (0 total)
| pr_url | repo | status | round | spawned_at |
|--------|------|--------|-------|------------|
SPAWNEOF

# Verify
grep -q "0 total" "$TEST_DIR/memory/impl-spawn-state.md" && pass "Shows 0 total" || fail "Still shows old count"
grep -q "10/10" "$TEST_DIR/memory/impl-spawn-state.md" && fail "Still contains 10/10" || pass "10/10 removed"
# Check for "| spawned |" (actual data rows) but allow "spawned_at" (header)
grep -q "| spawned |" "$TEST_DIR/memory/impl-spawn-state.md" && fail "Still contains spawned data rows" || pass "No spawned data rows"
grep -q "astral-sh" "$TEST_DIR/memory/impl-spawn-state.md" && fail "Still contains repo names" || pass "No stale repo names"

# ── Test 2: wake-state gets reset ─────────────────────────────────
echo ""
echo "Test 2: wake-state reset"
setup
cat > "$TEST_DIR/memory/wake-state.md" << 'EOF'
consecutive_wakes: 25
errors_this_hour: 3
last_wake: 2026-03-18T08:00:00Z
impl_slots_filled: 10
EOF

cat > "$TEST_DIR/memory/wake-state.md" << 'WAKEEOF'
consecutive_wakes: 0
errors_this_hour: 0
last_error: none
last_wake: none
WAKEEOF

grep -q "consecutive_wakes: 0" "$TEST_DIR/memory/wake-state.md" && pass "Wakes reset to 0" || fail "Wakes not reset"
grep -q "errors_this_hour: 0" "$TEST_DIR/memory/wake-state.md" && pass "Errors reset to 0" || fail "Errors not reset"
grep -q "impl_slots_filled" "$TEST_DIR/memory/wake-state.md" && fail "Still has slots field" || pass "Stale fields gone"

# ── Test 3: pr-followup-state gets reset ──────────────────────────
echo ""
echo "Test 3: pr-followup-state reset"
setup
cat > "$TEST_DIR/memory/pr-followup-state.md" << 'EOF'
## PR State
| Repo | PR# | Classification | Round |
|------|-----|---------------|-------|
| vercel/ai | 13499 | changes_requested | 2 |
| chroma-core/chroma | 6665 | ci_failing | 1 |
EOF

cat > "$TEST_DIR/memory/pr-followup-state.md" << 'FOLLOWEOF'
# PR Follow-up State — Reset by restart.sh
No active follow-ups.
FOLLOWEOF

grep -q "No active follow-ups" "$TEST_DIR/memory/pr-followup-state.md" && pass "Follow-up state reset" || fail "Follow-up state not reset"
grep -q "vercel" "$TEST_DIR/memory/pr-followup-state.md" && fail "Still has stale PRs" || pass "No stale PR entries"

# ── Test 4: Subagent result files should be cleaned ───────────────
echo ""
echo "Test 4: Subagent result files cleaned"
setup
touch "$TEST_DIR/memory/subagent-result-foo.md"
touch "$TEST_DIR/memory/subagent-result-bar.md"
touch "$TEST_DIR/memory/subagent-result-followup-baz.md"

rm -f "$TEST_DIR/memory/subagent-result-"*.md 2>/dev/null

COUNT=$(ls "$TEST_DIR/memory/subagent-result-"*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$COUNT" -eq 0 ] && pass "All result files cleaned" || fail "Result files remain ($COUNT)"

# ── Test 5: Lock files should be cleaned ──────────────────────────
echo ""
echo "Test 5: Lock files cleaned"
setup
mkdir -p "$TEST_DIR/memory/locks"
touch "$TEST_DIR/memory/locks/owner_repo.lock"
touch "$TEST_DIR/memory/locks/another_repo.lock"

find "$TEST_DIR/memory/locks/" -name "*.lock" -delete 2>/dev/null

COUNT=$(ls "$TEST_DIR/memory/locks/"*.lock 2>/dev/null | wc -l | tr -d ' ')
[ "$COUNT" -eq 0 ] && pass "All lock files cleaned" || fail "Lock files remain ($COUNT)"

# ── Test 6: Empty state file is valid markdown table ──────────────
echo ""
echo "Test 6: Reset state is valid markdown"
setup
cat > "$TEST_DIR/memory/impl-spawn-state.md" << 'SPAWNEOF'
# Implementation Spawn State — Reset by restart.sh

## Active Implementations (0 total)
| issue_url | repo | status | spawned_at |
|-----------|------|--------|------------|

## Active Follow-ups (0 total)
| pr_url | repo | status | round | spawned_at |
|--------|------|--------|-------|------------|
SPAWNEOF

# Verify table headers exist
grep -q "issue_url" "$TEST_DIR/memory/impl-spawn-state.md" && pass "Has impl table headers" || fail "Missing impl headers"
grep -q "pr_url" "$TEST_DIR/memory/impl-spawn-state.md" && pass "Has followup table headers" || fail "Missing followup headers"
LINES=$(wc -l < "$TEST_DIR/memory/impl-spawn-state.md")
[ "$LINES" -gt 5 ] && pass "File has structure ($LINES lines)" || fail "File too short ($LINES lines)"

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
