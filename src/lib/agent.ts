import type { AgentConfig } from "./template"
import type { Issue } from "./github"
import { resolve } from "path"

export interface AgentResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
  elapsed: number
}

export async function spawnAgent(
  config: AgentConfig,
  promptFile: string,
  cwd: string,
): Promise<AgentResult> {
  const absolutePromptFile = resolve(cwd, promptFile)
  const startTime = Date.now()

  let args = [...config.args]
  let stdin: Parameters<typeof Bun.spawn>[1]["stdin"] = undefined

  switch (config.input) {
    case "stdin":
      stdin = Bun.file(absolutePromptFile)
      break

    case "file":
      // File mode: always append prompt file path as last argument
      args.push(absolutePromptFile)
      break

    case "argument":
      // Argument mode: substitute {prompt_file} placeholder in args
      const before = args.join(" ")
      args = args.map((arg) =>
        arg.replace("{prompt_file}", absolutePromptFile),
      )
      if (args.join(" ") === before) {
        throw new Error(
          `agent.input is "argument" but no {prompt_file} placeholder found in agent.args. ` +
          `Add {prompt_file} to your args or use agent.input = file instead.`
        )
      }
      break
  }

  const proc = Bun.spawn([config.command, ...args], {
    cwd,
    stdin: stdin ?? "ignore",
    stdout: "pipe",
    stderr: "pipe",
  })

  let timedOut = false
  let killed = false

  const timeoutId = setTimeout(() => {
    timedOut = true
    proc.kill("SIGTERM")
    setTimeout(() => {
      if (!killed) {
        try {
          proc.kill("SIGKILL")
        } catch {
          // Process already dead
        }
      }
    }, 5000)
  }, config.timeout * 1000)

  // Collect output while streaming to terminal
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []

  const stdoutReader = (async () => {
    const reader = proc.stdout.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      stdoutChunks.push(text)
      process.stdout.write(text)
    }
  })()

  const stderrReader = (async () => {
    const reader = proc.stderr.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      stderrChunks.push(text)
      process.stderr.write(text)
    }
  })()

  await Promise.all([stdoutReader, stderrReader])
  const exitCode = await proc.exited
  killed = true
  clearTimeout(timeoutId)

  const elapsed = Date.now() - startTime

  return {
    exitCode: timedOut ? 124 : exitCode,
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join(""),
    timedOut,
    elapsed,
  }
}

export function buildComment(result: AgentResult, issue: Issue): string {
  const elapsed = (result.elapsed / 1000).toFixed(1)
  const MAX_OUTPUT = 60000

  if (result.timedOut) {
    return [
      `## Ralph timed out on #${issue.number}`,
      "",
      `Agent was killed after ${elapsed}s timeout.`,
      "",
      "<details>",
      "<summary>Agent output (truncated)</summary>",
      "",
      "```",
      (result.stdout + result.stderr).slice(0, MAX_OUTPUT),
      "```",
      "",
      "</details>",
    ].join("\n")
  }

  if (result.exitCode === 0) {
    return [
      `## Ralph completed #${issue.number}`,
      "",
      `Finished in ${elapsed}s.`,
      "",
      "<details>",
      "<summary>Agent output</summary>",
      "",
      "```",
      result.stdout.slice(0, MAX_OUTPUT),
      "```",
      "",
      "</details>",
    ].join("\n")
  }

  return [
    `## Ralph failed on #${issue.number}`,
    "",
    `Exited with code ${result.exitCode} after ${elapsed}s.`,
    "",
    "<details>",
    "<summary>Error output</summary>",
    "",
    "```",
    (result.stderr || result.stdout).slice(0, MAX_OUTPUT),
    "```",
    "",
    "</details>",
  ].join("\n")
}
