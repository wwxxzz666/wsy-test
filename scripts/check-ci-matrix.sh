#!/usr/bin/env bash
# check-ci-matrix.sh — Extract CI matrix from .github/workflows/
# Usage: check-ci-matrix.sh <workspace_path>
# Outputs JSON with: OS targets, language versions, linters, formatters, type checkers
# Exit 0 always (data in JSON)

if [ "${1:-}" = "--help" ]; then
  echo "Usage: check-ci-matrix.sh <workspace_path>"
  echo "Reads .github/workflows/ and extracts CI requirements."
  exit 0
fi

WORKDIR="${1:?Usage: check-ci-matrix.sh <workspace_path>}"
WORKFLOWS_DIR="$WORKDIR/.github/workflows"

if [ ! -d "$WORKFLOWS_DIR" ]; then
  echo '{"has_ci": false, "workflows": 0}'
  exit 0
fi

# Count workflow files
WORKFLOW_COUNT=$(ls "$WORKFLOWS_DIR"/*.yml "$WORKFLOWS_DIR"/*.yaml 2>/dev/null | wc -l | tr -d ' ')

if [ "$WORKFLOW_COUNT" -eq 0 ]; then
  echo '{"has_ci": false, "workflows": 0}'
  exit 0
fi

# Parse all workflow files
python3 - "$WORKFLOWS_DIR" <<'PYEOF'
import os, json, re, glob, sys

workflows_dir = sys.argv[1]
files = glob.glob(os.path.join(workflows_dir, '*.yml')) + glob.glob(os.path.join(workflows_dir, '*.yaml'))

os_targets = set()
lang_versions = {}
linters = set()
formatters = set()
type_checkers = set()
test_commands = set()
workflow_names = []

# Known tool patterns
LINTER_PATTERNS = {
    'eslint': r'eslint|npx eslint',
    'ruff': r'ruff check|ruff linter',
    'flake8': r'flake8',
    'pylint': r'pylint',
    'golangci-lint': r'golangci-lint',
    'clippy': r'cargo clippy',
    'rubocop': r'rubocop',
    'shellcheck': r'shellcheck',
}
FORMATTER_PATTERNS = {
    'prettier': r'prettier|npx prettier',
    'black': r'black\s|python.*black',
    'gofmt': r'gofmt|goimports',
    'rustfmt': r'rustfmt|cargo fmt',
    'isort': r'isort',
}
TYPE_CHECK_PATTERNS = {
    'mypy': r'mypy',
    'pyright': r'pyright',
    'tsc': r'tsc\b|typescript',
    'pytype': r'pytype',
}

for f in files:
    try:
        content = open(f).read()
        name = os.path.basename(f)
        workflow_names.append(name)

        # OS targets
        for m in re.findall(r'os:\s*\[([^\]]+)\]', content):
            for os_name in m.split(','):
                os_targets.add(os_name.strip().strip('"').strip("'"))
        for m in re.findall(r'runs-on:\s*(.+)', content):
            os_val = m.strip().strip('"').strip("'")
            if 'matrix' not in os_val:
                os_targets.add(os_val)

        # Python versions
        for m in re.findall(r'python-version:\s*\[([^\]]+)\]', content):
            versions = [v.strip().strip('"').strip("'") for v in m.split(',')]
            lang_versions.setdefault('python', set()).update(versions)
        for m in re.findall(r"python-version:\s*[\"']?([0-9.]+)", content):
            lang_versions.setdefault('python', set()).add(m)

        # Node versions
        for m in re.findall(r'node-version:\s*\[([^\]]+)\]', content):
            versions = [v.strip().strip('"').strip("'") for v in m.split(',')]
            lang_versions.setdefault('node', set()).update(versions)

        # Go versions
        for m in re.findall(r"go-version:\s*[\"']?([0-9.]+)", content):
            lang_versions.setdefault('go', set()).add(m)

        # Rust versions
        for m in re.findall(r'toolchain:\s*(\S+)', content):
            lang_versions.setdefault('rust', set()).add(m.strip())

        # Detect tools
        for tool, pattern in LINTER_PATTERNS.items():
            if re.search(pattern, content, re.IGNORECASE):
                linters.add(tool)
        for tool, pattern in FORMATTER_PATTERNS.items():
            if re.search(pattern, content, re.IGNORECASE):
                formatters.add(tool)
        for tool, pattern in TYPE_CHECK_PATTERNS.items():
            if re.search(pattern, content, re.IGNORECASE):
                type_checkers.add(tool)

        # Test commands
        for m in re.findall(r'run:\s*(.+)', content):
            cmd = m.strip()
            if any(kw in cmd.lower() for kw in ['pytest', 'jest', 'go test', 'cargo test', 'npm test', 'yarn test', 'rspec', 'make test']):
                test_commands.add(cmd[:100])

    except Exception:
        pass

# Convert sets to sorted lists
result = {
    'has_ci': True,
    'workflows': len(files),
    'workflow_files': workflow_names,
    'os_targets': sorted(os_targets),
    'language_versions': {k: sorted(v) for k, v in lang_versions.items()},
    'linters': sorted(linters),
    'formatters': sorted(formatters),
    'type_checkers': sorted(type_checkers),
    'test_commands': sorted(test_commands)[:10],
}
print(json.dumps(result, indent=2))
PYEOF

if [ $? -ne 0 ]; then
  echo '{"has_ci": true, "workflows": '"$WORKFLOW_COUNT"', "error": "parse failed"}'
fi

exit 0
