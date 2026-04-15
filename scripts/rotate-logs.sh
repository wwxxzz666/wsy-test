#!/usr/bin/env bash
set -euo pipefail
LOG_DIR="$HOME/.openclaw/logs"
DAYS_TO_KEEP=14
find "$LOG_DIR" -name "*.log" -mtime +$DAYS_TO_KEEP -delete 2>/dev/null
echo "Logs older than $DAYS_TO_KEEP days removed."
