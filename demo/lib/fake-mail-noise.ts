// Adds to the fake Mail folder of a demo the mail that asks nothing: a thank you written to the PM
// alone, and a notice written to many. The code cannot tell them from mail that waits; Claude can.
// Usage: node demo/lib/fake-mail-noise.ts <mail folder>
import {
  addFakeMail,
  type FakeMail,
} from '../../packages/infrastructure/test/support/mail-folder.ts'

const [mailRoot] = process.argv.slice(2)
if (!mailRoot) throw new Error('usage: fake-mail-noise.ts <mail folder>')

const HOUR_MS = 60 * 60 * 1000
const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * HOUR_MS)

const PM = 'Paola Verdi <pm@example.test>'
const CLIENT = 'Carla Bianchi <carla@cliente.example>'
const TECH = 'Luca Neri <luca@cliente.example>'
const MANY = `${PM}, ${TECH}, Rossi Mario <m.rossi@fornitore.example>`

const MAILS: FakeMail[] = [
  {
    id: 41,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(6),
    message: {
      messageId: 'grazie@cliente.example',
      from: TECH,
      to: PM,
      subject: 'Aurora: materiale della sessione',
      html: '<p>Grazie Paola per il materiale della sessione di Aurora, è tutto quello che ci serviva.</p>',
    },
  },
  {
    id: 42,
    folder: 'Posta in arrivo',
    receivedAt: hoursAgo(4),
    message: {
      messageId: 'chiusura@cliente.example',
      from: CLIENT,
      to: MANY,
      subject: 'Aurora: uffici chiusi venerdì',
      html: '<p>Per conoscenza: venerdì gli uffici del cliente restano chiusi, il lavoro su Aurora riprende lunedì.</p>',
    },
  },
]

addFakeMail(mailRoot, MAILS)
console.log(`${MAILS.length} mail in più in ${mailRoot}: un ringraziamento e un avviso`)
