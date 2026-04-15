#!/bin/bash
# Dashboard reporter hook — fires on PostToolUse
# Reads tool call data from stdin (JSON) and posts to dashboard API
# Non-blocking: all errors silently ignored

DASHBOARD_URL="${DASHBOARD_URL:-https://clawoss-dashboard.vercel.app}"
API_KEY="${CLAW_API_KEY:?Set CLAW_API_KEY env var}"
SESSION_ID="${CLAUDE_SESSION_ID:-agent-session}"
ACTIVE_MODEL="${CLAWOSS_MODEL_PRIMARY:-unknown}"

# Read the hook input from stdin
INPUT=$(cat 2>/dev/null || echo '{}')

# Extract tool info — field names: tool_name, tool_input (object), tool_output, duration, tool_use_id
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null || echo "unknown")
TOOL_INPUT_RAW=$(echo "$INPUT" | jq -c '.tool_input // {}' 2>/dev/null | head -c 2000 || echo '{}')
TOOL_OUTPUT_RAW=$(echo "$INPUT" | jq -r 'if .tool_output then (.tool_output | tostring) else "" end' 2>/dev/null | head -c 3000 || echo "")
DURATION=$(echo "$INPUT" | jq -r '.duration // 0' 2>/dev/null || echo "0")
TOOL_USE_ID=$(echo "$INPUT" | jq -r '.tool_use_id // ""' 2>/dev/null || echo "")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Ensure duration is numeric
case "$DURATION" in
  ''|*[!0-9]*) DURATION=0 ;;
esac

# Build JSON payload with jq for proper escaping
PAYLOAD=$(jq -n \
  --arg sid "$SESSION_ID" \
  --arg content "$TOOL_INPUT_RAW" \
  --arg toolName "$TOOL_NAME" \
  --arg toolCallId "$TOOL_USE_ID" \
  --arg model "$ACTIVE_MODEL" \
  --argjson durationMs "$DURATION" \
  --arg ts "$TIMESTAMP" \
  --arg resultContent "$TOOL_OUTPUT_RAW" \
  '{
    messages: [
      {
        sessionId: $sid,
        role: "tool_call",
        content: $content,
        toolName: $toolName,
        toolCallId: $toolCallId,
        durationMs: $durationMs,
        timestamp: $ts,
        metadata: { agent_id: "clawoss", model: $model }
      },
      {
        sessionId: $sid,
        role: "tool_result",
        content: $resultContent,
        toolName: $toolName,
        toolCallId: $toolCallId,
        durationMs: $durationMs,
        timestamp: $ts,
        metadata: { agent_id: "clawoss" }
      }
    ]
  }' 2>/dev/null)

# Fallback if jq fails
if [ -z "$PAYLOAD" ]; then
  exit 0
fi

# Fire-and-forget POST to dashboard — 5s timeout, background, silent
curl -s -m 5 -X POST \
  "${DASHBOARD_URL}/api/ingest/conversation" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  >/dev/null 2>&1 &

exit 0
