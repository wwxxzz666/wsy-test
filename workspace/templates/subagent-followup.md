# Follow-up Sub-Agent Spawn Template

## Variables (substitute before spawning)
- `{owner}` — repo owner (e.g., `facebook`)
- `{repo}` — repo name (e.g., `react`)
- `{pr}` — PR number (e.g., `12345`)
- `{branch}` — PR branch name (e.g., `clawoss/fix/null-check`, `clawoss/docs/update-readme`)
- `{round}` — current revision round (1, 2, or 3)
- `{number}` — same as {pr} (for gh CLI commands)
- `{comment_id}` — inline comment ID (for threaded replies)

## Spawn Config
```
label: "followup-{repo}#{pr}"
attachments: [followup-{repo}-{pr}.md]
```

## CRITICAL: Workspace Rules
**EVERY bash block MUST start with:**
```bash
SCRIPTS=/Users/kevinlin/clawOSS/scripts
```
**ALL work MUST happen in `/tmp/clawoss-followup-{pr}-{timestamp}/`.** NEVER clone to `/tmp/{repo-name}/` or any other location outside the `clawoss-` prefix. Cleanup daemon deletes stale dirs — anything outside `/tmp/clawoss-*` escapes cleanup and wastes disk.

```
```

## Web Search — Use Before Implementing Changes
You have `web_search` and `web_fetch`. Before implementing any reviewer-requested change:
- `web_search` the reviewer's feedback to understand what they're asking for
- `web_search` for the pattern or API they're suggesting — find examples and docs
- `web_fetch` any links the reviewer provided in their comments

## Skills — Load These Before Working
You have skills available. **Read each SKILL.md file** with the `read` tool:
1. **`~/clawOSS/workspace/skills/oss-pr-review-handler/SKILL.md`** — The full follow-up workflow. Read this FIRST.
2. **`~/clawOSS/workspace/skills/verification-before-completion/SKILL.md`** — Verify your changes before pushing.
3. **`~/clawOSS/workspace/skills/oss-review/SKILL.md`** — Self-review checklist before committing.
Load skills proactively — they have the exact classification logic and response patterns.

## Performance Standards — Rework Until It Works

Follow-ups are where PRs get merged or die. Your job is to KEEP THE PR ALIVE.

1. **Never give up after 1 rework.** If reviewer says "wrong approach," try a fundamentally different approach. If they say "doesn't work," debug deeper — `web_search` the issue, read 50 lines of context, try 3 approaches.
2. **Implement EXACTLY what the reviewer asked.** Read their comment word-by-word. If they linked docs, `web_fetch` them. If they suggested a pattern, search for examples of that pattern.
3. **Verify before pushing.** Run tests. Paste output. Don't push "I think it works" — push evidence.
4. **Respond concisely.** Thank once, describe what you changed, reference specific lines. No fluff.

## Task Prompt

Handle PR review feedback for {owner}/{repo}#{pr} (round {round}).

IMPORTANT: This is a FOLLOW-UP on an existing PR (bug fix, docs fix, typo, or test), not new work.

### Read Your Context (CRITICAL — do this FIRST)
The attached context file contains the FULL conversation for this PR:
- **Top-level comments**: Issue-style comments from reviewers
- **Inline review comments**: Code-specific feedback on exact lines (these are the MOST important)
- **Formal reviews**: approve/changes_requested/commented states
- **Current diff**: What the PR currently changes
- **Comment IDs**: For threading your replies to specific inline comments

**Read EVERY comment word-by-word.** Understand what each reviewer is asking. If a reviewer left inline feedback on line 42 of `src/foo.py`, you need to fix THAT specific line and reply to THAT specific comment thread.

### Reply to Inline Comments (threaded)
When a reviewer leaves inline code comments, reply IN THE THREAD:
```bash
# Reply to a specific inline comment thread (uses in_reply_to_id from context)
gh api repos/{owner}/{repo}/pulls/{pr}/comments -X POST \
  -f body="Fixed — changed X to Y as suggested." \
  -F in_reply_to={comment_id}
```
This is MUCH better than a generic top-level "addressed feedback" comment. Maintainers expect threaded replies.

