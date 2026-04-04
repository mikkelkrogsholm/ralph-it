# Command Reference

## ralph-it init

Create a RALPH.md template and `.ralph/` directory.

```bash
ralph-it init              # Create template
ralph-it init --force      # Overwrite existing RALPH.md
```

**What it creates:**
- `RALPH.md` — prompt template with Claude Code defaults
- `.ralph/` — working directory
- Adds `.ralph/prompt.md` to `.gitignore` (if .gitignore exists)

## ralph-it setup

Create the 19-label system on your GitHub repo.

```bash
ralph-it setup
```

Creates state labels (5), priority labels (4), and type labels (10). Uses `gh label create --force` so it's idempotent — safe to run multiple times.

## ralph-it doctor

Check all prerequisites and configuration.

```bash
ralph-it doctor
```

Runs 9 checks:
| Check | What it verifies |
|-------|-----------------|
| Bun installed | `bun --version` succeeds |
| gh CLI installed | `gh --version` succeeds |
| gh authenticated | `gh auth status` returns logged-in user |
| Git repo detected | `.git` directory exists |
| Remote configured | `git remote -v` has entries |
| RALPH.md found | File exists in current directory |
| Agent CLI available | Agent command from RALPH.md is in PATH |
| Labels configured | All `ralph:` state labels exist on repo |
| Stuck issues | No issues stuck in `ralph:in-progress` |

Exit code 0 if all critical checks pass, 1 otherwise.

## ralph-it run

Process queued issues with the configured agent.

```bash
ralph-it run                                    # Process all queued, then exit
ralph-it run --once                             # Process one issue, then exit
ralph-it run --watch                            # Loop continuously
ralph-it run --watch --interval 60              # Custom poll interval (seconds)
ralph-it run --issue 42                         # Process specific issue
ralph-it run --label type:bug                   # Only issues with label
ralph-it run --label type:bug,priority:high     # Multiple labels (comma-separated)
ralph-it run --milestone "v2.0"                 # Only issues in milestone
ralph-it run --timeout 900                      # Override agent timeout (seconds)
ralph-it run --arg target=90 --arg lang=da      # Pass template arguments
ralph-it run --include-diff                     # Include git diff in issue comment
ralph-it run --dry-run                          # Show what would happen
```

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--once` | boolean | false | Process one issue, then exit |
| `--watch` | boolean | false | Loop: process, sleep, repeat |
| `--interval` | number | 30 | Seconds between polls (watch mode) |
| `--issue` | number | — | Process specific issue |
| `--label` | string | — | Filter by label (comma-separated) |
| `--milestone` | string | — | Filter by milestone |
| `--timeout` | number | from RALPH.md | Agent timeout in seconds |
| `--arg` | string[] | — | Template arguments (repeatable) |
| `--include-diff` | boolean | false | Add git changes to issue comment |
| `--dry-run` | boolean | false | Preview without executing |

### Run modes

| Mode | Command | Behavior |
|------|---------|----------|
| **Queue drain** | `ralph-it run` | Process all `ralph:queued` issues, exit when empty |
| **Single** | `ralph-it run --once` | Process one issue, exit |
| **Specific** | `ralph-it run --issue 42` | Process issue #42, exit |
| **Watch** | `ralph-it run --watch` | Loop forever, poll for new issues |

### What happens per iteration

1. Pick next `ralph:queued` issue (sorted by priority)
2. Move label: `ralph:queued` → `ralph:in-progress`
3. Create branch `ralph/issue-{N}` from default branch
4. Execute RALPH.md commands, capture output
5. Render template with issue + repo + command context
6. Write prompt to `.ralph/prompt.md`
7. Spawn agent with timeout
8. On success: comment, `ralph:done`, close issue, merge branch
9. On failure: comment error, `ralph:failed`, delete branch
10. Write events to `.ralph/logs/{run-id}.jsonl`

## ralph-it list

Show issues in the queue.

```bash
ralph-it list              # Show ralph:queued issues
ralph-it list --all        # Show all ralph-managed issues (all states)
```

Output format:
```
3 issue(s):

  #42     Fix login validation on mobile              priority:high     type:bug          ralph:queued
  #38     Add rate limiting to API                     priority:medium   type:feature      ralph:queued
  #51     Update API documentation                     priority:low      type:docs         ralph:queued
```

Issues are sorted by priority (critical first).

## ralph-it status

Show project overview with issue counts.

```bash
ralph-it status
```

Output:
```
Repository: owner/project-name
Description: A web application for managing tasks
Languages: TypeScript, CSS

Issue Queue:
  Queued         3
  In Progress    1
  Done          12
  Failed         2
  Blocked        0

Total managed: 18
```
