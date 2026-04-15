#!/usr/bin/env bash
# Wrapper for pr-ledger-sync.sh that loads environment from .env
# Used by launchd plist to run the sync on a schedule.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env for GITHUB_TOKEN
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a; source "$PROJECT_DIR/.env"; set +a
fi

# Ensure gh and other tools are on PATH (use nvm default, not hardcoded version)
NVM_NODE=$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | tail -1)
export PATH="/opt/homebrew/bin:/usr/local/bin:${NVM_NODE:+$NVM_NODE:}$PATH"

exec bash "$SCRIPT_DIR/pr-ledger-sync.sh"
