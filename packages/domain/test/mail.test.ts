import { describe, expect, it } from 'vitest'
import {
  type ArchivedMail,
  cleanMailSource,
  cleanTargetFolder,
  extractedDocument,
  extractedTextPath,
  folderWanted,
  htmlToText,
  isCurrentText,
  keywordIn,
  locatorKey,
  type MailMessage,
  type MailRules,
  mailDocument,
  mailWanted,
  shortHash,
  slugOf,
  sourcePathOf,
  startOfDay,
} from '../src/index.ts'

const RULES: MailRules = { keywords: [], folders: [], excludeSenders: [] }

function message(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    messageId: 'uno@cliente.example',
    subject: 'Aurora: data del collaudo',
    from: { name: 'Carla Bianchi', email: 'carla@cliente.example' },
    to: [{ name: '', email: 'pm@example.test' }],
    cc: [],
    sentAt: new Date('2026-11-10T09:05:00Z'),
    text: 'Il collaudo è confermato per giovedì: nel salone grande.',
    attachments: [],
    calendarMethod: null,
    ...overrides,
  }
}

const archived: ArchivedMail = {
  id: '42',
  folder: 'Posta in arrivo/Clienti',
  receivedAt: new Date('2026-11-10T09:06:00Z'),
}

describe('the text of an HTML mail', () => {
  it('drops markup, styles and comments, and keeps one line per block', () => {
    const html =
      '<html><head><style>p{color:red}</style><title>x</title></head><body><!-- nota -->' +
      '<p>Buongiorno&nbsp;a tutti,</p><div>il costo &egrave; di 10&euro; &amp; IVA.<br>Grazie</div>' +
      '<ul><li>uno</li><li>due</li></ul><table><tr><td>A</td><td>B</td></tr></table>' +
      '<p>&#233;&#x20AC;&sconosciuta;&#0;</p></body></html>'
    expect(htmlToText(html)).toBe(
      'Buongiorno a tutti,\nil costo è di 10€ & IVA.\nGrazie\n\n- uno\n- due\nA B\n\né€&sconosciuta;&#0;',
    )
  })
})

describe('which mail is of the project', () => {
  it('reads every folder but drafts, trash and the like, unless folders are named', () => {
    expect(folderWanted('Posta in arrivo', RULES)).toBe(true)
    expect(folderWanted('Posta eliminata/Vecchie', RULES)).toBe(false)
    const named = { ...RULES, folders: ['Clienti'] }
    expect(folderWanted('clienti/Aurora', named)).toBe(true)
    expect(folderWanted('Posta in arrivo', named)).toBe(false)
  })

  it('finds a word only as a whole, and an address among the people or in the text', () => {
    expect(keywordIn(message(), 'collaudo')).toBe(true)
    expect(keywordIn(message(), 'SAL')).toBe(false)
    expect(keywordIn(message(), '@cliente.example')).toBe(true)
    expect(keywordIn(message(), 'carla@cliente.example')).toBe(true)
    expect(keywordIn(message({ from: null }), 'luca@altro.example')).toBe(false)
  })

  it('leaves out excluded senders, answers to invitations and mail about something else', () => {
    const rules = { ...RULES, keywords: ['Aurora'], excludeSenders: ['Avvisi@monitor.example'] }
    expect(mailWanted(message(), rules)).toBe(true)
    expect(mailWanted(message({ subject: 'Zefiro', text: 'preventivo' }), rules)).toBe(false)
    expect(mailWanted(message({ calendarMethod: 'REPLY' }), rules)).toBe(false)
    const alert = message({ from: { name: 'Monitor', email: 'avvisi@monitor.example' } })
    expect(mailWanted(alert, rules)).toBe(false)
    expect(mailWanted(message({ from: null }), RULES)).toBe(true)
  })
})

