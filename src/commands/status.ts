import { parseArgs } from "node:util"
import { getRepoContext, listIssues } from "../lib/github"

const HELP = `ralph-it status — Show project overview and issue counts

Usage: ralph-it status [options]

Options:
  --help    Show this help`

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

  // Fetch repo context
  const repo = await getRepoContext()
  const languages = repo.languages?.map((l) => l.name).join(", ") ?? "unknown"

  console.log(`Repository: ${repo.owner.login}/${repo.name}`)
  if (repo.description) {
    console.log(`Description: ${repo.description}`)
  }
  console.log(`Languages: ${languages}`)
  console.log("")

  // Count issues by state
  const states = [
    { label: "ralph:queued", name: "Queued" },
    { label: "ralph:in-progress", name: "In Progress" },
    { label: "ralph:done", name: "Done" },
    { label: "ralph:failed", name: "Failed" },
    { label: "ralph:blocked", name: "Blocked" },
  ]

  console.log("Issue Queue:")
  let total = 0

  for (const state of states) {
    try {
      const issues = await listIssues({
        labels: [state.label],
        state: state.label === "ralph:done" ? "all" : "open",
        limit: 100,
      })
      console.log(`  ${state.name.padEnd(14)} ${issues.length}`)
      total += issues.length
    } catch {
      console.log(`  ${state.name.padEnd(14)} ?`)
    }
  }

  console.log(`\nTotal managed: ${total}`)
}
