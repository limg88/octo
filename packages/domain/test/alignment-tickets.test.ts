import { describe, expect, it } from 'vitest'
import { missingTickets, PROJECT_KEY, parseTicketsWritten } from '../src/index.ts'

describe('the tickets an alignment found missing', () => {
  it('reads them from the file the alignment wrote, quoted cells and line breaks included', () => {
    const csv = [
      'Summary,Issue Type,Priority,Assignee,Description,Sprint',
      '[AZDO 12] Esportazione,Story,,,Come da riunione,Sprint 28',
      '"[AZDO 13] Filtro, con ""virgolette""",Bug,,,"Prima riga',
      'seconda riga",Sprint 28',
      // Twice the same summary, and a row without one: neither is a ticket.
      '[AZDO 12] Esportazione,Story,,,Doppione,Sprint 28',
      ',Story,,,Senza titolo,Sprint 28',
      '',
    ].join('\r\n')
    expect(missingTickets(csv)).toEqual([
      { summary: '[AZDO 12] Esportazione', type: 'Story', description: 'Come da riunione' },
      {
        summary: '[AZDO 13] Filtro, con "virgolette"',
        type: 'Bug',
        description: 'Prima riga\r\nseconda riga',
      },
    ])
    expect(missingTickets('Titolo,Tipo\nA,B')).toEqual([])
    expect(missingTickets('Summary\nSolo il titolo')).toEqual([
      { summary: 'Solo il titolo', type: '', description: '' },
    ])
  })

  it('keeps of what was written only what is a record of it', () => {
    const entry = { summary: 'A', key: 'AUR-1', at: '2026-11-19T10:00:00.000Z', by: 'Paola' }
    expect(parseTicketsWritten(JSON.stringify([entry, { summary: 'B' }, null]))).toEqual([entry])
    expect(parseTicketsWritten(null)).toEqual([])
    expect(parseTicketsWritten('{}')).toEqual([])
    expect(parseTicketsWritten('non è JSON')).toEqual([])
  })

  it('takes as a project key only what Jira would', () => {
    expect(['AUR', 'A1_B'].every((key) => PROJECT_KEY.test(key))).toBe(true)
    expect(['aur', 'A', '1AB', 'AU R', ''].some((key) => PROJECT_KEY.test(key))).toBe(false)
  })
})
