# ralph-it

Autonomous agent loop runner powered by GitHub Issues. Point it at a repo, label issues as `ralph:queued`, and let your AI coding agent work through them one by one — picking issues, running the agent, committing, commenting, and closing.

## How it works

```
You + agent set up the project → create issues → ralph-it runs autonomously
     Phase 1: collaborative          Phase 2: execution
```

**Phase 1:** You work with an AI assistant (Claude Code, etc.) to set up your project, make design decisions, and configure ralph-it. This is collaborative, high-context work.

**Phase 2:** ralph-it takes over. It picks issues from the queue, runs the agent, commits, comments, and closes — no human in the loop.

Each iteration:
1. Fetch the next `ralph:queued` issue (sorted by priority)
2. Create a branch `ralph/issue-{N}`
3. Assemble a prompt from `RALPH.md` template + issue context
4. Write prompt to `.ralph/prompt.md` and pipe to agent
5. On success: comment, label `ralph:done`, close issue, merge branch
6. On failure: comment error, label `ralph:failed`, delete branch
7. Move to next issue

## Install the skill (recommended)

The fastest way to get started is to install the ralph-it skill for your AI agent. Once installed, your agent knows everything about ralph-it and can help you set it up, create issues in the right format, write RALPH.md, and run loops.

```bash
npx skills add https://github.com/mikkelkrogsholm/ralph-it --skill ralph-it
```

Then just tell your agent: *"Set up ralph-it on this project"* — it handles the rest.

## Manual setup

