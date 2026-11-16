// Adds to the fake Mail folder of a demo the mail that tells whose turn it is: written to many
// people and asking all of them, asking another person by name, a conversation of three mails
// whose last asks the PM, one a colleague has already answered, and a notice of a system.
// Usage: node demo/lib/fake-mail-turns.ts <mail folder>
import {
  addFakeMail,
  type FakeMail,
} from '../../packages/infrastructure/test/support/mail-folder.ts'

const [mailRoot] = process.argv.slice(2)
if (!mailRoot) throw new Error('usage: fake-mail-turns.ts <mail folder>')

const HOUR_MS = 60 * 60 * 1000
const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * HOUR_MS)

const PM = 'Paola Verdi <pm@example.test>'
const CLIENT = 'Carla Bianchi <carla@cliente.example>'
const TECH = 'Luca Neri <luca@cliente.example>'
const OURS = 'Rossi Mario <m.rossi@fornitore.example>'
const MANY = `${PM}, ${TECH}, ${OURS}, Ufficio acquisti <acquisti@cliente.example>`

const mail = (
  id: number,
  hours: number,
  message: NonNullable<FakeMail['message']>,
  folder = 'Posta in arrivo',
): FakeMail => ({ id, folder, receivedAt: hoursAgo(hours), message })

const MAILS: FakeMail[] = [
  mail(21, 50, {
    messageId: 'recap@cliente.example',
    from: CLIENT,
    to: MANY,
    subject: 'Aurora: recap della sessione di prova',
    html: '<p>Ciao a tutti,</p><p>di seguito il recap della sessione di prova di Aurora: esito positivo su tutti i punti.</p>',
  }),
  mail(22, 40, {
    messageId: 'ambiente@cliente.example',
    from: CLIENT,
    to: MANY,
    subject: 'Aurora: ambiente di collaudo',
    html: '<p>Luca, ci confermi che l’ambiente di collaudo di Aurora è pronto per lunedì?</p>',
  }),
  mail(23, 30, {
    messageId: 'piano-1@cliente.example',
    from: TECH,
    to: MANY,
    subject: 'Aurora: piano di rilascio',
    html: '<p>Ciao a tutti,</p><p>condivido la prima bozza del piano di rilascio di Aurora.</p>',
  }),
  mail(24, 20, {
    messageId: 'piano-2@cliente.example',
    inReplyTo: 'piano-1@cliente.example',
    from: CLIENT,
    to: MANY,
    subject: 'R: Aurora: piano di rilascio',
    html: '<p>Grazie a tutti, per noi la bozza va bene.</p>',
  }),
  mail(25, 5, {
    messageId: 'piano-3@cliente.example',
    inReplyTo: 'piano-2@cliente.example',
    from: CLIENT,
    to: MANY,
    subject: 'R: Aurora: piano di rilascio',
    html: '<p>Paola, ci mandi il piano di rilascio definitivo di Aurora entro venerdì?</p>',
  }),
  mail(26, 26, {
    messageId: 'log@cliente.example',
    from: TECH,
    to: MANY,
    subject: 'Aurora: errore nei log di notte',
    html: '<p>Nei log di Aurora di stanotte compare un errore di connessione: qualcuno può guardare?</p>',
  }),
  // One of the supplier's own answers the client, the PM in copy: the conversation is taken up.
  mail(27, 24, {
    messageId: 'log-risposta@fornitore.example',
    inReplyTo: 'log@cliente.example',
    from: OURS,
    to: TECH,
    cc: PM,
    subject: 'R: Aurora: errore nei log di notte',
    html: '<p>Ciao Luca, l’ho visto: è il rinnovo del certificato, lo sistemo in giornata.</p>',
  }),
  mail(28, 8, {
    messageId: 'notifica@devops.example',
    from: 'Azure DevOps <azuredevops@microsoft.com>',
    to: PM,
    subject: 'Aurora: User Story 44254 è stata modificata',
    html: '<p>Lo stato della voce 44254 di Aurora è cambiato.</p>',
  }),
]

addFakeMail(mailRoot, MAILS)
console.log(`${MAILS.length} mail in più in ${mailRoot}: a molti, a un altro, una conversazione`)
