#!/usr/bin/env bun

import { parseArgs } from "node:util"

const VERSION = "0.1.0"

const BANNER_LINES = [
  "██████╗  █████╗ ██╗     ██████╗ ██╗  ██╗      ██╗████████╗",
  "██╔══██╗██╔══██╗██║     ██╔══██╗██║  ██║      ██║╚══██╔══╝",
  "██████╔╝███████║██║     ██████╔╝███████║█████╗██║   ██║   ",
  "██╔══██╗██╔══██║██║     ██╔═══╝ ██╔══██║╚════╝██║   ██║   ",
  "██║  ██║██║  ██║███████╗██║     ██║  ██║      ██║   ██║   ",
  "╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝      ╚═╝   ╚═╝   ",
]

const BANNER_COLORS = [
  "\x1b[38;2;140;220;255m", // ice cyan
  "\x1b[38;2;200;240;255m", // frost white-blue
  "\x1b[38;2;255;220;180m", // warm cream
  "\x1b[38;2;255;160;80m",  // amber
  "\x1b[38;2;255;100;40m",  // flame orange
  "\x1b[38;2;230;50;20m",   // deep fire red
]

const RESET = "\x1b[0m"
const DIM = "\x1b[2m"
const ITALIC = "\x1b[3m"

function printBanner(): void {
  const cols = process.stdout.columns || 80
  console.log("")
  for (let i = 0; i < BANNER_LINES.length; i++) {
    const line = BANNER_LINES[i]
    const pad = Math.max(0, Math.floor((cols - line.length) / 2))
    console.log(" ".repeat(pad) + BANNER_COLORS[i] + line + RESET)
  }
  const tagline = "Autonomous agent loops powered by GitHub Issues"
  const tagPad = Math.max(0, Math.floor((cols - tagline.length) / 2))
  console.log("")
  console.log(" ".repeat(tagPad) + DIM + ITALIC + tagline + RESET)
  console.log("")
}

const COMMANDS: Record<string, {
  description: string
  run: (args: string[]) => Promise<void>
}> = {
  init: {
    description: "Create a RALPH.md template in the current directory",
    run: async (args) => (await import("./commands/init")).run(args),
  },
  setup: {
    description: "Create the ralph label system on the GitHub repo",
    run: async (args) => (await import("./commands/setup")).run(args),
  },
  run: {
    description: "Process queued issues with the configured agent",
    run: async (args) => (await import("./commands/run")).run(args),
  },
  list: {
    description: "Show queued issues",
    run: async (args) => (await import("./commands/list")).run(args),
  },
  status: {
    description: "Show project overview and issue counts",
    run: async (args) => (await import("./commands/status")).run(args),
  },
  doctor: {
    description: "Check prerequisites and configuration",
    run: async (args) => (await import("./commands/doctor")).run(args),
  },
}

function printHelp(): void {
  printBanner()
  console.log(`ralph-it v${VERSION}

Usage: ralph-it <command> [options]

Commands:
${Object.entries(COMMANDS)
  .map(([name, cmd]) => `  ${name.padEnd(10)} ${cmd.description}`)
  .join("\n")}

Options:
  --help       Show help
  --version    Show version

Run 'ralph-it <command> --help' for command-specific options.`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    printHelp()
    process.exit(0)
  }

  if (args.includes("--version")) {
    console.log(VERSION)
    process.exit(0)
  }

  const command = args[0]
  const commandArgs = args.slice(1)

  if (command === "--help") {
    printHelp()
    process.exit(0)
  }

  const cmd = COMMANDS[command]
  if (!cmd) {
    console.error(`Unknown command: ${command}\n`)
    printHelp()
    process.exit(1)
  }

  // Show banner on run command
  if (command === "run") {
    printBanner()
  }

  try {
    await cmd.run(commandArgs)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()
