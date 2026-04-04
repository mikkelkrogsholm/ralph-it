import { parseArgs } from "node:util"
import { resolve } from "path"

const DEFAULT_RALPH = `---
agent.command = claude
agent.args = -p --dangerously-skip-permissions
agent.input = stdin
agent.timeout = 600
credit = true
---

<!-- This is iteration {{ ralph.iteration }} -->
<!-- HTML comments like this are stripped from the prompt before sending to the agent -->

You are an autonomous coding agent working in a loop.
Each iteration: solve the task, test your changes, and commit.

## Project
{{ repo.description }}
Languages: {{ repo.languages }}

## Task
Issue #{{ issue.number }}: {{ issue.title }}

{{ issue.body }}

## Discussion
{{ issue.comments }}

## Labels
{{ issue.labels }}
`

const HELP = `ralph-it init — Create a RALPH.md template

Usage: ralph-it init [options]

Options:
  --force    Overwrite existing RALPH.md
  --help     Show this help`

export async function run(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      force: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  })

  if (values.help) {
    console.log(HELP)
    return
  }

  const cwd = process.cwd()
  const ralphPath = resolve(cwd, "RALPH.md")
  const ralphDir = resolve(cwd, ".ralph")

  const file = Bun.file(ralphPath)
  if (await file.exists()) {
    if (!values.force) {
      console.error("RALPH.md already exists. Use --force to overwrite.")
      process.exit(1)
    }
  }

  // Create .ralph directory
  const { mkdirSync } = await import("fs")
  try {
    mkdirSync(ralphDir, { recursive: true })
  } catch {
    // Already exists
  }

  // Write RALPH.md
  await Bun.write(ralphPath, DEFAULT_RALPH)
  console.log("Created RALPH.md")
  console.log("Created .ralph/")

  // Add .ralph/prompt.md to .gitignore if not already there
  const gitignorePath = resolve(cwd, ".gitignore")
  const gitignoreFile = Bun.file(gitignorePath)
  if (await gitignoreFile.exists()) {
    const content = await gitignoreFile.text()
    if (!content.includes(".ralph/prompt.md")) {
      await Bun.write(gitignorePath, content.trimEnd() + "\n.ralph/prompt.md\n")
      console.log("Added .ralph/prompt.md to .gitignore")
    }
  }

  console.log("\nNext steps:")
  console.log("  1. Edit RALPH.md to customize your agent and prompt")
  console.log("  2. Run: ralph-it setup    (create labels on your repo)")
  console.log("  3. Run: ralph-it doctor   (verify everything is configured)")
}
