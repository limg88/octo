import { describe, expect, it } from 'vitest'
import {
  type Citation,
  checkAnswer,
  checkCitation,
  cleanQuestion,
  DomainError,
  type Evidence,
  isDomainError,
  markersIn,
  normalizeForMatch,
  projectNameFromFolder,
  sameFolder,
  unverifiedCount,
} from '../src/index.ts'

const MODIFIED_AT = '2026-11-10T09:00:00.000Z'
const TEXT = 'La consegna del modulo ordini\nè fissata al 12 dicembre 2026.'
const found: Evidence = { kind: 'found', text: TEXT, modifiedAt: MODIFIED_AT }

function citation(quote: string, n = 1, path = 'wiki/stato.md'): Citation {
  return { n, path, quote }
}

describe('checkCitation', () => {
  it('verifies a quote across line breaks and repeated spaces', () => {
    const checked = checkCitation(citation('modulo ordini  è fissata al 12 dicembre'), found)
    expect(checked).toMatchObject({ status: 'verified', modifiedAt: MODIFIED_AT })
  })

  it('marks a quote the file does not contain', () => {
    expect(checkCitation(citation('fissata al 15 dicembre 2026'), found).status).toBe(
      'quote_not_found',
    )
  })

  it('refuses a quote too short to prove anything', () => {
    expect(checkCitation(citation('ordini'), found).status).toBe('quote_too_short')
  })

  it('verifies a quote the file writes with JSON escapes', () => {
    const json: Evidence = {
      kind: 'found',
      text: '{"title": "Crystal Symphony \\u2014 Upgrade to the latest release"}',
      modifiedAt: MODIFIED_AT,
    }
    expect(checkCitation(citation('"title": "Crystal Symphony — Upgrade'), json).status).toBe(
      'verified',
    )
  })

  it('says when a file is too large to be checked', () => {
    expect(checkCitation(citation('fissata al 12 dicembre'), { kind: 'too_large' }).status).toBe(
      'file_too_large',
    )
  })

  it('marks a missing file and a file outside the project', () => {
    const quote = 'fissata al 12 dicembre 2026'
    expect(checkCitation(citation(quote), { kind: 'missing' })).toMatchObject({
      status: 'file_not_found',
      modifiedAt: null,
    })
    expect(checkCitation(citation(quote), { kind: 'outside' }).status).toBe('outside_project')
  })
})

describe('checkAnswer', () => {
  it('keeps the text and reports what is not backed', () => {
    const draft = {
      text: 'Consegna il 12 dicembre [1]. Budget residuo 14.500 euro [2]. Rischio alto [3].',
      citations: [
        citation('fissata al 12 dicembre 2026', 1),
        citation('budget residuo di 14.500 euro', 2, 'wiki/economics.md'),
      ],
      missing: ['data di collaudo'],
    }
    const answer = checkAnswer(draft, new Map([['wiki/stato.md', found]]))

    expect(answer.text).toBe(draft.text)
    expect(answer.citations.map((c) => c.status)).toEqual(['verified', 'file_not_found'])
    expect(answer.markersWithoutCitation).toEqual([3])
    expect(answer.missing).toEqual(['data di collaudo'])
    expect(unverifiedCount(answer)).toBe(2)
  })
})

describe('text helpers', () => {
  it('lists each marker once, in order', () => {
    expect(markersIn('b [2], a [1], again [2]')).toEqual([1, 2])
  })

  it('normalizes Unicode composition', () => {
    expect(normalizeForMatch('e\u0300  fissata')).toBe('è fissata')
  })
})

describe('project', () => {
  it('names a project after its folder on any system', () => {
    expect(projectNameFromFolder('/Users/paola/Progetti/DEEM/')).toBe('DEEM')
    expect(projectNameFromFolder('C:\\Users\\paola\\Progetti\\Aurora')).toBe('Aurora')
    expect(projectNameFromFolder('/')).toBe('Progetto')
  })

  it('compares folders ignoring a trailing separator', () => {
    expect(sameFolder('/a/b/', '/a/b')).toBe(true)
    expect(sameFolder('/a/b', '/a/c')).toBe(false)
  })
})

describe('question', () => {
  it('trims a question and refuses an empty one', () => {
    expect(cleanQuestion('  A che punto siamo?  ')).toBe('A che punto siamo?')
    expect(() => cleanQuestion('   ')).toThrowError(DomainError)
  })

  it('carries a code the interface can explain', () => {
    const error = new DomainError('agent_failed', 'exit 1')
    expect(isDomainError(error)).toBe(true)
    expect(error.code).toBe('agent_failed')
    expect(isDomainError(new Error('other'))).toBe(false)
  })
})
