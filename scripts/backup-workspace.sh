#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
git add workspace/memory/ workspace/MEMORY.md
git diff --cached --quiet || git commit -m "chore: backup workspace state $(date +%Y-%m-%d)"
echo "Workspace backed up."
