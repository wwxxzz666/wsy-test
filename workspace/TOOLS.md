# Tool Conventions

## Required Binaries
- `git` — version control
- `gh` — GitHub CLI (authenticated)
- `node` / `npm` — Node.js runtime
- `curl` — HTTP requests to dashboard API

## Common Commands
NOTE: `gh search issues` with qualifier combos silently returns empty. Use `gh api` instead:
- `gh api "/search/issues?q=is:issue+is:open+label:bug+stars:>200&sort=created&order=desc&per_page=30"` — find bug reports
- `gh api "/search/issues?q=is:issue+is:open+label:defect+stars:>200&sort=created&order=desc&per_page=30"` — find defect reports
- `gh api "/search/issues?q=is:issue+is:open+label:regression+stars:>200&sort=created&order=desc&per_page=30"` — find regressions
- `gh api "/search/issues?q=is:issue+is:open+label:documentation+stars:>200&sort=created&order=desc&per_page=20"` — find docs issues
- `gh api "/search/issues?q=is:issue+is:open+label:typo+stars:>200&sort=created&order=desc&per_page=20"` — find typo reports
- `gh api "/search/issues?q=is:issue+is:open+label:good-first-issue+stars:>200&sort=created&order=desc&per_page=30"` — find easy wins
- `gh api "/search/issues?q=is:issue+is:open+label:help-wanted+stars:>200&sort=created&order=desc&per_page=30"` — find maintainer-requested help
- Add `--jq '.items[] | {number, title, html_url, created_at, repository_url}'` to extract fields
- `gh pr create --title "{type}(...): ..." --body "..."` — submit contribution PRs (type = fix, docs, or test)
- `gh pr list --author BillionClaw` — check own PRs (ALWAYS use explicit username, NOT @me — @me fails in sub-agent contexts)
- `git diff --stat` — verify diff size before submission

## Safety Rules
- Always use `gh pr create`, never `git push` to main
- Always run the target repo's test suite before submitting
- Always check diff size: target 25-100 lines, HARD MAX 200 lines changed
- Never use `feat:` commit prefix — we only contribute `fix:`, `docs:`, and `test:`
