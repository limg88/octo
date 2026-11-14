import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type MailSourceConfig, NO_SOURCES } from '@octo/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createAppleMailArchive,
  createFileVault,
  createFsMemoryWriter,
  createFsSourceSettings,
  createJsonSourceStates,
  MailFormatError,
  messageBytes,
  parseEmlx,
  type SecretCipher,
  shardOf,
} from '../src/index.ts'
import { addFakeMail, emlx } from './support/mail-folder.ts'

let root: string
const FROM = new Date('2026-11-01T00:00:00Z')
const TO = new Date('2026-11-30T00:00:00Z')
const CLIENT = 'Carla Bianchi <carla@cliente.example>'

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'octo-mail-')))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('a file of Mail', () => {
  it('is read with who wrote it, who received it and its text', async () => {
    const file = emlx(
      [
        'Message-ID: <uno@cliente.example>',
        `From: ${CLIENT}`,
        'To: PM <pm@example.test>, altri: Luca <luca@example.test>;',
        'Cc: capo@example.test',
        'Subject: Aurora:\n stato lavori',
        'Date: Tue, 10 Nov 2026 10:00:00 +0000',
        'Content-Type: text/html; charset=utf-8',
        '',
        '<p>Il collaudo &egrave; confermato.</p>',
        '',
      ].join('\n'),
    )
    const message = await parseEmlx(file)

    expect(message).toMatchObject({
      messageId: 'uno@cliente.example',
      subject: 'Aurora: stato lavori',
      from: { name: 'Carla Bianchi', email: 'carla@cliente.example' },
      cc: [{ name: '', email: 'capo@example.test' }],
      text: 'Il collaudo è confermato.',
      calendarMethod: null,
    })
    expect(message.to.map((person) => person.email)).toEqual([
      'pm@example.test',
      'luca@example.test',
    ])
    expect(message.sentAt?.toISOString()).toBe('2026-11-10T10:00:00.000Z')
  })

  it('stands without headers, and is refused when it is not what Mail writes', async () => {
    const bare = await parseEmlx(emlx('X-Vuoto: si\n\n'))
    expect(bare).toMatchObject({ messageId: null, subject: '', from: null, sentAt: null, text: '' })
    expect(() => messageBytes(new TextEncoder().encode('non una mail'))).toThrow(MailFormatError)
    expect(() => messageBytes(new TextEncoder().encode('999\ncorta'))).toThrow(MailFormatError)
  })

  it('is filed under the thousands of its number', () => {
    expect(shardOf(7)).toEqual([])
    expect(shardOf(73587)).toEqual(['3', '7'])
  })
})

describe('the archive of Mail', () => {
  it('lists what arrived in the window with its folder, and reads each message', async () => {
    const mailRoot = join(root, 'Mail')
    addFakeMail(mailRoot, [
      {
        id: 1,
        folder: 'Posta in arrivo/Clienti',
        receivedAt: new Date('2026-11-10T09:00:00Z'),
        message: { messageId: 'a@x', from: CLIENT, subject: 'Aurora: uno', text: 'Testo uno.' },
      },
      {
        id: 2,
        folder: 'Posta in arrivo',
        receivedAt: new Date('2026-10-10T09:00:00Z'),
        message: { from: CLIENT, subject: 'Vecchia', text: 'x' },
      },
      {
        id: 3,
        folder: 'Posta in arrivo',
        receivedAt: new Date('2026-11-11T09:00:00Z'),
        deleted: true,
        message: { from: CLIENT, subject: 'Cancellata', text: 'x' },
      },
      { id: 4, folder: 'Posta in arrivo', receivedAt: new Date('2026-11-12T09:00:00Z') },
      {
        id: 73587,
        folder: 'Posta in arrivo',
        receivedAt: new Date('2026-11-13T09:00:00Z'),
        partial: true,
        message: { from: CLIENT, subject: 'Aurora: parziale', text: 'Testo.' },
      },
    ])
    const archive = createAppleMailArchive(mailRoot)

    const listed = await archive.between(FROM, TO)
    expect(listed.map((mail) => [mail.id, mail.folder])).toEqual([
      ['1', 'Posta in arrivo/Clienti'],
      ['4', 'Posta in arrivo'],
      ['73587', 'Posta in arrivo'],
    ])
    const [first, missing, partial] = listed
    expect(first && (await archive.read(first))).toMatchObject({
      messageId: 'a@x',
      text: 'Testo uno.',
    })
    expect(missing && (await archive.read(missing))).toBeNull()
    expect(partial && (await archive.read(partial))).toMatchObject({ subject: 'Aurora: parziale' })
    expect(await archive.read({ id: '999', folder: 'Altrove', receivedAt: FROM })).toBeNull()

    addFakeMail(mailRoot, [
      {
        id: 5,
        folder: 'Posta in arrivo',
        receivedAt: new Date('2026-11-14T09:00:00Z'),
        message: { from: CLIENT, subject: 'Nuova', text: 'x' },
      },
    ])
    expect(await archive.between(FROM, TO)).toHaveLength(4)
  })

  it('says so when Mail keeps nothing here or the folder cannot be read', async () => {
    const empty = join(root, 'Vuota')
    await mkdir(empty)
    const unreadable = { code: 'mail_archive_unreadable' }

    await expect(createAppleMailArchive(empty).between(FROM, TO)).rejects.toMatchObject(unreadable)
    await expect(
      createAppleMailArchive(join(root, 'assente')).between(FROM, TO),
    ).rejects.toMatchObject(unreadable)
    await mkdir(join(empty, 'V10'))
    await expect(createAppleMailArchive(empty).between(FROM, TO)).rejects.toMatchObject(unreadable)
  })
})

