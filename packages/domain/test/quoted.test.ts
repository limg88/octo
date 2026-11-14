import { describe, expect, it } from 'vitest'
import { MIN_OWN_CHARS, ownText } from '../src/mail/quoted.ts'

const REPLY = 'Confermo il collaudo per il 20 novembre: avviso io il cliente e il fornitore.'
const EARLIER = [
  'Da: Carla Cliente <carla@cliente.example>',
  'Inviato: martedì 4 novembre 2026 09:12',
  'A: Paola Prova <paola@example.test>',
  'Oggetto: R: Collaudo',
  '',
  'Possiamo spostare il collaudo? Il budget resta 890.000 euro.',
].join('\n')
const FIRST = [
  'From: Paola Prova <paola@example.test>',
  'Sent: Monday, November 3, 2026 6:00 PM',
  'To: Carla Cliente <carla@cliente.example>',
  'Subject: Collaudo',
  '',
  'Propongo il collaudo il 18 novembre.',
].join('\n')
const RULE = '________________________________'

describe('what the author of a mail wrote', () => {
  it('leaves a mail that quotes nothing as it is', () => {
    expect(ownText(`${REPLY}\n\nSaluti,\nPaola`)).toBe(`${REPLY}\n\nSaluti,\nPaola`)
  })

  it('cuts at the header block of Outlook, in Italian or English, with the rule above it', () => {
    expect(ownText(`${REPLY}\n${RULE}\n${EARLIER}\n${RULE}\n${FIRST}`)).toBe(REPLY)
    expect(ownText(`${REPLY}\n\n${FIRST}`)).toBe(REPLY)
  })

  it.each([
    '-----Messaggio originale-----',
    '-----Original Message-----',
    '---------- Forwarded message ---------',
    'Il giorno mar 4 nov 2026 alle ore 09:12 Carla Cliente <carla@cliente.example> ha scritto:',
    'On Tue, Nov 4, 2026 at 9:12 AM Carla Cliente <carla@cliente.example> wrote:',
  ])('cuts at «%s»', (marker) => {
    expect(ownText(`${REPLY}\n\n${marker}\n> Possiamo spostare il collaudo?`)).toBe(REPLY)
  })

  it('a forward or a one-word reply keeps the first message it quotes, and only that one', () => {
    const forwarded = ownText(`Per conoscenza.\n${RULE}\n${EARLIER}\n${RULE}\n${FIRST}`)
    expect(forwarded).toContain('Per conoscenza.')
    expect(forwarded).toContain('Il budget resta 890.000 euro.')
    expect(forwarded).not.toContain('Propongo il collaudo')
    // With nothing after the first quoted message, all of it stays.
    expect(ownText(`ok\n${RULE}\n${EARLIER}`)).toContain('890.000')
    expect('Per conoscenza.'.length).toBeLessThan(MIN_OWN_CHARS)
  })

  it('drops the footer of a Teams invitation, quoted messages or not', () => {
    const footer = `${RULE}\nRiunione di Microsoft Teams\nPartecipa: https://teams.example/abc\nID riunione: 123`
    expect(ownText(`${REPLY}\n${footer}`)).toBe(REPLY)
    expect(ownText(`${REPLY}\n${RULE}\nMicrosoft Teams meeting\nJoin: https://teams.example`)).toBe(
      REPLY,
    )
  })

  it('does not take a sender named in running text for a quoted message', () => {
    const text =
      'Da: lunedì cambiamo fornitore.\nInviato il piano ieri, attendo risposta dal cliente.'
    expect(ownText(text)).toBe(text)
    const signature = `${REPLY}\n${RULE}\nPaola Prova\nProject Manager`
    expect(ownText(signature)).toBe(signature)
  })
})
