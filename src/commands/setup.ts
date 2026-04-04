import { parseArgs } from "node:util"
import { ALL_LABELS } from "../lib/labels"
import { createLabel } from "../lib/github"

const HELP = `ralph-it setup — Create the ralph label system on the GitHub repo

Usage: ralph-it setup [options]

Options:
  --help    Show this help

Creates ${ALL_LABELS.length} labels (state, priority, type) on the repo.
Safe to run multiple times — existing labels are updated.`

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

  console.log(`Creating ${ALL_LABELS.length} labels...\n`)

  let created = 0
  let failed = 0

  for (const label of ALL_LABELS) {
    try {
      await createLabel(label)
      console.log(`  + ${label.name}`)
      created++
    } catch (err) {
      console.error(`  x ${label.name}: ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }
  }

  console.log(`\nDone: ${created} created/updated${failed > 0 ? `, ${failed} failed` : ""}.`)
}
