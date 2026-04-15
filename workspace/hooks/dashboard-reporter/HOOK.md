---
name: dashboard-reporter
description: "Posts agent metrics and heartbeat data to the ClawOSS Vercel dashboard after each agent turn."
homepage: https://github.com/billion-token-one-task/ClawOSS
metadata:
  { "openclaw": { "emoji": "📊", "events": ["agent_end", "after_tool_call"], "requires": { "bins": ["curl"], "env": ["CLAW_API_KEY"] } } }
---

# Dashboard Reporter Hook

Automatically sends telemetry to the ClawOSS dashboard after each agent turn.

## Behavior
- On `agent_end`: Posts a heartbeat + token metrics to the dashboard
- On `after_tool_call`: Accumulates tool call durations and token counts for batch reporting
- Dashboard URL: `https://clawoss-dashboard.vercel.app`
- Auth: Bearer `$CLAW_API_KEY`

## Resilience
- Non-blocking: failures are logged but never interrupt agent work
- 10s timeout on all HTTP requests
- Single retry on failure with 5s delay
