# End-to-End Workflow

## The Two-Phase Model

ralph-it is designed around two phases of work:

### Phase 1: Human + Agent (conversational)

You work interactively with an AI assistant (Claude Code, etc.) to:
- Set up the project architecture
- Make design decisions
- Push initial code
- Configure ralph-it
- Create well-structured issues for autonomous processing

This is collaborative, high-context work where human judgment matters.

### Phase 2: ralph-it (autonomous)

ralph-it takes over and:
- Picks issues from the queue
- Runs the agent on each issue
- Commits directly, comments on issues, closes them
- Moves to the next issue

This is execution work — well-defined tasks with clear acceptance criteria.

## Complete Walkthrough

### 1. Start with your project

You have a project. Maybe it's new, maybe it's existing. You've been working on it with an AI assistant.

### 2. Install ralph-it

```bash
# In your project
ralph-it init
ralph-it setup
ralph-it doctor
```

### 3. Customize RALPH.md

Edit the generated RALPH.md to match your project:

```
---
agent.command = claude
agent.args = -p --dangerously-skip-permissions
agent.input = stdin
agent.timeout = 600
credit = true

command.tests = npm test -- --reporter=summary 2>&1 | tail -20
command.lint = npm run lint 2>&1 | tail -10
---

[Your customized prompt template]
```

Key decisions:
- Which agent to use
- What commands provide useful context
- What rules should govern agent behavior
- How strict the scope constraints should be

### 4. Create issues

Create well-structured issues. Use the standard format:

```markdown
## Context
[Background]

## Task
[What to do]

## Acceptance Criteria
- [ ] [Criteria]

## Scope
[Files to touch]

## Constraints
[What not to touch]
```

Label each with `ralph:queued` + `type:` + `priority:`.

**Batch creation from TODOs:**
```bash
# Find TODOs and create issues
grep -rn "TODO" src/ --include="*.ts" | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  num=$(echo "$line" | cut -d: -f2)
  todo=$(echo "$line" | cut -d: -f3- | sed 's/.*TODO[: ]*//')
  gh issue create \
    --title "TODO: $todo" \
    --label "ralph:queued,type:chore,priority:low" \
    --body "## Context
Found in \`$file:$num\`

## Task
$todo

## Scope
- \`$file\`

## Acceptance Criteria
- [ ] TODO comment removed
- [ ] Task completed
- [ ] Tests pass"
done
```

### 5. Review the queue

```bash
ralph-it list
ralph-it status
```

Verify issues are in the right order and have correct labels.

### 6. Start the loop

```bash
# Process everything and exit
ralph-it run

# Or watch mode for continuous processing
ralph-it run --watch

# Or start conservatively
ralph-it run --once    # Just one issue, verify it works
```

### 7. Monitor

**Terminal:** Watch the structured output in real-time.

**Logs:** `tail -f .ralph/logs/*.jsonl`

**GitHub:** Check issue comments for agent results.

**Lock file:** `cat .ralph/run.lock` to see current state.

### 8. Review results

After the loop completes (or between iterations):
- Check closed issues for agent comments
- Review git log for commits
- Run tests to verify everything works
- Check for any `ralph:failed` issues

### 9. Handle failures

Failed issues stay open with `ralph:failed` label.

**Options:**
- **Retry:** Remove `ralph:failed`, add `ralph:queued`
- **Refine:** Edit the issue with more detail, then retry
- **Block:** Add `ralph:blocked` for manual handling
- **Close:** If no longer needed

### 10. Iterate

As you continue developing:
- Create new issues when you identify work
- Let ralph-it process them
- Review results
- Refine RALPH.md based on agent behavior

## Example: Full Session

```bash
# Phase 1: You + Claude set up the project
# ... (interactive work) ...

# Phase 2: Set up ralph-it
ralph-it init
# Edit RALPH.md to match your project
ralph-it setup
ralph-it doctor

# Create issues
gh issue create --title "Add input validation to user registration" \
  --label "ralph:queued,type:feature,priority:high" \
  --body-file issues/validation.md

gh issue create --title "Fix memory leak in WebSocket handler" \
  --label "ralph:queued,type:bug,priority:critical" \
  --body-file issues/memory-leak.md

gh issue create --title "Add unit tests for payment module" \
  --label "ralph:queued,type:test,priority:medium" \
  --body-file issues/payment-tests.md

# Verify
ralph-it list
# #2  Fix memory leak in WebSocket handler   priority:critical  type:bug      ralph:queued
# #1  Add input validation to user reg...     priority:high      type:feature  ralph:queued
# #3  Add unit tests for payment module       priority:medium    type:test     ralph:queued

# Start processing (critical first)
ralph-it run

# Monitor in another terminal
tail -f .ralph/logs/*.jsonl | jq 'select(.event | startswith("iteration"))'

# After completion
ralph-it status
# Queued         0
# In Progress    0
# Done           3
# Failed         0
```

## Tips

1. **Start with --once.** Verify the agent handles one issue correctly before processing the whole queue.
2. **Keep issues small.** One focused task per issue. Big issues lead to big failures.
3. **Use --dry-run.** See what would be processed before committing.
4. **Check git log.** Verify the agent's commits make sense.
5. **Refine RALPH.md.** If the agent keeps making the same mistake, add a rule to the prompt.
6. **Use priority labels.** Critical bugs before nice-to-have features.
7. **Scope is your safety net.** Always tell the agent which files to touch and which to leave alone.
