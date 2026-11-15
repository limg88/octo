// Writes what the page of the day needs on top of the other demo data of «Aurora»: a fake Mail
// folder with conversations (one answered, one not, a question of the PM nobody answered, an
// alert of a system, an invitation for today), the mail source already set, and the people and
// the calendar of the project with a sprint that ends tomorrow.
// Usage: node demo/lib/fake-today.ts <project folder> <mail folder>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  addFakeMail,
  type FakeMail,
} from '../../packages/infrastructure/test/support/mail-folder.ts'

const [project, mailRoot] = process.argv.slice(2)
if (!project || !mailRoot) throw new Error('usage: fake-today.ts <project folder> <mail folder>')

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const now = Date.now()
const hoursAgo = (hours: number): Date => new Date(now - hours * HOUR_MS)
const dayOf = (offset: number): string => new Date(now + offset * DAY_MS).toISOString().slice(0, 10)
/** The day in Italy, as an invitation writes it: `20261116`. */
const romeDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' })
  .format(new Date(now))
  .replaceAll('-', '')

const PM = 'Paola Verdi <pm@example.test>'
const CLIENT = 'Carla Bianchi <carla@cliente.example>'
const TECH = 'Luca Neri <luca@cliente.example>'

const invitation = [
  'BEGIN:VCALENDAR',
  'METHOD:REQUEST',
  'BEGIN:VEVENT',
  'UID:collaudo-aurora@cliente.example',
  'SUMMARY:Aurora: prova generale del collaudo',
  `DTSTART;TZID=Europe/Rome:${romeDay}T150000`,
  `DTEND;TZID=Europe/Rome:${romeDay}T160000`,
  'LOCATION:Sala riunioni del cliente',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\n')

const MAILS: FakeMail[] = [
  {
    id: 1,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(30),
    message: {
      messageId: 'collaudo@cliente.example',
      from: CLIENT,
      to: PM,
      subject: 'Aurora: data del collaudo',
      html: '<p>Buongiorno,</p><p>il collaudo di <b>Aurora</b> &egrave; spostato a gioved&igrave; 17 dicembre 2026. Va bene per voi?</p>',
    },
  },
  {
    // The answer of the PM: the mail above no longer waits.
    id: 2,
    folder: 'Posta inviata',
    receivedAt: hoursAgo(29),
    message: {
      messageId: 'risposta@example.test',
      inReplyTo: 'collaudo@cliente.example',
      from: PM,
      to: CLIENT,
      subject: 'R: data del collaudo',
      html: '<p>Grazie Carla, per noi va bene: confermo il collaudo per il 17 dicembre e avviso il team.</p>',
    },
  },
  {
    id: 3,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(2),
    message: {
      messageId: 'budget@cliente.example',
      from: CLIENT,
      to: PM,
      subject: 'Aurora: budget aggiuntivo approvato',
      html: '<p>Il comitato ha approvato un budget aggiuntivo di 8.000 euro per Aurora. Mi confermi entro la settimana come intendete usarlo?</p>',
    },
  },
  {
    // A system, not a person: nobody answers it.
    id: 4,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(5),
    message: {
      messageId: 'allarme@monitor.example',
      from: 'Monitor <avvisi@monitor.example>',
      to: PM,
      subject: '[FIRING] Aurora - disco pieno',
      html: '<p>1 firing alert instance</p>',
    },
  },
  {
    // A question of the PM that nobody answered for days.
    id: 5,
    folder: 'Posta inviata',
    receivedAt: hoursAgo(5 * 24),
    message: {
      messageId: 'ambiente@example.test',
      from: PM,
      to: TECH,
      subject: 'Aurora: ambiente di prova',
      html: '<p>Ciao Luca, quando sar&agrave; disponibile l&rsquo;ambiente di prova per il collaudo?</p>',
    },
  },
  {
    id: 6,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(20),
    message: {
      messageId: 'invito@cliente.example',
      from: CLIENT,
      to: PM,
      subject: 'Aurora: prova generale del collaudo',
      calendarMethod: 'REQUEST',
      calendar: invitation,
    },
  },
  {
    // Of another project: it never enters.
    id: 7,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(3),
    message: {
      messageId: 'zefiro@altro.example',
      from: 'Marta Rosa <marta@altro.example>',
      to: PM,
      subject: 'Zefiro: preventivo',
      html: '<p>In allegato il preventivo.</p>',
    },
  },
]
addFakeMail(mailRoot, MAILS)

const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
writeFileSync(
  join(settings, 'sources.json'),
  JSON.stringify(
    {
      mail: {
        since: dayOf(-30),
        keywords: ['Aurora'],
        folders: [],
        excludeSenders: [],
        keepQuoted: false,
        targetFolder: '_octo/posta',
      },
      ado: null,
      jira: null,
      confluence: null,
      dwsi: null,
    },
    null,
    1,
  ),
)
const person = (name: string, role: string, to = '') => ({
  name,
  role,
  side: 'supplier',
  from: '',
  to,
  allocation: null,
  note: '',
})
writeFileSync(
  join(settings, 'team.json'),
  JSON.stringify(
    {
      people: [
        person('Rossi Mario', 'Sviluppo'),
        person('Bianchi Anna', 'Analisi'),
        // Leaves the project in four days.
        person('Neri Sara', 'Test', dayOf(4)),
      ],
      // The sprint compared in «Allineamento» ends tomorrow.
      periods: [{ name: 'Sprint 28', from: dayOf(-13), to: dayOf(1) }],
    },
    null,
    1,
  ),
)
console.log(`${MAILS.length} mail in ${mailRoot}; posta, persone e calendario impostati`)
