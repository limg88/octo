import { describe, expect, it } from 'vitest'
import {
  assertChecksum,
  CHECKSUMS_ASSET,
  type Citation,
  checkAnswer,
  checkCitation,
  checksumOf,
  cleanQuestion,
  conversationOf,
  conversationsOf,
  DomainError,
  type Evidence,
  earlierTurns,
  isDomainError,
  isNewerVersion,
  LEGACY_CONVERSATION,
  markersIn,
  normalizeForMatch,
  parseVersion,
  pathInProject,
  projectNameFromFolder,
  type QuestionRecord,
  sameFolder,
  unverifiedCount,
  updateAssetFor,
  updateAssetName,
  updateOffer,
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

  it('gives a chosen path as a path from the project folder, or refuses it', () => {
    expect(pathInProject('/p/Aurora', '/p/Aurora/dati/ore.csv')).toBe('dati/ore.csv')
    expect(pathInProject('/p/Aurora/', '/p/Aurora/dati/')).toBe('dati')
    expect(pathInProject('C:\\p\\Aurora', 'C:\\p\\Aurora\\dati\\ore.csv')).toBe('dati/ore.csv')
    // The folder itself, a sibling whose name starts the same way, and anything elsewhere.
    expect(pathInProject('/p/Aurora', '/p/Aurora')).toBeNull()
    expect(pathInProject('/p/Aurora', '/p/Aurora 2/ore.csv')).toBeNull()
    expect(pathInProject('/p/Aurora', '/altrove/ore.csv')).toBeNull()
  })
})

describe('conversations', () => {
  const record = (
    id: string,
    askedAt: string,
    conversationId: string | undefined,
    answer: string | null = `Risposta a ${id}`,
  ): QuestionRecord => ({
    id,
    projectId: 'p-1',
    question: `Domanda ${id}`,
    askedAt,
    durationMs: 1,
    answer:
      answer === null
        ? null
        : { text: answer, citations: [], missing: [], markersWithoutCitation: [] },
    error: answer === null ? 'agent_failed' : null,
    conversationId,
  })
  const records = [
    record('a', '2026-11-10T08:00:00Z', undefined),
    record('b', '2026-11-11T08:00:00Z', 'c-1'),
    record('c', '2026-11-12T08:00:00Z', 'c-2'),
    record('d', '2026-11-13T08:00:00Z', 'c-1', null),
    record('e', '2026-11-14T08:00:00Z', 'c-1'),
  ]

  it('groups the questions, the conversation asked in last first, the old ones together', () => {
    const conversations = conversationsOf(records)
    expect(conversations.map((chat) => [chat.id, chat.title, chat.records.length])).toEqual([
      ['c-1', 'Domanda b', 3],
      ['c-2', 'Domanda c', 1],
      [LEGACY_CONVERSATION, 'Domanda a', 1],
    ])
    expect(conversations[0]).toMatchObject({
      startedAt: '2026-11-11T08:00:00Z',
      lastAt: '2026-11-14T08:00:00Z',
    })
    expect(conversationOf(records[0] as QuestionRecord)).toBe(LEGACY_CONVERSATION)
    expect(conversationsOf([])).toEqual([])
  })

  it('tells a new question the answered ones before it, the latest and cut short', () => {
    expect(earlierTurns(records, 'c-1')).toEqual([
      { question: 'Domanda b', answer: 'Risposta a b' },
      { question: 'Domanda e', answer: 'Risposta a e' },
    ])
    expect(earlierTurns(records, 'altra')).toEqual([])
    const long = Array.from({ length: 9 }, (_unused, at) =>
      record(`n${at}`, `2026-11-1${at}T08:00:00Z`, 'c-3', 'x'.repeat(5000)),
    )
    const turns = earlierTurns(long, 'c-3')
    expect(turns.map((turn) => turn.question)).toEqual(
      ['n3', 'n4', 'n5', 'n6', 'n7', 'n8'].map((id) => `Domanda ${id}`),
    )
    expect(turns[0]?.answer).toHaveLength(4000)
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

describe('a newer version of Octo', () => {
  const mac = { platform: 'darwin', arch: 'arm64' }
  const asset = (name: string) => ({ name, url: `https://example.test/${name}`, size: 10 })
  const release = {
    version: 'v1.4.0',
    notes: 'Novità.',
    assets: [
      asset('Octo-1.4.0-mac-arm64.zip'),
      asset('Octo-1.4.0-mac-arm64.dmg'),
      asset('Octo-1.4.0-win-x64.exe'),
      asset(CHECKSUMS_ASSET),
    ],
  }

  it('reads a version, and says which of two comes after', () => {
    expect(parseVersion(' v1.4.0 ')).toEqual([1, 4, 0])
    expect(parseVersion('1.4')).toBeNull()
    expect(parseVersion('1.4.0-beta.1')).toBeNull()
    expect(isNewerVersion('1.4.0', '1.3.9')).toBe(true)
    expect(isNewerVersion('v0.10.0', '0.9.0')).toBe(true)
    expect(isNewerVersion('2.0.0', '10.0.0')).toBe(false)
    expect(isNewerVersion('1.4.0', '1.4.0')).toBe(false)
    expect(isNewerVersion('1.4.1', '1.4.0')).toBe(true)
    // What is not a version is never offered.
    expect(isNewerVersion('nightly', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0', 'dev')).toBe(false)
  })

  it('finds the file of a release for the computer it runs on', () => {
    expect(updateAssetName('v1.4.0', mac)).toBe('Octo-1.4.0-mac-arm64.zip')
    expect(updateAssetName('1.4.0', { platform: 'win32', arch: 'x64' })).toBe(
      'Octo-1.4.0-win-x64.exe',
    )
    expect(updateAssetName('1.4.0', { platform: 'linux', arch: 'x64' })).toBeNull()
    expect(updateAssetName('ultima', mac)).toBeNull()
    expect(updateAssetFor(release, mac)?.name).toBe('Octo-1.4.0-mac-arm64.zip')
    expect(updateAssetFor(release, { platform: 'darwin', arch: 'x64' })).toBeNull()
  })

  it('offers a release only when it is newer and has a file for this computer', () => {
    expect(updateOffer(release, '1.3.0', mac)).toEqual({ version: '1.4.0', notes: 'Novità.' })
    expect(updateOffer(release, '1.4.0', mac)).toBeNull()
    expect(updateOffer(release, '1.3.0', { platform: 'linux', arch: 'x64' })).toBeNull()
    expect(updateOffer(null, '1.3.0', mac)).toBeNull()
  })

  it('reads the checksum of a file from the list of a release, and refuses another file', () => {
    const hex = 'A'.repeat(64)
    const list = `${'b'.repeat(64)}  altro.zip\n${hex} *Octo-1.4.0-mac-arm64.zip\nriga qualsiasi\n`
    expect(checksumOf(list, 'Octo-1.4.0-mac-arm64.zip')).toBe('a'.repeat(64))
    expect(checksumOf(list, 'manca.zip')).toBeNull()
    expect(() => assertChecksum('a'.repeat(64), 'A'.repeat(64))).not.toThrow()
    expect(() => assertChecksum(null, 'a'.repeat(64))).toThrow('update_checksum_missing')
    expect(() => assertChecksum('a'.repeat(64), 'c'.repeat(64))).toThrow('update_checksum_mismatch')
  })
})
