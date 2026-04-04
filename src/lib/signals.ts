let shuttingDown = false

export function isShuttingDown(): boolean {
  return shuttingDown
}

export function initSignalHandlers(): void {
  process.on("SIGINT", () => {
    if (shuttingDown) {
      console.error("\nForce quit.")
      process.exit(1)
    }
    shuttingDown = true
    console.log("\nGraceful shutdown... finishing current issue.")
  })

  process.on("SIGTERM", () => {
    shuttingDown = true
  })
}
