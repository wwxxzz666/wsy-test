---
name: audit-logger
description: "Logs all agent actions to the ClawOSS dashboard for audit trail and debugging."
homepage: https://github.com/billion-token-one-task/ClawOSS
metadata:
  { "openclaw": { "emoji": "📝", "events": ["command:new", "agent_end", "after_tool_call"], "requires": { "bins": ["curl"], "env": ["CLAW_API_KEY"] } } }
---

# Audit Logger Hook

Records all significant agent actions to the ClawOSS dashboard audit log.

## What Gets Logged
- New commands/sessions started
- Tool calls with their names and durations
- Agent completion events
- Errors and failures

## Dashboard Integration
- Endpoint: `POST https://clawoss-dashboard.vercel.app/api/ingest/logs`
- Auth: Bearer `$CLAW_API_KEY`

## Resilience
- Fire-and-forget: logs best-effort, never blocks
- 10s timeout, no retries (audit logs are supplementary)
