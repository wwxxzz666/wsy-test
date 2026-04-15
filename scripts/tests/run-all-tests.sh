#!/usr/bin/env bash
# run-all-tests.sh — Test suite for ClawOSS scripts
# Usage: bash scripts/tests/run-all-tests.sh

SCRIPTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0; SKIP=0; TOTAL=0

run_test() {
  local name="$1" cmd="$2" expect_exit="$3" expect_json="${4:-false}"
  TOTAL=$((TOTAL + 1))
  echo -n "  [$TOTAL] $name... "
  
  OUTPUT=$(eval "$cmd" 2>&1)
  EXIT=$?
  
  if [ "$expect_exit" = "any" ] || [ "$EXIT" -eq "$expect_exit" ]; then
    if [ "$expect_json" = "true" ]; then
      echo "$OUTPUT" | jq . >/dev/null 2>&1
      if [ $? -eq 0 ]; then
        echo "PASS (exit=$EXIT, valid JSON)"
        PASS=$((PASS + 1))
      else
        echo "FAIL (exit=$EXIT ok, but invalid JSON)"
        FAIL=$((FAIL + 1))
      fi
    else
      echo "PASS (exit=$EXIT)"
      PASS=$((PASS + 1))
    fi
  else
    echo "FAIL (expected exit=$expect_exit, got exit=$EXIT)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== ClawOSS Script Test Suite ==="
echo ""

# ── check-blocklist.sh ──
echo "check-blocklist.sh:"
run_test "no args = usage error" "bash $SCRIPTS_DIR/check-blocklist.sh 2>&1" 1
run_test "known blocked repo (llama_index)" "bash $SCRIPTS_DIR/check-blocklist.sh run-llama/llama_index" 1 true
run_test "known safe repo" "bash $SCRIPTS_DIR/check-blocklist.sh ollama/ollama" 0 true

# ── check-already-fixed.sh ──
echo "check-already-fixed.sh:"
run_test "no args = usage error" "bash $SCRIPTS_DIR/check-already-fixed.sh 2>&1" 1

# ── check-supersession.sh ──
echo "check-supersession.sh:"
run_test "no args = usage error" "bash $SCRIPTS_DIR/check-supersession.sh 2>&1" 1

# ── pr-portfolio-stats.sh ──
echo "pr-portfolio-stats.sh:"
run_test "returns valid JSON" "bash $SCRIPTS_DIR/pr-portfolio-stats.sh" 0 true

# ── heartbeat-status.sh ──
echo "heartbeat-status.sh:"
run_test "returns valid JSON" "bash $SCRIPTS_DIR/heartbeat-status.sh" 0 true

# ── compute-merge-probability.sh ──
echo "compute-merge-probability.sh:"
run_test "no args = usage error" "bash $SCRIPTS_DIR/compute-merge-probability.sh 2>&1" 1

# ── lock-repo.sh / unlock-repo.sh ──
echo "lock-repo.sh:"
run_test "no args = usage error" "bash $SCRIPTS_DIR/lock-repo.sh 2>&1" 1
echo "unlock-repo.sh:"
run_test "no args = usage error" "bash $SCRIPTS_DIR/unlock-repo.sh 2>&1" 1

# ── workspace-cleanup.sh ──
echo "workspace-cleanup.sh:"
run_test "nonexistent dir = still succeeds" "bash $SCRIPTS_DIR/workspace-cleanup.sh /tmp/nonexistent-test-dir-12345" 0

# ── format-pr-description.sh ──
echo "format-pr-description.sh:"
run_test "no args = usage error" "bash $SCRIPTS_DIR/format-pr-description.sh 2>&1" 1

echo ""
echo "=================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "=================================="

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