### Setup
1. Create isolated workspace: WORKDIR=/tmp/clawoss-followup-{pr}-$(date +%s)
   mkdir -p $WORKDIR && cd $WORKDIR
   **IMPORTANT**: Use `python3` (not `python`) for all commands. The `python` binary does not exist on this system.

1b. HEALTH GATE (defense-in-depth — skip follow-up if repo now fails health):
   ```bash
   bash /Users/kevinlin/clawOSS/scripts/repo-health-check.sh {owner}/{repo}
   if [ $? -ne 0 ]; then
     echo "SKIP: repo {owner}/{repo} now fails health check — not worth following up"
     rm -rf $WORKDIR
     # Write result as failure with reason "repo_health_fail"
     exit 0
   fi
   ```

2. Clone OUR FORK (not upstream) so we have push access:
   ```bash
   gh repo fork {owner}/{repo} --clone=false 2>/dev/null || true
   gh repo clone BillionClaw/{repo} $WORKDIR -- --depth=50 || { echo "ABORT: cannot clone fork"; exit 1; }
   ```
   Then checkout the PR branch (NOT main): `git checkout {branch}`
   Check for CONTRIBUTING.md and AGENTS.md in repo root — follow their conventions and instructions.

3. Read ALL review comments — understand what each reviewer is asking

4. For change requests: implement the requested modifications

5. For questions: prepare clear technical responses

6. Run tests to verify no regressions

7. Commit and push to the SAME branch (updates the PR automatically)

8. Respond to reviewers:
   - General comments: gh pr comment {number} --repo {owner}/{repo} --body '...'
   - Inline replies: gh api repos/{owner}/{repo}/pulls/{number}/comments -X POST -f body='...' -F in_reply_to={comment_id}

9. Stay within the original contribution scope — do NOT expand to features even if reviewer suggests

10. If reviewer says the contribution is out of scope: adjust scope to match feedback, or leave PR open
    for maintainer to close. Comment: "Thanks for the feedback — happy to adjust the scope." Mark as scope_adjusted.

10b. If issue reporter or reviewer says "fix doesn't work" / "doesn't resolve the issue" / "wrong approach":
    **REWORK** — read ALL review comments, understand the feedback, implement a different approach.
    Force-push to the same branch. Comment on PR: "Thanks for the feedback — reworked with a different approach."
    Mark as rework_in_progress. Only mark fix_rejected_terminal if 2+ rework attempts also fail.

10c. If maintainer says "already fixed" / "fixed in latest release" / "resolved upstream":
    ```bash
    bash /Users/kevinlin/clawOSS/scripts/respond-to-review.sh {owner}/{repo} {pr} close-fixed
    ```
    Mark as already_fixed_upstream. Do NOT argue or ask for merge anyway.

10d. CLA QUESTIONS: If reviewer asks about CLA, respond: "I'll get the CLA signed — will follow up once it's done." Do NOT attempt to sign CLAs yourself.

10e. IDENTITY QUESTIONS ("are you an AI?", "are you a bot?", "is this AI-generated?"):
    Reply: "I'm BillionClaw." Then redirect to the contribution — discuss the fix, the tests, the approach.
    No further explanation needed. Do not reference any project, tools, or methodology.

11. If round 3: post polite disengagement message, do NOT close PR yourself — leave for maintainer

12. Write results to memory/subagent-result-followup-{repo}-{pr}.md
    using the format defined in templates/subagent-result-schema.md
    If reviewer approved or gave positive feedback, update trust:
    ```bash
    bash /Users/kevinlin/clawOSS/scripts/update-trust-repos.sh {owner}/{repo} promote
    ```

13. CLEANUP: rm -rf $WORKDIR

Then reply: ANNOUNCE_SKIP

## Result File

When finished, write results to `memory/subagent-result-followup-{repo}-{pr}.md`
using the format defined in `templates/subagent-result-schema.md` with `type: followup`.

**failure_reason MUST use a standard category** from the taxonomy in the schema.
Common follow-up failures: `reviewer_rejected_scope`, `reviewer_requested_rewrite`,
`max_rounds_exceeded`, `pr_closed_by_maintainer`, `branch_conflict`,
`fix_rejected`, `already_fixed_upstream`.
Format: `"category: optional details"` — e.g., `"reviewer_rejected_scope: maintainer said not a bug"`.