If you prefer to set things up yourself:

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [GitHub CLI](https://cli.github.com) (`gh`) authenticated
- A git repo with GitHub Issues enabled
- An AI coding agent CLI (Claude Code, Codex, Gemini, Aider, etc.)

### Installation

```bash
# Clone and use directly
git clone git@github.com:mikkelkrogsholm/ralph-it.git
cd ralph-it

# Or install from GitHub
bun install github:mikkelkrogsholm/ralph-it
```

### Quick start

```bash
# 1. Initialize in your project
ralph-it init

# 2. Create labels on your repo
ralph-it setup

# 3. Verify everything works
ralph-it doctor

# 4. Create issues with the ralph:queued label
# 5. Run the agent loop
ralph-it run
```

## Commands

### `ralph-it init`

Creates a `RALPH.md` template and `.ralph/` directory in your project.

```bash
ralph-it init          # Create template
ralph-it init --force  # Overwrite existing
```

### `ralph-it setup`

Creates 19 labels (state, priority, type) on your GitHub repo. Safe to run multiple times.

```bash
ralph-it setup
```

### `ralph-it doctor`

Checks all prerequisites: bun, gh, authentication, repo, RALPH.md, agent CLI, labels, stuck issues.

```bash
ralph-it doctor
```

### `ralph-it run`

Process queued issues with the configured agent.

```bash
ralph-it run                        # Process all queued issues, then exit
ralph-it run --once                 # Process one issue, then exit
ralph-it run --watch                # Loop: process, sleep, repeat
ralph-it run --watch --interval 60  # Custom polling interval (seconds)
ralph-it run --issue 42             # Run specific issue
ralph-it run --label type:bug       # Only issues with this label
ralph-it run --milestone "v2.0"     # Only issues in milestone
ralph-it run --timeout 900          # Override agent timeout (seconds)
ralph-it run --arg target=90        # Pass argument to template
ralph-it run --include-diff         # Add git diff to issue comment
ralph-it run --dry-run              # Show what would be done
```

### `ralph-it list`

```bash
ralph-it list        # Show ralph:queued issues
ralph-it list --all  # Show all ralph-managed issues
```

### `ralph-it status`

```bash
ralph-it status      # Show repo info + issue counts per state
```

## Issue format

Structured issues give the agent clear context. Use this format:

```markdown
## Context
Brief background — what exists now, what's the problem or need.

## Task
Precise description of what the agent should do.

## Acceptance Criteria
- [ ] Tests pass
- [ ] No new lint errors
- [ ] [Task-specific criteria]

## Scope
Files and modules the agent should focus on.

## Constraints
What the agent should NOT do.
```

**Required labels:** `ralph:queued` + one `type:` label + one `priority:` label.

See `skill/ralph-it/references/issues.md` for detailed examples per issue type.

## RALPH.md

RALPH.md uses a simple key=value frontmatter format, followed by the prompt template.

### Example

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

<!-- Notes stripped before sending to agent -->

You are an autonomous coding agent (iteration {{ ralph.iteration }}).

## Project
{{ repo.description }}

## Task
Issue #{{ issue.number }}: {{ issue.title }}

{{ issue.body }}

## Discussion
{{ issue.comments }}

## Test Results
{{ commands.tests }}
```

### Frontmatter fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `agent.command` | Yes | — | Agent executable |
| `agent.args` | No | — | CLI arguments |
| `agent.input` | No | `stdin` | `stdin`, `file`, or `argument` |
| `agent.timeout` | No | `600` | Agent timeout (seconds) |
| `command.<name>` | No | — | Shell command for `{{ commands.<name> }}` |
| `command.<name>.timeout` | No | `60` | Per-command timeout (seconds) |
| `credit` | No | `true` | Append co-author instruction |

### Template placeholders

| Placeholder | Content |
|-------------|---------|
| `{{ repo.description }}` | Repository description |
| `{{ repo.languages }}` | Languages in the repo |
| `{{ issue.number }}` | Issue number |
| `{{ issue.title }}` | Issue title |
| `{{ issue.body }}` | Issue body |
| `{{ issue.comments }}` | Formatted comment thread |
| `{{ issue.labels }}` | Comma-separated labels |
| `{{ commands.<name> }}` | Output from named command |
| `{{ args.<name> }}` | Runtime argument (`--arg key=value`) |
| `{{ ralph.iteration }}` | Current iteration number |

HTML comments (`<!-- -->`) are stripped from the prompt before sending.

## Agent configuration

| Agent | command | args | input |
|-------|---------|------|-------|
| **Claude Code** | `claude` | `-p --dangerously-skip-permissions` | `stdin` |
| **Codex** | `codex` | `exec --full-auto -` | `stdin` |
| **Gemini CLI** | `gemini` | `--prompt - --yolo` | `stdin` |
| **Aider** | `aider` | `--message-file {prompt_file} --yes` | `file` |

## Label system

19 labels in three groups, created by `ralph-it setup`.

**State** (managed automatically):
`ralph:queued` → `ralph:in-progress` → `ralph:done` (closed) / `ralph:failed` / `ralph:blocked`

**Priority** (determines processing order):
`priority:critical` > `priority:high` > `priority:medium` > `priority:low`

**Type:**
`type:bug`, `type:feature`, `type:refactor`, `type:docs`, `type:test`, `type:chore`, `type:security`, `type:perf`, `type:migration`, `type:research`

## Logging & monitoring

Each run writes:
- **`.ralph/run.lock`** — real-time state (prevents concurrent runs)
- **`.ralph/logs/{run-id}.jsonl`** — append-only event log

Follow along live:

```bash
tail -f .ralph/logs/*.jsonl
```

Query with jq:

```bash
# Iteration results
cat .ralph/logs/*.jsonl | jq 'select(.event == "iteration:done")'

# Failures only
cat .ralph/logs/*.jsonl | jq 'select(.result == "failed")'
```

## GitHub Actions

```yaml
name: ralph-it
on:
  schedule:
    - cron: '0 */2 * * *'
  workflow_dispatch:

jobs:
  ralph:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install github:mikkelkrogsholm/ralph-it
      - run: ralph-it run
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "gh not found" | Install: https://cli.github.com |
| "Not authenticated" | Run `gh auth login` |
| "No RALPH.md found" | Run `ralph-it init` |
| Agent times out | `agent.timeout = 1200` or `--timeout 1200` |
| Issue stuck in-progress | `ralph-it doctor` detects it. Manual fix: swap labels |
| Merge conflict | Branch `ralph/issue-{N}` preserved for manual review |
| Concurrent run blocked | Delete `.ralph/run.lock` if stale |

## License

MIT
