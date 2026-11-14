import { describe, expect, it } from 'vitest'
import {
  approvedFileName,
  cleanInputs,
  costOf,
  DELIVERABLE_CATALOG,
  type Deliverable,
  deliverableKind,
  ESTIMATE_PLACEHOLDER,
  estimate,
  estimateMarkdown,
  isOwnKind,
  MAX_REVIEW_PAUSE_MS,
  ownKind,
  ownKindInput,
  ownKindPath,
  registerMarkdown,
  registerTotals,
  reviewTimeSince,
  type WbsRow,
  withEstimate,
  withoutMarkers,
} from '../src/index.ts'

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
