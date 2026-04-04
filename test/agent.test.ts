import { describe, test, expect } from "bun:test"
import { buildComment } from "../src/lib/agent"
import type { AgentResult } from "../src/lib/agent"
import type { Issue } from "../src/lib/github"

const mockIssue: Issue = {
  number: 42,
  title: "Fix login bug",
  body: "Description",
  labels: [{ name: "type:bug" }],
  comments: [],
}

describe("buildComment", () => {
  test("success comment includes issue number and elapsed time", () => {
    const result: AgentResult = {
      exitCode: 0,
      stdout: "Fixed the bug",
      stderr: "",
      timedOut: false,
      elapsed: 52300,
    }

    const comment = buildComment(result, mockIssue)
    expect(comment).toContain("#42")
    expect(comment).toContain("completed")
    expect(comment).toContain("52.3s")
  })

  test("failure comment includes exit code", () => {
    const result: AgentResult = {
      exitCode: 1,
      stdout: "",
      stderr: "Error: something went wrong",
      timedOut: false,
      elapsed: 23100,
    }

    const comment = buildComment(result, mockIssue)
    expect(comment).toContain("#42")
    expect(comment).toContain("failed")
    expect(comment).toContain("code 1")
    expect(comment).toContain("Error: something went wrong")
  })

  test("timeout comment indicates timeout", () => {
    const result: AgentResult = {
      exitCode: 124,
      stdout: "partial output",
      stderr: "",
      timedOut: true,
      elapsed: 600000,
    }

    const comment = buildComment(result, mockIssue)
    expect(comment).toContain("#42")
    expect(comment).toContain("timed out")
    expect(comment).toContain("600.0s")
  })

  test("truncates long output", () => {
    const longOutput = "x".repeat(70000)
    const result: AgentResult = {
      exitCode: 0,
      stdout: longOutput,
      stderr: "",
      timedOut: false,
      elapsed: 1000,
    }

    const comment = buildComment(result, mockIssue)
    expect(comment.length).toBeLessThan(65000)
  })

  test("uses stderr for failed results", () => {
    const result: AgentResult = {
      exitCode: 1,
      stdout: "stdout content",
      stderr: "stderr content",
      timedOut: false,
      elapsed: 1000,
    }

    const comment = buildComment(result, mockIssue)
    expect(comment).toContain("stderr content")
  })

  test("falls back to stdout when stderr is empty for failures", () => {
    const result: AgentResult = {
      exitCode: 1,
      stdout: "only stdout",
      stderr: "",
      timedOut: false,
      elapsed: 1000,
    }

    const comment = buildComment(result, mockIssue)
    expect(comment).toContain("only stdout")
  })
})
