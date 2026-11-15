import { describe, expect, it } from 'vitest'
import {
  cleanMeetingsSource,
  MEETINGS_FOLDER,
  type MeetingCandidate,
  type MeetingReading,
  meetingFolderName,
  meetingMeta,
  meetingOwner,
  meetingsReadingNote,
  parseMeetingMeta,
  projectKeywords,
  type RecordedMeeting,
  readMeetingManifest,
  unassignedMeetingItems,
} from '../src/index.ts'

const ID = 'AB12CD34-0000-4000-8000-000000000001'
const manifest = (change: Record<string, unknown> = {}): string =>
  JSON.stringify({
    schemaVersion: 1,
    id: ID,
    title: 'Kickoff Aurora',
    started: '2026-11-10T09:00:00Z',
    timezone: 'Europe/Rome',
    duration: 2700,
    state: 'complete',
    speakers: { '1': 'Luca', '2': 'Anna', '3': 'Anna', '4': ' ', '5': 7 },
    ...change,
  })

const kickoff: RecordedMeeting = {
  id: ID.toLowerCase(),
  title: 'Kickoff Aurora',
  started: '2026-11-10T09:00:00.000Z',
  timezone: 'Europe/Rome',
  durationSeconds: 2700,
  participants: ['Anna', 'Luca'],
}

const skipOf = (reading: MeetingReading) =>
  reading.status === 'skipped' ? [reading.reason, reading.detail] : reading.status

describe('the manifest of an export of Verbale', () => {
  it('gives a finished meeting, with the people Verbale named', () => {
    expect(readMeetingManifest('cartella', manifest())).toEqual({
      folder: 'cartella',
      status: 'complete',
      meeting: kickoff,
    })
    const bare = readMeetingManifest('c', manifest({ speakers: undefined, timezone: undefined }))
    expect(
      bare.status === 'complete' && [bare.meeting.participants, bare.meeting.timezone],
    ).toEqual([[], ''])
  })

  it('leaves out what is not finished, not readable or of another version, with its reason', () => {
    expect(skipOf(readMeetingManifest('c', null))).toEqual(['no_manifest', ''])
    expect(skipOf(readMeetingManifest('c', '{"schemaVersion": 1,'))).toEqual(['corrupt', ''])
    expect(skipOf(readMeetingManifest('c', '[]'))).toEqual(['invalid', ''])
    expect(skipOf(readMeetingManifest('c', '{"id": "x"}'))).toEqual(['invalid', 'schemaVersion'])
    for (const state of ['recording', 'processing', 'interrupted', 'failed']) {
      expect(skipOf(readMeetingManifest('c', manifest({ state })))).toEqual(['not_complete', state])
    }
    // A version Octo does not know is not judged by the fields of the one it knows.
    expect(skipOf(readMeetingManifest('c', '{"schemaVersion": 2, "meeting": {}}'))).toEqual([
      'schema',
      '2',
    ])
  })

  it('refuses a manifest of the known version whose fields are not the expected ones', () => {
    const broken = [
      { id: 'non-un-uuid' },
      { title: 3 },
      { started: 'ieri' },
      { duration: -1 },
      { duration: '45' },
      { state: null },
    ]
    for (const change of broken) {
      expect(skipOf(readMeetingManifest('c', manifest(change)))).toEqual(['invalid', ''])
    }
  })
})

describe('the folder Verbale exports to', () => {
  it('is kept trimmed, from the root of the disk or from the home', () => {
    expect(cleanMeetingsSource({ root: '  ~/Documents/Verbale/ ' })).toEqual({
      root: '~/Documents/Verbale',
    })
    expect(cleanMeetingsSource({ root: '/' }).root).toBe('/')
    expect(cleanMeetingsSource({ root: 'C:\\Verbale' }).root).toBe('C:\\Verbale')
    for (const root of ['', 'Verbale', '../Verbale', '~altro/Verbale']) {
      expect(() => cleanMeetingsSource({ root })).toThrow('source_config_invalid')
    }
  })
})

describe('a meeting in the memory of a project', () => {
  it('has a folder named by its day in Italy, its title and the start of its id', () => {
    expect(meetingFolderName(kickoff)).toBe('2026-11-10_kickoff-aurora_ab12cd34')
    // 23:30 in universal time is already the next day in Italy.
    const late = { ...kickoff, started: '2026-11-10T23:30:00.000Z', title: '—' }
    expect(meetingFolderName(late)).toBe('2026-11-11_riunione_ab12cd34')
  })

  it('is described by a file that is read back as the same meeting', () => {
    const meta = meetingMeta(kickoff, '2026-11-10_100000_Kickoff_AB12CD34', [
      'transcript.md',
      'notes.md',
    ])
    expect(meta).toContain('- Durata: 45 minuti')
    expect(meta).toContain('- Partecipanti: Anna, Luca')
    expect(meta).toContain('cartella `2026-11-10_100000_Kickoff_AB12CD34`')
    expect(meta).toContain('- `transcript.md`')
    expect(meta).not.toContain('report.md')
    const path = `${MEETINGS_FOLDER}/2026-11-10_kickoff-aurora_ab12cd34/_meta.md`
    expect(parseMeetingMeta(path, meta)).toEqual({
      id: kickoff.id,
      title: 'Kickoff Aurora',
      started: kickoff.started,
      minutes: 45,
      participants: ['Anna', 'Luca'],
      folder: `${MEETINGS_FOLDER}/2026-11-10_kickoff-aurora_ab12cd34`,
    })
    const alone = meetingMeta({ ...kickoff, participants: [] }, 'c', [])
    expect(alone).not.toContain('Partecipanti:')
    expect(parseMeetingMeta(path, alone)?.participants).toEqual([])
  })

  it('is not read from a file that is not one of its descriptions', () => {
    expect(parseMeetingMeta('a/_meta.md', '# Appunti')).toBeNull()
    expect(parseMeetingMeta('a/_meta.md', '---\ntipo: "email"\nid: "x"\n---\n')).toBeNull()
    expect(
      parseMeetingMeta('a/_meta.md', '---\ntipo: "riunione"\nid: "x"\ndata: "boh"\n---\n'),
    ).toBeNull()
  })
})

