# Logging & Monitoring

ralph-it writes structured logs during every run for real-time monitoring and post-run analysis.

## Files

| File | Format | Purpose |
|------|--------|---------|
| `.ralph/run.lock` | JSON | Active run state, prevents concurrent runs |
| `.ralph/logs/{run-id}.jsonl` | JSONL | Append-only event log per run |
| `.ralph/prompt.md` | Markdown | Last rendered prompt (overwritten each iteration) |

All files are in `.gitignore` by default.

## Lock File (.ralph/run.lock)

Created when a run starts, deleted when it ends. Contains real-time state:

```json
{
  "runId": "a1b2c3d4ef",
  "pid": 12345,
  "startedAt": "2026-04-04T19:00:00.000Z",
  "mode": "Watch mode",
  "agent": "claude",
  "iteration": 3,
  "currentIssue": { "number": 42, "title": "Fix login bug" },
  "stats": { "succeeded": 2, "failed": 0 }
}
```

### Concurrent run prevention

If a lock file exists and the PID is still alive, `ralph-it run` will refuse to start:

```
Error: Another ralph-it run is active (pid 12345, run a1b2c3d4ef).
If this is stale, delete .ralph/run.lock
```

Stale locks (PID no longer running) are automatically cleaned up.

### Checking current state

```bash
# Quick check
cat .ralph/run.lock | jq .

# Watch state changes
watch -n 2 cat .ralph/run.lock
```

## Event Log (.ralph/logs/{run-id}.jsonl)

One JSON object per line, one event per line. Append-only — never modified after writing.

### Event Types

| Event | When | Key fields |
|-------|------|------------|
| `run:start` | Run begins | `runId`, `mode`, `agent`, `pid` |
| `iteration:start` | New iteration | `iteration`, `issue`, `title` |
| `command:done` | Command finishes | `name`, `ok`, `elapsed`, `output` |
| `prompt:rendered` | Template rendered | `chars` |
| `agent:start` | Agent spawned | `command` |
| `agent:done` | Agent exits | `exitCode`, `timedOut`, `elapsed` |
| `iteration:done` | Iteration ends | `issue`, `result`, `elapsed`, `reason` |
| `run:done` | Run ends | `runId`, `stats`, `iterations` |

### Example log

```jsonl
{"ts":"2026-04-04T19:00:00.123Z","event":"run:start","runId":"a1b2c3","mode":"Watch mode","agent":"claude","pid":12345}
{"ts":"2026-04-04T19:00:01.456Z","event":"iteration:start","iteration":1,"issue":42,"title":"Fix login validation"}
{"ts":"2026-04-04T19:00:03.789Z","event":"command:done","name":"coverage","ok":true,"elapsed":2100,"output":"87.3%"}
{"ts":"2026-04-04T19:00:03.890Z","event":"command:done","name":"lint","ok":true,"elapsed":1500,"output":"No issues found"}
{"ts":"2026-04-04T19:00:04.012Z","event":"prompt:rendered","chars":4231}
{"ts":"2026-04-04T19:00:04.015Z","event":"agent:start","command":"claude"}
{"ts":"2026-04-04T19:00:56.300Z","event":"agent:done","exitCode":0,"timedOut":false,"elapsed":52285}
{"ts":"2026-04-04T19:00:57.100Z","event":"iteration:done","issue":42,"result":"success","elapsed":55644}
{"ts":"2026-04-04T19:01:00.000Z","event":"run:done","runId":"a1b2c3","stats":{"succeeded":1,"failed":0},"iterations":1}
```

## Real-time Monitoring

### Follow events live

```bash
tail -f .ralph/logs/*.jsonl
```

### Follow with formatting

```bash
tail -f .ralph/logs/*.jsonl | jq '.'
```

### Watch only iteration results

```bash
tail -f .ralph/logs/*.jsonl | jq 'select(.event == "iteration:done")'
```

### Watch only failures

```bash
tail -f .ralph/logs/*.jsonl | jq 'select(.result == "failed")'
```

## Post-run Analysis

### Summary of a specific run

```bash
cat .ralph/logs/a1b2c3.jsonl | jq 'select(.event == "run:done")'
```

### All iteration results across runs

```bash
cat .ralph/logs/*.jsonl | jq 'select(.event == "iteration:done") | {issue, result, elapsed: (.elapsed/1000 | round)}'
```

### Average agent time

```bash
cat .ralph/logs/*.jsonl | jq -s '[.[] | select(.event == "agent:done") | .elapsed] | (add / length / 1000 | round)'
```

### Failed issues with reasons

```bash
cat .ralph/logs/*.jsonl | jq 'select(.event == "iteration:done" and .result == "failed") | {issue, reason}'
```

### Command success rates

```bash
cat .ralph/logs/*.jsonl | jq -s 'group_by(.name) | map(select(.[0].event == "command:done") | {name: .[0].name, total: length, ok: [.[] | select(.ok)] | length})'
```

## Terminal Output

During a run, ralph-it prints structured, color-coded output:

```
──────────────────────────────────────────────────────────────
▶ Watch mode  agent: claude · 2 command(s) · timeout: 600s
──────────────────────────────────────────────────────────────
  Run a1b2c3 — log: .ralph/logs/a1b2c3.jsonl

  → Picking next issue...

── Iteration 1 ──
#42  Fix login validation on mobile
  → Claiming #42
  → Branch: ralph/issue-42
  → Running 2 command(s)
  ✓ coverage  87.3% (src/auth: 72%, src/api: 95%)
  ✓ lint  No issues found
  → Prompt assembled (4,231 chars)
  ▶ claude

  [agent output streams here]

  ✓ #42 completed  (52.3s)
  ✓ Merged ralph/issue-42

  → Picking next issue...
  No queued issues found.
  Waiting 30s before next poll...

══════════════════════════════════════════════════════════════
Done: 1 iteration(s) — 1 succeeded, 0 failed  (53.1s)
══════════════════════════════════════════════════════════════
```

Color coding:
- **Cyan** (→) — phases/progress
- **Green** (✓) — success
- **Red** (✗) — failure
- **Yellow** (⏱/!) — timeout/warning
- **Orange** (▶) — agent running
- **Gray** — separators, dim text
