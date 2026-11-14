import { describe, expect, it } from 'vitest'
import {
  approvedFileName,
  cleanInputs,
  costOf,
  DELIVERABLE_CATALOG,
  type Deliverable,
  deliverableKind,
  MAX_REVIEW_PAUSE_MS,
  reviewTimeSince,
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
