# Installation & Setup

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [GitHub CLI](https://cli.github.com) (`gh`) — authenticated
- A git repo with a GitHub remote and Issues enabled
- An AI coding agent CLI (Claude Code, Codex, Gemini CLI, Aider)

## Install ralph-it

```bash
# From GitHub
git clone git@github.com:mikkelkrogsholm/ralph-it.git
cd ralph-it

# Or add to an existing project
bun install github:mikkelkrogsholm/ralph-it
```

## Set up a project

Run these commands in your project directory:

### Step 1: Initialize

```bash
ralph-it init
```

Creates:
- `RALPH.md` — prompt template with Claude Code defaults
- `.ralph/` — working directory for prompts and logs

### Step 2: Create labels

```bash
ralph-it setup
```

Creates 19 labels on your GitHub repo (state, priority, type). Idempotent — safe to run multiple times.

### Step 3: Verify

```bash
ralph-it doctor
```

Runs 9 checks:
1. Bun installed
2. gh CLI installed
3. gh authenticated
4. Git repo detected
5. Remote configured
6. RALPH.md found
7. Agent CLI available
8. Labels configured
9. No stuck issues

### Step 4: Customize RALPH.md

Edit `RALPH.md` to match your project. See [ralph-md.md](ralph-md.md) for syntax.

Key things to customize:
- **Agent**: Which LLM CLI to use and how
- **Commands**: What context to gather each iteration (tests, coverage, lint)
- **Prompt**: Instructions that guide the agent's behavior

### Step 5: Create issues

Create GitHub issues using the standard format (see [issues.md](issues.md)). Label them with `ralph:queued` + a type + a priority.

### Step 6: Run

```bash
ralph-it run              # Process all queued issues
ralph-it run --watch      # Continuous mode
```

## Installing the skill

To make any Claude Code session aware of ralph-it, copy the skill:

```bash
# Personal (available in all projects)
cp -r skill/ralph-it ~/.claude/skills/ralph-it

# Or project-specific
cp -r skill/ralph-it .claude/skills/ralph-it
```

Then Claude will automatically know how to help with ralph-it setup, issue creation, and loop management.

## Uninstalling

Remove from your project:
- Delete `RALPH.md`
- Delete `.ralph/` directory
- Optionally remove labels: `gh label delete ralph:queued` etc.
