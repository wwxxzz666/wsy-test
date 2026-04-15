#!/usr/bin/env bash
set -euo pipefail

echo "=== Starting ClawOSS ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AGENT_ID="clawoss"
WORKSPACE_DIR="$PROJECT_DIR/workspace"
source "$SCRIPT_DIR/lib/openclaw-cli.sh"

if ! ensure_openclaw_cli; then
    echo "Error: openclaw CLI not found. Set OPENCLAW_JS_PATH or install openclaw in PATH."
    exit 1
fi

# Load .env if present
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Env-driven model selection
CLAWOSS_MODEL_PRIMARY="${CLAWOSS_MODEL_PRIMARY:-openrouter/openai/gpt-4.1-mini}"

# Verify setup
if [ ! -L "$HOME/.openclaw/workspace" ]; then
    echo "Error: workspace not linked. Run 'npm run setup' first."
    exit 1
fi

# Register the clawoss agent if it doesn't exist
if openclaw agents list 2>/dev/null | grep -q "^- $AGENT_ID "; then
    echo "Agent '$AGENT_ID' already registered"
else
    echo "Registering agent '$AGENT_ID'..."
    openclaw agents add "$AGENT_ID" \
        --workspace "$WORKSPACE_DIR" \
        --model "$CLAWOSS_MODEL_PRIMARY" \
        --non-interactive
    echo "Agent '$AGENT_ID' registered"
fi

# Register cron jobs (skip if already registered to avoid duplicates)
echo "Registering cron jobs..."
EXISTING_CRONS=$(openclaw cron list --json 2>/dev/null | jq -r '.jobs[] | select(.agentId == "'"$AGENT_ID"'") | .name' 2>/dev/null || true)
while IFS= read -r job; do
    name=$(echo "$job" | jq -r '.id')
    schedule=$(echo "$job" | jq -r '.schedule.expr')
    # Extract message text from payload (agentTurn uses .message, systemEvent uses .text)
    payload=$(echo "$job" | jq -r '.payload.message // .payload.text // empty')

    if echo "$EXISTING_CRONS" | grep -q "^${name}$"; then
        echo "  Exists: $name"
        continue
    fi

    # Non-default agents must use isolated sessions with session-key for persistence
    cmd=(openclaw cron add --name "$name" --agent "$AGENT_ID" --cron "$schedule")
    cmd+=(--session isolated --session-key "agent:${AGENT_ID}:${name}" --message "$payload")

    "${cmd[@]}" 2>/dev/null && echo "  Added: $name" || echo "  Failed: $name"
done < <(jq -c '.[]' "$PROJECT_DIR/config/cron-jobs.json")

# Start OpenClaw gateway (if not already running)
if openclaw gateway status 2>/dev/null | grep -q "running\|reachable"; then
    echo "OpenClaw gateway already running — restarting to pick up config..."
    openclaw gateway restart 2>/dev/null || true
else
    echo "Starting OpenClaw gateway..."
    openclaw gateway install 2>/dev/null || openclaw gateway run &
fi

echo ""
echo "=== ClawOSS Running ==="
echo "Dashboard: check your Vercel deployment"
echo "Logs: tail -f $HOME/.openclaw/logs/openclaw-$(date +%Y-%m-%d).log"
echo "Stop: npm run stop"
