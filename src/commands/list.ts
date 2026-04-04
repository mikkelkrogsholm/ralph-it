import { parseArgs } from "node:util"
import { listIssues } from "../lib/github"
import { PRIORITY_ORDER } from "../lib/labels"

const HELP = `ralph-it list — Show queued issues

Usage: ralph-it list [options]

Options:
  --all     Show all ralph-managed issues, not just queued
  --help    Show this help`

export async function run(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      all: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  })

  if (values.help) {
    console.log(HELP)
    return
  }

  let issues

  if (values.all) {
    // Fetch issues with any ralph: state label
    const states = ["ralph:queued", "ralph:in-progress", "ralph:done", "ralph:failed", "ralph:blocked"]
    const allIssues = []
    for (const label of states) {
      try {
        const batch = await listIssues({ labels: [label], state: "all", limit: 50 })
        allIssues.push(...batch)
      } catch {
        // Label might not exist yet
      }
    }
    // Deduplicate by number
    const seen = new Set<number>()
    issues = allIssues.filter((i) => {
      if (seen.has(i.number)) return false
      seen.add(i.number)
      return true
    })
  } else {
    issues = await listIssues({ labels: ["ralph:queued"] })
  }

  if (issues.length === 0) {
    console.log(values.all ? "No ralph-managed issues found." : "No queued issues.")
    return
  }

  // Sort by priority
  issues.sort((a, b) => {
    const pa = a.labels.find((l) => l.name.startsWith("priority:"))
    const pb = b.labels.find((l) => l.name.startsWith("priority:"))
    return (PRIORITY_ORDER[pa?.name ?? ""] ?? 99) - (PRIORITY_ORDER[pb?.name ?? ""] ?? 99)
  })

  console.log(`${issues.length} issue(s):\n`)

  for (const issue of issues) {
    const priority = issue.labels.find((l) => l.name.startsWith("priority:"))?.name ?? ""
    const type = issue.labels.find((l) => l.name.startsWith("type:"))?.name ?? ""
    const state = issue.labels.find((l) => l.name.startsWith("ralph:"))?.name ?? ""

    const parts = [
      `#${String(issue.number).padEnd(5)}`,
      issue.title.slice(0, 50).padEnd(52),
      priority.padEnd(20),
      type.padEnd(16),
      state,
    ]

    console.log(`  ${parts.join("  ")}`)
  }
}
