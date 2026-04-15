#!/usr/bin/env bash
# ClawOSS V10 Full Restart Script
# THE canonical way to restart ClawOSS from scratch.
# Safe to run multiple times — idempotent.
#
# DO NOT use `set -euo pipefail` — many steps use commands that may
# legitimately fail (process kills, gateway stop, launchctl unload).
# Each step handles its own errors explicitly.

echo "=== ClawOSS V10 Full Restart ==="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_DIR="$PROJECT_DIR/workspace"
DEPLOYED_CONFIG="$HOME/.openclaw/openclaw.json"
GATEWAY_PLIST="$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist"
source "$SCRIPT_DIR/lib/openclaw-cli.sh"

# ── 0. Preflight checks ──────────────────────────────────────────────
MISSING=()
command -v python3 &>/dev/null || MISSING+=("python3")
command -v gh       &>/dev/null || MISSING+=("gh")
command -v jq       &>/dev/null || MISSING+=("jq")
command -v node     &>/dev/null || MISSING+=("node")
ensure_openclaw_cli || MISSING+=("openclaw")

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "[FAIL] Missing required tools: ${MISSING[*]}"
    echo "       Install them and retry."
    exit 1
fi
echo "[OK] All required tools found (python3, gh, jq, openclaw, node)"

# 0b. Ensure `python` resolves to `python3` (macOS has no `python` binary)
# Subagents run target repo test suites that call `python` — this prevents failures.
if ! command -v python &>/dev/null && command -v python3 &>/dev/null; then
    mkdir -p "$HOME/.local/bin"
    ln -sf "$(which python3)" "$HOME/.local/bin/python"
    # Ensure ~/.local/bin is in PATH for this session
    export PATH="$HOME/.local/bin:$PATH"
    echo "[OK] Created python -> python3 symlink in ~/.local/bin"
elif command -v python &>/dev/null; then
    echo "[OK] python already available: $(which python)"
fi

# ── 1. Load environment ──────────────────────────────────────────────
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
    echo "[OK] Loaded .env"
else
    echo "[INFO] No .env found — using existing env vars"
fi

# ── 2. Git identity ──────────────────────────────────────────────────
# Model configuration defaults (all env-driven)
CLAWOSS_MODEL_PRIMARY="${CLAWOSS_MODEL_PRIMARY:-openrouter/openai/gpt-4.1-mini}"
CLAWOSS_MODEL_FALLBACKS="${CLAWOSS_MODEL_FALLBACKS:-}"
CLAWOSS_LLM_BASE_URL="${CLAWOSS_LLM_BASE_URL:-https://openrouter.ai/api/v1}"
CLAWOSS_MODEL_CONTEXT_WINDOW="${CLAWOSS_MODEL_CONTEXT_WINDOW:-204800}"
CLAWOSS_MODEL_MAX_TOKENS="${CLAWOSS_MODEL_MAX_TOKENS:-131072}"
CLAWOSS_MODEL_REASONING="${CLAWOSS_MODEL_REASONING:-true}"
CLAWOSS_MODEL_INPUT_COST_PER_MTOK="${CLAWOSS_MODEL_INPUT_COST_PER_MTOK:-0.60}"
CLAWOSS_MODEL_OUTPUT_COST_PER_MTOK="${CLAWOSS_MODEL_OUTPUT_COST_PER_MTOK:-3.00}"
CLAWOSS_MODEL_NAME="${CLAWOSS_MODEL_NAME:-}"
CLAWOSS_MODEL_CACHE_READ_COST_PER_MTOK="${CLAWOSS_MODEL_CACHE_READ_COST_PER_MTOK:-}"
CLAWOSS_MODEL_CACHE_WRITE_COST_PER_MTOK="${CLAWOSS_MODEL_CACHE_WRITE_COST_PER_MTOK:-}"
CLAWOSS_TOKEN_BUDGET_TOTAL="${CLAWOSS_TOKEN_BUDGET_TOTAL:-0}"

