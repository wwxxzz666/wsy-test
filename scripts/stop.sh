#!/usr/bin/env bash
set -euo pipefail

echo "=== Stopping ClawOSS ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/lib/openclaw-cli.sh"

if ! ensure_openclaw_cli; then
    echo "Warning: openclaw CLI not found; cron removal via openclaw may fail."
fi

# Remove ClawOSS cron jobs (don't stop the gateway — other agents may be running)
echo "Removing ClawOSS cron jobs..."
while IFS= read -r job_id; do
    openclaw cron rm "$job_id" 2>/dev/null && echo "  Removed cron: $job_id" || true
done < <(jq -r '.[].id' "$PROJECT_DIR/config/cron-jobs.json")

# Stop PR ledger sync
PLIST="$HOME/Library/LaunchAgents/com.clawoss.pr-ledger-sync.plist"
if [ -f "$PLIST" ]; then
    launchctl unload "$PLIST" 2>/dev/null && echo "  Stopped PR ledger sync" || true
fi

# Stop dashboard sync
pkill -f "dashboard-sync" 2>/dev/null && echo "  Stopped dashboard sync" || true

echo "ClawOSS stopped."
echo "Note: Gateway left running (other agents may depend on it)."
echo "To stop the gateway entirely: openclaw gateway stop"
