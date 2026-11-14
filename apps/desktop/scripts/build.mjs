// Builds the three parts of the desktop app into dist/: main process, preload and renderer.
import { fileURLToPath } from 'node:url'
import { build as bundle } from 'esbuild'
import { build as buildRenderer } from 'vite'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const NODE_TARGET = 'node22'

const shared = {
  absWorkingDir: appRoot,
  bundle: true,
  platform: 'node',
  target: NODE_TARGET,
  // `pg-native` is an optional accelerator of `pg` that is not installed.
  external: ['electron', 'pg-native'],
  sourcemap: true,
  logLevel: 'info',
}

await bundle({
  ...shared,
  entryPoints: ['src/main/main.ts'],
  format: 'esm',
  // CommonJS libraries bundled here (the Postgres client) still call `require` for Node's own
  // modules: an ES module has none unless it is made.
  banner: {
    js: "import { createRequire as __octoCreateRequire } from 'node:module';const require = __octoCreateRequire(import.meta.url);",
  },
  outfile: 'dist/main/main.mjs',
})

// The worker thread that extracts text from Office and PDF files, started once per file.
await bundle({
  ...shared,
  entryPoints: ['../../packages/infrastructure/src/extract/worker.ts'],
  format: 'esm',
  outfile: 'dist/main/extract-worker.mjs',
})

// A sandboxed preload cannot be an ES module.
await bundle({
  ...shared,
  entryPoints: ['src/preload/preload.ts'],
  format: 'cjs',
  outfile: 'dist/preload/preload.cjs',
})

await buildRenderer({
  root: `${appRoot}src/renderer`,
  configFile: `${appRoot}vite.config.ts`,
})
