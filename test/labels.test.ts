import { describe, test, expect } from "bun:test"
import {
  STATE_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  ALL_LABELS,
  PRIORITY_ORDER,
} from "../src/lib/labels"

describe("label definitions", () => {
  test("all labels have required fields", () => {
    for (const label of ALL_LABELS) {
      expect(label.name).toBeTruthy()
      expect(label.color).toBeTruthy()
      expect(label.description).toBeTruthy()
    }
  })

  test("no duplicate label names", () => {
    const names = ALL_LABELS.map((l) => l.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  test("colors are valid 6-char hex (no #)", () => {
    for (const label of ALL_LABELS) {
      expect(label.color).toMatch(/^[0-9A-Fa-f]{6}$/)
    }
  })

  test("ALL_LABELS is concatenation of all groups", () => {
    expect(ALL_LABELS.length).toBe(
      STATE_LABELS.length + PRIORITY_LABELS.length + TYPE_LABELS.length,
    )
  })

  test("state labels have correct names", () => {
    const names = STATE_LABELS.map((l) => l.name)
    expect(names).toContain("ralph:queued")
    expect(names).toContain("ralph:in-progress")
    expect(names).toContain("ralph:done")
    expect(names).toContain("ralph:failed")
    expect(names).toContain("ralph:blocked")
  })

  test("5 state labels", () => {
    expect(STATE_LABELS.length).toBe(5)
  })

  test("4 priority labels", () => {
    expect(PRIORITY_LABELS.length).toBe(4)
  })

  test("10 type labels", () => {
    expect(TYPE_LABELS.length).toBe(10)
  })

  test("19 total labels", () => {
    expect(ALL_LABELS.length).toBe(19)
  })
})

describe("PRIORITY_ORDER", () => {
  test("covers all priority labels", () => {
    for (const label of PRIORITY_LABELS) {
      expect(PRIORITY_ORDER[label.name]).toBeDefined()
    }
  })

  test("critical is highest priority (0)", () => {
    expect(PRIORITY_ORDER["priority:critical"]).toBe(0)
  })

  test("low is lowest priority (3)", () => {
    expect(PRIORITY_ORDER["priority:low"]).toBe(3)
  })

  test("priority order is correct", () => {
    expect(PRIORITY_ORDER["priority:critical"]).toBeLessThan(PRIORITY_ORDER["priority:high"])
    expect(PRIORITY_ORDER["priority:high"]).toBeLessThan(PRIORITY_ORDER["priority:medium"])
    expect(PRIORITY_ORDER["priority:medium"]).toBeLessThan(PRIORITY_ORDER["priority:low"])
  })
})
