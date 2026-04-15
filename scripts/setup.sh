#!/usr/bin/env bash
set -euo pipefail

echo "=== ClawOSS Setup ==="

# Auto-detect paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_DIR="$PROJECT_DIR/workspace"

# Check prerequisites
echo "Checking prerequisites..."
command -v openclaw >/dev/null 2>&1 || { echo "Error: openclaw not found. Install: npm i -g openclaw"; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "Error: gh not found. Install: brew install gh"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found. Install Node.js"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Error: python3 not found. Install Python 3"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Error: jq not found. Install: brew install jq"; exit 1; }
echo "[OK] All prerequisites found"

# Load .env for API keys
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
    echo "[OK] Loaded .env"
else
    echo "Error: .env not found. Run: cp .env.example .env && edit .env"
    exit 1
fi

# Validate required env vars
if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "Error: GITHUB_TOKEN not set in .env"
    exit 1
fi

# Unified model configuration (env-driven, provider-agnostic)
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

# Resolve API key from unified key first, then common provider env vars.
CLAWOSS_LLM_API_KEY="${CLAWOSS_LLM_API_KEY:-}"
if [ -z "$CLAWOSS_LLM_API_KEY" ]; then
    CLAWOSS_LLM_API_KEY="${OPENROUTER_API_KEY:-${OPENAI_API_KEY:-${ANTHROPIC_API_KEY:-${GEMINI_API_KEY:-${KIMI_API_KEY:-${MINIMAX_API_KEY:-}}}}}}"
fi
if [ -z "$CLAWOSS_LLM_API_KEY" ]; then
    echo "Error: missing model API key. Set CLAWOSS_LLM_API_KEY (or OPENROUTER_API_KEY/OPENAI_API_KEY/ANTHROPIC_API_KEY/GEMINI_API_KEY/KIMI_API_KEY/MINIMAX_API_KEY)."
    exit 1
fi

echo "[OK] API keys configured"
echo "[OK] Model config: $CLAWOSS_MODEL_PRIMARY @ $CLAWOSS_LLM_BASE_URL"

# Configure git identity
GITHUB_USERNAME="${GITHUB_USERNAME:-BillionClaw}"
GITHUB_EMAIL="${GITHUB_EMAIL:-267901332+BillionClaw@users.noreply.github.com}"
git config --global user.name "$GITHUB_USERNAME"
git config --global user.email "$GITHUB_EMAIL"
echo "[OK] Git identity: $GITHUB_USERNAME <$GITHUB_EMAIL>"

# Authenticate GitHub CLI
if gh auth status >/dev/null 2>&1; then
    echo "[OK] GitHub CLI already authenticated"
else
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null
        echo "[OK] GitHub CLI authenticated via token"
    else
        echo "GitHub CLI not authenticated. Starting interactive login..."
        gh auth login
    fi
fi

# Create workspace symlink
OPENCLAW_DIR="$HOME/.openclaw"
mkdir -p "$OPENCLAW_DIR"
WORKSPACE_LINK="$OPENCLAW_DIR/workspace"

if [ -L "$WORKSPACE_LINK" ] && [ "$(readlink "$WORKSPACE_LINK")" = "$WORKSPACE_DIR" ]; then
    echo "[OK] Workspace already linked"
elif [ -L "$WORKSPACE_LINK" ] || [ -d "$WORKSPACE_LINK" ]; then
    mv "$WORKSPACE_LINK" "${WORKSPACE_LINK}.backup.$(date +%s)"
    ln -sf "$WORKSPACE_DIR" "$WORKSPACE_LINK"
    echo "[OK] Workspace linked (old backed up)"
else
    ln -sf "$WORKSPACE_DIR" "$WORKSPACE_LINK"
    echo "[OK] Workspace linked"
fi

# Deploy config with path substitution
echo "Deploying config..."
sed \
    -e "s|__WORKSPACE_PATH__|$WORKSPACE_DIR|g" \
    -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__HOME_DIR__|$HOME|g" \
    "$PROJECT_DIR/config/openclaw.json" > "$OPENCLAW_DIR/openclaw.json"

# Inject env vars + model config into deployed config
_CONFIG_PATH="$OPENCLAW_DIR/openclaw.json" \
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
python3 -c "
import json, os

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

config_path = os.environ['_CONFIG_PATH']
with open(config_path, encoding='utf-8') as f:
    c = json.load(f)

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

cost = {'input': input_cost, 'output': output_cost}
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

c.setdefault('agents', {}).setdefault('defaults', {}).setdefault('model', {})
c['agents']['defaults']['model']['primary'] = primary_model
c['agents']['defaults']['model']['fallbacks'] = resolved_fallbacks
c['agents']['defaults'].setdefault('subagents', {})
c['agents']['defaults']['subagents']['model'] = primary_model

for agent in c.get('agents', {}).get('list', []):
    agent['model'] = primary_model
    agent.setdefault('heartbeat', {})
    agent['heartbeat']['model'] = primary_model

c.setdefault('models', {})
c['models']['mode'] = 'merge'
c['models']['providers'] = {
    primary_provider: {
        'baseUrl': base_url,
        'apiKey': '${CLAWOSS_LLM_API_KEY}',
        'api': 'openai-completions',
        'authHeader': True,
        'models': provider_models,
    }
}

c.setdefault('env', {})
env_vars = {
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
    'OPENROUTER_API_KEY': os.environ.get('OPENROUTER_API_KEY', ''),
    'OPENAI_API_KEY': os.environ.get('OPENAI_API_KEY', ''),
    'ANTHROPIC_API_KEY': os.environ.get('ANTHROPIC_API_KEY', ''),
    'GEMINI_API_KEY': os.environ.get('GEMINI_API_KEY', ''),
    'KIMI_API_KEY': os.environ.get('KIMI_API_KEY', ''),
    'MINIMAX_API_KEY': os.environ.get('MINIMAX_API_KEY', ''),
    'GITHUB_TOKEN': os.environ.get('_GH_TOKEN', ''),
    'DASHBOARD_URL': os.environ.get('_DASH_URL', ''),
    'CLAW_API_KEY': os.environ.get('_CLAW_KEY', ''),
}
for k, v in env_vars.items():
    if v:
        c['env'][k] = v
c['env'] = {k: v for k, v in c['env'].items() if v}

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(c, f, indent=2)
    f.write('\n')
" 2>/dev/null
echo "[OK] Config deployed with env-driven model + budget settings"

# Install PR ledger sync launchd plist
PLIST_SRC="$PROJECT_DIR/config/com.clawoss.pr-ledger-sync.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.clawoss.pr-ledger-sync.plist"
if [ -f "$PLIST_SRC" ]; then
    launchctl unload "$PLIST_DST" 2>/dev/null || true
    sed \
        -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
        -e "s|__HOME_DIR__|$HOME|g" \
        "$PLIST_SRC" > "$PLIST_DST"
    launchctl load "$PLIST_DST" 2>/dev/null || true
    echo "[OK] PR ledger sync installed (launchd, 60s interval)"
fi

# Install PII sanitizer plugin
PLUGIN_SRC="$PROJECT_DIR/plugins/pii-sanitizer"
PLUGIN_DST="$OPENCLAW_DIR/extensions/clawoss-pii-sanitizer"
if [ -d "$PLUGIN_SRC" ]; then
    mkdir -p "$PLUGIN_DST"
    cp -f "$PLUGIN_SRC/index.js" "$PLUGIN_DST/index.js"
    echo "[OK] PII sanitizer plugin installed"
fi

# Symlink skills
echo "Linking skills..."
mkdir -p "$OPENCLAW_DIR/skills"
for skill in "$WORKSPACE_DIR/skills"/*/; do
    [ ! -d "$skill" ] && continue
    name=$(basename "$skill")
    ln -sf "$skill" "$OPENCLAW_DIR/skills/$name"
    echo "  Linked: $name"
done

# Create working directories
mkdir -p "$OPENCLAW_DIR/logs"
mkdir -p "$WORKSPACE_DIR/memory/repos"
mkdir -p "$WORKSPACE_DIR/memory/issues"
echo "[OK] Directories ready"

echo ""
echo "=== Setup Complete ==="
echo "  Project: $PROJECT_DIR"
echo "  Workspace: $WORKSPACE_DIR"
echo "  Model: $CLAWOSS_MODEL_PRIMARY"
echo "  Endpoint: $CLAWOSS_LLM_BASE_URL"
echo ""
echo "Next steps:"
echo "  bash scripts/restart.sh    # Start the agent"
echo "  openclaw logs              # Watch agent output"
