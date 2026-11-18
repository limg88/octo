import { describe, expect, it } from 'vitest'
import {
  approvedFileName,
  cleanInputs,
  clientFilter,
  costOf,
  type Deliverable,
  ESTIMATE_PLACEHOLDER,
  estimate,
  estimateMarkdown,
  isMemoryPage,
  isOwnKind,
  MAX_REVIEW_PAUSE_MS,
  memoryPageMarkdown,
  memoryPagePath,
  ownKind,
  ownKindInput,
  ownKindPath,
  parseCatalogIndex,
  parseCatalogKind,
  registerMarkdown,
  registerTotals,
  reviewTimeSince,
  type WbsRow,
  withEstimate,
  withoutMarkers,
} from '../src/index.ts'
import { DELIVERABLE_CATALOG, deliverableKind } from './support/catalog.ts'

const email = DELIVERABLE_CATALOG[0]
if (!email) throw new Error('empty catalog')

const deliverable: Deliverable = {
  id: 'd-1',
  projectId: 'p-1',
  kindId: 'email-cliente',
  title: 'Collaudo: nuova data',
  inputs: {},
  status: 'approved',
  createdAt: '2026-11-13T09:00:00.000Z',
  rounds: [
    { at: '', request: null, durationMs: 90_000, error: null },
    { at: '', request: 'Più breve', durationMs: 45_000, error: null },
  ],
  draft: null,
  written: null,
  redTeam: null,
  readyAt: null,
  reviewMs: 6 * 60_000,
  approvedAt: '2026-11-14T10:00:00.000Z',
  files: [],
}

describe('the catalog', () => {
  it('has kinds with distinct ids, each with what to ask and what to check', () => {
    const ids = DELIVERABLE_CATALOG.map((kind) => kind.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const kind of DELIVERABLE_CATALOG) {
      expect(kind.fields.some((field) => field.required)).toBe(true)
      expect(kind.checklist.length).toBeGreaterThan(0)
      expect(kind.instructions.length).toBeGreaterThan(100)
    }
    expect(ids).toEqual([
      'email-cliente',
      'stato-avanzamento',
      'verbale',
      'stima',
      'analisi-funzionale',
      'voce-di-backlog',
      'modifiche-al-tracker',
      'scenari-di-test',
      'note-di-rilascio',
      'technical-proposal',
      // The three pages of the curated memory of the project.
      'memoria-fatti-correnti',
      'memoria-decisioni-e-regole',
      'memoria-cronologia',
    ])
    expect(DELIVERABLE_CATALOG.flatMap((kind) => kind.memoryPage ?? [])).toEqual([
      'fatti-correnti',
      'decisioni-e-regole',
      'cronologia',
    ])
    // Every kind asks for what names the deliverable in the lists.
    for (const kind of DELIVERABLE_CATALOG) {
      const naming = kind.fields.filter((field) =>
        ['tema', 'periodo', 'riunione'].includes(field.key),
      )
      expect(naming.map((field) => field.required)).toEqual([true])
    }
    // What goes to the client carries the rules on internal data; only the report is shown.
    for (const kind of DELIVERABLE_CATALOG.filter((kind) => kind.audience === 'client')) {
      expect(kind.instructions).toContain('The reader is the client')
    }
    expect(DELIVERABLE_CATALOG.filter((kind) => kind.deck).map((kind) => kind.id)).toEqual([
      'stato-avanzamento',
    ])
    expect(deliverableKind('technical-proposal')?.instructions).toContain('No figures at all')
    expect(deliverableKind('verbale')?.audience).toBe('internal')
    expect(deliverableKind('nessuno')).toBeNull()
  })
})

describe('what the PM types', () => {
  it('is trimmed, without what the kind does not ask and without empty optional fields', () => {
    const cleaned = cleanInputs(email, {
      destinatario: ' Carla ',
      tema: 'Collaudo',
      richiesta: 'Conferma',
      note: '  ',
      altro: 'ignorato',
    })
    expect(cleaned).toEqual({ destinatario: 'Carla', tema: 'Collaudo', richiesta: 'Conferma' })
  })

  it('must have every required field', () => {
    expect(() => cleanInputs(email, { destinatario: 'Carla' })).toThrow(/deliverable_input_missing/)
  })
})

