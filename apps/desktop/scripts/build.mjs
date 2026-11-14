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
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
}

await bundle({
  ...shared,
  entryPoints: ['src/main/main.ts'],
  format: 'esm',
  outfile: 'dist/main/main.mjs',
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
