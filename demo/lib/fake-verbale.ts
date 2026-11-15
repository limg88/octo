// Writes what stands for Verbale in a demo: the folder it exports the meetings to, with finished
// meetings and exports Octo must leave out, the data folder where Verbale says which folder it
// exports to, and the invitation of one of the meetings in the fake Mail folder.
// Usage: node demo/lib/fake-verbale.ts <export folder> <Verbale data folder> <mail folder> [again]
// With `again`, the first meeting is exported again: a correction and a report.
import { mkdirSync } from 'node:fs'
import { addFakeMail } from '../../packages/infrastructure/test/support/mail-folder.ts'
import {
  type FakeExport,
  publishDestination,
  writeExport,
} from '../../packages/infrastructure/test/support/verbale-export.ts'

const [root, verbaleFolder, mailRoot, again] = process.argv.slice(2)
if (!root || !verbaleFolder || !mailRoot) {
  throw new Error(
    'usage: fake-verbale.ts <export folder> <Verbale data folder> <mail folder> [again]',
  )
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const INVITE_MAIL_ID = 20
const now = Date.now()
/** A day before today at ten in the morning in universal time, as Verbale writes an instant. */
const tenOf = (daysAgo: number): string =>
  `${new Date(now - daysAgo * DAY_MS).toISOString().slice(0, 10)}T10:00:00Z`
const compact = (instant: string): string => instant.replace(/[-:]/g, '')

const WEEKLY: FakeExport = {
  id: 'A1A1A1A1-0000-4000-8000-000000000001',
  title: 'Punto settimanale',
  started: tenOf(1),
  duration: 45 * 60,
  revision: 1,
  speakers: { '1': 'Carla Bianchi', '2': 'Paola Verdi' },
  notes: 'Collaudo: serve l’ambiente di prova entro venerdì.',
  passages: [
    'Il collaudo resta il 17 dicembre, se l’ambiente di prova arriva entro venerdì.',
    'Luca conferma l’ambiente di prova entro giovedì.',
  ],
}
const CORRECTED: FakeExport = {
  ...WEEKLY,
  revision: 2,
  passages: [
    'Il collaudo resta il 17 dicembre, se l’ambiente di prova arriva entro mercoledì.',
    'Luca conferma l’ambiente di prova entro martedì.',
  ],
  report: '# Riepilogo\n\nCollaudo confermato al 17 dicembre.\n',
}
const EXPORTS: FakeExport[] = [
  WEEKLY,
  {
    // Named after the other project: it goes there, by its title.
    id: 'B2B2B2B2-0000-4000-8000-000000000002',
    title: 'Boreale: pianificazione di gennaio',
    started: tenOf(2),
    duration: 30 * 60,
    revision: 1,
    passages: ['Il collaudo di Boreale si pianifica nella seconda settimana di gennaio.'],
  },
  {
    // No invitation and no word of a project: it waits for the PM.
    id: 'C3C3C3C3-0000-4000-8000-000000000003',
    title: 'Allineamento fornitori',
    started: tenOf(3),
    duration: 25 * 60,
    passages: ['Il fornitore dell’ambiente di prova chiede due giorni di preavviso.'],
  },
  {
    id: 'D4D4D4D4-0000-4000-8000-000000000004',
    title: 'Riunione in corso',
    started: tenOf(0),
    duration: 5 * 60,
    state: 'recording',
  },
  {
    id: 'E5E5E5E5-0000-4000-8000-000000000005',
    title: 'Formato futuro',
    started: tenOf(4),
    duration: 10 * 60,
    schemaVersion: 2,
  },
  {
    id: 'F6F6F6F6-0000-4000-8000-000000000006',
    title: 'Esportazione rovinata',
    started: tenOf(5),
    duration: 10 * 60,
    manifest: '{"schemaVersion": 1, "id":',
  },
]

if (again) {
  await writeExport(root, CORRECTED)
} else {
  mkdirSync(root, { recursive: true })
  for (const meeting of EXPORTS) await writeExport(root, meeting)
  // Verbale says which folder it exports to: Octo proposes it.
  await publishDestination(verbaleFolder, root)
  const start = compact(WEEKLY.started)
  const end = compact(new Date(Date.parse(WEEKLY.started) + HOUR_MS).toISOString().slice(0, 19))
  addFakeMail(mailRoot, [
    {
      id: INVITE_MAIL_ID,
      folder: 'Posta in arrivo',
      receivedAt: new Date(now - 3 * DAY_MS),
      message: {
        messageId: 'punto@cliente.example',
        from: 'Carla Bianchi <carla@cliente.example>',
        to: 'Paola Verdi <pm@example.test>',
        subject: 'Aurora: punto settimanale',
        calendarMethod: 'REQUEST',
        calendar: [
          'BEGIN:VCALENDAR',
          'METHOD:REQUEST',
          'BEGIN:VEVENT',
          'UID:punto-aurora@cliente.example',
          'SUMMARY:Aurora: punto settimanale',
          `DTSTART:${start}`,
          `DTEND:${end}Z`,
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\n'),
      },
    },
  ])
}
