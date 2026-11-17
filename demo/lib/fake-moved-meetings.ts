// Two synthetic projects that read the same folder of Verbale, with the mistake demo 47 puts
// right: the two dailies of Aurora were assigned by hand to Boreale, and the open points Claude
// read in them are in the register of Boreale. A third daily still waits for a project.
// Usage: node demo/lib/fake-moved-meetings.ts <work folder>
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  MEETING_META_FILE,
  MEETINGS_FOLDER,
  meetingFolderName,
  meetingMeta,
  NO_OPEN_POINTS,
  OPEN_POINTS_FILE,
  type OpenPoint,
  openPointsMarkdown,
  proposedPointId,
  readMeetingManifest,
} from '../../packages/domain/src/index.ts'
import {
  type FakeExport,
  publishDestination,
  writeExport,
} from '../../packages/infrastructure/test/support/verbale-export.ts'

const [work] = process.argv.slice(2)
if (!work) throw new Error('usage: fake-moved-meetings.ts <work folder>')

const aurora = join(work, 'Aurora')
const boreale = join(work, 'Boreale')
const verbale = join(work, 'Verbale')
const today = new Date().toISOString().slice(0, 10)
const at = (hour: string): string => `${today}T${hour}:00Z`
/** The people of Aurora: the three dailies are theirs. */
const AURORA_TEAM = ['Luca Verdi', 'Sara Neri', 'Paola Verdi']
const BOREALE_TEAM = ['Elena Costa', 'Ugo Gialli']
const people = AURORA_TEAM.map((name) => ({ name }))
const KEPT_FILES = ['transcript.md', 'notes.md', 'markers.json'] as const

const daily = (id: string, title: string, hour: string, passages: string[]): FakeExport => ({
  id,
  title,
  started: at(hour),
  duration: 15 * 60,
  revision: 1,
  participants: people,
  notes: passages.join('\n'),
  passages,
})
/** Assigned by mistake to Boreale, with the points Claude read in each. */
const WRONG: FakeExport[] = [
  daily('C7C7C7C7-0000-4000-8000-000000000001', 'Daily Standup Cliente', '08:00', [
    'Il certificato dell’ambiente di collaudo scade venerdì: Luca lo rinnova.',
    'La migrazione degli ordini aspetta la conferma del cliente.',
  ]),
  daily('C8C8C8C8-0000-4000-8000-000000000002', 'Daily Standup Interna', '08:30', [
    'Sara chiude il report dei test entro domani.',
    'Serve un secondo ambiente di prova per il multi-database.',
  ]),
]
/** Still without a project: its people are of Aurora. */
const WAITING = daily('C9C9C9C9-0000-4000-8000-000000000003', 'Daily Standup Fornitori', '09:00', [
  'Nessuna novità dai fornitori.',
])

const write = (file: string, content: string) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}
const json = (file: string, value: unknown) => write(file, JSON.stringify(value, null, 1))
const person = (name: string) => ({ name, role: 'Team', side: 'supplier' })

mkdirSync(verbale, { recursive: true })
await publishDestination(join(work, 'VerbaleDati'), verbale)
await writeExport(verbale, WAITING)

const points: OpenPoint[] = []
const read: string[] = []
for (const meeting of WRONG) {
  const exportFolder = await writeExport(verbale, meeting)
  const reading = readMeetingManifest(
    exportFolder,
    readFileSync(join(verbale, exportFolder, 'meeting.json'), 'utf8'),
  )
  if (reading.status !== 'complete') throw new Error(`not a finished meeting: ${exportFolder}`)
  // As Octo keeps a meeting of a project: its text files and the file that describes it.
  const folder = `${MEETINGS_FOLDER}/${meetingFolderName(reading.meeting)}`
  for (const name of KEPT_FILES) {
    cpSync(join(verbale, exportFolder, name), join(boreale, folder, name))
  }
  write(
    join(boreale, folder, MEETING_META_FILE),
    meetingMeta(reading.meeting, exportFolder, [...KEPT_FILES]),
  )
  read.push(reading.meeting.id)
  for (const quote of meeting.passages ?? []) {
    const source = { path: `${folder}/notes.md`, quote, verified: true }
    points.push({
      id: proposedPointId(source),
      title: quote.replace(/\.$/, ''),
      owner: '',
      openedOn: today,
      due: null,
      state: 'open',
      origin: 'claude',
      source,
      signalKey: null,
      signalKind: null,
      meeting: null,
      closedOn: null,
      closedBy: null,
      closing: null,
      history: [],
      check: null,
    })
  }
}
const register = { ...NO_OPEN_POINTS, points, readMeetings: read, closedDay: today }
json(join(boreale, '_octo', '.impostazioni', 'open-point.json'), register)
write(join(boreale, OPEN_POINTS_FILE), openPointsMarkdown(register))

write(
  join(boreale, 'stato.md'),
  '# Boreale\n\nIl collaudo del progetto Boreale è a gennaio 2027.\n',
)
for (const [folder, team] of [
  [aurora, AURORA_TEAM],
  [boreale, BOREALE_TEAM],
] as const) {
  const settings = join(folder, '_octo', '.impostazioni')
  json(join(settings, 'sources.json'), { mail: null, meetings: { root: verbale, since: today } })
  json(join(settings, 'team.json'), { people: team.map(person), periods: [] })
}
json(join(work, 'dati', 'projects.json'), [
  { id: 'demo-aurora', name: 'Aurora', folder: aurora, addedAt: '2026-11-14T08:00:00.000Z' },
  { id: 'demo-boreale', name: 'Boreale', folder: boreale, addedAt: '2026-11-15T08:00:00.000Z' },
])
