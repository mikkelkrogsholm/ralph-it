export interface LabelDef {
  name: string
  color: string
  description: string
}

export const STATE_LABELS: LabelDef[] = [
  { name: "ralph:queued", color: "0E8A16", description: "Ready for agent pickup" },
  { name: "ralph:in-progress", color: "FBCA04", description: "Agent is working on this" },
  { name: "ralph:done", color: "6F42C1", description: "Completed by agent" },
  { name: "ralph:failed", color: "D73A4A", description: "Agent failed on this" },
  { name: "ralph:blocked", color: "E4E669", description: "Needs human intervention" },
]

export const PRIORITY_LABELS: LabelDef[] = [
  { name: "priority:critical", color: "B60205", description: "Must be done immediately" },
  { name: "priority:high", color: "D93F0B", description: "Important, do soon" },
  { name: "priority:medium", color: "FBCA04", description: "Normal priority" },
  { name: "priority:low", color: "0E8A16", description: "Nice to have" },
]

export const TYPE_LABELS: LabelDef[] = [
  { name: "type:bug", color: "D73A4A", description: "Something is broken" },
  { name: "type:feature", color: "0075CA", description: "New functionality" },
  { name: "type:refactor", color: "BFD4F2", description: "Code improvement" },
  { name: "type:docs", color: "0075CA", description: "Documentation" },
  { name: "type:test", color: "1D76DB", description: "Testing" },
  { name: "type:chore", color: "EDEDED", description: "Maintenance task" },
  { name: "type:security", color: "B60205", description: "Security issue" },
  { name: "type:perf", color: "D4C5F9", description: "Performance improvement" },
  { name: "type:migration", color: "C5DEF5", description: "Migration task" },
  { name: "type:research", color: "D876E3", description: "Research and investigation" },
]

export const ALL_LABELS: LabelDef[] = [
  ...STATE_LABELS,
  ...PRIORITY_LABELS,
  ...TYPE_LABELS,
]

export const PRIORITY_ORDER: Record<string, number> = {
  "priority:critical": 0,
  "priority:high": 1,
  "priority:medium": 2,
  "priority:low": 3,
}
