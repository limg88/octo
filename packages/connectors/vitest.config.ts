import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The DWSI connector is tested against a real Postgres dressed as the warehouse. Where none is
// set up (`pnpm db:setup`), those tests are left out rather than failing on the connection.
const envFile = fileURLToPath(new URL('../../.env.local', import.meta.url))
const hasTestDatabase = Boolean(process.env.DATABASE_OWNER_URL) || existsSync(envFile)
const NEEDS_DATABASE = ['test/dwsi.test.ts']

export default defineConfig({
  test: { exclude: ['**/node_modules/**', ...(hasTestDatabase ? [] : NEEDS_DATABASE)] },
})