# Resolve unified LLM API key
CLAWOSS_LLM_API_KEY="${CLAWOSS_LLM_API_KEY:-}"
if [ -z "$CLAWOSS_LLM_API_KEY" ]; then
    CLAWOSS_LLM_API_KEY="${OPENROUTER_API_KEY:-${OPENAI_API_KEY:-${ANTHROPIC_API_KEY:-${GEMINI_API_KEY:-${KIMI_API_KEY:-${MINIMAX_API_KEY:-}}}}}}"
fi
if [ -z "$CLAWOSS_LLM_API_KEY" ]; then
    echo "[FAIL] Missing LLM API key. Set CLAWOSS_LLM_API_KEY (or a provider-specific key)."
    exit 1
fi
echo "[OK] Model config: $CLAWOSS_MODEL_PRIMARY @ $CLAWOSS_LLM_BASE_URL"

GITHUB_USERNAME="${GITHUB_USERNAME:-BillionClaw}"
GITHUB_EMAIL="${GITHUB_EMAIL:-267901332+BillionClaw@users.noreply.github.com}"
git config --global user.name "$GITHUB_USERNAME"
git config --global user.email "$GITHUB_EMAIL"
echo "[OK] Git identity: $GITHUB_USERNAME <$GITHUB_EMAIL>"

# ── 3. GitHub CLI auth (skip if already authenticated) ────────────────
if gh auth status &>/dev/null; then
    echo "[OK] GitHub CLI already authenticated"
