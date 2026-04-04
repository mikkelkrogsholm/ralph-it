# GitHub Actions CI/CD

Run ralph-it on a schedule or on-demand via GitHub Actions.

## Basic Workflow

```yaml
name: ralph-it

on:
  # Run on a schedule
  schedule:
    - cron: '0 */2 * * *'  # Every 2 hours

  # Allow manual trigger
  workflow_dispatch:

jobs:
  ralph:
    runs-on: ubuntu-latest
    permissions:
      contents: write     # Push commits
      issues: write       # Comment and close issues

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for branch operations

      - uses: oven-sh/setup-bun@v2

      - run: bun install github:mikkelkrogsholm/ralph-it

      - run: ralph-it run
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Configuration Options

### Schedule patterns

```yaml
# Every hour
- cron: '0 * * * *'

# Every 2 hours during business hours (9-17 UTC)
- cron: '0 9-17/2 * * 1-5'

# Every 30 minutes
- cron: '*/30 * * * *'

# Once daily at midnight
- cron: '0 0 * * *'

# Weekdays only, every 4 hours
- cron: '0 */4 * * 1-5'
```

### With filters

```yaml
      - run: ralph-it run --label type:bug --once
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### With different agents

**Claude:**
```yaml
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**OpenAI Codex:**
```yaml
      - run: npm install -g @openai/codex
      - run: ralph-it run
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

**Google Gemini:**
```yaml
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

## Required Secrets

| Secret | Required for | How to set |
|--------|-------------|------------|
| `GITHUB_TOKEN` | gh CLI operations | Automatic in Actions |
| `ANTHROPIC_API_KEY` | Claude Code | Repo Settings → Secrets |
| `OPENAI_API_KEY` | Codex | Repo Settings → Secrets |
| `GOOGLE_API_KEY` | Gemini | Repo Settings → Secrets |

`GITHUB_TOKEN` is automatically available. For other secrets: Repo → Settings → Secrets and variables → Actions → New repository secret.

## Required Permissions

The workflow needs:
- `contents: write` — to push commits
- `issues: write` — to comment on and close issues

If your repo uses branch protection:
- Consider using a **personal access token** (PAT) instead of `GITHUB_TOKEN` for pushing
- Or configure branch protection to allow the Actions bot

## Advanced: Push changes back

The basic workflow commits locally but doesn't push. To push:

```yaml
      - run: ralph-it run

      - name: Push changes
        run: |
          git config user.name "ralph-it[bot]"
          git config user.email "ralph-it[bot]@users.noreply.github.com"
          git push
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Advanced: Upload logs as artifacts

```yaml
      - run: ralph-it run

      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ralph-it-logs
          path: .ralph/logs/
          retention-days: 30
```

## Advanced: Notify on failure

```yaml
      - run: ralph-it run
        id: ralph

      - name: Notify on failure
        if: failure()
        run: |
          gh issue create \
            --title "ralph-it CI run failed" \
            --label "ralph:blocked" \
            --body "The scheduled ralph-it run failed. Check [the workflow run](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}) for details."
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Troubleshooting

### "Not authenticated"

Ensure `GH_TOKEN` is set. In Actions, `${{ secrets.GITHUB_TOKEN }}` provides this automatically.

### "Permission denied" on push

Check workflow permissions. Add `permissions: contents: write` to the job.

### Agent timeout in CI

CI runners may be slower. Increase timeout:
```yaml
      - run: ralph-it run --timeout 1200
```

### Rate limits

GitHub Actions has API rate limits. If processing many issues:
- Use `ralph-it run --once` and let the schedule handle batching
- Or add `--interval 60` for longer pauses between iterations
