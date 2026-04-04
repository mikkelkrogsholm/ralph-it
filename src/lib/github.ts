import type { LabelDef } from "./labels"

export interface RepoContext {
  name: string
  owner: { login: string }
  description: string
  languages: Array<{ name: string; percentage: number }>
}

export interface Issue {
  number: number
  title: string
  body: string
  labels: Array<{ name: string }>
  comments: Array<{ author: { login: string }; body: string }>
  milestone?: { title: string } | null
  createdAt?: string
  updatedAt?: string
}

export interface IssueListOpts {
  labels?: string[]
  milestone?: string
  limit?: number
  state?: "open" | "closed" | "all"
}

interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function exec(args: string[]): Promise<ExecResult> {
  const proc = Bun.spawn(["gh", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
}

export async function checkAuth(): Promise<{ authenticated: boolean; username: string }> {
  const result = await exec(["auth", "status"])
  if (result.exitCode !== 0) {
    return { authenticated: false, username: "" }
  }
  const match = result.stdout.match(/Logged in to .+ as (\S+)/) ??
    result.stderr.match(/Logged in to .+ as (\S+)/)
  return { authenticated: true, username: match?.[1] ?? "unknown" }
}

export async function getRepoContext(): Promise<RepoContext> {
  const result = await exec([
    "repo", "view",
    "--json", "name,owner,description,languages",
  ])

  if (result.exitCode !== 0) {
    throw new Error(`Failed to get repo info: ${result.stderr}`)
  }

  return JSON.parse(result.stdout)
}

export async function listIssues(opts: IssueListOpts = {}): Promise<Issue[]> {
  const args = [
    "issue", "list",
    "--json", "number,title,body,labels,comments,milestone,createdAt,updatedAt",
    "--limit", String(opts.limit ?? 50),
    "--state", opts.state ?? "open",
  ]

  if (opts.labels) {
    for (const label of opts.labels) {
      args.push("--label", label)
    }
  }

  if (opts.milestone) {
    args.push("--milestone", opts.milestone)
  }

  const result = await exec(args)

  if (result.exitCode !== 0) {
    throw new Error(`Failed to list issues: ${result.stderr}`)
  }

  return JSON.parse(result.stdout)
}

export async function getIssue(number: number): Promise<Issue> {
  const result = await exec([
    "issue", "view", String(number),
    "--json", "number,title,body,labels,comments,milestone,createdAt,updatedAt",
  ])

  if (result.exitCode !== 0) {
    throw new Error(`Failed to get issue #${number}: ${result.stderr}`)
  }

  return JSON.parse(result.stdout)
}

export async function updateIssueLabels(
  number: number,
  add: string[],
  remove: string[],
): Promise<void> {
  const args = ["issue", "edit", String(number)]

  for (const label of add) {
    args.push("--add-label", label)
  }
  for (const label of remove) {
    args.push("--remove-label", label)
  }

  const result = await exec(args)

  if (result.exitCode !== 0) {
    throw new Error(`Failed to update labels on #${number}: ${result.stderr}`)
  }
}

export async function commentOnIssue(number: number, body: string): Promise<void> {
  // Write body to temp file to avoid ARG_MAX limits with large comments
  const tmpFile = `/tmp/ralph-comment-${number}-${Date.now()}.md`
  await Bun.write(tmpFile, body)

  try {
    const result = await exec([
      "issue", "comment", String(number),
      "--body-file", tmpFile,
    ])

    if (result.exitCode !== 0) {
      throw new Error(`Failed to comment on #${number}: ${result.stderr}`)
    }
  } finally {
    try {
      const { unlinkSync } = await import("fs")
      unlinkSync(tmpFile)
    } catch { /* cleanup best-effort */ }
  }
}

export async function closeIssue(number: number): Promise<void> {
  const result = await exec([
    "issue", "close", String(number),
    "--reason", "completed",
  ])

  if (result.exitCode !== 0) {
    throw new Error(`Failed to close #${number}: ${result.stderr}`)
  }
}

export async function createLabel(label: LabelDef): Promise<void> {
  const result = await exec([
    "label", "create", label.name,
    "--color", label.color,
    "--description", label.description,
    "--force",
  ])

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create label ${label.name}: ${result.stderr}`)
  }
}

export async function listLabels(): Promise<Array<{ name: string; color: string; description: string }>> {
  const result = await exec([
    "label", "list",
    "--json", "name,color,description",
    "--limit", "100",
  ])

  if (result.exitCode !== 0) {
    throw new Error(`Failed to list labels: ${result.stderr}`)
  }

  return JSON.parse(result.stdout)
}
