import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createClaudeMeetingReader } from '../src/index.ts'

const here = fileURLToPath(new URL('.', import.meta.url))

describe('Claude as the one who reads the meetings of a day', () => {
  const folder = mkdtempSync(join(tmpdir(), 'octo-chiusura-'))
  const meeting = '_octo/riunioni/2026-11-16_sal'
  mkdirSync(join(folder, meeting), { recursive: true })
  writeFileSync(
    join(folder, meeting, 'report.md'),
    [
      '# SAL',
      '',
      '- Ambiente di prova: consegnato questa mattina da Luca.',
      '- Stima della migrazione: Mario la rivede entro giovedì.',
      '- Azione: Mandare al cliente il piano di rilascio (Anna Bianchi) entro 2026-11-19.',
      '- Azione: Verificare le licenze.',
    ].join('\n'),
  )
  const reader = createClaudeMeetingReader({
    command: process.execPath,
    prefixArgs: [join(here, 'fake-claude.mjs')],
    env: process.env,
  })
  const report = `${meeting}/report.md`
  const read = { title: 'SAL', started: '2026-11-16T09:00:00.000Z', files: [report, 'manca.md'] }

  it('says which points a meeting closed, which it talked about and which it opened', async () => {
    const models: string[] = []
    const closing = await reader.closing({
      projectFolder: folder,
      day: '2026-11-16',
      points: [
        { id: 'a', title: 'Ambiente di prova', owner: 'Luca', due: null },
        { id: 'b', title: 'Stima della migrazione', owner: 'Mario', due: '2026-11-18' },
        { id: 'c', title: 'Nessuno ne parla', owner: '', due: null },
      ],
      meetings: [read],
      onModel: (model) => models.push(model),
    })
    expect(closing.verdicts).toEqual([
      {
        id: 'a',
        outcome: 'resolved',
        said: 'Ambiente di prova: consegnato questa mattina da Luca.',
        path: report,
        quote: '- Ambiente di prova: consegnato questa mattina da Luca.',
      },
      {
        id: 'b',
        outcome: 'open',
        said: 'Stima della migrazione: Mario la rivede entro giovedì.',
        path: report,
        quote: '- Stima della migrazione: Mario la rivede entro giovedì.',
      },
    ])
    expect(closing.points).toEqual([
      {
        title: 'Mandare al cliente il piano di rilascio',
        owner: 'Anna Bianchi',
        due: '2026-11-19',
        path: report,
        quote: '- Azione: Mandare al cliente il piano di rilascio (Anna Bianchi) entro 2026-11-19.',
      },
      {
        title: 'Verificare le licenze',
        owner: '',
        due: null,
        path: report,
        quote: '- Azione: Verificare le licenze.',
      },
    ])
    expect(models).toEqual(['claude-fake-default'])
  })

  it('says what to bring to a meeting, with words of the files it was given', async () => {
    writeFileSync(
      join(folder, 'mail.md'),
      [
        '---',
        'tipo: "email"',
        '---',
        '',
        '# Aurora',
        '',
        'Mi confermi il budget entro venerdì?',
      ].join('\n'),
    )
    const card = {
      key: 'meeting:sal:1',
      subject: 'SAL',
      start: '2026-11-17T09:00:00.000Z',
      attendees: ['Carla <carla@cliente.example>'],
      points: [],
      lastFiles: [report],
      mails: ['mail.md'],
    }
    const notes = await reader.prep({
      projectFolder: folder,
      day: '2026-11-17',
      meetings: [card, { ...card, key: 'meeting:altra:1', lastFiles: [], mails: [] }],
    })
    expect(notes).toEqual([
      {
        key: 'meeting:sal:1',
        text: expect.stringMatching(/^Chiedi/),
        path: report,
        quote: '- Ambiente di prova: consegnato questa mattina da Luca.',
      },
      {
        key: 'meeting:sal:1',
        text: expect.stringMatching(/^Preparati/),
        path: 'mail.md',
        quote: 'Mi confermi il budget entro venerdì?',
      },
    ])
    expect(await reader.prep({ projectFolder: folder, day: '2026-11-17', meetings: [] })).toEqual(
      [],
    )
  })

  it('is not asked when there is no meeting to read', async () => {
    const closing = await reader.closing({
      projectFolder: folder,
      day: '2026-11-16',
      points: [{ id: 'a', title: 'Ambiente di prova', owner: '', due: null }],
      meetings: [],
    })
    expect(closing).toEqual({ verdicts: [], points: [] })
  })
})
