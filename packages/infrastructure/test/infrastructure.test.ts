import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentProgress } from '@octo/application'
import { type Backup, HISTORY_FOLDER, type Project, type QuestionRecord } from '@octo/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  CLAUDE_PATH_VARIABLE,
  createClaudeCliRunner,
  createFsEvidenceReader,
  createFsFolderProbe,
  createJsonBackupFiles,
  createJsonPreferences,
  createJsonProjectRegistry,
  createJsonQuestionLog,
  createJsonSetAsideProjects,
  locateClaude,
  shellPath,
  withShellPath,
} from '../src/index.ts'

const FAKE_CLAUDE = fileURLToPath(new URL('./fake-claude.mjs', import.meta.url))
const STATE_TEXT = 'La consegna è fissata al 12 dicembre 2026.'

let root: string
let project: string
let outside: string

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'octo-infra-')))
  project = join(root, 'progetto')
  outside = join(root, 'fuori')
  await mkdir(join(project, 'wiki'), { recursive: true })
  await mkdir(outside)
  await writeFile(join(project, 'wiki', 'stato.md'), STATE_TEXT)
  await writeFile(join(outside, 'segreto.md'), 'non del progetto')
  await symlink(join(outside, 'segreto.md'), join(project, 'wiki', 'link.md'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

function runner(overrides: { env?: Record<string, string>; askTimeoutMs?: number } = {}) {
  return createClaudeCliRunner({
    command: process.execPath,
    prefixArgs: [FAKE_CLAUDE],
    env: { ...process.env, ...overrides.env },
    ...(overrides.askTimeoutMs ? { askTimeoutMs: overrides.askTimeoutMs } : {}),
  })
}

describe('claude cli runner', () => {
  it('reports the version of the installed agent', async () => {
    expect(await runner().status()).toEqual({ available: true, version: '9.9.9 (Fake Claude)' })
  })

  it('says the agent is not installed when the executable is missing', async () => {
    const missing = createClaudeCliRunner({ command: join(root, 'no-claude'), env: {} })

    expect(await missing.status()).toEqual({ available: false, reason: 'not_installed' })
    await expect(missing.ask({ projectFolder: project, question: 'x' })).rejects.toMatchObject({
      code: 'agent_not_installed',
    })
  })

  it('returns the draft and tells what the agent is doing', async () => {
    const progress: AgentProgress[] = []
    const draft = await runner().ask({
      projectFolder: project,
      question: 'Quando consegniamo?',
      onProgress: (step) => progress.push(step),
    })

    expect(draft.citations).toEqual([
      { n: 1, path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026' },
    ])
    expect(progress).toEqual([
      { kind: 'searching', target: 'consegna' },
      { kind: 'listing', target: '**/*.md' },
      { kind: 'reading', target: join('wiki', 'stato.md') },
      { kind: 'writing', target: '' },
    ])
  })

  it('uses the model it is asked for, or the default of the seat, and says which', async () => {
    const used: string[] = []
    const onModel = (model: string) => used.push(model)
    const request = { projectFolder: project, question: 'Quando consegniamo?', onModel }
    await runner().ask(request)
    await runner().ask({ ...request, model: null })
    await runner().ask({ ...request, model: 'sonnet' })
    expect(used).toEqual(['claude-fake-default', 'claude-fake-default', 'claude-sonnet-fake'])
  })

  it('runs on the seat of the PM, confined to the project and without connectors', async () => {
    const draft = await runner({
      env: { ANTHROPIC_API_KEY: 'k', CLAUDE_CODE_OAUTH_TOKEN: 't', CLAUDECODE: '1' },
    }).ask({ projectFolder: project, question: '#ambiente' })

    expect(draft.missing).toEqual(['rules:false', 'args:true'])
  })

  it('binds the answer to the rules the PM wrote for the project', async () => {
    const withRules = join(root, 'con-regole')
    await mkdir(withRules)
    await writeFile(join(withRules, 'CLAUDE.md'), 'REGOLA-DI-PROVA: niente numeri oltre 72 ore.')

    const draft = await runner().ask({ projectFolder: withRules, question: '#ambiente' })

    expect(draft.missing).toContain('rules:true')
  })

  it('maps the failures to codes a PM can be told', async () => {
    const ask = (question: string) => runner().ask({ projectFolder: project, question })

    await expect(ask('#accesso')).rejects.toMatchObject({ code: 'agent_not_signed_in' })
    await expect(ask('#rotto')).rejects.toMatchObject({ code: 'agent_failed' })
    await expect(ask('#limite')).rejects.toMatchObject({ code: 'agent_limit_reached' })
    await expect(ask('#forma')).rejects.toMatchObject({ code: 'agent_output_invalid' })
  })

  it('stops when the PM cancels and when the time is over', async () => {
    const controller = new AbortController()
    const cancelled = runner().ask({
      projectFolder: project,
      question: '#lento',
      signal: controller.signal,
    })
    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ code: 'agent_cancelled' })

    const slow = runner({ askTimeoutMs: 200 }).ask({ projectFolder: project, question: '#lento' })
    await expect(slow).rejects.toMatchObject({ code: 'agent_failed' })
  })
})

describe('locateClaude', () => {
  const base = { env: {}, home: '/home/paola', exists: () => false }

  it('prefers the configured path, then a usual install place, then the PATH', () => {
    const configured = { ...base, env: { [CLAUDE_PATH_VARIABLE]: '/custom/claude' } }
    expect(locateClaude({ ...configured, platform: 'darwin' })).toBe('/custom/claude')
    expect(
      locateClaude({ ...base, platform: 'darwin', exists: (path) => path.startsWith('/opt') }),
    ).toBe('/opt/homebrew/bin/claude')
    expect(locateClaude({ ...base, platform: 'linux' })).toBe('claude')
  })

  it('finds Claude in a folder of the PATH before the usual places', () => {
    const env = { PATH: '/usr/bin:/home/paola/.nvm/versions/node/v24/bin' }
    const found = locateClaude({
      ...base,
      env,
      platform: 'darwin',
      exists: (path) => path.includes('.nvm') || path.startsWith('/opt'),
    })
    expect(found).toBe('/home/paola/.nvm/versions/node/v24/bin/claude')
  })

  it('looks for the native executable on Windows', () => {
    const found = locateClaude({ ...base, platform: 'win32', exists: () => true })
    expect(found.endsWith('claude.exe')).toBe(true)
    // The PATH and the paths are read as Windows writes them, whatever system the test runs on.
    const onPath = locateClaude({
      ...base,
      platform: 'win32',
      env: { PATH: 'C:\\Windows;C:\\Users\\paola\\bin' },
      exists: (path) => path.includes('paola'),
    })
    expect(onPath).toBe('C:\\Users\\paola\\bin\\claude.exe')
  })
})

describe('shellPath', () => {
  const env = { SHELL: '/bin/zsh', PATH: '/usr/bin:/bin' }

  it('reads the PATH of the login shell between its marks, whatever the profile prints', async () => {
    const asked: string[] = []
    const found = await shellPath({
      platform: 'darwin',
      env,
      run: async (shell, args) => {
        asked.push(shell, ...args.slice(0, 1))
        return 'welcome\n__OCTO_PATH__/home/paola/.nvm/bin:/usr/bin__OCTO_PATH__'
      },
    })
    expect(found).toBe('/home/paola/.nvm/bin:/usr/bin')
    expect(asked).toEqual(['/bin/zsh', '-ilc'])
  })

  it('gives nothing on Windows, when the shell fails, or when it answers nothing', async () => {
    const never = async () => {
      throw new Error('not asked')
    }
    expect(await shellPath({ platform: 'win32', env, run: never })).toBeNull()
    expect(await shellPath({ platform: 'linux', env, run: never })).toBeNull()
    expect(await shellPath({ platform: 'linux', env: {}, run: async () => 'no marks' })).toBeNull()
  })

  it('asks the real shell when no other way is given', async () => {
    const found = await shellPath({ platform: process.platform, env: { SHELL: '/bin/sh' } })
    if (process.platform !== 'win32') expect(found).toContain('/')
  })

  it('puts the folders of the shell before those of the app, each once', () => {
    expect(withShellPath(env, null)).toBe(env)
    expect(withShellPath(env, '/home/paola/.nvm/bin:/usr/bin').PATH).toBe(
      '/home/paola/.nvm/bin:/usr/bin:/bin',
    )
  })
})

describe('evidence reader', () => {
  const reader = createFsEvidenceReader()

  it('reads a cited file by relative or absolute path', async () => {
    const relative = await reader.read(project, 'wiki/stato.md')
    expect(relative).toMatchObject({ kind: 'found', text: STATE_TEXT })
    expect(await reader.read(project, join(project, 'wiki', 'stato.md'))).toEqual(relative)
  })

  it('never leaves the project folder, not even through a link', async () => {
    expect(await reader.read(project, '../fuori/segreto.md')).toEqual({ kind: 'outside' })
    expect(await reader.read(project, 'wiki/link.md')).toEqual({ kind: 'outside' })
    expect(await reader.read(project, '../fuori/assente.md')).toEqual({ kind: 'outside' })
  })

  it('says when a cited file is too large to check', async () => {
    const tiny = createFsEvidenceReader(STATE_TEXT.length - 1)
    expect(await tiny.read(project, 'wiki/stato.md')).toEqual({ kind: 'too_large' })
  })

  it('reports a missing file and refuses a folder', async () => {
    expect(await reader.read(project, 'wiki/assente.md')).toEqual({ kind: 'missing' })
    expect(await reader.read(project, 'wiki')).toEqual({ kind: 'missing' })
  })
})

describe('json stores', () => {
  const sample: Project = { id: 'p-1', name: 'Aurora', folder: '/a', addedAt: '2026-11-14' }
  const record: QuestionRecord = {
    id: 'q-1',
    projectId: 'p-1',
    question: 'Quando?',
    askedAt: '2026-11-14T08:00:00.000Z',
    durationMs: 10,
    answer: {
      text: 'Il 12 [1].',
      citations: [{ n: 1, path: 'a.md', quote: 'q', status: 'verified', modifiedAt: null }],
      missing: [],
      markersWithoutCitation: [],
    },
    error: null,
  }

  it('keeps projects and questions across restarts', async () => {
    const data = join(root, 'dati')
    expect(await createJsonProjectRegistry(data).list()).toEqual([])

    await createJsonProjectRegistry(data).save([sample])
    expect(await createJsonProjectRegistry(data).list()).toEqual([sample])
  })

  it('keeps what the person set for the app, and knows nothing before it is set', async () => {
    const data = join(root, 'dati-preferenze')
    expect(await createJsonPreferences(data).load()).toBeNull()

    await createJsonPreferences(data).save({ theme: 'dark' })
    expect(await createJsonPreferences(data).load()).toEqual({ theme: 'dark' })
  })

  it('keeps the projects taken off the list apart from the list', async () => {
    const data = join(root, 'dati-tolti')
    expect(await createJsonSetAsideProjects(data).list()).toEqual([])

    await createJsonSetAsideProjects(data).save([sample])
    expect(await createJsonSetAsideProjects(data).list()).toEqual([sample])
    expect(await createJsonProjectRegistry(data).list()).toEqual([])
  })

  it('keeps the questions of a person with the app, out of the folder other people open', async () => {
    const folder = join(root, 'con-domande')
    const data = join(root, 'dati-domande')
    await mkdir(folder)
    const here: Project = { ...sample, folder }
    const log = () => createJsonQuestionLog(data, async (asked) => (asked === folder ? here : null))
    expect(await log().list(folder)).toEqual([])

    await log().append(folder, record)
    await log().append(folder, { ...record, id: 'q-2', answer: null, error: 'agent_failed' })

    expect((await log().list(folder)).map((question) => question.id)).toEqual(['q-1', 'q-2'])
    expect(await readdir(folder)).toEqual([])
    // A citation of an earlier answer is never verified: there is nothing of it in the folder.
    const cited = await createFsEvidenceReader().read(folder, `${HISTORY_FOLDER}/domande.json`)
    expect(cited).toEqual({ kind: 'missing' })
  })

  it('takes out of a shared folder only the questions this computer asked', async () => {
    const folder = join(root, 'domande-di-due')
    const legacy = join(folder, HISTORY_FOLDER, 'domande.json')
    await mkdir(join(folder, HISTORY_FOLDER), { recursive: true })
    const mine = { ...record, id: 'q-mia' }
    const hers = { ...record, id: 'q-sua', projectId: 'p-di-un-altro-computer' }
    await writeFile(legacy, JSON.stringify([mine, hers]))
    const here: Project = { ...sample, folder }
    const log = createJsonQuestionLog(join(root, 'dati-di-due'), async () => here)

    expect((await log.list(folder)).map((question) => question.id)).toEqual(['q-mia'])
    expect(JSON.parse(await readFile(legacy, 'utf8'))).toEqual([hers])

    // The other computer takes its own: nothing personal is left in the folder.
    const there: Project = { ...sample, id: 'p-di-un-altro-computer', folder }
    const other = createJsonQuestionLog(join(root, 'dati-dell-altra'), async () => there)
    expect((await other.list(folder)).map((question) => question.id)).toEqual(['q-sua'])
    await expect(readFile(legacy, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('writes a backup and reads it back, and refuses what is not one', async () => {
    const files = createJsonBackupFiles()
    const file = join(root, 'copie', 'octo-copia.json')
    const backup: Backup = {
      format: 'octo-backup',
      version: 1,
      createdAt: '2026-11-15T08:00:00.000Z',
      projects: [
        {
          project: sample,
          sources: { mail: { cursor: '2026-11-10T00:00:00.000Z', lastRun: null } },
          feeds: { jira: { scope: 'AUR', items: { 'AUR-1': { version: '1', path: 'a.md' } } } },
        },
      ],
    }

    await files.write(file, backup)
    expect(await files.read(file)).toEqual(backup)

    const other = join(root, 'non-una-copia.json')
    await writeFile(other, '{"format":"altro"}')
    await expect(files.read(other)).rejects.toMatchObject({ code: 'backup_invalid' })
    await writeFile(other, 'non è json')
    await expect(files.read(other)).rejects.toMatchObject({ code: 'backup_invalid' })
    await expect(files.read(join(root, 'manca.json'))).rejects.toMatchObject({
      code: 'backup_invalid',
    })
    // The folder of the project is a folder: nothing can be written over it.
    await expect(files.write(project, backup)).rejects.toMatchObject({
      code: 'backup_not_written',
    })
  })

  it('fails loudly on a damaged state file', async () => {
    const data = join(root, 'danneggiato')
    await mkdir(data)
    await writeFile(join(data, 'projects.json'), '{ not json')
    await expect(createJsonProjectRegistry(data).list()).rejects.toThrow()
  })

  it('tells a readable folder from a file and from nothing', async () => {
    const probe = createFsFolderProbe()
    expect(await probe.isReadableFolder(project)).toBe(true)
    expect(await probe.isReadableFolder(join(project, 'wiki', 'stato.md'))).toBe(false)
    expect(await probe.isReadableFolder(join(root, 'assente'))).toBe(false)
  })
})