describe('what leaves and what it cost', () => {
  it('drops the markers of the sources from the text the reader gets', () => {
    expect(withoutMarkers('Consegna il 12 [1], budget 14.500 [2] [3].')).toBe(
      'Consegna il 12, budget 14.500.',
    )
  })

  it('names the approved file by day, kind and subject', () => {
    expect(approvedFileName(deliverable, 'docx')).toBe(
      '2026-11-14_email-cliente_collaudo-nuova-data.docx',
    )
    expect(approvedFileName({ ...deliverable, approvedAt: null }, 'md')).toContain('2026-11-13_')
  })

  it('counts minutes of writing, minutes of review and rounds', () => {
    expect(costOf(deliverable)).toEqual({ draftMinutes: 2.3, reviewMinutes: 6, rounds: 2 })
  })

  it('counts the review from when the draft was ready, capping a long pause', () => {
    const ready = '2026-11-14T10:00:00.000Z'
    expect(reviewTimeSince(ready, new Date('2026-11-14T10:04:00.000Z'))).toBe(4 * 60_000)
    expect(reviewTimeSince(ready, new Date('2026-11-15T10:00:00.000Z'))).toBe(MAX_REVIEW_PAUSE_MS)
    expect(reviewTimeSince(ready, new Date('2026-11-14T09:00:00.000Z'))).toBe(0)
    expect(reviewTimeSince(null, new Date())).toBe(0)
  })
})

describe('an estimate computed by the code', () => {
  const row = (overrides: Partial<WbsRow>): WbsRow => ({
    id: 'W-01',
    fase: 'Analisi',
    attivita: 'Allineamento',
    driver: 'Una riunione [1]',
    ruolo: 'PM',
    ott: 1,
    prob: 2,
    pess: 3,
    stato: 'parziale',
    ...overrides,
  })

  it('weighs the three points, sums by phase and role and gives the interval', () => {
    const result = estimate([
      row({}),
      row({
        id: 'W-02',
        fase: 'Sviluppo',
        ruolo: 'Dev',
        ott: 4,
        prob: 6,
        pess: 14,
        stato: 'mancante',
      }),
    ])

    expect(result.rows.map((line) => line.media)).toEqual([2, 7])
    expect(result.total).toBe(9)
    expect(result.sd).toBeCloseTo(Math.sqrt((2 / 6) ** 2 + (10 / 6) ** 2))
    expect(result.min).toBeCloseTo(9 - 1.2816 * result.sd)
    expect(result.max).toBeCloseTo(9 + 1.2816 * result.sd)
    expect(result.byPhase).toEqual([
      ['Sviluppo', 7],
      ['Analisi', 2],
    ])
    expect(result.byRole[0]).toEqual(['Dev', 7])
    expect(result.warnings).toEqual([])
  })

  it('leaves out, and says, the lines it cannot compute', () => {
    const result = estimate([
      row({}),
      row({ id: 'W-01' }),
      row({ id: '' }),
      row({ id: 'W-03', driver: ' ' }),
      row({ id: 'W-04', ott: 5, prob: 3, pess: 9 }),
      row({ id: 'W-05', ott: 2, prob: 2, pess: 2 }),
      row({ id: 'W-06', ott: Number.NaN }),
    ])

    expect(result.rows.map((line) => line.id)).toEqual(['W-01'])
    expect(result.warnings).toHaveLength(6)
    expect(result.warnings.every((warning) => warning.startsWith('Esclusa dai totali'))).toBe(true)
  })

  it('warns when the range does not match what is known', () => {
    const result = estimate([
      row({ id: 'A', stato: 'completo', ott: 1, prob: 2, pess: 5 }),
      row({ id: 'B', stato: 'parziale', ott: 1, prob: 2, pess: 4 }),
      row({ id: 'C', stato: 'mancante', ott: 2, prob: 3, pess: 4 }),
      row({ id: 'D', stato: 'completo', ott: 2, prob: 3, pess: 4 }),
    ])

    expect(result.rows).toHaveLength(4)
    expect(result.warnings.map((warning) => warning.slice(0, 2))).toEqual(['A:', 'B:', 'C:'])
    expect(result.min).toBeGreaterThanOrEqual(0)
  })

  it('writes the numbers where the writer said, or at the end', () => {
    const rows = [row({})]
    const placed = withEstimate(`## Stima\n\n${ESTIMATE_PLACEHOLDER}\n\n## Rischi`, rows)
    expect(placed).toContain('Totale **2,0 gg**')
    expect(placed.indexOf('Totale')).toBeLessThan(placed.indexOf('## Rischi'))
    expect(placed).toContain('| W-01 | Analisi | Allineamento | Una riunione [1] | PM |')

    expect(withEstimate('Senza segnaposto.', rows)).toMatch(/^Senza segnaposto\.\n\nTotale/)
    expect(estimateMarkdown(estimate([row({ id: 'X', ott: 9, prob: 1, pess: 2 })]))).toContain(
      '### Avvisi',
    )
  })
})