describe('what a reading left out', () => {
  it('names every folder skipped with its reason, and the meetings without a project', () => {
    const note = meetingsReadingNote(
      '~/Verbale',
      [
        { folder: 'in-corso', status: 'skipped', reason: 'not_complete', detail: 'recording' },
        { folder: 'rotta', status: 'skipped', reason: 'corrupt', detail: '' },
      ],
      [{ folder: 'orfana', status: 'complete', meeting: kickoff }],
    )
    expect(note).toContain('Cartella letta: `~/Verbale`')
    expect(note).toContain('- `in-corso`: riunione non completa (recording)')
    expect(note).toContain('- `rotta`: `meeting.json` non si legge: non è JSON valido')
    expect(note).toContain('- `orfana`: «Kickoff Aurora» del 2026-11-10')
    expect(meetingsReadingNote('/v', [], []).match(/Nessuna\./g)).toHaveLength(2)
  })
})

describe('whose a recorded meeting is', () => {
  const candidate = (
    projectId: string,
    invites: MeetingCandidate['invites'],
    keywords: string[] = [],
  ): MeetingCandidate => ({ projectId, invites, keywords })
  const during = { start: '2026-11-10T09:30:00.000Z', end: '2026-11-10T10:30:00.000Z' }
  const before = { start: '2026-11-10T08:00:00.000Z', end: '2026-11-10T09:00:00.000Z' }

  it('is of the only project whose calendar has a meeting at that time', () => {
    const candidates = [candidate('aurora', [before, during]), candidate('borea', [before])]
    expect(meetingOwner(kickoff, '', candidates)).toBe('aurora')
    // An invitation without an end is taken to last an hour.
    const open = [candidate('borea', [{ start: '2026-11-10T08:30:00.000Z', end: null }])]
    expect(meetingOwner({ ...kickoff, title: 'Sync' }, '', open)).toBe('borea')
  })

  it('is told by the words of the title or of the notes when the calendar does not say', () => {
    const candidates = [candidate('aurora', [], ['Aurora']), candidate('borea', [], ['Borea'])]
    expect(meetingOwner(kickoff, '', candidates)).toBe('aurora')
    expect(meetingOwner({ ...kickoff, title: 'Sync' }, 'Parlato di borea.', candidates)).toBe(
      'borea',
    )
    // A word is looked for as a whole: «Aurorale» does not name Aurora.
    expect(meetingOwner({ ...kickoff, title: 'Aurorale' }, '', candidates)).toBeNull()
  })

  it('is settled by the words among the projects that share the time', () => {
    const candidates = [
      candidate('aurora', [during], ['Aurora']),
      candidate('borea', [during], ['Borea']),
      candidate('cirro', [], ['Kickoff']),
    ]
    expect(meetingOwner(kickoff, '', candidates)).toBe('aurora')
  })

  it('is of no project when none or more than one could claim it: never by chance', () => {
    const both = [candidate('aurora', [during]), candidate('borea', [during])]
    expect(meetingOwner(kickoff, '', both)).toBeNull()
    const named = [candidate('aurora', [], ['Kickoff']), candidate('borea', [], ['Aurora'])]
    expect(meetingOwner(kickoff, '', named)).toBeNull()
    expect(meetingOwner(kickoff, '', [candidate('borea', [before], ['Borea'])])).toBeNull()
    expect(meetingOwner(kickoff, '', [])).toBeNull()
  })

  it('takes as the words of a project its name and what its mail is chosen by, but no address', () => {
    expect(projectKeywords('Aurora', ['aurora ', 'ACME', '@acme.example', 'Aurora', ''])).toEqual([
      'Aurora',
      'aurora',
      'ACME',
    ])
  })
})

describe('a recorded meeting without a project on the page of the day', () => {
  it('waits for the PM, heavier the longer it waits', () => {
    const [item] = unassignedMeetingItems([kickoff], new Date('2026-11-12T10:00:00.000Z'))
    expect(item).toEqual({
      key: `meeting-unassigned:${kickoff.id}`,
      band: 'waiting',
      facts: {
        kind: 'meeting_unassigned',
        id: kickoff.id,
        title: 'Kickoff Aurora',
        start: kickoff.started,
        minutes: 45,
        days: 2,
      },
      weight: 2,
      target: 'sources',
      asOf: null,
    })
  })
})
