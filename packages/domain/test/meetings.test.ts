import { describe, expect, it } from 'vitest'
import {
  beforeFirstDay,
  certainProject,
  cleanMeetingsSource,
  likelierProject,
  MAX_MEETING_REASON,
  MEETINGS_FOLDER,
  type MeetingCandidate,
  type MeetingReading,
  meetingFolderName,
  meetingMeta,
  meetingOwner,
  meetingPeople,
  meetingsReadingNote,
  outsideTeam,
  parseMeetingMeta,
  placeMeeting,
  projectByPeople,
  projectKeywords,
  type RecordedMeeting,
  readMeetingManifest,
  sameExport,
  tellingPresence,
  withMeetingChoice,
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
  calendarEventUID: null,
  onlineMeetingURL: null,
  exportRevision: null,
  exportedAt: null,
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

  it('takes what a newer Verbale adds: who took part, the event, which export it is', () => {
    const reading = readMeetingManifest(
      'c',
      manifest({
        participants: [
          { name: 'Luca', email: 'luca@cliente.example' },
          { name: ' Anna ' },
          { name: 'Anna' },
          { email: 'senza@nome.example' },
          'Marta',
        ],
        calendarEventUID: ' uid-7 ',
        onlineMeetingURL: 'https://teams.example/l/1',
        exportRevision: 3,
        exportedAt: '2026-11-10T10:00:00Z',
      }),
    )
    expect(reading.status === 'complete' && reading.meeting).toMatchObject({
      // The list of the participants comes before the names given to the voices.
      participants: ['Anna', 'Luca <luca@cliente.example>'],
      calendarEventUID: 'uid-7',
      onlineMeetingURL: 'https://teams.example/l/1',
      exportRevision: 3,
      exportedAt: '2026-11-10T10:00:00.000Z',
    })
    const odd = readMeetingManifest('c', manifest({ exportedAt: 'boh', exportRevision: '3' }))
    expect(
      odd.status === 'complete' && [odd.meeting.exportedAt, odd.meeting.exportRevision],
    ).toEqual([null, null])
  })

  it('tells whether a folder read again still holds the same export', () => {
    const third = { ...kickoff, exportRevision: 3, exportedAt: '2026-11-10T10:00:00.000Z' }
    const again = (meeting: RecordedMeeting): MeetingReading => ({
      folder: 'c',
      status: 'complete',
      meeting,
    })
    expect(sameExport(third, again(third))).toBe(true)
    // An export made before Verbale counted them: the same as long as it is there.
    expect(sameExport(kickoff, again(kickoff))).toBe(true)
    expect(sameExport(third, again({ ...third, exportRevision: 4 }))).toBe(false)
    expect(sameExport(third, again({ ...third, exportedAt: '2026-11-10T10:05:00.000Z' }))).toBe(
      false,
    )
    expect(sameExport(third, again({ ...third, id: 'altra' }))).toBe(false)
    expect(sameExport(third, readMeetingManifest('c', null))).toBe(false)
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
    expect(cleanMeetingsSource({ root: '  ~/Documents/Verbale/ ', since: ' ' })).toEqual({
      root: '~/Documents/Verbale',
      since: null,
    })
    expect(cleanMeetingsSource({ root: '/', since: '2026-11-16' })).toEqual({
      root: '/',
      since: '2026-11-16',
    })
    expect(cleanMeetingsSource({ root: 'C:\\Verbale', since: null }).root).toBe('C:\\Verbale')
    // The meetings taken away from the project are kept, each once; none, nothing is written.
    expect(
      cleanMeetingsSource({ root: '/v', since: null, released: [' m-1 ', 'm-1', '', 'm-2'] }),
    ).toEqual({ root: '/v', since: null, released: ['m-1', 'm-2'] })
    expect(cleanMeetingsSource({ root: '/v', since: null, released: [] })).toEqual({
      root: '/v',
      since: null,
    })
    for (const root of ['', 'Verbale', '../Verbale', '~altro/Verbale']) {
      expect(() => cleanMeetingsSource({ root, since: null })).toThrow('source_config_invalid')
    }
    expect(() => cleanMeetingsSource({ root: '/v', since: 'ieri' })).toThrow(
      'source_config_invalid',
    )
  })

  it('leaves alone what Verbale recorded before the first day taken', () => {
    const finished: MeetingReading = { folder: 'c', status: 'complete', meeting: kickoff }
    expect(beforeFirstDay(finished, null)).toBe(false)
    expect(beforeFirstDay(finished, '2026-11-10')).toBe(false)
    expect(beforeFirstDay(finished, '2026-11-11')).toBe(true)
    // What was left out is judged by the day Verbale put in the name of its folder.
    const left = (folder: string) => readMeetingManifest(folder, null)
    expect(beforeFirstDay(left('2026-11-05_143131_Chiamata_Teams_B03368F3'), '2026-11-10')).toBe(
      true,
    )
    expect(beforeFirstDay(left('2026-11-12_100000_Riunione_AB12CD34'), '2026-11-10')).toBe(false)
    expect(beforeFirstDay(left('senza-data'), '2026-11-10')).toBe(false)
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
    expect(meta).not.toContain('Riunione online')
    const online = { ...kickoff, onlineMeetingURL: 'https://teams.example/l/1' }
    expect(meetingMeta(online, 'c', [])).toContain('- Riunione online: https://teams.example/l/1')
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
        { folder: 'mossa', status: 'skipped', reason: 'changing', detail: '' },
      ],
      [{ folder: 'orfana', status: 'complete', meeting: kickoff }],
    )
    expect(note).toContain('Cartella letta: `~/Verbale`')
    expect(note).toContain('- `in-corso`: riunione non completa (recording)')
    expect(note).toContain('- `rotta`: `meeting.json` non si legge: non è JSON valido')
    expect(note).toContain('- `mossa`: esportata di nuovo durante la lettura')
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
  const during = { uid: 'd', start: '2026-11-10T09:30:00.000Z', end: '2026-11-10T10:30:00.000Z' }
  const before = { uid: 'b', start: '2026-11-10T08:00:00.000Z', end: '2026-11-10T09:00:00.000Z' }

  it('is of the only project whose calendar has a meeting at that time', () => {
    const candidates = [candidate('aurora', [before, during]), candidate('borea', [before])]
    expect(meetingOwner(kickoff, '', candidates)).toBe('aurora')
    // An invitation without an end is taken to last an hour.
    const open = [candidate('borea', [{ uid: 'o', start: '2026-11-10T08:30:00.000Z', end: null }])]
    expect(meetingOwner({ ...kickoff, title: 'Sync' }, '', open)).toBe('borea')
  })

  it('is of the project whose meeting that repeats falls at that time', () => {
    // Called a month before, every Tuesday at the hour of the recording.
    const weekly = {
      uid: 'w',
      start: '2026-10-13T08:30:00.000Z',
      end: '2026-10-13T09:30:00.000Z',
      recurrence: 'FREQ=WEEKLY;BYDAY=TU',
    }
    const sync = { ...kickoff, title: 'Sync' }
    expect(meetingOwner(sync, '', [candidate('aurora', []), candidate('borea', [weekly])])).toBe(
      'borea',
    )
    const skipped = { ...weekly, excluded: [kickoff.started.replace(/T.*/, 'T09:30:00.000Z')] }
    expect(meetingOwner(sync, '', [candidate('borea', [skipped])])).toBeNull()
  })

  it('is of the only project invited to the very event Verbale names, whatever its day', () => {
    // A meeting that repeats is invited once, with the day of its first time.
    const series = { uid: 'serie-1', start: '2026-10-06T09:00:00.000Z', end: null }
    const named = { ...kickoff, title: 'Sync', calendarEventUID: 'serie-1' }
    expect(
      meetingOwner(named, '', [candidate('aurora', [during]), candidate('borea', [series])]),
    ).toBe('borea')
    // Invited in two projects, the event says nothing: the time and the words decide.
    const both = [candidate('aurora', [series, during]), candidate('borea', [series])]
    expect(meetingOwner(named, '', both)).toBe('aurora')
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

describe('whether a meeting is of a project', () => {
  const pm = ['Paola Verdi', 'pm@example.test']
  const rule = {
    people: meetingPeople(['Paola Verdi', 'Rossi Mario', 'Carla Bianchi', ' '], pm),
    keywords: ['Aurora', 'collaudo ordini'],
    pm,
  }
  const meeting = (title: string, participants: string[]) => ({ title, participants })

  it('is told by one of its people taking part, the PM left out, or by its name in the title', () => {
    // The PM is in every meeting: alone, they tell nothing.
    expect(rule.people).toEqual(['Rossi Mario', 'Carla Bianchi'])
    expect(
      placeMeeting(meeting('Allineamento', ['Paola Verdi <pm@example.test>']), rule, undefined),
    ).toEqual({ place: 'unknown', why: null, reason: '' })
    expect(
      placeMeeting(meeting('Allineamento', ['mario.rossi@example.test']), rule, undefined),
    ).toMatchObject({ place: 'project', why: 'person' })
    expect(placeMeeting(meeting('Aurora: stato', []), rule, undefined)).toMatchObject({
      place: 'project',
      why: 'keyword',
    })
  })

  it('is not of the project when others take part and nobody of its team, whatever its title', () => {
    const outside = meeting('Aurora: stima delle ore', ['Paola Verdi', 'Ugo Neri', 'Lea Blu'])
    expect(placeMeeting(outside, rule, undefined)).toEqual({
      place: 'other',
      why: 'outside',
      reason: '',
    })
    // Claude is not heard against who took part; the PM is.
    const claude = { place: 'project', by: 'claude', reason: 'Nomina Aurora.' } as const
    expect(placeMeeting(outside, rule, claude).why).toBe('outside')
    expect(placeMeeting(outside, rule, { ...claude, by: 'pm' }).place).toBe('project')
    // A team that names nobody, or a meeting nobody is known of, says nothing.
    expect(outsideTeam(['Ugo Neri'], [], pm)).toBe(false)
    expect(outsideTeam(['Paola Verdi'], rule.people, pm)).toBe(false)
    expect(outsideTeam(['Ugo Neri', 'Mario Rossi'], rule.people, pm)).toBe(false)
  })

  it('is as Claude said where the rule cannot tell, and as the PM says before anything else', () => {
    const doubtful = meeting('Comitato', [])
    const claude = { place: 'other', by: 'claude', reason: 'Parla del budget di Boreale.' } as const
    expect(placeMeeting(doubtful, rule, claude)).toEqual({
      place: 'other',
      why: 'claude',
      reason: 'Parla del budget di Boreale.',
    })
    // The rule comes before Claude; the PM before the rule.
    expect(placeMeeting(meeting('Aurora', []), rule, claude).why).toBe('keyword')
    const mine = { place: 'other', by: 'pm', reason: '' } as const
    expect(placeMeeting(meeting('Aurora', ['Rossi Mario']), rule, mine)).toMatchObject({
      place: 'other',
      why: 'pm',
    })
  })

  it('keeps every meeting while the project names no person to tell it by', () => {
    const bare = { people: [], keywords: ['Aurora'] }
    expect(placeMeeting(meeting('Comitato', ['Ugo Neri']), bare, undefined)).toMatchObject({
      place: 'project',
      why: 'no_people',
    })
  })

  it('keeps the words on the meetings short and not for ever', () => {
    const long = 'x'.repeat(MAX_MEETING_REASON + 50)
    const kept = withMeetingChoice({ a: { place: 'unknown', by: 'claude', reason: '' } }, 'b', {
      place: 'project',
      by: 'claude',
      reason: ` ${long}`,
    })
    expect(Object.keys(kept)).toEqual(['a', 'b'])
    expect(kept.b?.reason).toHaveLength(MAX_MEETING_REASON)
    const again = withMeetingChoice(kept, 'a', { place: 'other', by: 'pm', reason: '' })
    expect(Object.keys(again)).toEqual(['b', 'a'])
  })

  it('gives a recording to the only project with one of its people there', () => {
    const teams = [
      { projectId: 'p-a', people: ['Rossi Mario'] },
      { projectId: 'p-b', people: ['Carla Neri', 'Luca Verdi'] },
    ]
    expect(projectByPeople(['Mario Rossi', 'Ospite'], teams)).toBe('p-a')
    expect(projectByPeople(['Mario Rossi', 'Luca Verdi'], teams)).toBeNull()
    expect(projectByPeople(['Ospite'], teams)).toBeNull()
  })
})

describe('the project the people of a meeting point to', () => {
  const teams = [
    { projectId: 'p-a', people: ['Rossi Mario', 'Anna Bianchi', 'Luca Verdi'] },
    { projectId: 'p-b', people: ['Carla Neri', 'Luca Verdi'] },
    { projectId: 'p-c', people: [] },
  ]
  const people = ['Mario Rossi <mario@example.test>', 'BIANCHI, Anna', 'Ospite Esterno']

  it('is the only other project with more of them than this one', () => {
    expect(likelierProject(people, 'p-b', teams)).toBe('p-a')
    expect(likelierProject(people, 'p-c', teams)).toBe('p-a')
    // This project has as many, or more: nothing to say.
    expect(likelierProject(people, 'p-a', teams)).toBeNull()
    expect(likelierProject(['Luca Verdi'], 'p-a', teams)).toBeNull()
  })

  it('is none when nobody is known, two others have as many, or the project has no team', () => {
    expect(likelierProject(['Ospite Esterno'], 'p-b', teams)).toBeNull()
    expect(likelierProject([], 'p-b', teams)).toBeNull()
    expect(likelierProject(['Luca Verdi'], 'p-c', teams)).toBeNull()
    expect(likelierProject(people, 'p-altro', teams)).toBe('p-a')
  })
})

describe('whether who took part tells a meeting as of a project', () => {
  const team = {
    projectId: 'p-a',
    people: ['Rossi Mario', 'Anna Bianchi', 'Dario Cliente'],
    clients: ['Dario Cliente'],
  }

  it('is told by somebody of the client, or by two of its people who are no fewer than the others', () => {
    expect(tellingPresence(['Dario Cliente <dario@example.test>', 'Ugo', 'Lea', 'Pia'], team)).toBe(
      true,
    )
    expect(tellingPresence(['Mario Rossi', 'BIANCHI, Anna'], team)).toBe(true)
    expect(tellingPresence(['Mario Rossi', 'Anna Bianchi', 'Ugo', 'Lea'], team)).toBe(true)
  })

  it('is not told by one person of the supplier, nor by two among many others', () => {
    expect(tellingPresence(['Mario Rossi'], team)).toBe(false)
    expect(tellingPresence(['Anna Bianchi', 'Ugo', 'Lea'], team)).toBe(false)
    expect(tellingPresence(['Mario Rossi', 'Anna Bianchi', 'Ugo', 'Lea', 'Pia'], team)).toBe(false)
    expect(tellingPresence([], team)).toBe(false)
    expect(
      tellingPresence(['Dario Cliente'], { projectId: 'p-b', people: ['Dario Cliente'] }),
    ).toBe(false)
  })
})

describe('the project a meeting is certainly of, by who took part', () => {
  const teams = [
    { projectId: 'p-a', people: ['Rossi Mario', 'Anna Bianchi', 'Paola Verdi'] },
    { projectId: 'p-b', people: ['Carla Neri', 'Paola Verdi'] },
    { projectId: 'p-c', people: [] },
  ]

  it('is the only project whose team has every participant a team knows', () => {
    // The PM is of both projects and tells nothing alone; the guest is of none and is not counted.
    const daily = ['Mario Rossi <mario@example.test>', 'BIANCHI, Anna', 'Paola Verdi', 'Ospite']
    expect(certainProject(daily, teams)).toBe('p-a')
    expect(certainProject(['Carla Neri', 'Paola Verdi'], teams)).toBe('p-b')
    expect(certainProject(['Carla Neri'], teams)).toBe('p-b')
  })

  it('is none when the people are of more projects, of two that both have them all, or unknown', () => {
    expect(certainProject(['Mario Rossi', 'Carla Neri'], teams)).toBeNull()
    expect(certainProject(['Paola Verdi'], teams)).toBeNull()
    expect(certainProject(['Ospite Esterno'], teams)).toBeNull()
    expect(certainProject([], teams)).toBeNull()
    expect(certainProject(['Mario Rossi'], [])).toBeNull()
  })
})
