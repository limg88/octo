import { execFile, spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, posix, relative } from 'node:path'
import type { UpdateApplier } from '@octo/application'
import { DomainError } from '@octo/domain'

export type UpdateApplierConfig = {
  platform: NodeJS.Platform
  /** The executable of the Octo that is running. */
  execPath: string
  /** The process to wait for before the app is replaced. */
  pid: number
  /** Where the new app is unpacked before it takes the place of the old one. */
  workFolder: string
  /** Closes the running Octo. */
  quit: () => void
  /**
   * How the new Octo is started: by the system, as from the Finder, or directly, so that it
   * keeps the environment of the old one (a demo with its own data folder).
   */
  relaunch?: 'system' | 'direct'
  /** Starts something that outlives this process. */
  start?: ((command: string, args: string[]) => void) | undefined
}

const MAC = 'darwin'
const WINDOWS = 'win32'
const BUNDLE_SUFFIX = '.app'
const WINDOWS_INSTALLER = '.exe'
/** Places a Mac app cannot be replaced in: a mounted disk image, or where the system moved it. */
const READ_ONLY_PLACES = ['/Volumes/', '/AppTranslocation/']
const UNZIP = '/usr/bin/ditto'
const SHELL = '/bin/sh'
const SWAP_SCRIPT_NAME = 'sostituisci.sh'
/** Silent, and the app is started again when it is done: as the installer's own updater asks. */
const WINDOWS_INSTALLER_ARGS = ['/S', '--force-run']

/**
 * Waits for the old Octo to close, puts the new bundle in its place and starts it. If the new
 * one cannot be put in place the old one is put back: the PM is never left without Octo.
 * Arguments: the process to wait for, the app in place, the new app, how to start it, and its
 * executable inside the bundle.
 */
const SWAP_SCRIPT = `#!/bin/sh
waited=0
while kill -0 "$1" 2>/dev/null; do
  waited=$((waited + 1))
  [ "$waited" -gt 300 ] && exit 1
  sleep 0.2
done
old="$2.precedente"
rm -rf "$old"
if mv "$2" "$old" && mv "$3" "$2"; then
  rm -rf "$old"
elif [ -d "$old" ] && [ ! -d "$2" ]; then
  mv "$old" "$2"
fi
if [ "$4" = direct ]; then
  exec "$2/$5"
fi
exec /usr/bin/open "$2"
`

const notInstallable = (why: string): DomainError => new DomainError('update_not_installable', why)

const startDetached = (command: string, args: string[]): void => {
  spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

const run = (command: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile(command, args, (error) => (error ? reject(error) : resolve()))
  })

/**
 * `/Applications/Octo.app/Contents/MacOS/Octo` gives `/Applications/Octo.app`. A bundle is a
 * thing of the Mac: its path is read as a Mac writes it, whatever system this code runs on.
 */
export function bundleOf(execPath: string): string | null {
  const parts = execPath.split(posix.sep)
  const at = parts.findIndex((part) => part.endsWith(BUNDLE_SUFFIX))
  return at < 0 ? null : parts.slice(0, at + 1).join(posix.sep)
}

/** Replaces the running Octo with a downloaded one: a zipped app on a Mac, an installer on Windows. */
export function createUpdateApplier(config: UpdateApplierConfig): UpdateApplier {
  const start = config.start ?? startDetached

  async function applyOnMac(filePath: string): Promise<void> {
    const bundle = bundleOf(config.execPath)
    if (bundle === null) throw notInstallable('not a bundle')
    if (READ_ONLY_PLACES.some((place) => bundle.includes(place))) {
      throw notInstallable('read-only place')
    }
    try {
      await access(dirname(bundle), constants.W_OK)
    } catch {
      throw notInstallable('folder not writable')
    }
    const staging = join(config.workFolder, 'nuovo')
    await rm(staging, { recursive: true, force: true })
    await mkdir(staging, { recursive: true })
    try {
      await run(UNZIP, ['-x', '-k', filePath, staging])
    } catch {
      throw notInstallable('not an archive')
    }
    const unpacked = (await readdir(staging)).find((name) => name.endsWith(BUNDLE_SUFFIX))
    if (!unpacked) throw notInstallable('no app inside')
    const script = join(config.workFolder, SWAP_SCRIPT_NAME)
    await writeFile(script, SWAP_SCRIPT, { mode: 0o700 })
    start(SHELL, [
      script,
      String(config.pid),
      bundle,
      join(staging, unpacked),
      config.relaunch ?? 'system',
      relative(bundle, config.execPath),
    ])
    config.quit()
  }

  async function applyOnWindows(filePath: string): Promise<void> {
    if (!filePath.toLowerCase().endsWith(WINDOWS_INSTALLER))
      throw notInstallable('not an installer')
    start(filePath, WINDOWS_INSTALLER_ARGS)
    config.quit()
  }

  return {
    async apply(filePath) {
      if (config.platform === MAC) return applyOnMac(filePath)
      if (config.platform === WINDOWS) return applyOnWindows(filePath)
      throw notInstallable(config.platform)
    },
  }
}
