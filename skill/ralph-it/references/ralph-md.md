# RALPH.md Syntax & Best Practices

## File Structure

RALPH.md has two parts separated by `---` delimiters:

```
---
[frontmatter: key = value pairs]
---

[template: markdown prompt with {{ placeholders }}]
```

## Frontmatter

Simple key=value format. No YAML, no dependencies.

### Agent Configuration

```
agent.command = claude                           # Required: executable name
agent.args = -p --dangerously-skip-permissions   # Optional: CLI arguments
agent.input = stdin                              # Optional: stdin (default), file, argument
agent.timeout = 600                              # Optional: seconds (default 600)
```

### Input Modes

| Mode | Behavior | Use when |
|------|----------|----------|
| `stdin` | Prompt piped to agent's stdin | Claude, Codex, Gemini (most agents) |
| `file` | Prompt file path appended as last arg | Aider, agents that read files |
| `argument` | `{prompt_file}` in args replaced with path | Custom agents with specific flags |

### Commands

Commands run each iteration, their output available via `{{ commands.<name> }}`:

```
command.coverage = ./check-coverage.sh
command.coverage.timeout = 120
command.lint = npm run lint --silent
command.tests = bun test --reporter=summary 2>&1
```

- Default timeout: 60 seconds per command
- Commands starting with `./` run relative to project root
- Output is captured as a string and injected into the template
- Failed commands produce `[command failed (exit N): stderr]`
- Timed-out commands produce `[command timed out after Ns]`

### Credit

```
credit = true    # Default: append co-author instruction to prompt
credit = false   # Disable co-author instruction
```

When enabled, appends an instruction asking the agent to include `Co-Authored-By: ralph-it` in commit messages.

## Template

Everything after the second `---` is the template. It's markdown with `{{ }}` placeholders.

### Available Placeholders

| Placeholder | Type | Content |
|-------------|------|---------|
| `{{ repo.description }}` | string | Repository description from GitHub |
| `{{ repo.languages }}` | string | Comma-separated languages |
| `{{ repo.name }}` | string | Repository name |
| `{{ repo.owner }}` | string | Repository owner |
| `{{ issue.number }}` | number | Issue number |
| `{{ issue.title }}` | string | Issue title |
| `{{ issue.body }}` | string | Full issue body (markdown) |
| `{{ issue.comments }}` | formatted | Comment thread: `**@user**: body` |
| `{{ issue.labels }}` | formatted | Comma-separated label names |
| `{{ commands.<name> }}` | string | Output from named command |
| `{{ args.<name> }}` | string | Runtime argument from `--arg key=value` |
| `{{ ralph.iteration }}` | number | Current iteration number (1-based) |

Unknown placeholders render as empty string.

### HTML Comments

HTML comments are stripped before the prompt is sent:

```markdown
<!-- This note is for humans reading RALPH.md, the agent won't see it -->
<!-- TODO: add a command for database migrations -->

You are an autonomous coding agent.
```

Use comments for:
- Notes to yourself
- Temporarily disabling sections
- Documentation about the template itself

### Runtime Arguments

Pass arguments when running:

```bash
ralph-it run --arg target=90 --arg module=auth
```

Reference in template:

```markdown
Focus on the {{ args.module }} module.
Target coverage: {{ args.target }}%
```

## Best Practices

### 1. Be specific about agent behavior

Bad:
```markdown
Fix the issue.
```

Good:
```markdown
You are an autonomous coding agent working on a single GitHub issue.

Rules:
1. Read the issue carefully before making changes
2. Make the minimal change needed to solve the issue
3. Write or update tests for your changes
4. Run tests before committing
5. Make a single, focused commit with a descriptive message
6. Do not modify files outside the stated scope
```

### 2. Include project-specific context

```markdown
## Project
{{ repo.description }}
Languages: {{ repo.languages }}

## Architecture
This is a monorepo with:
- `packages/api/` — Express.js REST API
- `packages/web/` — Next.js frontend
- `packages/shared/` — shared types and utilities

## Conventions
- Use TypeScript strict mode
- Tests use vitest
- Commits follow conventional commits format
- Do not add new dependencies without justification
```

### 3. Use commands for dynamic context

```
command.coverage = npx vitest --coverage --reporter=json | jq '.total'
command.failing = npx vitest --reporter=json 2>&1 | jq '.testResults[] | select(.status=="failed") | .name'
command.todos = grep -rn "TODO\|FIXME" src/ --include="*.ts" | head -20
```

These give the agent fresh data each iteration.

### 4. Set appropriate timeouts

| Task type | Suggested timeout |
|-----------|-------------------|
| Bug fix | 300s (5 min) |
| Feature | 600s (10 min) |
| Refactor | 600s (10 min) |
| Test writing | 300s (5 min) |
| Documentation | 300s (5 min) |
| Research | 900s (15 min) |

### 5. Example RALPH.md files

#### General purpose (works for most projects)

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

You are an autonomous coding agent (iteration {{ ralph.iteration }}).

Rules:
1. Read the full issue before making changes
2. Make the minimal, focused change needed
3. Write or update tests for every change
4. Run tests and lint before committing
5. Commit with a clear message referencing the issue number
6. Do not modify files outside the stated scope
7. Do not add new dependencies unless explicitly asked

## Project
{{ repo.description }}
Languages: {{ repo.languages }}

## Current Task
Issue #{{ issue.number }}: {{ issue.title }}

{{ issue.body }}

## Discussion
{{ issue.comments }}

## Test Results
{{ commands.tests }}

## Lint Status
{{ commands.lint }}
```

#### Coverage-focused

```
---
agent.command = claude
agent.args = -p --dangerously-skip-permissions
agent.input = stdin
agent.timeout = 300
credit = true

command.coverage = npx vitest --coverage --reporter=json 2>/dev/null | jq -r '.total.lines.pct'
command.uncovered = npx vitest --coverage --reporter=json 2>/dev/null | jq -r '[.files[] | select(.lines.pct < 80) | {file: .filename, pct: .lines.pct}] | sort_by(.pct) | .[:10]'
---

You are a test-writing agent. Each iteration, pick ONE uncovered file 
and write comprehensive tests for it.

Target: {{ args.target }}% line coverage (currently {{ commands.coverage }}%)

## Least covered files
{{ commands.uncovered }}

## Task
{{ issue.body }}

## Rules
1. Pick the file with lowest coverage from the list above
2. Write thorough tests covering all branches
3. Run tests to verify they pass
4. Commit with message "test: add tests for <filename>"
5. Do not modify source code, only add tests
```

#### Security audit

```
---
agent.command = claude
agent.args = -p --dangerously-skip-permissions
agent.input = stdin
agent.timeout = 900
credit = true

command.deps = npm audit --json 2>&1 | jq '.vulnerabilities | to_entries | map({name: .key, severity: .value.severity}) | sort_by(.severity)'
---

You are a security auditor. Find and fix ONE vulnerability per iteration.

## Known vulnerabilities
{{ commands.deps }}

## Task
{{ issue.body }}

## Rules
1. Focus on one vulnerability at a time
2. Fix the root cause, not just the symptom
3. Write a regression test proving the fix
4. Document what was vulnerable and how it was fixed in the commit message
5. Do not introduce new dependencies to fix security issues
```
