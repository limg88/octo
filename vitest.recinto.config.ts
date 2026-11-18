import { defineConfig } from 'vitest/config'

/**
 * The hostile test of the fence: real Claude Code on the seat of who runs it, real sandbox.
 * Kept out of the suite (`pnpm test`): run it with `pnpm test:recinto`.
 */
export default defineConfig({
  test: { include: ['packages/infrastructure/recinto/**/*.recinto.ts'], fileParallelism: false },
})
