#!/usr/bin/env bash
# tmp-cleaner.sh — Background daemon that cleans up ClawOSS temp directories
# Runs every 5 minutes, deletes dirs inactive for >30 minutes
# Start: nohup bash scripts/tmp-cleaner.sh &
# Stop: kill $(cat /tmp/clawoss-cleaner.pid)

set -u

INTERVAL=300  # 5 minutes
MAX_AGE=30    # minutes of inactivity before deletion
PID_FILE="/tmp/clawoss-cleaner.pid"
LOG_FILE="/tmp/clawoss-cleaner.log"

# Write PID for stop control
echo $$ > "$PID_FILE"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "ClawOSS tmp-cleaner started (PID $$, interval ${INTERVAL}s, max_age ${MAX_AGE}m)"

cleanup_cycle() {
    local freed=0
    local count=0

    # 1. Clean /tmp/clawoss-* dirs inactive >30 min
    while IFS= read -r dir; do
        [ -z "$dir" ] && continue
        size=$(du -sm "$dir" 2>/dev/null | cut -f1)
        rm -rf "$dir" 2>/dev/null
        freed=$((freed + size))
        count=$((count + 1))
    done < <(find /private/tmp -maxdepth 1 -name "clawoss-*" -type d -mmin +${MAX_AGE} 2>/dev/null)

    # 2. Clean escaped repos — subagents that cloned outside the clawoss- prefix
    #    Detect by: /tmp/{name}/.git exists AND dir is >30 min inactive
    while IFS= read -r gitdir; do
        [ -z "$gitdir" ] && continue
        parent=$(dirname "$gitdir")
        # Safety: only clean /tmp/{single-level} dirs, not nested
        depth=$(echo "$parent" | tr '/' '\n' | wc -l)
        [ "$depth" -gt 3 ] && continue
        # Check age
        age_min=$(( ($(date +%s) - $(stat -f %m "$parent" 2>/dev/null || echo $(date +%s))) / 60 ))
        if [ "$age_min" -gt "$MAX_AGE" ]; then
            size=$(du -sm "$parent" 2>/dev/null | cut -f1)
            rm -rf "$parent" 2>/dev/null
            freed=$((freed + size))
            count=$((count + 1))
        fi
    done < <(find /private/tmp -maxdepth 2 -name ".git" -type d -not -path "/private/tmp/openclaw/*" 2>/dev/null)

    # 3. Clean known escapee patterns (repos cloned to /tmp/{repo-name}/)
    for pattern in eliza copilotkit-* rig unsloth* fastapi libminizinc notebooks-check; do
        while IFS= read -r dir; do
            [ -z "$dir" ] && continue
            age_min=$(( ($(date +%s) - $(stat -f %m "$dir" 2>/dev/null || echo $(date +%s))) / 60 ))
            if [ "$age_min" -gt "$MAX_AGE" ]; then
                size=$(du -sm "$dir" 2>/dev/null | cut -f1)
                rm -rf "$dir" 2>/dev/null
                freed=$((freed + size))
                count=$((count + 1))
            fi
        done < <(find /private/tmp -maxdepth 1 -name "$pattern" -type d 2>/dev/null)
    done

    # 4. Clean large stray files (downloaded wheels, binaries, etc.)
    find /private/tmp -maxdepth 1 -name "*.whl" -mmin +${MAX_AGE} -delete 2>/dev/null
    find /private/tmp -maxdepth 1 -name "*.tar.gz" -size +50M -mmin +${MAX_AGE} -delete 2>/dev/null
    find /private/tmp -maxdepth 1 -name "*.zip" -size +50M -mmin +${MAX_AGE} -delete 2>/dev/null
    # Clean old issue-scout event files (90k each, hundreds accumulate)
    find /private/tmp -maxdepth 1 -name "issue-scout-evt-*.json" -mmin +${MAX_AGE} -delete 2>/dev/null
    # Clean old debug/test files from subagents
    find /private/tmp -maxdepth 1 -name "debug_*.py" -mmin +${MAX_AGE} -delete 2>/dev/null
    find /private/tmp -maxdepth 1 -name "test_*.py" -mmin +${MAX_AGE} -delete 2>/dev/null
    find /private/tmp -maxdepth 1 -name "test_*.rs" -mmin +${MAX_AGE} -delete 2>/dev/null

    # 5. Clean workspace/repos/ and workspace/workdir/ if >100MB
    for wsdir in /Users/kevinlin/clawOSS/workspace/repos /Users/kevinlin/clawOSS/workspace/workdir; do
        if [ -d "$wsdir" ]; then
            ws_size=$(du -sm "$wsdir" 2>/dev/null | cut -f1)
            if [ "${ws_size:-0}" -gt 100 ]; then
                rm -rf "$wsdir"/* 2>/dev/null
                freed=$((freed + ws_size))
                count=$((count + 1))
            fi
        fi
    done

    if [ "$count" -gt 0 ]; then
        log "Cleaned $count dirs, freed ${freed}MB"
    fi
}

# Main loop
while true; do
    cleanup_cycle
    sleep "$INTERVAL"
done
