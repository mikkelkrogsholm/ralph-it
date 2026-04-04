export interface AgentConfig {
  command: string
  args: string[]
  input: "stdin" | "file" | "argument"
  timeout: number
}

export interface CommandDef {
  name: string
  run: string
  timeout: number
}

export interface RalphConfig {
  agent: AgentConfig
  commands: CommandDef[]
  credit: boolean
  template: string
}

export interface TemplateContext {
  repo: Record<string, unknown>
  issue: Record<string, unknown>
  commands: Record<string, string>
  args: Record<string, string>
  ralph: Record<string, unknown>
}

export function parseFrontmatter(content: string): Record<string, string> {
  const lines = content.split("\n")
  const result: Record<string, string> = {}

  let inFrontmatter = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === "---") {
      if (inFrontmatter) break
      inFrontmatter = true
      continue
    }
    if (!inFrontmatter) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    result[key] = value
  }

  return result
}

function extractTemplate(content: string): string {
  const parts = content.split("---")
  if (parts.length < 3) return content
  return parts.slice(2).join("---").trim()
}

function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "")
}

function buildAgentConfig(fm: Record<string, string>): AgentConfig {
  const command = fm["agent.command"]
  if (!command) {
    throw new Error("RALPH.md: agent.command is required")
  }

  const argsStr = fm["agent.args"] ?? ""
  const args = argsStr ? argsStr.split(/\s+/) : []
  const input = (fm["agent.input"] ?? "stdin") as AgentConfig["input"]
  const timeout = parseInt(fm["agent.timeout"] ?? "600", 10)

  if (!["stdin", "file", "argument"].includes(input)) {
    throw new Error(`RALPH.md: agent.input must be stdin, file, or argument. Got: ${input}`)
  }

  return { command, args, input, timeout }
}

function buildCommands(fm: Record<string, string>): CommandDef[] {
  const commands: CommandDef[] = []
  const seen = new Set<string>()

  for (const [key, value] of Object.entries(fm)) {
    if (key.startsWith("command.") && !key.includes(".timeout")) {
      const name = key.slice("command.".length)
      if (seen.has(name)) {
        throw new Error(`RALPH.md: duplicate command name: ${name}`)
      }
      seen.add(name)
      const timeout = parseInt(fm[`command.${name}.timeout`] ?? "60", 10)
      commands.push({ name, run: value, timeout })
    }
  }

  return commands
}

export async function parseRalphFile(cwd: string): Promise<RalphConfig> {
  const filepath = `${cwd}/RALPH.md`
  const file = Bun.file(filepath)

  if (!(await file.exists())) {
    throw new Error(`No RALPH.md found in ${cwd}. Run: ralph-it init`)
  }

  const content = await file.text()
  const fm = parseFrontmatter(content)
  const agent = buildAgentConfig(fm)
  const commands = buildCommands(fm)
  const credit = (fm["credit"] ?? "true") !== "false"
  const rawTemplate = extractTemplate(content)
  const template = stripHtmlComments(rawTemplate)

  return { agent, commands, credit, template }
}

export async function executeCommands(commands: CommandDef[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {}

  for (const cmd of commands) {
    try {
      const proc = Bun.spawn(["sh", "-c", cmd.run], {
        stdout: "pipe",
        stderr: "pipe",
      })

      // Command timeout
      let timedOut = false
      const timeoutId = setTimeout(() => {
        timedOut = true
        proc.kill("SIGTERM")
        setTimeout(() => {
          try { proc.kill("SIGKILL") } catch { /* dead */ }
        }, 3000)
      }, cmd.timeout * 1000)

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      const exitCode = await proc.exited
      clearTimeout(timeoutId)

      if (timedOut) {
        results[cmd.name] = `[command timed out after ${cmd.timeout}s]`
      } else if (exitCode !== 0) {
        results[cmd.name] = `[command failed (exit ${exitCode}): ${stderr.trim().slice(0, 500)}]`
      } else {
        results[cmd.name] = stdout.trim()
      }
    } catch (err) {
      results[cmd.name] = `[command error: ${err instanceof Error ? err.message : String(err)}]`
    }
  }

  return results
}

export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path: string) => {
    const value = path.split(".").reduce<unknown>((obj, key) => {
      if (obj && typeof obj === "object") {
        return (obj as Record<string, unknown>)[key]
      }
      return undefined
    }, context as unknown)

    if (value === undefined || value === null) {
      return ""
    }

    if (Array.isArray(value)) {
      if (path.endsWith(".comments")) {
        return (value as Array<{ author?: { login?: string }; body?: string }>)
          .map((c) => `**@${c.author?.login ?? "unknown"}**: ${c.body ?? ""}`)
          .join("\n\n")
      }
      if (path.endsWith(".labels")) {
        return (value as Array<{ name?: string }>).map((l) => l.name ?? "").join(", ")
      }
      return JSON.stringify(value)
    }

    if (typeof value === "object") {
      return JSON.stringify(value)
    }

    return String(value)
  })
}

const CREDIT_INSTRUCTION = `

---
IMPORTANT: When you make git commits, include this co-author trailer at the end of each commit message:
Co-Authored-By: ralph-it <ralph-it@noreply.github.com>
`

export function appendCredit(prompt: string): string {
  return prompt + CREDIT_INSTRUCTION
}
