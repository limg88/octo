// Writes into the demo project a meeting as Octo keeps it once Verbale recorded it: the weekly
// review of today, with a report that closes one open point, talks about another and opens one.
// Usage: node demo/lib/fake-recorded.ts <project folder>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MEETINGS_FOLDER,
  meetingFolderName,
  meetingMeta,
  type RecordedMeeting,
  romeDateString,
  romeMidnight,
} from '../../packages/domain/src/index.ts'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-recorded.ts <project folder>')

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS
/** Two minutes past eleven in Italy: the weekly review of the fake calendar starts at eleven. */
const STARTED_AFTER_MIDNIGHT_MS = (11 * 60 + 2) * MINUTE_MS
const DUE_IN_DAYS = 3
const today = romeDateString(new Date())
const [year, month, day] = today.split('-').map(Number) as [number, number, number]
const started = new Date(romeMidnight(year, month, day).getTime() + STARTED_AFTER_MIDNIGHT_MS)
const due = romeDateString(new Date(Date.now() + DUE_IN_DAYS * DAY_MS))

const meeting: RecordedMeeting = {
  id: 'd4d4d4d4-0000-4000-8000-000000000039',
  title: 'Aurora: SAL settimanale',
  started: started.toISOString(),
  timezone: 'Europe/Rome',
  durationSeconds: 50 * 60,
  participants: ['Carla Bianchi', 'Paola Verdi', 'Luca Neri'],
  calendarEventUID: null,
  onlineMeetingURL: null,
  exportRevision: 1,
  exportedAt: new Date().toISOString(),
}

const report = [
  '# Aurora: SAL settimanale — riepilogo',
  '',
  '## Punti discussi',
  '',
  '- Ambiente di prova per il collaudo: consegnato da Luca questa mattina, il collaudo resta il 17 dicembre.',
  '- Risposta al cliente sulla variante CR-12: Paola la manda dopo il comitato, serve prima la stima di Mario.',
  '',
  '## Azioni',
  '',
  `- Azione: Aggiornare il piano dei test dopo la consegna dell’ambiente (Anna Bianchi) entro ${due}.`,
  '',
].join('\n')
const transcript = [
  '**Luca Neri**: l’ambiente di prova è su da stamattina, potete entrare.',
  '**Carla Bianchi**: bene, allora il collaudo resta il 17 dicembre.',
  '**Paola Verdi**: per la variante CR-12 rispondo dopo il comitato.',
  '',
].join('\n')

const folder = join(project, MEETINGS_FOLDER, meetingFolderName(meeting))
mkdirSync(folder, { recursive: true })
writeFileSync(join(folder, 'report.md'), report)
writeFileSync(join(folder, 'transcript.md'), transcript)
writeFileSync(
  join(folder, '_meta.md'),
  meetingMeta(meeting, 'Verbale (demo)', ['transcript.md', 'report.md']),
)
console.log(`Riunione registrata scritta in ${folder}`)
