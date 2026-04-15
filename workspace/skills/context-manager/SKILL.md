---
name: context-manager
description: "Manage context window: monitor usage, flush state to memory at 80% capacity, write work-in-progress summary, trigger compaction, re-read memory after compaction."
user-invocable: true
---

# Context Manager

Manage context window to maintain continuity across compaction cycles.

## When to Invoke
- Context window exceeds ~70% estimated capacity
- Before starting a new major task (clean up from previous)
- When switching between repositories

## Process
1. Monitor approximate context usage
2. When approaching limits (>70%):
   a. Flush all important state to memory files:
      - Current work-in-progress details
      - What has been tried and what failed
      - Key decisions made and reasoning
   b. Write summary of current task state
   c. Trigger compaction
3. After compaction:
   a. Re-read critical memory files
   b. Re-read HEARTBEAT.md and AGENTS.md
   c. Resume work from saved state
4. Between tasks:
   - Summarize completed work to memory
   - Clear working context for next task

## Memory File Format
Write to memory/YYYY-MM-DD.md:
```
## Work in Progress
- Repo: owner/repo
- Issue: #1234
- Branch: clawoss/{fix,docs,test,typo}/1234-description
- Status: implementing / reviewing / blocked
- Next step: [what to do after compaction]
```