elif [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
    if gh auth status &>/dev/null; then
        echo "[OK] GitHub CLI authenticated via token"
    else
        echo "[WARN] GitHub CLI auth failed — gh commands may fail"
    fi
else
    echo "[WARN] No GITHUB_TOKEN and gh not authenticated — gh commands may fail"
fi

# ── 4. Link workspace ────────────────────────────────────────────────
OC_WORKSPACE="$HOME/.openclaw/workspace"
if [ ! -L "$OC_WORKSPACE" ] || [ "$(readlink "$OC_WORKSPACE" 2>/dev/null)" != "$WORKSPACE_DIR" ]; then
    if [ -d "$OC_WORKSPACE" ] && [ ! -L "$OC_WORKSPACE" ]; then
        mv "$OC_WORKSPACE" "${OC_WORKSPACE}.backup.$(date +%s)"
    fi
    rm -f "$OC_WORKSPACE" 2>/dev/null || true
    ln -sf "$WORKSPACE_DIR" "$OC_WORKSPACE"
    echo "[OK] Workspace linked: $WORKSPACE_DIR"
else
    echo "[OK] Workspace already linked"
fi

# ── 5. Deploy config (deep-merge repo config into deployed config) ────
# Preserves gateway-managed sections (meta, commands, plugins, gateway.auth)
# while overlaying all agent/tool/skill settings from the repo config.

REPO_CONFIG_RESOLVED=$(sed \
    -e "s|__WORKSPACE_PATH__|$WORKSPACE_DIR|g" \
    -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__HOME_DIR__|$HOME|g" \
    "$PROJECT_DIR/config/openclaw.json")

_REPO_CONFIG="$REPO_CONFIG_RESOLVED" \
_DEPLOYED="$DEPLOYED_CONFIG" \
_MODEL_PRIMARY="${CLAWOSS_MODEL_PRIMARY:-}" \
_MODEL_FALLBACKS="${CLAWOSS_MODEL_FALLBACKS:-}" \
_MODEL_BASE_URL="${CLAWOSS_LLM_BASE_URL:-}" \
_LLM_API_KEY="${CLAWOSS_LLM_API_KEY:-}" \
_MODEL_NAME="${CLAWOSS_MODEL_NAME:-}" \
_MODEL_CONTEXT_WINDOW="${CLAWOSS_MODEL_CONTEXT_WINDOW:-}" \
_MODEL_MAX_TOKENS="${CLAWOSS_MODEL_MAX_TOKENS:-}" \
_MODEL_REASONING="${CLAWOSS_MODEL_REASONING:-}" \
_MODEL_INPUT_COST="${CLAWOSS_MODEL_INPUT_COST_PER_MTOK:-}" \
_MODEL_OUTPUT_COST="${CLAWOSS_MODEL_OUTPUT_COST_PER_MTOK:-}" \
_MODEL_CACHE_READ_COST="${CLAWOSS_MODEL_CACHE_READ_COST_PER_MTOK:-}" \
_MODEL_CACHE_WRITE_COST="${CLAWOSS_MODEL_CACHE_WRITE_COST_PER_MTOK:-}" \
_TOKEN_BUDGET_TOTAL="${CLAWOSS_TOKEN_BUDGET_TOTAL:-}" \
_GH_TOKEN="${GITHUB_TOKEN:-}" \
_DASH_URL="${DASHBOARD_URL:-https://clawoss-dashboard.vercel.app}" \
_CLAW_KEY="${CLAW_API_KEY:-}" \
_OPENROUTER_KEY="${OPENROUTER_API_KEY:-}" \
python3 -c "
import json, os

def deep_merge(base, override):
    result = dict(base)
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge(result[k], v)
        else:
            result[k] = v
    return result

def parse_bool(value, default):
    if value is None or value == '':
        return default
    return value.strip().lower() in ('1', 'true', 'yes', 'on')

def parse_int(value, default):
    try:
        return int(str(value).strip())
    except Exception:
        return default

def parse_float(value, default):
    try:
        return float(str(value).strip())
    except Exception:
        return default

def split_model(full, default_provider='llm'):
    full = (full or '').strip()
    if '/' in full:
        provider, model_id = full.split('/', 1)
        provider = provider.strip() or default_provider
        model_id = model_id.strip()
        return provider, model_id
    return default_provider, full

repo_config = json.loads(os.environ['_REPO_CONFIG'])
deployed_path = os.environ['_DEPLOYED']

try:
    with open(deployed_path, encoding='utf-8') as f:
        deployed = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    deployed = {}

merged = deep_merge(deployed, repo_config)

primary_model = (os.environ.get('_MODEL_PRIMARY') or 'openrouter/openai/gpt-4.1-mini').strip()
fallback_models = [m.strip() for m in (os.environ.get('_MODEL_FALLBACKS') or '').split(',') if m.strip()]
base_url = (os.environ.get('_MODEL_BASE_URL') or 'https://openrouter.ai/api/v1').strip()
primary_provider, primary_model_id = split_model(primary_model, 'llm')
if '/' not in primary_model:
    primary_model = f'{primary_provider}/{primary_model_id}'

resolved_fallbacks = []
provider_model_ids = [primary_model_id]
for fb in fallback_models:
    fb_provider, fb_id = split_model(fb, primary_provider)
    if fb_provider != primary_provider:
        continue
    if fb_id and fb_id not in provider_model_ids:
        provider_model_ids.append(fb_id)
        resolved_fallbacks.append(f'{primary_provider}/{fb_id}')

context_window = parse_int(os.environ.get('_MODEL_CONTEXT_WINDOW'), 204800)
max_tokens = parse_int(os.environ.get('_MODEL_MAX_TOKENS'), 131072)
reasoning = parse_bool(os.environ.get('_MODEL_REASONING'), True)
input_cost = parse_float(os.environ.get('_MODEL_INPUT_COST'), 0.60)
output_cost = parse_float(os.environ.get('_MODEL_OUTPUT_COST'), 3.00)
cache_read = os.environ.get('_MODEL_CACHE_READ_COST')
cache_write = os.environ.get('_MODEL_CACHE_WRITE_COST')
model_name_override = (os.environ.get('_MODEL_NAME') or '').strip()

cost = { 'input': input_cost, 'output': output_cost }
if cache_read not in (None, ''):
    cost['cacheRead'] = parse_float(cache_read, 0.0)
if cache_write not in (None, ''):
    cost['cacheWrite'] = parse_float(cache_write, 0.0)

provider_models = []
for index, model_id in enumerate(provider_model_ids):
    provider_models.append({
        'id': model_id,
        'name': model_name_override if index == 0 and model_name_override else model_id,
        'reasoning': reasoning,
        'input': ['text'],
        'cost': cost,
        'contextWindow': context_window,
        'maxTokens': max_tokens,
    })

merged.setdefault('agents', {}).setdefault('defaults', {}).setdefault('model', {})
merged['agents']['defaults']['model']['primary'] = primary_model
merged['agents']['defaults']['model']['fallbacks'] = resolved_fallbacks
merged['agents']['defaults'].setdefault('subagents', {})
merged['agents']['defaults']['subagents']['model'] = primary_model

for agent in merged.get('agents', {}).get('list', []):
    agent['model'] = primary_model
    agent.setdefault('heartbeat', {})
    agent['heartbeat']['model'] = primary_model

merged.setdefault('models', {})
merged['models']['mode'] = 'merge'
merged['models']['providers'] = {
    primary_provider: {
        'baseUrl': base_url,
        'apiKey': '${CLAWOSS_LLM_API_KEY}',
        'api': 'openai-completions',
        'authHeader': True,
        'models': provider_models,
    }
}

# Inject env vars (non-empty only)
merged.setdefault('env', {})
env_map = {
    'CLAWOSS_MODEL_PRIMARY': primary_model,
    'CLAWOSS_MODEL_FALLBACKS': os.environ.get('_MODEL_FALLBACKS', ''),
    'CLAWOSS_MODEL_CONTEXT_WINDOW': os.environ.get('_MODEL_CONTEXT_WINDOW', ''),
    'CLAWOSS_MODEL_MAX_TOKENS': os.environ.get('_MODEL_MAX_TOKENS', ''),
    'CLAWOSS_MODEL_REASONING': os.environ.get('_MODEL_REASONING', ''),
    'CLAWOSS_MODEL_NAME': os.environ.get('_MODEL_NAME', ''),
    'CLAWOSS_MODEL_INPUT_COST_PER_MTOK': os.environ.get('_MODEL_INPUT_COST', ''),
    'CLAWOSS_MODEL_OUTPUT_COST_PER_MTOK': os.environ.get('_MODEL_OUTPUT_COST', ''),
    'CLAWOSS_MODEL_CACHE_READ_COST_PER_MTOK': os.environ.get('_MODEL_CACHE_READ_COST', ''),
    'CLAWOSS_MODEL_CACHE_WRITE_COST_PER_MTOK': os.environ.get('_MODEL_CACHE_WRITE_COST', ''),
    'CLAWOSS_LLM_BASE_URL': os.environ.get('_MODEL_BASE_URL', ''),
    'CLAWOSS_LLM_API_KEY': os.environ.get('_LLM_API_KEY', ''),
    'CLAWOSS_TOKEN_BUDGET_TOTAL': os.environ.get('_TOKEN_BUDGET_TOTAL', ''),
    'OPENAI_API_KEY': os.environ.get('OPENAI_API_KEY', ''),
    'ANTHROPIC_API_KEY': os.environ.get('ANTHROPIC_API_KEY', ''),
    'GEMINI_API_KEY': os.environ.get('GEMINI_API_KEY', ''),
    'KIMI_API_KEY': os.environ.get('KIMI_API_KEY', ''),
    'MINIMAX_API_KEY': os.environ.get('MINIMAX_API_KEY', ''),
    'GITHUB_TOKEN': os.environ.get('_GH_TOKEN', ''),
    'DASHBOARD_URL': os.environ.get('_DASH_URL', ''),
    'CLAW_API_KEY': os.environ.get('_CLAW_KEY', ''),
    'OPENROUTER_API_KEY': os.environ.get('_OPENROUTER_KEY', ''),
}
for k, v in env_map.items():
    if v:
        merged['env'][k] = v
merged['env'] = {k: v for k, v in merged['env'].items() if v}

with open(deployed_path, 'w', encoding='utf-8') as f:
    json.dump(merged, f, indent=2)
    f.write('\n')
"

if [ $? -eq 0 ]; then
    echo "[OK] Config deployed (deep-merged with env-driven model + budget vars)"
else
    echo "[FAIL] Config merge failed — check python3 output above"
    exit 1
fi

# ── 5b. Disable cron jobs (V10: no cron dependencies) ─────────────────
# V10 architecture: heartbeat + 3 always-on subagents handle everything.
# Crons are disabled — scout handles discovery, PR monitor handles follow-ups,
# PR analyst handles reporting/analysis, heartbeat step 7 handles cleanup.
CRON_STORE="$HOME/.openclaw/cron/jobs.json"
if [ -f "$CRON_STORE" ]; then
    python3 -c "
import json
with open('$CRON_STORE') as f:
    store = json.load(f)
for job in store.get('jobs', []):
    job['enabled'] = False
with open('$CRON_STORE', 'w') as f:
    json.dump(store, f, indent=2)
print('All cron jobs disabled (V10: no cron dependencies)')
" 2>&1 || true
    echo "[OK] Cron jobs disabled (V10: heartbeat + subagents handle everything)"
fi

# ── 6. Update gateway plist PATH (ensure python3, gh, jq are reachable) ─
# The gateway spawns subagents that need these tools. launchd has a minimal
# PATH so we inject the paths we need.
if [ -f "$GATEWAY_PLIST" ]; then
    # Get current PATH from plist
    PLIST_PATH=$(/usr/libexec/PlistBuddy -c "Print :EnvironmentVariables:PATH" "$GATEWAY_PLIST" 2>/dev/null || echo "")
    NEEDS_UPDATE=false

    # Directories that must be in the plist PATH
    REQUIRED_DIRS=()
    for dir in "/opt/homebrew/bin" "/usr/local/bin" "/usr/bin" "/bin" "/usr/sbin" "/sbin"; do
        if [ -d "$dir" ] && [[ ":$PLIST_PATH:" != *":$dir:"* ]]; then
            REQUIRED_DIRS+=("$dir")
            NEEDS_UPDATE=true
        fi
    done

    # Also add nvm node path if present
    NVM_NODE_DIR="$(dirname "$(which node)" 2>/dev/null || echo "")"
    if [ -n "$NVM_NODE_DIR" ] && [[ ":$PLIST_PATH:" != *":$NVM_NODE_DIR:"* ]]; then
        REQUIRED_DIRS+=("$NVM_NODE_DIR")
        NEEDS_UPDATE=true
    fi

    # Add gh path if not already included
    GH_DIR="$(dirname "$(which gh)" 2>/dev/null || echo "")"
    if [ -n "$GH_DIR" ] && [[ ":$PLIST_PATH:" != *":$GH_DIR:"* ]]; then
        REQUIRED_DIRS+=("$GH_DIR")
        NEEDS_UPDATE=true
    fi

    # Add ~/.local/bin (python -> python3 symlink lives here)
    LOCAL_BIN="$HOME/.local/bin"
    if [ -d "$LOCAL_BIN" ] && [[ ":$PLIST_PATH:" != *":$LOCAL_BIN:"* ]]; then
        REQUIRED_DIRS+=("$LOCAL_BIN")
        NEEDS_UPDATE=true
    fi

    if [ "$NEEDS_UPDATE" = true ] && [ -n "$PLIST_PATH" ]; then
        NEW_PATH="$PLIST_PATH"
        for dir in "${REQUIRED_DIRS[@]}"; do
            NEW_PATH="$NEW_PATH:$dir"
        done
        /usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:PATH $NEW_PATH" "$GATEWAY_PLIST" 2>/dev/null || true
        echo "[OK] Gateway plist PATH updated (added: ${REQUIRED_DIRS[*]})"
    else
        echo "[OK] Gateway plist PATH already includes required dirs"
    fi
else
    echo "[INFO] No gateway plist found at $GATEWAY_PLIST — gateway install will create it"
fi

# ── 7. Flush context & clean sessions ─────────────────────────────────
# Delete ALL session .jsonl files (main + subagents) to force fresh context.
# OpenClaw recreates them on next message — this is safe per DeepWiki docs.
# The heartbeat timer lives in gateway process memory, not in session files.
# Also delete sessions.json entries — they're recreated on demand.
SESSIONS_DIR="$HOME/.openclaw/agents/clawoss/sessions"
TOTAL_CLEANED=0
if [ -d "$SESSIONS_DIR" ]; then
    TOTAL_CLEANED=$(find "$SESSIONS_DIR" -name "*.jsonl*" 2>/dev/null | wc -l | tr -d ' ')
    rm -f "$SESSIONS_DIR/"*.jsonl 2>/dev/null || true
    rm -f "$SESSIONS_DIR/"*.jsonl.deleted.* 2>/dev/null || true
    rm -f "$SESSIONS_DIR/"*.jsonl.reset.* 2>/dev/null || true
    rm -f "$SESSIONS_DIR/"*.lock 2>/dev/null || true
    # Reset sessions.json to empty — gateway recreates entries on first heartbeat
    echo '{}' > "$SESSIONS_DIR/sessions.json"
fi
echo "[OK] Context flushed ($TOTAL_CLEANED session files removed, fresh start)"

# ── 7b. Reset impl-spawn-state to EMPTY ───────────────────────────────
# All subagents die on restart. The state file must be reset to show 0 active
# agents — otherwise the main agent reads "10/10 slots FULL" and refuses to
# spawn new work. This was the root cause of post-restart stalls.
cat > "$WORKSPACE_DIR/memory/impl-spawn-state.md" << 'SPAWNEOF'
# Implementation Spawn State — Reset by restart.sh

## Active Implementations (0 total)
| issue_url | repo | status | spawned_at |
|-----------|------|--------|------------|

## Active Follow-ups (0 total)
| pr_url | repo | status | round | spawned_at |
|--------|------|--------|-------|------------|
SPAWNEOF
# Also reset followup state
cat > "$WORKSPACE_DIR/memory/pr-followup-state.md" << 'FOLLOWEOF'
# PR Follow-up State — Reset by restart.sh
No active follow-ups.
FOLLOWEOF
echo "[OK] Spawn state reset to empty (0 active implementations)"

# ── 7c. Clean stale subagent result files ─────────────────────────
RESULT_COUNT=$(ls "$WORKSPACE_DIR/memory/subagent-result-"*.md 2>/dev/null | wc -l | tr -d ' ')
rm -f "$WORKSPACE_DIR/memory/subagent-result-"*.md 2>/dev/null || true
echo "[OK] Cleaned $RESULT_COUNT stale result files"

# ── 8. Reset wake state (V9: no rate-limit fields) ───────────────────
cat > "$WORKSPACE_DIR/memory/wake-state.md" << 'WAKEEOF'
consecutive_wakes: 0
errors_this_hour: 0
last_error: none
last_wake: none
WAKEEOF
echo "[OK] Wake state reset (V10)"

# ── 9. Create required directories ───────────────────────────────────
mkdir -p "$HOME/.openclaw/logs"
mkdir -p "$WORKSPACE_DIR/memory/repos"
mkdir -p "$WORKSPACE_DIR/memory/issues"
mkdir -p "$WORKSPACE_DIR/memory/locks"
mkdir -p "$WORKSPACE_DIR/memory/subagent-inputs"
echo "[OK] Directories ready (including memory/locks/ for dedup)"

# ── 10. Clean ALL lock files (restart = full cleanup) ─────────────────
ALL_LOCKS=$(find "$WORKSPACE_DIR/memory/locks/" -name "*.lock" 2>/dev/null | wc -l | tr -d ' ')
find "$WORKSPACE_DIR/memory/locks/" -name "*.lock" -delete 2>/dev/null || true
echo "[OK] All lock files cleaned ($ALL_LOCKS removed)"

# ── 11. Clean ALL /tmp workspaces (restart = full cleanup) ────────────
ORPHANED=$(find /tmp -maxdepth 1 -name "clawoss-*" -type d 2>/dev/null | wc -l | tr -d ' ')
find /tmp -maxdepth 1 -name "clawoss-*" -type d -exec rm -rf {} + 2>/dev/null || true
echo "[OK] All /tmp workspaces cleaned ($ORPHANED removed)"

# ── 12. Kill all subagents, then stop gateway ─────────────────────────
# Kill all running subagents BEFORE stopping the gateway.
# This prevents orphaned LLM inference runs that consume API tokens.
# The /subagents kill all command terminates all active subagent runs.
if openclaw gateway status 2>/dev/null | grep -qi "running\|reachable\|ok"; then
    echo "[INFO] Killing all active subagents..."
    openclaw system event --text "/subagents kill all" --mode now 2>/dev/null || true
    sleep 3  # Give gateway time to process kill commands
    # Also run sessions cleanup to prune any stale entries
    openclaw sessions cleanup --agent clawoss 2>/dev/null || true
    echo "[OK] All subagents killed"
fi
openclaw gateway stop 2>/dev/null || true
sleep 2
echo "[OK] Gateway stopped"

# ── 13. Start gateway (prefer install for launchd, fallback to run) ───
# `gateway install` creates/updates the launchd plist and loads it.
# The plist has all env vars baked in (model keys, GITHUB_TOKEN, etc.)
# `gateway run &` is a fallback that inherits the current shell env.
if openclaw gateway install 2>/dev/null; then
    echo "[OK] Gateway installed via launchd"
else
    echo "[WARN] gateway install failed — falling back to gateway run"
    openclaw gateway run &
    echo "[OK] Gateway started in background (PID $!)"
fi

sleep 8  # 8s to allow gateway to fully initialize heartbeat timer + session registry

# Verify gateway is running
if openclaw gateway status 2>/dev/null | grep -qi "running\|reachable\|ok"; then
    echo "[OK] Gateway verified running"
else
    echo "[FAIL] Gateway not running after startup"
    echo "       Try: openclaw gateway status"
    echo "       Try: openclaw gateway run"
    echo "       Logs: cat ~/.openclaw/logs/gateway.err.log"
    exit 1
fi

# ── 14. Dashboard sync ───────────────────────────────────────────────
pkill -f "dashboard-sync" 2>/dev/null || true
sleep 1

if [ -f "$PROJECT_DIR/scripts/dashboard-sync.sh" ]; then
    if [ -z "${CLAW_API_KEY:-}" ]; then
        echo "[WARN] CLAW_API_KEY not set — dashboard-sync will not start"
    else
        nohup bash "$PROJECT_DIR/scripts/dashboard-sync.sh" > /tmp/dashboard-sync.log 2>&1 &
        echo "[OK] Dashboard sync started (PID $!)"
    fi
else
    echo "[INFO] No dashboard-sync.sh found — skipping"
fi

# ── 15. PR ledger sync (launchd, runs every 60s) ─────────────────────
LEDGER_PLIST="$HOME/Library/LaunchAgents/com.clawoss.pr-ledger-sync.plist"
launchctl unload "$LEDGER_PLIST" 2>/dev/null || true

if [ -f "$PROJECT_DIR/config/com.clawoss.pr-ledger-sync.plist" ]; then
    sed \
        -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
        -e "s|__HOME_DIR__|$HOME|g" \
        "$PROJECT_DIR/config/com.clawoss.pr-ledger-sync.plist" > "$LEDGER_PLIST"
    launchctl load "$LEDGER_PLIST" 2>/dev/null || true
    echo "[OK] PR ledger sync installed (launchd, 60s interval)"
elif [ -f "$LEDGER_PLIST" ]; then
    launchctl load "$LEDGER_PLIST" 2>/dev/null || true
    echo "[OK] PR ledger sync loaded (existing plist)"
else
    echo "[INFO] No pr-ledger-sync plist found — skipping"
fi

# ── 15b. Ensure dual push remotes (CMLKevin + billion-token-one-task) ──
cd "$PROJECT_DIR"
# Add billionclaw as second push URL so `git push origin` goes to both repos
PUSH_URLS=$(git remote get-url --push --all origin 2>/dev/null || echo "")
if ! echo "$PUSH_URLS" | grep -q "billion-token-one-task"; then
    git remote set-url --add --push origin https://github.com/billion-token-one-task/ClawOSS.git 2>/dev/null || true
    echo "[OK] Added billion-token-one-task as second push target"
else
    echo "[OK] Dual push remotes already configured"
fi

# ── 16. Kick the agent ───────────────────────────────────────────────
sleep 3
if openclaw system event \
    --text "ClawOSS V10.1 restart. Execute HEARTBEAT.md steps 0-7. Always-on agents use runTimeoutSeconds:0 (no timeout). Discover across ALL niches. Fill all 10 impl slots. NEVER idle — always work on something." \
    --mode now 2>&1; then
    echo "[OK] Agent kicked (V10)"
else
    echo "[WARN] Agent wake event failed — agent will wake on next heartbeat timer"
fi

# ── 17. Start tmp-cleaner daemon ───────────────────────────────────────
pkill -f "tmp-cleaner.sh" 2>/dev/null || true
nohup bash "$PROJECT_DIR/scripts/tmp-cleaner.sh" > /dev/null 2>&1 &
echo "[OK] tmp-cleaner daemon started (PID $!, cleans /tmp/clawoss-* every 5m)"

# ── 18. Trigger dashboard PR sync ──────────────────────────────────────
# Sync GitHub PR data to dashboard so it shows current stats immediately
sleep 5  # Wait for gateway to be fully ready
DASH_URL="${DASHBOARD_URL:-https://clawoss-dashboard.vercel.app}"
DASH_KEY="${CLAW_API_KEY:-}"
if [ -n "$DASH_KEY" ]; then
    SYNC_RESULT=$(curl -s --max-time 30 "${DASH_URL}/api/github/sync" 2>/dev/null)
    SYNCED=$(echo "$SYNC_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('synced',0))" 2>/dev/null || echo "0")
    echo "[OK] Dashboard PR sync: $SYNCED PRs synced"
else
    echo "[WARN] CLAW_API_KEY not set — skipping dashboard sync"
fi

# ── Summary ───────────────────────────────────────────────────────────
echo ""
echo "=== ClawOSS V10 Running ==="
echo "  Model: ${CLAWOSS_MODEL_PRIMARY}"
echo "  Fallbacks: ${CLAWOSS_MODEL_FALLBACKS:-none}"
echo "  Endpoint: ${CLAWOSS_LLM_BASE_URL}"
echo "  Token Budget: ${CLAWOSS_TOKEN_BUDGET_TOTAL:-0} (0 = disabled)"
echo "  Dashboard: ${DASHBOARD_URL:-https://clawoss-dashboard.vercel.app}"
echo "  Slots: 3 always-on (scout + PR monitor + PR analyst) + 10 impl/followup = 13"
echo "  Heartbeat: 5m"
echo "  Logs: openclaw logs"
echo "  PRs: gh search prs --author BillionClaw --state open"
echo "  Stop: openclaw gateway stop && pkill -f dashboard-sync"
echo ""
echo "V10.1 features: P(merge) scoring, no per-repo PR cap,"
echo "7-niche discovery, always-on agents with no timeout (runTimeoutSeconds:0),"
echo "rework-not-close, lock-file dedup, CLA auto-signing, unconditional ANNOUNCE_SKIP."
echo ""
echo "The agent runs independently via OpenClaw gateway — no manual intervention needed."
