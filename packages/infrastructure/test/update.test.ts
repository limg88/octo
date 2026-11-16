import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  bundleOf,
  createGithubReleaseFeed,
  createHttpDownloads,
  createUpdateApplier,
  UPDATE_USER_AGENT,
} from '../src/index.ts'

const REPOSITORY = 'limg88/octo'
const PACKAGE = Buffer.from('il pacchetto di Octo, per finta: '.repeat(4000))
const MAC = process.platform === 'darwin'

let folder: string
let server: Server
let base: string
/** What the fake publisher answers next for the latest release. */
let latest: { status: number; body: unknown } = { status: 404, body: {} }
const seen: Array<{ url: string; agent: string }> = []

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'octo-update-'))
  server = createServer((request, response) => {
    seen.push({ url: request.url ?? '', agent: request.headers['user-agent'] ?? '' })
    if (request.url === `/repos/${REPOSITORY}/releases/latest`) {
      response.writeHead(latest.status, { 'content-type': 'application/json' })
      return response.end(JSON.stringify(latest.body))
    }
    if (request.url === '/files/Octo.zip') {
      response.writeHead(200, { 'content-length': PACKAGE.length })
      return response.end(PACKAGE)
    }
    if (request.url === '/files/SHA256SUMS') return response.end('abc  Octo.zip\n')
    if (request.url === '/files/cut') {
      response.writeHead(200, { 'content-length': 1000 })
      response.write('solo un pezzo')
      return response.destroy()
    }
    response.writeHead(500)
    response.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await rm(folder, { recursive: true, force: true })
})

describe('the releases of Octo', () => {
  const feed = () => createGithubReleaseFeed({ repository: REPOSITORY, baseUrl: base })

  it('reads the latest release with its files, saying only what is asking', async () => {
    latest = {
      status: 200,
      body: {
        tag_name: 'v1.4.0',
        body: 'Novità.',
        assets: [
          { name: 'Octo.zip', browser_download_url: `${base}/files/Octo.zip`, size: 12 },
          { name: 'sicuro.zip', browser_download_url: 'https://example.test/sicuro.zip' },
          // A file served in clear from somewhere else is not taken.
          { name: 'altrove.zip', browser_download_url: 'http://example.test/altrove.zip' },
          { name: 'rotto.zip', browser_download_url: 'non un indirizzo' },
          { name: 7 },
          'non un file',
        ],
      },
    }
    expect(await feed().latest()).toEqual({
      version: 'v1.4.0',
      notes: 'Novità.',
      assets: [
        { name: 'Octo.zip', url: `${base}/files/Octo.zip`, size: 12 },
        { name: 'sicuro.zip', url: 'https://example.test/sicuro.zip', size: 0 },
      ],
    })
    expect(seen.at(-1)).toEqual({
      url: `/repos/${REPOSITORY}/releases/latest`,
      agent: UPDATE_USER_AGENT,
    })
  })

  it('says there is none yet, and fails on an answer it cannot read', async () => {
    latest = { status: 404, body: {} }
    expect(await feed().latest()).toBeNull()
    latest = { status: 500, body: {} }
    await expect(feed().latest()).rejects.toThrow('releases: 500')
    latest = { status: 200, body: { assets: 'nessuno' } }
    await expect(feed().latest()).rejects.toThrow('no version')
    latest = { status: 200, body: { tag_name: 'v2.0.0' } }
    expect(await feed().latest()).toEqual({ version: 'v2.0.0', notes: '', assets: [] })
  })
})

describe('the files of a release', () => {
  const downloads = () => createHttpDownloads({ folder: join(folder, 'scaricati') })

  it('brings a file down, counting and hashing what arrives, under its own name only', async () => {
    const steps: number[] = []
    const file = await downloads().file(
      { name: '../../fuori/Octo.zip', url: `${base}/files/Octo.zip`, size: 0 },
      (step) => steps.push(step.received),
    )
    expect(file.path).toBe(join(folder, 'scaricati', 'Octo.zip'))
    expect(readFileSync(file.path)).toEqual(PACKAGE)
    expect(file.sha256).toBe(createHash('sha256').update(PACKAGE).digest('hex'))
    expect(steps.at(-1)).toBe(PACKAGE.length)
  })

  it('reads a small text, and leaves nothing behind of a download that fails', async () => {
    const text = await downloads().text({
      name: 'SHA256SUMS',
      url: `${base}/files/SHA256SUMS`,
      size: 0,
    })
    expect(text).toBe('abc  Octo.zip\n')
    await expect(
      downloads().text({ name: 'x', url: `${base}/files/manca`, size: 0 }),
    ).rejects.toThrow('download: 500')
    await expect(
      downloads().file({ name: 'tagliato.zip', url: `${base}/files/cut`, size: 0 }),
    ).rejects.toThrow()
    expect(existsSync(join(folder, 'scaricati', 'tagliato.zip'))).toBe(false)
    await expect(
      downloads().file({ name: 'enorme.zip', url: `${base}/files/Octo.zip`, size: 2 ** 31 }),
    ).rejects.toThrow('too large')
  })
})

