import { parseArgs } from "node:util"
import { resolve } from "path"
import { parseRalphFile, executeCommands, renderTemplate, appendCredit } from "../lib/template"
import { getRepoContext, listIssues, getIssue, updateIssueLabels, commentOnIssue, closeIssue } from "../lib/github"
import { spawnAgent, buildComment } from "../lib/agent"
import { PRIORITY_ORDER } from "../lib/labels"
import { initSignalHandlers, isShuttingDown } from "../lib/signals"
import { log } from "../lib/log"
import { RunSession } from "../lib/lockfile"
import type { Issue } from "../lib/github"

const HELP = `ralph-it run — Process queued issues with the configured agent

Usage: ralph-it run [options]

Options:
  --once            Process one issue, then exit
  --watch           Loop: process issues, sleep, repeat (Ctrl+C to stop)
  --interval <sec>  Seconds between polls in watch mode (default: 30)
  --issue <N>       Run a specific issue only
  --label <names>   Filter issues by label (comma-separated)
  --milestone <M>   Filter issues by milestone
  --timeout <sec>   Override agent timeout from RALPH.md
  --arg <key=val>   Pass argument to template (repeatable, e.g. --arg target=90)
  --include-diff    Include git diff summary in issue comment
  --dry-run         Show what would be done without executing
  --help            Show this help`

const MAX_PROMPT_SIZE = 100_000