describe('a mail as a file of the memory', () => {
  it('goes in the folder of its month, named by day, subject and a stable mark', () => {
    const document = mailDocument(archived, message(), { keepQuoted: false })

    expect(document.externalId).toBe('uno@cliente.example')
    expect(document.relativePath).toBe(
      `2026-11/2026-11-10_0905_aurora-data-del-collaudo_${shortHash('uno@cliente.example')}.md`,
    )
    expect(document.content).toContain('oggetto: "Aurora: data del collaudo"')
    expect(document.content).toContain('da: "Carla Bianchi <carla@cliente.example>"')
    expect(document.content).toContain('a: "pm@example.test"')
    expect(document.content).toContain('cartella: "Posta in arrivo/Clienti"')
    expect(document.content).toContain('\n# Aurora: data del collaudo\n\nIl collaudo è confermato')
  })

  it('stands without a subject, a sender, a date or a Message-ID', () => {
    const bare = message({ messageId: null, subject: '', from: null, sentAt: null })
    const document = mailDocument(archived, bare, { keepQuoted: true })

    expect(document.externalId).toBe('archive:42')
    expect(document.relativePath.startsWith('2026-11/2026-11-10_0906_senza-oggetto_')).toBe(true)
    expect(document.content).toContain('da: ""')
  })

  it('keeps or drops the messages quoted under what the author wrote', () => {
    const own = 'Confermo il collaudo per il 20 novembre: avviso io il cliente e il fornitore.'
    const text = `${own}\n\nDa: Carla\nInviato: martedì\n\nPossiamo spostare il collaudo?`
    const reply = message({ text })

    expect(mailDocument(archived, reply, { keepQuoted: false }).content).not.toContain('spostare')
    expect(mailDocument(archived, reply, { keepQuoted: true }).content).toContain('spostare')
  })

  it('makes a file name any system accepts', () => {
    expect(slugOf('R: Perché è così? / «SAL» n°3')).toBe('r-perche-e-cosi-sal-n-3')
    expect(slugOf('???')).toBe('mail')
    expect(slugOf('a'.repeat(200)).length).toBe(60)
    expect(shortHash('a')).not.toBe(shortHash('b'))
  })
})

describe('the configuration of the mail', () => {
  const config = {
    since: '2026-11-01',
    keywords: [' Aurora ', 'Aurora', ''],
    folders: [],
    excludeSenders: ['x@y.example'],
    keepQuoted: false,
    targetFolder: 'raw\\Mail/',
  }

  it('is saved trimmed, without doubles, with a folder inside the project', () => {
    expect(cleanMailSource(config)).toEqual({
      ...config,
      keywords: ['Aurora'],
      targetFolder: 'raw/Mail',
    })
  })

  it('refuses a day that is not one and a folder that leaves the project', () => {
    expect(() => startOfDay('ieri')).toThrow(/source_config_invalid/)
    expect(() => startOfDay('2026-13-40')).toThrow(/source_config_invalid/)
    expect(() => cleanTargetFolder('../fuori')).toThrow(/source_config_invalid/)
    expect(() => cleanTargetFolder('  ')).toThrow(/source_config_invalid/)
    expect(() => cleanTargetFolder('a:b')).toThrow(/source_config_invalid/)
    expect(startOfDay('2026-11-01').toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })
})

describe('the text of an Office or PDF file as a file of the memory', () => {
  const stamp = { path: 'raw/SOW/Offerta.pdf', size: 1200, modifiedAt: '2026-11-10T09:00:00.000Z' }
  const extraction = {
    extractor: 'octo-extract/1',
    chunks: [
      { locator: { kind: 'page' as const, page: 1 }, text: 'Prima pagina.' },
      { locator: { kind: 'page' as const, page: 1 }, text: 'Ancora la prima.' },
      { locator: { kind: 'slide' as const, slide: 2 }, text: 'Una slide.' },
      { locator: { kind: 'paragraph' as const, index: 4 }, text: 'Un paragrafo.' },
    ],
    truncated: true,
    metadataDate: null,
    warnings: ['truncated' as const],
  }

  it('names the original, groups the text under pages and slides, and reports warnings', () => {
    const text = extractedDocument(stamp, extraction)

    expect(text).toContain('origine: "raw/SOW/Offerta.pdf"')
    expect(text).toContain('avvisi: "truncated"')
    expect(text).toContain('# Offerta.pdf')
    expect(text).toContain(
      '## Pagina 1\n\nPrima pagina.\n\nAncora la prima.\n\n## Slide 2\n\nUna slide.',
    )
    expect(text.match(/## Pagina 1/g)).toHaveLength(1)
  })

  it('is current until the file or the extractor changes', () => {
    const text = extractedDocument(stamp, extraction)

    expect(isCurrentText(text, stamp, 'octo-extract/1')).toBe(true)
    expect(isCurrentText(text, { ...stamp, size: 1201 }, 'octo-extract/1')).toBe(false)
    expect(isCurrentText(text, stamp, 'octo-extract/2')).toBe(false)
  })

  it('maps a file to its text and back', () => {
    expect(extractedTextPath('raw/a.docx')).toBe('_octo/testo/raw/a.docx.md')
    expect(sourcePathOf('_octo/testo/raw/a.docx.md')).toBe('raw/a.docx')
    expect(sourcePathOf('raw/a.docx.md')).toBeNull()
    expect(sourcePathOf('_octo/testo/raw/a.docx')).toBeNull()
    expect(locatorKey({ kind: 'cell', sheet: 'PI7', ref: 'B2' })).toBe('cell:PI7!B2')
  })
})