describe('putting a new Octo in place of the running one', () => {
  const started: Array<{ command: string; args: string[] }> = []
  const applier = (config: Partial<Parameters<typeof createUpdateApplier>[0]> = {}) => {
    let quit = 0
    const made = createUpdateApplier({
      platform: 'darwin',
      execPath: '/Applications/Octo.app/Contents/MacOS/Octo',
      pid: 1,
      workFolder: join(folder, 'lavoro'),
      quit: () => {
        quit += 1
      },
      start: (command, args) => started.push({ command, args }),
      ...config,
    })
    return { ...made, quits: () => quit }
  }

  it('finds the bundle an executable belongs to', () => {
    expect(bundleOf('/Applications/Octo.app/Contents/MacOS/Octo')).toBe('/Applications/Octo.app')
    expect(bundleOf('/usr/local/bin/octo')).toBeNull()
  })

  it('refuses where an app cannot be replaced: no bundle, a disk image, another system', async () => {
    const refused = { code: 'update_not_installable' }
    await expect(applier({ execPath: '/usr/bin/octo' }).apply('x.zip')).rejects.toMatchObject(
      refused,
    )
    await expect(
      applier({ execPath: '/Volumes/Octo 1.0/Octo.app/Contents/MacOS/Octo' }).apply('x.zip'),
    ).rejects.toMatchObject(refused)
    await expect(
      applier({ execPath: '/non/esiste/Octo.app/Contents/MacOS/Octo' }).apply('x.zip'),
    ).rejects.toMatchObject(refused)
    await expect(applier({ platform: 'linux' }).apply('x.zip')).rejects.toMatchObject(refused)
    await expect(applier({ platform: 'win32' }).apply('x.zip')).rejects.toMatchObject(refused)
  })

  it('starts the installer on Windows, silent, and closes', async () => {
    started.length = 0
    const windows = applier({ platform: 'win32' })
    await windows.apply('C:\\Temp\\Octo-1.4.0-win-x64.exe')
    expect(started).toEqual([
      { command: 'C:\\Temp\\Octo-1.4.0-win-x64.exe', args: ['/S', '--force-run'] },
    ])
    expect(windows.quits()).toBe(1)
  })

  /** A folder that stands for an app: its executable says which version it is. */
  function fakeApp(at: string, version: string): string {
    const bundle = join(at, 'Octo.app')
    mkdirSync(join(bundle, 'Contents', 'MacOS'), { recursive: true })
    const executable = join(bundle, 'Contents', 'MacOS', 'Octo')
    writeFileSync(executable, `#!/bin/sh\necho ${version} > "${join(folder, 'avviato.txt')}"\n`)
    chmodSync(executable, 0o755)
    return bundle
  }

  it.runIf(MAC)(
    'unpacks the new app, waits for the old one to close, swaps them and starts it',
    async () => {
      const installed = fakeApp(join(folder, 'Applicazioni'), '1.3.0')
      const packed = join(folder, 'Octo-1.4.0-mac-arm64.zip')
      execFileSync('/usr/bin/ditto', [
        '-c',
        '-k',
        '--keepParent',
        fakeApp(join(folder, 'nuova'), '1.4.0'),
        packed,
      ])
      // The "running Octo": a process that closes a moment after it is told to.
      const running = spawn('/bin/sleep', ['30'])
      const real = applier({
        execPath: join(installed, 'Contents', 'MacOS', 'Octo'),
        pid: running.pid ?? 0,
        relaunch: 'direct',
        start: undefined,
        quit: () => setTimeout(() => running.kill(), 300),
      })
      await real.apply(packed)

      const marker = join(folder, 'avviato.txt')
      const deadline = Date.now() + 15_000
      while (!existsSync(marker) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      // The app in place is the new one, it was started, and nothing of the old one is left about.
      expect(readFileSync(marker, 'utf8').trim()).toBe('1.4.0')
      expect(readFileSync(join(installed, 'Contents', 'MacOS', 'Octo'), 'utf8')).toContain('1.4.0')
      expect(existsSync(`${installed}.precedente`)).toBe(false)
    },
  )

  it.runIf(MAC)('refuses a file that is not a zipped app', async () => {
    const installed = fakeApp(join(folder, 'Altre'), '1.3.0')
    const notZip = join(folder, 'non-uno-zip.zip')
    writeFileSync(notZip, 'testo')
    const execPath = join(installed, 'Contents', 'MacOS', 'Octo')
    await expect(applier({ execPath }).apply(notZip)).rejects.toMatchObject({
      code: 'update_not_installable',
    })
    const empty = join(folder, 'vuoto.zip')
    mkdirSync(join(folder, 'solo-testo'), { recursive: true })
    writeFileSync(join(folder, 'solo-testo', 'leggimi.txt'), 'niente app')
    execFileSync('/usr/bin/ditto', ['-c', '-k', join(folder, 'solo-testo'), empty])
    await expect(applier({ execPath }).apply(empty)).rejects.toMatchObject({
      code: 'update_not_installable',
    })
  })
})
