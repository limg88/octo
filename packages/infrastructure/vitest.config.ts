import { defineConfig } from 'vitest/config'

// Tests that start processes, worker threads and fake servers: slow shared machines need room.
const SLOW_MACHINE_TIMEOUT_MS = 30_000

export default defineConfig({ test: { testTimeout: SLOW_MACHINE_TIMEOUT_MS } })
