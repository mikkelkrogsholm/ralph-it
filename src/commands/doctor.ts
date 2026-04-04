import { parseArgs } from "node:util"
import { resolve } from "path"
import { exec, checkAuth, listLabels, listIssues } from "../lib/github"
import { parseRalphFile } from "../lib/template"
import { STATE_LABELS } from "../lib/labels"

const HELP = `ralph-it doctor — Check prerequisites and configuration

Usage: ralph-it doctor [options]

Options:
  --help    Show this help`

interface Check {
  name: string
  critical: boolean
  run: () => Promise<{ ok: boolean; detail: string }>
}

export async function run(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", default: false },
    },
  })

  if (values.help) {
    console.log(HELP)
    return
  }

  const cwd = process.cwd()
  let hasError = false

  const checks: Check[] = [
    {
      name: "Bun installed",
      critical: true,
      run: async () => {
        const proc = Bun.spawn(["bun", "--version"], { stdout: "pipe", stderr: "pipe" })
        const version = (await new Response(proc.stdout).text()).trim()
        const code = await proc.exited
        return { ok: code === 0, detail: code === 0 ? `v${version}` : "bun not found" }
      },
    },
    {
      name: "gh CLI installed",
      critical: true,
      run: async () => {
        const result = await exec(["--version"])
        return { ok: result.exitCode === 0, detail: result.exitCode === 0 ? result.stdout.trim().split("\n")[0] : "gh not found. Install: https://cli.github.com" }
      },
    },
    {
      name: "gh authenticated",
      critical: true,
      run: async () => {
        const auth = await checkAuth()
        return { ok: auth.authenticated, detail: auth.authenticated ? `Logged in as ${auth.username}` : "Not authenticated. Run: gh auth login" }
      },
    },
    {
      name: "Git repo detected",
      critical: true,
      run: async () => {
        const proc = Bun.spawn(["git", "rev-parse", "--git-dir"], { stdout: "pipe", stderr: "pipe", cwd })
        const code = await proc.exited
        return { ok: code === 0, detail: code === 0 ? "OK" : "Not a git repository" }
      },
    },
    {
      name: "Remote configured",
      critical: true,
      run: async () => {
        const proc = Bun.spawn(["git", "remote", "-v"], { stdout: "pipe", stderr: "pipe", cwd })
        const output = (await new Response(proc.stdout).text()).trim()
        const code = await proc.exited
        const hasRemote = code === 0 && output.length > 0
        return { ok: hasRemote, detail: hasRemote ? output.split("\n")[0] : "No git remote configured" }
      },
    },
    {
      name: "RALPH.md found",
      critical: true,
      run: async () => {
        const exists = await Bun.file(resolve(cwd, "RALPH.md")).exists()
        return { ok: exists, detail: exists ? "OK" : "Not found. Run: ralph-it init" }
      },
    },
    {
      name: "Agent CLI available",
      critical: true,
      run: async () => {
        try {
          const config = await parseRalphFile(cwd)
          const proc = Bun.spawn(["which", config.agent.command], { stdout: "pipe", stderr: "pipe" })
          const path = (await new Response(proc.stdout).text()).trim()
          const code = await proc.exited
          return { ok: code === 0, detail: code === 0 ? `${config.agent.command} at ${path}` : `${config.agent.command} not found in PATH` }
        } catch {
          return { ok: false, detail: "Could not parse RALPH.md to check agent" }
        }
      },
    },
    {
      name: "Labels configured",
      critical: true,
      run: async () => {
        try {
          const labels = await listLabels()
          const labelNames = new Set(labels.map((l) => l.name))
          const missing = STATE_LABELS.filter((l) => !labelNames.has(l.name))
          if (missing.length === 0) {
            return { ok: true, detail: "All ralph: labels present" }
          }
          return { ok: false, detail: `Missing: ${missing.map((l) => l.name).join(", ")}. Run: ralph-it setup` }
        } catch {
          return { ok: false, detail: "Could not check labels (are you in a repo with a remote?)" }
        }
      },
    },
    {
      name: "Stuck issues",
      critical: false,
      run: async () => {
        try {
          const issues = await listIssues({ labels: ["ralph:in-progress"], limit: 10 })
          if (issues.length === 0) {
            return { ok: true, detail: "No stuck issues" }
          }
          const nums = issues.map((i) => `#${i.number}`).join(", ")
          return { ok: false, detail: `${issues.length} issue(s) stuck in-progress: ${nums}` }
        } catch {
          return { ok: true, detail: "Could not check (skipped)" }
        }
      },
    },
  ]

  console.log("ralph-it doctor\n")

  for (const check of checks) {
    const result = await check.run()
    const icon = result.ok ? "+" : (check.critical ? "x" : "!")
    console.log(`  ${icon} ${check.name}: ${result.detail}`)
    if (!result.ok && check.critical) {
      hasError = true
    }
  }

  console.log("")
  if (hasError) {
    console.log("Some checks failed. Fix the issues above and run doctor again.")
    process.exit(1)
  } else {
    console.log("All checks passed. Ready to go!")
  }
}
