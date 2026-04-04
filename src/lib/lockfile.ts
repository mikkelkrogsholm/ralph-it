import { resolve } from "path"
import { mkdirSync, unlinkSync, appendFileSync } from "fs"

export interface RunLock {
  runId: string
  pid: number
  startedAt: string
  mode: string
  agent: string
  iteration: number
  currentIssue: { number: number; title: string } | null
  stats: { succeeded: number; failed: number }
}

export interface LogEntry {
  ts: string
  event: string
  [key: string]: unknown
}

function generateRunId(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
}

export class RunSession {
  readonly runId: string
  readonly lockPath: string
  readonly logPath: string
  readonly logDir: string
  private lock: RunLock

  constructor(cwd: string, mode: string, agent: string) {
    this.runId = generateRunId()

    const ralphDir = resolve(cwd, ".ralph")
    this.logDir = resolve(ralphDir, "logs")
    this.lockPath = resolve(ralphDir, "run.lock")
    this.logPath = resolve(this.logDir, `${this.runId}.jsonl`)

    // Ensure directories exist
    mkdirSync(this.logDir, { recursive: true })

    this.lock = {
      runId: this.runId,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      mode,
      agent,
      iteration: 0,
      currentIssue: null,
      stats: { succeeded: 0, failed: 0 },
    }
  }

  // Check if another run is active
  static async isLocked(cwd: string): Promise<RunLock | null> {
    const lockPath = resolve(cwd, ".ralph", "run.lock")
    const file = Bun.file(lockPath)
    if (!(await file.exists())) return null

    try {
      const lock: RunLock = JSON.parse(await file.text())

      // Check if the PID is still alive
      try {
        process.kill(lock.pid, 0) // Signal 0 = check if alive
        return lock // Process is alive, lock is valid
      } catch {
        // Process is dead, stale lock
        try { unlinkSync(lockPath) } catch { /* ignore */ }
        return null
      }
    } catch {
      // Corrupt lock file
      try { unlinkSync(lockPath) } catch { /* ignore */ }
      return null
    }
  }

  // Write lock file
  async writeLock(): Promise<void> {
    await Bun.write(this.lockPath, JSON.stringify(this.lock, null, 2) + "\n")
  }

  // Remove lock file
  removeLock(): void {
    try { unlinkSync(this.lockPath) } catch { /* already gone */ }
  }

  // Append to JSONL log
  private appendLog(entry: LogEntry): void {
    appendFileSync(this.logPath, JSON.stringify(entry) + "\n")
  }

  // --- Events ---

  async start(): Promise<void> {
    await this.writeLock()
    this.appendLog({
      ts: new Date().toISOString(),
      event: "run:start",
      runId: this.runId,
      mode: this.lock.mode,
      agent: this.lock.agent,
      pid: this.lock.pid,
    })
  }

  async iterationStart(iteration: number, issue: { number: number; title: string }): Promise<void> {
    this.lock.iteration = iteration
    this.lock.currentIssue = issue
    await this.writeLock()
    this.appendLog({
      ts: new Date().toISOString(),
      event: "iteration:start",
      iteration,
      issue: issue.number,
      title: issue.title,
    })
  }

  logCommand(name: string, ok: boolean, elapsed: number, output?: string): void {
    this.appendLog({
      ts: new Date().toISOString(),
      event: "command:done",
      name,
      ok,
      elapsed,
      output: output ? output.slice(0, 500) : undefined,
    })
  }

  logPromptRendered(chars: number): void {
    this.appendLog({
      ts: new Date().toISOString(),
      event: "prompt:rendered",
      chars,
    })
  }

  logAgentStart(): void {
    this.appendLog({
      ts: new Date().toISOString(),
      event: "agent:start",
      command: this.lock.agent,
    })
  }

  logAgentDone(exitCode: number, timedOut: boolean, elapsed: number): void {
    this.appendLog({
      ts: new Date().toISOString(),
      event: "agent:done",
      exitCode,
      timedOut,
      elapsed,
    })
  }

  async iterationSuccess(issueNumber: number, elapsed: number): Promise<void> {
    this.lock.stats.succeeded++
    this.lock.currentIssue = null
    await this.writeLock()
    this.appendLog({
      ts: new Date().toISOString(),
      event: "iteration:done",
      issue: issueNumber,
      result: "success",
      elapsed,
    })
  }

  async iterationFailed(issueNumber: number, elapsed: number, reason: string): Promise<void> {
    this.lock.stats.failed++
    this.lock.currentIssue = null
    await this.writeLock()
    this.appendLog({
      ts: new Date().toISOString(),
      event: "iteration:done",
      issue: issueNumber,
      result: "failed",
      reason,
      elapsed,
    })
  }

  async end(): Promise<void> {
    this.appendLog({
      ts: new Date().toISOString(),
      event: "run:done",
      runId: this.runId,
      stats: { ...this.lock.stats },
      iterations: this.lock.iteration,
    })
    this.removeLock()
  }
}