async function getDefaultBranch(cwd: string): Promise<string> {
  const proc = Bun.spawn(
    ["git", "symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
    { stdout: "pipe", stderr: "pipe", cwd },
  )
  const output = (await new Response(proc.stdout).text()).trim()
  await proc.exited
  if (!output) return "main"
  return output.replace("origin/", "")
}

export async function run(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      once: { type: "boolean", default: false },
      watch: { type: "boolean", default: false },
      interval: { type: "string", default: "30" },
      issue: { type: "string" },
      label: { type: "string" },
      milestone: { type: "string" },
      timeout: { type: "string" },
      arg: { type: "string", multiple: true },
      "include-diff": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  })

  if (values.help) {
    console.log(HELP)
    return
  }

  const cwd = process.cwd()
  const ralphConfig = await parseRalphFile(cwd)

  if (values.timeout) {
    ralphConfig.agent.timeout = parseInt(values.timeout, 10)
  }

  const intervalMs = parseInt(values.interval ?? "30", 10) * 1000
  const intervalSec = intervalMs / 1000
  const issueNumber = values.issue ? parseInt(values.issue, 10) : undefined
  const filterLabels = values.label ? values.label.split(",").map((l) => l.trim()) : []
  const includeDiff = values["include-diff"] ?? false
  const dryRun = values["dry-run"] ?? false

  // Parse --arg key=value pairs
  const userArgs: Record<string, string> = {}
  if (values.arg) {
    for (const pair of values.arg) {
      const eqIdx = pair.indexOf("=")
      if (eqIdx === -1) {
        throw new Error(`Invalid --arg format: "${pair}". Use --arg key=value`)
      }
      userArgs[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim()
    }
  }

  initSignalHandlers()

  // Check for existing lock
  const existingLock = await RunSession.isLocked(cwd)
  if (existingLock) {
    throw new Error(
      `Another ralph-it run is active (pid ${existingLock.pid}, run ${existingLock.runId}, ` +
      `started ${existingLock.startedAt}). ` +
      `If this is stale, delete .ralph/run.lock`
    )
  }

  // Fetch once, reuse across iterations
  const repo = await getRepoContext()
  const baseBranch = await getDefaultBranch(cwd)

  // Determine mode label
  const mode = issueNumber
    ? `Issue #${issueNumber}`
    : values.once
      ? "Single issue"
      : values.watch
        ? "Watch mode"
        : "Processing queue"

  // Create session with lock + log
  const session = new RunSession(cwd, mode, ralphConfig.agent.command)
  if (!dryRun) {
    await session.start()
  }

  log.runStart(mode, {
    agent: ralphConfig.agent.command,
    commands: ralphConfig.commands.length,
    timeout: ralphConfig.agent.timeout,
  })

  if (!dryRun) {
    log.info(`Run ${session.runId} — log: .ralph/logs/${session.runId}.jsonl`)
  }

  const runStartTime = Date.now()
  let succeeded = 0
  let failed = 0
  let iterations = 0

  const runOnce = async (): Promise<boolean> => {
    if (isShuttingDown()) return false

    // 1. Pick issue
    log.picking()
    let issue: Issue | null = null

    if (issueNumber) {
      issue = await getIssue(issueNumber)
    } else {
      const labels = ["ralph:queued", ...filterLabels]
      const issues = await listIssues({
        labels,
        milestone: values.milestone,
        limit: 50,
      })

      issues.sort((a, b) => {
        const pa = a.labels.find((l) => l.name.startsWith("priority:"))
        const pb = b.labels.find((l) => l.name.startsWith("priority:"))
        return (PRIORITY_ORDER[pa?.name ?? ""] ?? 99) - (PRIORITY_ORDER[pb?.name ?? ""] ?? 99)
      })

      issue = issues[0] ?? null
    }

    if (!issue) {
      log.noIssues()
      return false
    }

    iterations++
    const iterStart = Date.now()

    if (dryRun) {
      log.dryRun(issue.number, issue.title)
      return true
    }

    log.iterationStart(iterations, issue.number, issue.title)
    await session.iterationStart(iterations, { number: issue.number, title: issue.title })

    // 2. Claim issue
    log.claiming(issue.number)
    try {
      await updateIssueLabels(issue.number, ["ralph:in-progress"], ["ralph:queued"])
    } catch (err) {
      log.skipping(issue.number, err instanceof Error ? err.message : String(err))
      return true
    }

    // 3. Branch isolation
    const branchName = `ralph/issue-${issue.number}`
    let branchCreated = false
    try {
      const statusProc = Bun.spawn(["git", "status", "--porcelain"], { stdout: "pipe", stderr: "pipe", cwd })
      const statusOutput = (await new Response(statusProc.stdout).text()).trim()
      if (statusOutput) {
        await Bun.spawn(["git", "stash", "push", "-m", "ralph-it auto stash"], { cwd }).exited
      }

      const branchProc = Bun.spawn(["git", "checkout", "-b", branchName, baseBranch], {
        stdout: "pipe",
        stderr: "pipe",
        cwd,
      })
      const branchExit = await branchProc.exited
      branchCreated = branchExit === 0
      if (branchCreated) {
        log.branching(branchName)
      } else {
        log.warn(`Could not create branch ${branchName}, using current branch`)
      }
    } catch {
      log.warn("Branch isolation failed, using current branch")
    }

    try {
      // 4. Execute commands
      if (ralphConfig.commands.length > 0) {
        log.runningCommands(ralphConfig.commands.length)
        const cmdStart = Date.now()
        const commandOutputs = await executeCommands(ralphConfig.commands)
        for (const [name, output] of Object.entries(commandOutputs)) {
          const ok = !output.startsWith("[command ")
          const preview = ok ? output.slice(0, 60).replace(/\n/g, " ") : output
          log.commandResult(name, ok, preview)
          session.logCommand(name, ok, Date.now() - cmdStart, output)
        }
        var commandResults = commandOutputs
      } else {
        var commandResults: Record<string, string> = {}
      }

      // 5. Render template
      const repoContext = {
        description: repo.description ?? "",
        languages: repo.languages?.map((l: { name: string }) => l.name).join(", ") ?? "",
        name: repo.name,
        owner: repo.owner.login,
      }

      let rendered = renderTemplate(ralphConfig.template, {
        repo: repoContext,
        issue: {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          comments: issue.comments,
          labels: issue.labels,
        },
        commands: commandResults,
        args: userArgs,
        ralph: {
          iteration: iterations,
        },
      })

      if (ralphConfig.credit) {
        rendered = appendCredit(rendered)
      }

      if (rendered.length > MAX_PROMPT_SIZE) {
        log.warn(`Prompt is ${rendered.length.toLocaleString()} chars, truncating to ${MAX_PROMPT_SIZE.toLocaleString()}`)
        rendered = rendered.slice(0, MAX_PROMPT_SIZE) + "\n\n[Prompt truncated due to size]"
      }

      log.renderingPrompt(rendered.length)
      session.logPromptRendered(rendered.length)

      // 6. Write prompt to file
      const promptDir = resolve(cwd, ".ralph")
      try {
        const { mkdirSync } = await import("fs")
        mkdirSync(promptDir, { recursive: true })
      } catch { /* exists */ }

      const promptFile = resolve(promptDir, "prompt.md")
      await Bun.write(promptFile, rendered)

      // 7. Spawn agent
      log.spawningAgent(ralphConfig.agent.command)
      session.logAgentStart()
      const result = await spawnAgent(ralphConfig.agent, promptFile, cwd)
      session.logAgentDone(result.exitCode, result.timedOut, result.elapsed)
      const iterElapsed = Date.now() - iterStart

      // 8. Handle result
      let comment = buildComment(result, issue)

      if (includeDiff && result.exitCode === 0) {
        try {
          const logProc = Bun.spawn(
            ["git", "log", "--oneline", `${baseBranch}..HEAD`],
            { stdout: "pipe", stderr: "pipe", cwd },
          )
          const logOutput = (await new Response(logProc.stdout).text()).trim()

          const diffProc = Bun.spawn(
            ["git", "diff", "--stat", `${baseBranch}...HEAD`],
            { stdout: "pipe", stderr: "pipe", cwd },
          )
          const diffOutput = (await new Response(diffProc.stdout).text()).trim()

          if (logOutput || diffOutput) {
            comment += "\n\n### Changes"
            if (logOutput) {
              comment += "\n\n**Commits:**\n```\n" + logOutput.slice(0, 2000) + "\n```"
            }
            if (diffOutput) {
              comment += "\n\n**Files changed:**\n```\n" + diffOutput.slice(0, 2000) + "\n```"
            }
          }
        } catch { /* ignore */ }
      }

      if (result.exitCode === 0) {
        await commentOnIssue(issue.number, comment)
        await updateIssueLabels(issue.number, ["ralph:done"], ["ralph:in-progress"])
        await closeIssue(issue.number)

        if (result.timedOut) {
          log.iterationTimeout(issue.number, iterElapsed)
        } else {
          log.iterationSuccess(issue.number, iterElapsed)
        }
        await session.iterationSuccess(issue.number, iterElapsed)
        succeeded++

        if (branchCreated) {
          try {
            await Bun.spawn(["git", "checkout", baseBranch], { cwd }).exited
            const mergeProc = Bun.spawn(["git", "merge", branchName], { stdout: "pipe", stderr: "pipe", cwd })
            const mergeExit = await mergeProc.exited
            if (mergeExit === 0) {
              await Bun.spawn(["git", "branch", "-d", branchName], { cwd }).exited
              log.merged(branchName)
            } else {
              log.mergeConflict(branchName)
            }
          } catch {
            log.warn(`Could not merge ${branchName}, branch preserved`)
          }
        }
      } else {
        await commentOnIssue(issue.number, comment)
        await updateIssueLabels(issue.number, ["ralph:failed"], ["ralph:in-progress"])

        if (result.timedOut) {
          log.iterationTimeout(issue.number, iterElapsed)
          await session.iterationFailed(issue.number, iterElapsed, "timeout")
        } else {
          log.iterationFailed(issue.number, result.exitCode, iterElapsed)
          await session.iterationFailed(issue.number, iterElapsed, `exit ${result.exitCode}`)
        }
        failed++

        if (branchCreated) {
          try {
            await Bun.spawn(["git", "checkout", baseBranch], { cwd }).exited
            await Bun.spawn(["git", "branch", "-D", branchName], { stdout: "pipe", stderr: "pipe", cwd }).exited
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      log.iterationError(issue.number, errMsg)
      await session.iterationFailed(issue.number, Date.now() - iterStart, errMsg)
      try {
        await commentOnIssue(issue.number, `## Ralph error on #${issue.number}\n\n\`\`\`\n${errMsg}\n\`\`\``)
        await updateIssueLabels(issue.number, ["ralph:failed"], ["ralph:in-progress"])
      } catch { /* Can't even update the issue */ }
      failed++

      if (branchCreated) {
        try {
          await Bun.spawn(["git", "checkout", baseBranch], { cwd }).exited
          await Bun.spawn(["git", "branch", "-D", branchName], { stdout: "pipe", stderr: "pipe", cwd }).exited
        } catch { /* ignore */ }
      }
    }

    return true
  }

  // Main execution
  if (issueNumber || values.once) {
    const found = await runOnce()
    if (!found && !dryRun) {
      log.noIssues()
    }
  } else if (values.watch) {
    while (!isShuttingDown()) {
      const found = await runOnce()
      if (!found) {
        if (!isShuttingDown()) {
          log.watching(intervalSec)
          await Bun.sleep(intervalMs)
        }
      }
    }
  } else {
    while (!isShuttingDown()) {
      const found = await runOnce()
      if (!found) break
    }
  }

  // Summary + cleanup
  if (!dryRun) {
    await session.end()
  }

  if (iterations > 0 && !dryRun) {
    log.runEnd({
      iterations,
      succeeded,
      failed,
      elapsed: Date.now() - runStartTime,
    })
  }
}