describe('files of a project', () => {
  const mail: MailSourceConfig = {
    since: '2026-11-01',
    keywords: ['Aurora'],
    folders: [],
    excludeSenders: [],
    keepQuoted: false,
    targetFolder: 'raw/Mail',
  }

  it('writes a file of the memory once and never outside the project', async () => {
    const project = join(root, 'progetto')
    const outside = join(root, 'fuori')
    await mkdir(project)
    await mkdir(outside)
    await symlink(outside, join(project, 'link'))
    const writer = createFsMemoryWriter()

    expect(await writer.write(project, 'Posta/2026-11/a.md', 'uno')).toBe('written')
    expect(await writer.write(project, 'Posta/2026-11/a.md', 'uno')).toBe('unchanged')
    expect(await writer.write(project, 'Posta/2026-11/a.md', 'due')).toBe('written')
    expect(await readFile(join(project, 'Posta', '2026-11', 'a.md'), 'utf8')).toBe('due')
    const refused = { code: 'source_config_invalid' }
    await expect(writer.write(project, '../fuori/b.md', 'x')).rejects.toMatchObject(refused)
    await expect(writer.write(project, 'link/b.md', 'x')).rejects.toMatchObject(refused)
  })

  it('keeps the sources in the project folder and proposes where the mail goes', async () => {
    const project = join(root, 'con-fonti')
    await mkdir(project)
    const settings = createFsSourceSettings()

    expect(await settings.load(project)).toEqual(NO_SOURCES)
    // Octo's own folder, also in a vault that keeps its inbox under `raw/`.
    await mkdir(join(project, 'raw'))
    expect(await settings.suggestMailFolder(project)).toBe('_octo/posta')
    expect(await settings.suggestFeedFolder(project, 'ado')).toBe('_octo/fonti/ADO')

    await settings.save(project, { ...NO_SOURCES, mail })
    expect(await createFsSourceSettings().load(project)).toEqual({ ...NO_SOURCES, mail })
    expect(
      JSON.parse(await readFile(join(project, '_octo', '.impostazioni', 'sources.json'), 'utf8')),
    ).toEqual({
      ...NO_SOURCES,
      mail,
    })

    await writeFile(
      join(project, '_octo', '.impostazioni', 'sources.json'),
      '{"mail": {"since": 3}}',
    )
    await expect(settings.load(project)).rejects.toMatchObject({ code: 'source_config_invalid' })
    await writeFile(join(project, '_octo', '.impostazioni', 'sources.json'), '{ rotto')
    await expect(settings.load(project)).rejects.toThrow()
  })

  it('marks its own folder so git leaves it out and the search still looks inside', async () => {
    const project = join(root, 'versionato')
    await mkdir(project)
    const writer = createFsMemoryWriter()

    await writer.claim(project)
    await writer.claim(project)

    expect(await readFile(join(project, '_octo', '.gitignore'), 'utf8')).toBe('*\n')
    expect(await readFile(join(project, '_octo', '.ignore'), 'utf8')).toBe('!*\n')
  })

  it('keeps what each source did on this computer', async () => {
    const data = join(root, 'dati-fonti')
    const state = {
      cursor: '2026-11-14T10:00:00.000Z',
      lastRun: { at: '2026-11-14T10:00:00.000Z', written: 2, unchanged: 1, error: null },
    }

    expect(await createJsonSourceStates(data).get('p-1', 'mail')).toEqual({
      cursor: null,
      lastRun: null,
    })
    await createJsonSourceStates(data).set('p-1', 'mail', state)
    expect(await createJsonSourceStates(data).get('p-1', 'mail')).toEqual(state)
    await createJsonSourceStates(data).removeProject('p-1')
    expect((await createJsonSourceStates(data).get('p-1', 'mail')).cursor).toBeNull()
  })
})

describe('the vault of the credentials', () => {
  const reversed = (text: string) => [...text].reverse().join('')
  const cipher = (available = true): SecretCipher => ({
    available: () => available,
    encrypt: (value) => new TextEncoder().encode(reversed(value)),
    decrypt: (bytes) => {
      const text = new TextDecoder().decode(bytes)
      if (text.startsWith('!')) throw new Error('not mine')
      return reversed(text)
    },
  })

  it('keeps each credential encrypted and forgets it on request', async () => {
    const data = join(root, 'vault')
    const vault = createFileVault(data, cipher())

    expect(await vault.get('p-1/ado')).toBeNull()
    await vault.set('p-1/ado', 'pat-segreto')
    await vault.set('p-1/jira', 'token')
    expect(await createFileVault(data, cipher()).get('p-1/ado')).toBe('pat-segreto')
    expect(await readFile(join(data, 'secrets.json'), 'utf8')).not.toContain('pat-segreto')

    await vault.remove('p-1/ado')
    expect(await vault.get('p-1/ado')).toBeNull()
    expect(await vault.get('p-1/jira')).toBe('token')
  })

  it('saves nothing without a safe store, and ignores what it cannot read back', async () => {
    const data = join(root, 'vault-chiuso')
    await expect(createFileVault(data, cipher(false)).set('k', 'v')).rejects.toMatchObject({
      code: 'secret_store_unavailable',
    })
    await createFileVault(data, cipher()).set('k', 'v!')
    expect(await createFileVault(data, cipher()).get('k')).toBeNull()
    expect(await createFileVault(data, cipher(false)).get('k')).toBeNull()
  })
})
