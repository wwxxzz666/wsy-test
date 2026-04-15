#!/usr/bin/env bash

# Resolve an OpenClaw CLI entrypoint even when `openclaw` is not in PATH
# (common on Windows where OpenClaw is installed as a global npm package
# but the command shim is unavailable in the current shell).

to_posix_path() {
    local raw="$1"
    raw="${raw//\\//}"
    if [[ "$raw" =~ ^([A-Za-z]):/(.*)$ ]]; then
        local drive
        drive="$(echo "${BASH_REMATCH[1]}" | tr '[:upper:]' '[:lower:]')"
        echo "/$drive/${BASH_REMATCH[2]}"
    else
        echo "$raw"
    fi
}

ensure_openclaw_cli() {
    if command -v openclaw >/dev/null 2>&1; then
        return 0
    fi

    local node_bin="${OPENCLAW_NODE_BIN:-}"
    local js_path="${OPENCLAW_JS_PATH:-}"

    local -a node_candidates=()
    local -a js_candidates=()

    if [ -n "$node_bin" ]; then
        node_candidates+=("$node_bin")
    fi
    node_candidates+=("node" "/c/Program Files/nodejs/node.exe")

    if [ -n "$js_path" ]; then
        js_candidates+=("$js_path")
    fi

    if [ -n "${USERPROFILE:-}" ]; then
        js_candidates+=("${USERPROFILE}/AppData/Roaming/npm/node_modules/openclaw/dist/index.js")
        js_candidates+=("$(to_posix_path "$USERPROFILE")/AppData/Roaming/npm/node_modules/openclaw/dist/index.js")
    fi
    if [ -n "${HOME:-}" ]; then
        js_candidates+=("${HOME}/AppData/Roaming/npm/node_modules/openclaw/dist/index.js")
    fi

    local node_pick=""
    for candidate in "${node_candidates[@]}"; do
        if [ -z "$candidate" ]; then
            continue
        fi
        if [ "$candidate" = "node" ]; then
            if command -v node >/dev/null 2>&1; then
                node_pick="node"
                break
            fi
            continue
        fi
        if [ -x "$candidate" ]; then
            node_pick="$candidate"
            break
        fi
    done

    if [ -z "$node_pick" ]; then
        return 1
    fi

    local js_pick=""
    for candidate in "${js_candidates[@]}"; do
        if [ -n "$candidate" ] && [ -f "$candidate" ]; then
            js_pick="$candidate"
            break
        fi
    done

    if [ -z "$js_pick" ]; then
        return 1
    fi

    openclaw() {
        "$node_pick" "$js_pick" "$@"
    }

    return 0
}

