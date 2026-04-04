// ANSI color codes — zero dependencies
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const ITALIC = "\x1b[3m"

const RED = "\x1b[38;2;230;50;20m"
const GREEN = "\x1b[38;2;80;220;170m"
const YELLOW = "\x1b[38;2;255;200;50m"
const CYAN = "\x1b[38;2;140;220;255m"
const ORANGE = "\x1b[38;2;255;160;80m"
const FLAME = "\x1b[38;2;255;100;40m"
const GRAY = "\x1b[38;2;120;120;120m"

function cols(): number {
  return process.stdout.columns || 80
}

function separator(char = "─"): string {
  return GRAY + char.repeat(Math.min(cols(), 60)) + RESET
}

function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (minutes < 60) return `${minutes}m ${secs}s`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

export const log = {
  // Run lifecycle
  runStart(mode: string, config: { agent: string; commands: number; timeout: number }) {
    console.log(separator())
    console.log(
      `${BOLD}${CYAN}▶ ${mode}${RESET}  ` +
      `${DIM}agent: ${config.agent} · ${config.commands} command(s) · timeout: ${config.timeout}s${RESET}`
    )
    console.log(separator())
  },

  runEnd(stats: { iterations: number; succeeded: number; failed: number; elapsed: number }) {
    console.log("")
    console.log(separator("═"))
    const successStr = stats.succeeded > 0 ? `${GREEN}${stats.succeeded} succeeded${RESET}` : `${DIM}0 succeeded${RESET}`
    const failStr = stats.failed > 0 ? `${RED}${stats.failed} failed${RESET}` : `${DIM}0 failed${RESET}`
    console.log(
      `${BOLD}Done${RESET}: ${stats.iterations} iteration(s) — ${successStr}, ${failStr}` +
      `  ${DIM}(${formatDuration(stats.elapsed)})${RESET}`
    )
    console.log(separator("═"))
  },

  // Iteration lifecycle
  iterationStart(iteration: number, issueNumber: number, title: string) {
    console.log("")
    console.log(`${BOLD}${CYAN}── Iteration ${iteration} ──${RESET}`)
    console.log(`${BOLD}#${issueNumber}${RESET}  ${title}`)
  },

  // Phases within an iteration
  phase(icon: string, message: string) {
    console.log(`  ${icon} ${message}`)
  },

  picking() {
    this.phase(`${CYAN}→${RESET}`, "Picking next issue...")
  },

  claiming(issueNumber: number) {
    this.phase(`${CYAN}→${RESET}`, `Claiming #${issueNumber}`)
  },

  branching(branchName: string) {
    this.phase(`${CYAN}→${RESET}`, `Branch: ${DIM}${branchName}${RESET}`)
  },

  runningCommands(count: number) {
    this.phase(`${CYAN}→${RESET}`, `Running ${count} command(s)`)
  },

  commandResult(name: string, ok: boolean, detail?: string) {
    if (ok) {
      this.phase(`${GREEN}✓${RESET}`, `${name}${detail ? `  ${DIM}${detail}${RESET}` : ""}`)
    } else {
      this.phase(`${RED}✗${RESET}`, `${name}${detail ? `  ${DIM}${detail}${RESET}` : ""}`)
    }
  },

  renderingPrompt(chars: number) {
    this.phase(`${CYAN}→${RESET}`, `Prompt assembled ${DIM}(${chars.toLocaleString()} chars)${RESET}`)
  },

  spawningAgent(command: string) {
    this.phase(`${ORANGE}▶${RESET}`, `${BOLD}${command}${RESET}`)
    console.log("")
  },

  // Iteration results
  iterationSuccess(issueNumber: number, elapsed: number) {
    console.log("")
    console.log(`  ${GREEN}✓${RESET} ${BOLD}#${issueNumber} completed${RESET}  ${DIM}(${formatDuration(elapsed)})${RESET}`)
  },

  iterationFailed(issueNumber: number, exitCode: number, elapsed: number) {
    console.log("")
    console.log(`  ${RED}✗${RESET} ${BOLD}#${issueNumber} failed${RESET} ${DIM}(exit ${exitCode}, ${formatDuration(elapsed)})${RESET}`)
  },

  iterationTimeout(issueNumber: number, elapsed: number) {
    console.log("")
    console.log(`  ${YELLOW}⏱${RESET} ${BOLD}#${issueNumber} timed out${RESET}  ${DIM}(${formatDuration(elapsed)})${RESET}`)
  },

  iterationError(issueNumber: number, error: string) {
    console.log("")
    console.log(`  ${RED}✗${RESET} ${BOLD}#${issueNumber} error${RESET}: ${error}`)
  },

  // Branch outcomes
  merged(branchName: string) {
    this.phase(`${GREEN}✓${RESET}`, `Merged ${DIM}${branchName}${RESET}`)
  },

  mergeConflict(branchName: string) {
    this.phase(`${YELLOW}!${RESET}`, `Merge conflict — ${DIM}${branchName} preserved${RESET}`)
  },

  // Misc
  noIssues() {
    console.log(`  ${DIM}No queued issues found.${RESET}`)
  },

  watching(intervalSec: number) {
    console.log(`  ${DIM}Waiting ${intervalSec}s before next poll...${RESET}`)
  },

  dryRun(issueNumber: number, title: string) {
    console.log(`  ${YELLOW}[dry-run]${RESET} Would process: ${BOLD}#${issueNumber}${RESET}  ${title}`)
  },

  skipping(issueNumber: number, reason: string) {
    this.phase(`${YELLOW}!${RESET}`, `Skipping #${issueNumber}: ${reason}`)
  },

  warn(message: string) {
    console.log(`  ${YELLOW}!${RESET} ${message}`)
  },

  info(message: string) {
    console.log(`  ${DIM}${message}${RESET}`)
  },
}
