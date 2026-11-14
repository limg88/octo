import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/desktop'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.{ts,tsx}'],
      // Composition root and Electron wiring (main process, preload, renderer entry) are exercised
      // by the demo, not by unit tests.
      exclude: [
        '**/index.ts',
        'apps/desktop/src/main/**',
        'apps/desktop/src/preload/**',
        'apps/desktop/src/renderer/main.tsx',
      ],
      reporter: ['text-summary', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
