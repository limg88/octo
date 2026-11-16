// Adds to a fake Mail folder the invitations of the meetings a PM has every week: a stand-up
// held every day, a weekly review called three weeks ago, and one meeting of the next working day.
// Usage: node demo/lib/fake-agenda.ts <mail folder>
import {
  addFakeMail,
  type FakeMail,
} from '../../packages/infrastructure/test/support/mail-folder.ts'

const [mailRoot] = process.argv.slice(2)
if (!mailRoot) throw new Error('usage: fake-agenda.ts <mail folder>')

const DAY_MS = 24 * 60 * 60 * 1000
const SERIES_STARTED_DAYS_AGO = 21
const SATURDAY = 6
const SUNDAY = 0
const now = Date.now()
const PM = 'Paola Verdi <pm@example.test>'
const CLIENT = 'Carla Bianchi <carla@cliente.example>'

/** A day of Italy as an invitation writes it: `20261116`. */
const romeDay = (at: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' })
    .format(new Date(at))
    .replaceAll('-', '')

function nextWorkday(): number {
  let at = now + DAY_MS
  while ([SATURDAY, SUNDAY].includes(new Date(at).getUTCDay())) at += DAY_MS
  return at
}

const person = (name: string, address: string): string =>
  `ATTENDEE;ROLE=REQ-PARTICIPANT;CN=${name}:mailto:${address}`

function invitation(event: {
  uid: string
  summary: string
  day: number
  from: string
  to: string
  location: string
  rule?: string
  people: string[]
}): string {
  return [
    'BEGIN:VCALENDAR',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `SUMMARY:${event.summary}`,
    `DTSTART;TZID=Europe/Rome:${romeDay(event.day)}T${event.from}00`,
    `DTEND;TZID=Europe/Rome:${romeDay(event.day)}T${event.to}00`,
    `LOCATION:${event.location}`,
    ...(event.rule ? [`RRULE:${event.rule}`] : []),
    'ORGANIZER;CN=Carla Bianchi:mailto:carla@cliente.example',
    ...event.people,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
}

const started = now - SERIES_STARTED_DAYS_AGO * DAY_MS
const team = [
  person('Paola Verdi', 'pm@example.test'),
  person('Luca Neri', 'luca@cliente.example'),
  person('Mario Rossi', 'mario.rossi@example.test'),
  person('Anna Bianchi', 'anna.bianchi@example.test'),
  person('Elena Costa', 'elena.costa@example.test'),
]

const invite = (id: number, messageId: string, subject: string, calendar: string): FakeMail => ({
  id,
  folder: 'Posta in arrivo',
  receivedAt: new Date(started - DAY_MS),
  message: { messageId, from: CLIENT, to: PM, subject, calendarMethod: 'REQUEST', calendar },
})

const MAILS: FakeMail[] = [
  invite(
    31,
    'standup@cliente.example',
    'Aurora: stand-up',
    invitation({
      uid: 'standup-aurora@cliente.example',
      summary: 'Aurora: stand-up',
      day: started,
      from: '0930',
      to: '0945',
      location: 'Teams',
      rule: 'FREQ=DAILY',
      people: team,
    }),
  ),
  invite(
    32,
    'sal@cliente.example',
    'Aurora: SAL settimanale',
    invitation({
      uid: 'sal-aurora@cliente.example',
      summary: 'Aurora: SAL settimanale',
      // Three weeks ago to the day: it falls today.
      day: started,
      from: '1100',
      to: '1200',
      location: 'Teams',
      rule: 'FREQ=WEEKLY',
      people: team.slice(0, 2),
    }),
  ),
  invite(
    33,
    'comitato@cliente.example',
    'Aurora: comitato di progetto',
    invitation({
      uid: 'comitato-aurora@cliente.example',
      summary: 'Aurora: comitato di progetto',
      day: nextWorkday(),
      from: '1000',
      to: '1100',
      location: 'Sala riunioni del cliente',
      people: team.slice(0, 2),
    }),
  ),
]
addFakeMail(mailRoot, MAILS)
