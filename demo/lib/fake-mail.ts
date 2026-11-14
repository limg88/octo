// Builds a fake Mail.app folder with synthetic messages about the demo project «Aurora».
// Usage: node demo/lib/fake-mail.ts <folder> [extra]
// `extra` adds one more message to a folder already built.
import {
  addFakeMail,
  type FakeMail,
} from '../../packages/infrastructure/test/support/mail-folder.ts'

const HOUR_MS = 60 * 60 * 1000
const [root, extra] = process.argv.slice(2)
if (!root) throw new Error('usage: fake-mail.ts <folder> [extra]')

const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * HOUR_MS)
const CLIENT = 'Carla Bianchi <carla@cliente.example>'

const MAILS: FakeMail[] = [
  {
    id: 1,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(30),
    message: {
      messageId: 'collaudo@cliente.example',
      from: CLIENT,
      subject: 'Aurora: data del collaudo',
      html: '<p>Buongiorno,</p><p>il collaudo di <b>Aurora</b> &egrave; spostato a gioved&igrave; 17 dicembre 2026.</p>',
    },
  },
  {
    id: 2,
    folder: 'Posta inviata',
    receivedAt: hoursAgo(29),
    message: {
      messageId: 'risposta@example.test',
      from: 'Paola Verdi <pm@example.test>',
      to: CLIENT,
      subject: 'R: Aurora: data del collaudo',
      html: '<p>Grazie Carla, per noi va bene: confermo il collaudo per il 17 dicembre e avviso il team.</p>',
    },
  },
  {
    id: 3,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(28),
    message: {
      messageId: 'allarme@monitor.example',
      from: 'Monitor <avvisi@monitor.example>',
      subject: '[FIRING] Aurora - disco pieno',
      html: '<p>1 firing alert instance</p>',
    },
  },
  {
    id: 4,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(27),
    message: {
      messageId: 'accettata@cliente.example',
      from: CLIENT,
      subject: 'Accettata: Aurora - collaudo',
      calendarMethod: 'REPLY',
    },
  },
  {
    id: 5,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(26),
    message: {
      messageId: 'zefiro@altro.example',
      from: 'Luca Neri <luca@altro.example>',
      subject: 'Zefiro: preventivo',
      html: '<p>In allegato il preventivo per la sala aurorale del museo.</p>',
    },
  },
  {
    id: 6,
    folder: 'Posta eliminata',
    receivedAt: hoursAgo(25),
    message: {
      messageId: 'cestino@cliente.example',
      from: CLIENT,
      subject: 'Aurora: bozza superata',
      html: '<p>Ignora questa versione.</p>',
    },
  },
]

const EXTRA: FakeMail = {
  id: 1007,
  folder: 'Posta in arrivo',
  receivedAt: hoursAgo(1),
  message: {
    messageId: 'budget@cliente.example',
    from: CLIENT,
    subject: 'Aurora: budget aggiuntivo approvato',
    html: '<p>Il comitato ha approvato un budget aggiuntivo di 8.000 euro per Aurora.</p>',
  },
}

const mails = extra ? [EXTRA] : MAILS
addFakeMail(root, mails)
console.log(`${mails.length} mail in ${root}`)
