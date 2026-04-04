# Label System

ralph-it uses 19 labels organized in three groups. Created by `ralph-it setup`.

## State Labels (managed by ralph-it)

These labels are set automatically by ralph-it during processing. Do not manually change them while a run is active.

| Label | Color | Hex | Description | Set when |
|-------|-------|-----|-------------|----------|
| `ralph:queued` | Green | `#0E8A16` | Ready for agent pickup | You create/label the issue |
| `ralph:in-progress` | Yellow | `#FBCA04` | Agent is working | ralph-it claims the issue |
| `ralph:done` | Purple | `#6F42C1` | Completed by agent | Agent succeeds, issue closed |
| `ralph:failed` | Red | `#D73A4A` | Agent failed | Agent exits non-zero or times out |
| `ralph:blocked` | Light yellow | `#E4E669` | Needs human intervention | Set manually when agent can't proceed |

### State Machine

```
                    ┌──────────────┐
                    │ ralph:queued │ ← You create issues here
                    └──────┬───────┘
                           │ ralph-it picks up
                           ▼
                 ┌───────────────────┐
                 │ ralph:in-progress │
                 └────────┬──────────┘
                          │
                ┌─────────┴──────────┐
                │                    │
                ▼                    ▼
        ┌─────────────┐     ┌──────────────┐
        │ ralph:done  │     │ ralph:failed │
        │  (closed)   │     │   (open)     │
        └─────────────┘     └──────────────┘
                                   │
                                   │ Manual: fix and re-queue
                                   ▼
                            ┌──────────────┐
                            │ ralph:queued │
                            └──────────────┘
```

### Recovering failed issues

To retry a failed issue:
```bash
gh issue edit 42 --remove-label ralph:failed --add-label ralph:queued
```

To mark as needing human help:
```bash
gh issue edit 42 --remove-label ralph:failed --add-label ralph:blocked
```

## Priority Labels

Determine processing order. `priority:critical` is always processed first.

| Label | Color | Hex | Sort order | When to use |
|-------|-------|-----|------------|-------------|
| `priority:critical` | Dark red | `#B60205` | 0 (first) | Production down, security vuln, data loss |
| `priority:high` | Orange | `#D93F0B` | 1 | Important, should be done soon |
| `priority:medium` | Yellow | `#FBCA04` | 2 | Normal work, default choice |
| `priority:low` | Green | `#0E8A16` | 3 (last) | Nice to have, no urgency |

If no priority label is set, the issue sorts last (after `priority:low`).

## Type Labels

Categorize the work. Used for filtering (`ralph-it run --label type:bug`).

| Label | Color | Hex | When to use |
|-------|-------|-----|-------------|
| `type:bug` | Red | `#D73A4A` | Something is broken |
| `type:feature` | Blue | `#0075CA` | New functionality |
| `type:refactor` | Light blue | `#BFD4F2` | Code restructuring, no behavior change |
| `type:docs` | Blue | `#0075CA` | Documentation updates |
| `type:test` | Dark blue | `#1D76DB` | Test additions or improvements |
| `type:chore` | Light gray | `#EDEDED` | Build, CI, dependency updates |
| `type:security` | Dark red | `#B60205` | Security vulnerability fix |
| `type:perf` | Light purple | `#D4C5F9` | Performance improvement |
| `type:migration` | Light blue | `#C5DEF5` | Data or framework migration |
| `type:research` | Purple | `#D876E3` | Investigation, spike, exploration |

## Filtering with Labels

```bash
# Only bugs
ralph-it run --label type:bug

# Only critical bugs
ralph-it run --label type:bug,priority:critical

# Only a specific milestone
ralph-it run --milestone "v2.0"

# Combine filters
ralph-it run --label type:security --milestone "v2.0"
```

## Custom Labels

You can add your own labels alongside the ralph-it system. ralph-it only manages `ralph:` prefixed labels. Any other labels are passed through to the agent as context via `{{ issue.labels }}`.
