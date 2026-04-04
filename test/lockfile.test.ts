import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { RunSession } from "../src/lib/lockfile"
import { mkdtempSync, rmSync, readFileSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("RunSession", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ralph-test-"))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("creates lock file on start", async () => {
    const session = new RunSession(tmpDir, "test", "claude")
    await session.start()

    const lockPath = join(tmpDir, ".ralph", "run.lock")
    expect(existsSync(lockPath)).toBe(true)

    const lock = JSON.parse(readFileSync(lockPath, "utf-8"))
    expect(lock.runId).toBe(session.runId)
    expect(lock.pid).toBe(process.pid)
    expect(lock.mode).toBe("test")
    expect(lock.agent).toBe("claude")
    expect(lock.iteration).toBe(0)
    expect(lock.currentIssue).toBeNull()

    session.removeLock()
  })

  test("creates JSONL log file on start", async () => {
    const session = new RunSession(tmpDir, "test", "claude")
    await session.start()

    expect(existsSync(session.logPath)).toBe(true)

    const lines = readFileSync(session.logPath, "utf-8").trim().split("\n")
    expect(lines.length).toBe(1)

    const entry = JSON.parse(lines[0])
    expect(entry.event).toBe("run:start")
    expect(entry.runId).toBe(session.runId)

    session.removeLock()
  })

  test("updates lock on iteration start", async () => {
    const session = new RunSession(tmpDir, "test", "claude")
    await session.start()
    await session.iterationStart(1, { number: 42, title: "Fix bug" })

    const lockPath = join(tmpDir, ".ralph", "run.lock")
    const lock = JSON.parse(readFileSync(lockPath, "utf-8"))
    expect(lock.iteration).toBe(1)
    expect(lock.currentIssue).toEqual({ number: 42, title: "Fix bug" })

    session.removeLock()
  })

  test("tracks succeeded/failed in lock", async () => {
    const session = new RunSession(tmpDir, "test", "claude")
    await session.start()

    await session.iterationStart(1, { number: 1, title: "A" })
    await session.iterationSuccess(1, 1000)

    await session.iterationStart(2, { number: 2, title: "B" })
    await session.iterationFailed(2, 2000, "exit 1")

    const lockPath = join(tmpDir, ".ralph", "run.lock")
    const lock = JSON.parse(readFileSync(lockPath, "utf-8"))
    expect(lock.stats.succeeded).toBe(1)
    expect(lock.stats.failed).toBe(1)

    session.removeLock()
  })

  test("appends all events to JSONL log", async () => {
    const session = new RunSession(tmpDir, "test", "claude")
    await session.start()
    await session.iterationStart(1, { number: 42, title: "Fix" })
    session.logCommand("coverage", true, 500, "87%")
    session.logPromptRendered(4000)
    session.logAgentStart()
    session.logAgentDone(0, false, 30000)
    await session.iterationSuccess(42, 31000)
    await session.end()

    const lines = readFileSync(session.logPath, "utf-8").trim().split("\n")
    const events = lines.map((l) => JSON.parse(l).event)

    expect(events).toEqual([
      "run:start",
      "iteration:start",
      "command:done",
      "prompt:rendered",
      "agent:start",
      "agent:done",
      "iteration:done",
      "run:done",
    ])
  })

  test("removes lock on end", async () => {
    const session = new RunSession(tmpDir, "test", "claude")
    await session.start()
    await session.end()

    const lockPath = join(tmpDir, ".ralph", "run.lock")
    expect(existsSync(lockPath)).toBe(false)
  })

  test("isLocked returns null when no lock exists", async () => {
    const result = await RunSession.isLocked(tmpDir)
    expect(result).toBeNull()
  })

  test("isLocked returns lock when current process holds it", async () => {
    const session = new RunSession(tmpDir, "test", "claude")
    await session.start()

    const result = await RunSession.isLocked(tmpDir)
    expect(result).not.toBeNull()
    expect(result!.runId).toBe(session.runId)
    expect(result!.pid).toBe(process.pid)

    session.removeLock()
  })

  test("isLocked cleans up stale lock from dead PID", async () => {
    // Write a lock with a PID that doesn't exist
    const ralphDir = join(tmpDir, ".ralph")
    const { mkdirSync, writeFileSync } = await import("fs")
    mkdirSync(ralphDir, { recursive: true })
    writeFileSync(join(ralphDir, "run.lock"), JSON.stringify({
      runId: "stale",
      pid: 999999999, // almost certainly not running
      startedAt: new Date().toISOString(),
      mode: "test",
      agent: "claude",
      iteration: 0,
      currentIssue: null,
      stats: { succeeded: 0, failed: 0 },
    }))

    const result = await RunSession.isLocked(tmpDir)
    expect(result).toBeNull()
    expect(existsSync(join(ralphDir, "run.lock"))).toBe(false)
  })

  test("all log entries have timestamps", async () => {
    const session = new RunSession(tmpDir, "test", "claude")
    await session.start()
    session.logCommand("test", true, 100)
    await session.end()

    const lines = readFileSync(session.logPath, "utf-8").trim().split("\n")
    for (const line of lines) {
      const entry = JSON.parse(line)
      expect(entry.ts).toBeDefined()
      expect(new Date(entry.ts).getTime()).toBeGreaterThan(0)
    }
  })
})