describe('the register of a project', () => {
  it('lists every deliverable with what it cost and sums the approved ones', () => {
    const other: Deliverable = {
      ...deliverable,
      id: 'd-2',
      kindId: 'sconosciuto',
      title: 'Bozza | in corso',
      status: 'review',
      createdAt: '2026-11-14T08:00:00.000Z',
    }
    const text = registerMarkdown([deliverable, other], DELIVERABLE_CATALOG)

    expect(text).toContain(
      '| 2026-11-13 | Email al cliente | Collaudo: nuova data | approvato | 2.3 | 6 | 2 |',
    )
    expect(text).toContain('| 2026-11-14 | sconosciuto | Bozza \\| in corso | da rivedere |')
    expect(text.indexOf('2026-11-14 |')).toBeLessThan(text.indexOf('2026-11-13 |'))
    expect(text).toContain('Approvati: 1 · scrittura 2.3 min · revisione 6 min · 2 giri.')
    expect(registerTotals([other])).toEqual({
      deliverables: 0,
      draftMinutes: 0,
      reviewMinutes: 0,
      rounds: 0,
    })
  })
})

describe('a kind the PM defines in words', () => {
  it('turns questions into fields and comes back as it was typed', () => {
    const input = {
      title: ' Nota di rilascio ',
      summary: ' Novità per chi usa il prodotto. ',
      audience: 'client' as const,
      questions: ['Quale versione *', '', ' Che cosa mettere in evidenza '],
      instructions: ' Scrivi le novità. ',
      checklist: ['Nessun nome interno', ' '],
    }
    const kind = ownKind(input)

    expect(kind).toMatchObject({ id: 'proprio-nota-di-rilascio', title: 'Nota di rilascio' })
    expect(kind.fields).toEqual([
      { key: 'domanda-1', label: 'Quale versione', kind: 'long', required: true },
      { key: 'domanda-2', label: 'Che cosa mettere in evidenza', kind: 'long', required: false },
    ])
    expect(kind.checklist).toEqual(['Nessun nome interno'])
    expect(isOwnKind(kind.id)).toBe(true)
    expect(isOwnKind('email-cliente')).toBe(false)
    expect(ownKindPath(kind.id)).toBe('_octo/.tipi/proprio-nota-di-rilascio.json')
    expect(ownKindInput(kind).questions).toEqual([
      'Quale versione *',
      'Che cosa mettere in evidenza',
    ])
  })
})

describe('the filter on what goes to the client', () => {
  it('points at days of effort and amounts of money, with the words around', () => {
    const found = clientFilter(
      'La migrazione vale 12 gg (circa 1,5 FTE) e 45 giornate uomo, cioè 18.500,00 euro; ' +
        'la tariffa è € 450 al giorno, 3 MD di collaudo, 20k€ di licenze e 2 milioni di euro di valore.',
    )
    expect(found.map((finding) => [finding.kind, finding.match])).toEqual([
      ['effort', '12 gg'],
      ['effort', '1,5 FTE'],
      ['effort', '45 giornate uomo'],
      ['effort', '3 MD'],
      ['money', '18.500,00 euro'],
      ['money', '€ 450'],
      ['money', '20k€'],
      ['money', '2 milioni di euro'],
    ])
    expect(found[0]?.excerpt).toContain('La migrazione vale 12 gg (circa')
  })

  it('leaves dates, deadlines, percentages and identifiers alone', () => {
    const clean =
      'Il collaudo è il 12 dicembre 2026, entro 5 giorni dalla consegna e non oltre 48 ore. ' +
      'Avanzamento al 91,23%, voce AB-1234, versione 2.4, 3 ambienti, 12 ggiorni, 2 mdx, 5 europei.'
    expect(clientFilter(clean)).toEqual([])
    expect(clientFilter('')).toEqual([])
  })

  it('reports once a figure repeated with the same words around', () => {
    expect(clientFilter('Costo: 10 gg.\n\nCosto: 10 gg.')).toHaveLength(1)
    expect(clientFilter('10 gg')).toEqual([{ kind: 'effort', match: '10 gg', excerpt: '10 gg' }])
    expect(clientFilter('| Fase | gg |\n|---|---|\n| **Totale** | 9,0 gg |')[0]?.excerpt).toBe(
      'Fase gg Totale 9,0 gg',
    )
  })
})

