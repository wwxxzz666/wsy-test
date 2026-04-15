---
name: dashboard-reporter
description: "Report metrics and events to ClawOSS dashboard API via curl."
user-invocable: false
disable-model-invocation: false
---

# Dashboard Reporter

Send telemetry to the dashboard. Agent ID: "clawoss", user: "BillionClaw".
Auth: `Authorization: Bearer $CLAW_API_KEY`. All curls use `-s --max-time 10`.
URL base: `$DASHBOARD_URL` (default: `https://clawoss-dashboard.vercel.app`)

## Endpoints

**Heartbeat** - POST `/api/ingest/heartbeat`
```json
{"agent_id":"clawoss","status":"alive","currentTask":"...","uptimeSeconds":N}
```

**Metrics** - POST `/api/ingest/metrics`
```json
{"metrics":[{"provider":"<provider>","model":"$CLAWOSS_MODEL_PRIMARY","inputTokens":N,"outputTokens":N}]}
```
Cost is auto-computed server-side from the model name. If `costUsd` is omitted or 0, the dashboard uses its configured model pricing table (supports env-configured mainstream models). You can send `costUsd` to override.

**Logs** - POST `/api/ingest/logs`
```json
{"entries":[{"level":"info","source":"agent","message":"...","timestamp":"ISO8601"}]}
```

## When to Report

- Heartbeat cycle: heartbeat endpoint
- PR submitted/merged/closed: log entry
- Quality gate fail: warn log
- Error/recovery: error log
- Token usage: metrics after each run
- Sub-agent failure: log entry with structured failure_reason

If dashboard unreachable, log locally and continue. Never block work for telemetry.

## Structured Failure Logging

When logging sub-agent failures, include the standardized `failure_reason` category
from the taxonomy (see `templates/subagent-result-schema.md`). This enables dashboard
aggregation and pattern detection.

**Log format for failures:**
```json
{"entries":[{"level":"warn","source":"agent","message":"sub-agent failure: {repo}#{issue} - {failure_category}: {details}","timestamp":"ISO8601","metadata":{"repo":"{repo}","issue":"{issue}","failureCategory":"{category}","failureDetails":"{details}"}}]}
```

The `failureCategory` field must be one of the taxonomy values (e.g., `not_a_bug`,
`too_complex`, `repo_health_fail`). The dashboard can aggregate these to show
which failure modes are most common and help the agent adapt its strategy.
