# ClawOSS Acceptance Demo Checklist

Use this checklist to prove the system is fixed, deployable, autonomous, model-configurable, and budget-guarded.

## Prerequisites

1. Bring your own GitHub account (`gh auth status` works).
2. Bring your own OpenAI-compatible LLM API and set in `.env`:
   - `CLAWOSS_MODEL_PRIMARY`
   - `CLAWOSS_LLM_BASE_URL`
   - `CLAWOSS_LLM_API_KEY`
   - `CLAWOSS_TOKEN_BUDGET_TOTAL`
3. Bring your own dashboard server and key:
   - `DASHBOARD_URL`
   - `CLAW_API_KEY`
4. Start the system:
   - `bash scripts/setup.sh`
   - `bash scripts/restart.sh`

## What You Must Show During Acceptance

1. Dashboard link
   - Show `DASHBOARD_URL`
   - Show model/budget/connection status in the UI

2. GitHub account with a batch of PRs
   - Show GitHub profile (`GITHUB_USERNAME`)
   - Show open/merged/closed PR activity

3. Runtime evidence package
   - Run: `bash scripts/export-acceptance-evidence.sh`
   - Submit generated files:
     - `reports/acceptance/acceptance-evidence-*.md`
     - `reports/acceptance/acceptance-evidence-*.json`

## Suggested 3-5 Minute Demo Flow

1. Open `.env` and show model/budget come from env vars (not hardcoded).
2. Run `bash scripts/restart.sh` and show startup output (model/endpoint/budget).
3. Open dashboard and show active model + token budget + paused state behavior.
4. Open GitHub PR list for the same account and show recent batch activity.
5. Run `bash scripts/export-acceptance-evidence.sh` and show generated evidence files.