describe('a kind of the catalog read from its files', () => {
  const kind = {
    title: 'Email al cliente',
    summary: 'Una richiesta chiara.',
    audience: 'client',
    fields: [
      { key: 'tema', label: 'Di che cosa', kind: 'text', required: true, hint: ' Un tema ' },
    ],
    checklist: ['Una sola richiesta'],
  }
  const instructions = 'Write the draft of a formal email to the client. '.repeat(6)
  const broken = (change: object, text = instructions) => {
    const parsed = parseCatalogKind('email', { ...kind, ...change }, text)
    return parsed.ok ? null : parsed.why
  }

  it('is whole or is not a kind: what is wrong is named, never mended', () => {
    expect(parseCatalogKind('email', kind, instructions)).toEqual({
      ok: true,
      kind: {
        id: 'email',
        title: 'Email al cliente',
        summary: 'Una richiesta chiara.',
        audience: 'client',
        fields: [
          { key: 'tema', label: 'Di che cosa', kind: 'text', required: true, hint: 'Un tema' },
        ],
        instructions,
        checklist: ['Una sola richiesta'],
      },
    })
    expect(broken({ title: ' ' })).toBe('title')
    expect(broken({ audience: 'tutti' })).toBe('audience')
    expect(broken({ fields: [] })).toBe('fields')
    expect(broken({ fields: [{ ...kind.fields[0], kind: 'numero' }] })).toBe('fields')
    expect(broken({ fields: [kind.fields[0], kind.fields[0]] })).toBe('fields')
    expect(broken({ fields: ['tema'] })).toBe('fields')
    expect(broken({ checklist: ['x', ''] })).toBe('checklist')
    expect(broken({ checklist: 'x' })).toBe('checklist')
    expect(broken({ calculation: 'somma' })).toBe('calculation')
    expect(broken({ deck: 'si' })).toBe('deck')
    expect(broken({ memoryPage: '../fuori' })).toBe('memoryPage')
    expect(broken({ memoryPage: 3 })).toBe('memoryPage')
    expect(broken({}, 'Scrivi bene.')).toBe('istruzioni.md')
    const notAKind = parseCatalogKind('email', ['x'], instructions)
    expect(notAKind.ok ? null : notAKind.why).toBe('tipo.json')
  })

  it('keeps what only some kinds have, and wants the place of the figures in an estimate', () => {
    const shown = parseCatalogKind('stato', { ...kind, deck: true }, instructions)
    expect(shown.ok && shown.kind.deck).toBe(true)
    expect(broken({ calculation: 'pert' })).toBe('istruzioni.md')
    const estimated = parseCatalogKind(
      'stima',
      { ...kind, calculation: 'pert' },
      `${instructions}${ESTIMATE_PLACEHOLDER}`,
    )
    expect(estimated.ok && estimated.kind.calculation).toBe('pert')
  })

  it('is named by an index of distinct ids, in the order of the catalog', () => {
    expect(parseCatalogIndex(['email-cliente', 'verbale'])).toEqual(['email-cliente', 'verbale'])
    for (const wrong of [[], 'email', ['email', 'email'], ['Email'], ['email', 3], ['../fuori']]) {
      expect(parseCatalogIndex(wrong)).toBeNull()
    }
  })
})

describe('a page of the memory of the project', () => {
  const cited = (path: string, status: 'verified' | 'quote_not_found') => ({
    n: 1,
    path,
    quote: 'una frase lunga abbastanza',
    status,
    modifiedAt: null,
  })

  it('is kept with its title, the day it was approved, its text and the files it comes from', () => {
    const page = memoryPageMarkdown(
      'Memoria: fatti correnti',
      '\n## Dove siamo\n\nLa consegna è il 12 dicembre (al 2026-11-17)\n',
      [
        cited('wiki/stato.md', 'verified'),
        cited('wiki/stato.md', 'verified'),
        cited('_octo/posta/2026-11/mail.md', 'quote_not_found'),
      ],
      '2026-11-18T09:30:00.000Z',
    )
    expect(page.split('\n')[0]).toBe('# Memoria: fatti correnti')
    expect(page).toContain('approvata dal PM il 2026-11-18')
    expect(page).toContain(
      '## Dove siamo\n\nLa consegna è il 12 dicembre (al 2026-11-17)\n\n## Fonti',
    )
    // Each file once, in order; one the code did not find is said to be so.
    expect(
      page.endsWith('- `_octo/posta/2026-11/mail.md` (fonte non verificata)\n- `wiki/stato.md`\n'),
    ).toBe(true)
    expect(memoryPageMarkdown('T', 'x', [], '2026-11-18')).toContain('Nessuna fonte citata')
  })

  it('has a name that is the name of its file, inside the folder of the memory', () => {
    expect(memoryPagePath('fatti-correnti')).toBe('_octo/progetto/memoria/fatti-correnti.md')
    expect(isMemoryPage('fatti-correnti')).toBe(true)
    for (const wrong of ['', 'Fatti', '../x', 'a/b', 'a.md'])
      expect(isMemoryPage(wrong)).toBe(false)
  })
})
