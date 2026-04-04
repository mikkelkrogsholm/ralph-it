# ralph-it

Autonomous agent loop runner powered by GitHub Issues. Point it at a repo, label issues as `ralph:queued`, and let your AI coding agent work through them one by one — picking issues, running the agent, committing, commenting, and closing.

## How it works

```
You create issues → ralph-it picks them up → agent works →
commits → comments on issue → closes issue → next issue
```

Each iteration:
1. Fetch the next `ralph:queued` issue (sorted by priority)
2. Create a branch `ralph/issue-{N}`
3. Assemble a prompt from `RALPH.md` template + issue context
4. Write prompt to `.ralph/prompt.md` and pipe to agent
5. On success: comment, label `ralph:done`, close issue, merge branch
6. On failure: comment error, label `ralph:failed`, delete branch
7. Move to next issue

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [GitHub CLI](https://cli.github.com) (`gh`) authenticated
- A git repo with GitHub Issues enabled
- An AI coding agent CLI (Claude Code, Codex, Gemini, Aider, etc.)

## Installation

```bash
# Clone and use directly
git clone git@github.com:mikkelkrogsholm/ralph-it.git
cd ralph-it

# Or install from GitHub
bun install github:mikkelkrogsholm/ralph-it
```

## Quick start

```bash
# 1. Initialize in your project
ralph-it init

# 2. Create labels on your repo
ralph-it setup

# 3. Verify everything works
ralph-it doctor

# 4. Create an issue on GitHub with the label "ralph:queued"
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
ralph-it run --arg target=90 --arg lang=da  # Multiple args
ralph-it run --include-diff         # Add git diff to issue comment
ralph-it run --dry-run              # Show what would be done
```

### `ralph-it list`

Show queued issues.

```bash
ralph-it list        # Show ralph:queued issues
ralph-it list --all  # Show all ralph-managed issues
```

### `ralph-it status`

Show project overview with issue counts per state.

```bash
ralph-it status
```

## RALPH.md reference

RALPH.md uses a simple key=value frontmatter format between `---` delimiters, followed by the prompt template.

### Frontmatter fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `agent.command` | Yes | — | Agent executable (claude, codex, gemini, aider) |
| `agent.args` | No | — | CLI arguments (space-separated) |
| `agent.input` | No | `stdin` | How to deliver the prompt: `stdin`, `file`, or `argument` |
| `agent.timeout` | No | `600` | Agent timeout in seconds |
| `command.<name>` | No | — | Shell command whose output is available via `{{ commands.<name> }}` |
| `command.<name>.timeout` | No | `60` | Timeout for a specific command in seconds |
| `credit` | No | `true` | Append co-author instruction to prompt |

### Template placeholders

| Placeholder | Content |
|-------------|---------|
| `{{ repo.description }}` | Repository description |
| `{{ repo.languages }}` | Languages in the repo |
| `{{ issue.number }}` | Issue number |
| `{{ issue.title }}` | Issue title |
| `{{ issue.body }}` | Issue body |
| `{{ issue.comments }}` | Formatted comment thread |
| `{{ issue.labels }}` | Comma-separated label names |
| `{{ commands.<name> }}` | Output from named command |
| `{{ args.<name> }}` | Runtime argument passed via `--arg key=value` |
| `{{ ralph.iteration }}` | Current iteration number |

### Example RALPH.md

```
---
agent.command = claude
agent.args = -p --dangerously-skip-permissions
agent.input = stdin
agent.timeout = 600
credit = true

command.coverage = ./check-coverage.sh
command.coverage.timeout = 120
---

<!-- Notes for yourself — stripped from the prompt before sending to agent -->

You are an autonomous coding agent (iteration {{ ralph.iteration }}).
Each iteration: solve the task, test your changes, and commit.

## Project
{{ repo.description }}
Languages: {{ repo.languages }}

## Task
Issue #{{ issue.number }}: {{ issue.title }}

{{ issue.body }}

## Discussion
{{ issue.comments }}

## Coverage
{{ commands.coverage }}
```

### HTML comments

HTML comments (`<!-- ... -->`) in RALPH.md are stripped before the prompt is sent to the agent. Use them for notes, TODOs, or documentation that the agent should not see.

### Runtime arguments

Pass arguments at runtime with `--arg key=value`:

```bash
ralph-it run --arg target=90 --arg lang=da
```

Reference them in the template:

```
Target coverage: {{ args.target }}
Language: {{ args.lang }}
```

### Co-author credit

When `credit = true` (default), ralph-it appends an instruction to the prompt asking the agent to include a `Co-Authored-By: ralph-it` trailer in commit messages. Disable with `credit = false`.

## Agent configuration

### Claude Code

```
agent.command = claude
agent.args = -p --dangerously-skip-permissions
agent.input = stdin
```

### OpenAI Codex

```
agent.command = codex
agent.args = exec --full-auto -
agent.input = stdin
```

### Google Gemini CLI

```
agent.command = gemini
agent.args = --prompt - --yolo
agent.input = stdin
```

### Aider

```
agent.command = aider
agent.args = --message-file {prompt_file} --yes
agent.input = file
```

### Custom agent

Any CLI that accepts a prompt via stdin or file:

```
agent.command = my-agent
agent.args = --input {prompt_file}
agent.input = argument
```

## Label system

ralph-it uses 19 labels organized in three groups.

### State labels (managed by ralph-it)

| Label | Color | Description |
|-------|-------|-------------|
| `ralph:queued` | Green | Ready for agent pickup |
| `ralph:in-progress` | Yellow | Agent is working |
| `ralph:done` | Purple | Completed by agent |
| `ralph:failed` | Red | Agent failed |
| `ralph:blocked` | Light yellow | Needs human intervention |

### State machine

```
ralph:queued → ralph:in-progress → ralph:done (closed)
                                 → ralph:failed
```

### Priority labels

| Label | Description |
|-------|-------------|
| `priority:critical` | Must be done immediately |
| `priority:high` | Important, do soon |
| `priority:medium` | Normal priority |
| `priority:low` | Nice to have |

Issues are processed in priority order (critical first).

### Type labels

`type:bug`, `type:feature`, `type:refactor`, `type:docs`, `type:test`, `type:chore`, `type:security`, `type:perf`, `type:migration`, `type:research`

## GitHub Actions

Run ralph-it on a schedule in CI:

```yaml
name: ralph-it
on:
  schedule:
    - cron: '0 */2 * * *'  # Every 2 hours
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

### "gh not found"

Install the GitHub CLI: https://cli.github.com

### "Not authenticated"

Run `gh auth login` and follow the prompts.

### "No RALPH.md found"

Run `ralph-it init` in your project directory.

### Agent times out

Increase the timeout in RALPH.md (`agent.timeout = 1200`) or via `--timeout` flag.

### Issue stuck in "ralph:in-progress"

The agent may have crashed. Run `ralph-it doctor` to detect stuck issues, then manually remove the `ralph:in-progress` label and add `ralph:queued` to retry.

### Merge conflict after agent completes

The branch `ralph/issue-{N}` is preserved for manual review. Resolve the conflict and merge manually.

## License

MIT
