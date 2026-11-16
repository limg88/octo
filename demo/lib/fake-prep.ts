// Writes into the demo project what a card of preparation is made of: the recording of the same
// meeting a week ago, and a register of open points with one of the series, one of who is
// invited, one opened in that recording and one closed there.
// Usage: node demo/lib/fake-prep.ts <project folder>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  addOpenPoint,
  applyClosing,
  MEETINGS_FOLDER,
  meetingFolderName,
  meetingMeta,
  NO_OPEN_POINTS,
  type OpenPointRegister,
  previousWorkday,
  type RecordedMeeting,
  romeDateString,
} from '../../packages/domain/src/index.ts'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-prep.ts <project folder>')

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_DAYS = 7
/** The id of the invitation of the meeting of the day in the fake mail. */
const MEETING_UID = 'collaudo-aurora@cliente.example'
const today = romeDateString(new Date())
const lastWeek = new Date(Date.now() - WEEK_DAYS * DAY_MS)
const lastWeekDay = romeDateString(lastWeek)

const meeting: RecordedMeeting = {
  id: 'e5e5e5e5-0000-4000-8000-000000000040',
  // Called as the meeting of today: the calendar holds no series, the name tells.
  title: 'Aurora: prova generale del collaudo',
  started: lastWeek.toISOString(),
  timezone: 'Europe/Rome',
  durationSeconds: 40 * 60,
  participants: ['Carla Bianchi', 'Paola Verdi'],
  calendarEventUID: null,
  onlineMeetingURL: null,
  exportRevision: 1,
  exportedAt: lastWeek.toISOString(),
}
const folder = `${MEETINGS_FOLDER}/${meetingFolderName(meeting)}`
const report = `${folder}/report.md`
const ACTION = 'Azione: Preparare l’elenco dei casi di prova firmato dal cliente (Anna Bianchi).'
const CLOSED = 'Stima della migrazione dei dati: confermata a dodici giorni.'
const lines = [
  '# Aurora: prova generale del collaudo — riepilogo',
  '',
  'La prova generale si ripete fra una settimana, con l’ambiente di prova definitivo.',
  `- ${CLOSED}`,
  `- ${ACTION}`,
  '',
]
mkdirSync(join(project, folder), { recursive: true })
writeFileSync(join(project, report), lines.join('\n'))
writeFileSync(
  join(project, folder, '_meta.md'),
  meetingMeta(meeting, 'Verbale (demo)', ['report.md']),
)

const before = previousWorkday(previousWorkday(lastWeekDay))
let register: OpenPointRegister = addOpenPoint(
  NO_OPEN_POINTS,
  { title: 'Stima della migrazione dei dati', owner: 'Mario Rossi', origin: 'pm' },
  before,
)
const estimate = register.points[0]?.id ?? ''
// What reading that recording did: a point closed there, one opened there.
register = applyClosing(register, {
  day: lastWeekDay,
  at: lastWeek.toISOString(),
  model: 'claude-fake-default',
  read: [meeting.id],
  verdicts: [
    {
      id: estimate,
      outcome: 'resolved',
      said: 'Confermata a dodici giorni.',
      source: { path: report, quote: CLOSED, verified: true },
      meeting: meeting.title,
    },
  ],
  points: [
    {
      title: 'Preparare l’elenco dei casi di prova firmato dal cliente',
      owner: 'Anna Bianchi',
      due: null,
      source: { path: report, quote: ACTION, verified: true },
      meeting: MEETING_UID,
    },
  ],
})
register = addOpenPoint(
  register,
  {
    title: 'Conferma della data del collaudo',
    due: previousWorkday(today),
    origin: 'pm',
    meeting: MEETING_UID,
  },
  previousWorkday(previousWorkday(today)),
)
register = addOpenPoint(
  register,
  { title: 'Nome di chi firma il verbale di collaudo', owner: 'Carla Bianchi', origin: 'pm' },
  previousWorkday(today),
)

const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
writeFileSync(join(settings, 'open-point.json'), JSON.stringify(register, null, 1))
