# Agent Configuration

ralph-it works with any CLI agent that accepts a prompt. Configure in RALPH.md frontmatter.

## Input Modes

| Mode | How prompt is delivered | Use when |
|------|----------------------|----------|
| `stdin` | Prompt file piped to agent's stdin | Most agents (default) |
| `file` | Prompt file path appended as last CLI argument | Agents that read files (e.g., Aider) |
| `argument` | `{prompt_file}` in args replaced with file path | Custom agents with specific flags |

The prompt is always written to `.ralph/prompt.md` first — never passed through the shell as text. This avoids ARG_MAX limits and shell injection.

## Agent Configurations

### Claude Code

```
agent.command = claude
agent.args = -p --dangerously-skip-permissions
agent.input = stdin
agent.timeout = 600
```

Claude Code reads stdin when `-p` (print mode) is used. `--dangerously-skip-permissions` enables autonomous mode without confirmation prompts.

### OpenAI Codex

```
agent.command = codex
agent.args = exec --full-auto -
agent.input = stdin
```

The `-` argument tells Codex to read from stdin. `--full-auto` enables autonomous mode. `exec` runs in non-interactive mode.

### Google Gemini CLI

```
agent.command = gemini
agent.args = --prompt - --yolo
agent.input = stdin
```

`--prompt -` reads from stdin. `--yolo` auto-accepts all actions.

### Aider

```
agent.command = aider
agent.args = --message-file {prompt_file} --yes
agent.input = file
```

Aider reads prompts from files. `{prompt_file}` is replaced with the absolute path to `.ralph/prompt.md`. `--yes` auto-confirms changes.

### Custom Agent

Any CLI that accepts a prompt:

```
# Via stdin
agent.command = my-agent
agent.args = --autonomous
agent.input = stdin

# Via file argument
agent.command = my-agent
agent.args = --input {prompt_file} --no-confirm
agent.input = argument
```

For `argument` mode, `{prompt_file}` MUST appear in `agent.args` — ralph-it will error if it's missing.

## Timeout Configuration

```
agent.timeout = 600    # 10 minutes (default)
agent.timeout = 300    # 5 minutes (quick tasks)
agent.timeout = 1200   # 20 minutes (complex tasks)
```

When timeout is reached:
1. SIGTERM sent to agent process
2. 5 second grace period
3. SIGKILL if still alive
4. Issue marked as `ralph:failed` with timeout comment

Override at runtime: `ralph-it run --timeout 900`

## Verifying Agent Setup

```bash
# Check if agent is available
ralph-it doctor

# Test manually with a simple prompt
echo "Say hello" | claude -p
echo "Say hello" | codex exec -
echo "Say hello" | gemini --prompt -
```

## Agent Output

Agent stdout and stderr are:
1. Streamed to your terminal in real-time (you see what the agent sees)
2. Captured for the issue comment (truncated to 60KB)
3. Logged to `.ralph/logs/{run-id}.jsonl`
