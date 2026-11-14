import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createWordRenderer } from '../src/index.ts'
import { deckContent, MAX_SLIDE_LINES, MAX_TABLE_ROWS } from '../src/office/deck-slides.ts'
import { DECK_TABLE_PLACE, DECK_TABLE_STYLE, deckPptx } from './support/deck-pptx.ts'

const renderer = createWordRenderer()
const partsOf = (bytes: Uint8Array) =>
  Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, part]) => [name, strFromU8(part)]),
  )
const textsOf = (xml: string | undefined) =>
  [...(xml ?? '').matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((match) => match[1])

const REPORT = `# Stato di avanzamento — Sprint 28

Premessa prima delle sezioni.

## Sintesi
Tre consegne su **quattro**, collaudo *pianificato*.

- Modulo ordini consegnato
  - Manca l'ambiente & il <test>
1. Primo passo

> Una citazione

\`\`\`
codice
\`\`\`

---

## Rischi
Dal tracker al 13/11.

| Rischio | Responsabile |
|---|---|
| Ambiente [di prova](http://x) | Cliente |
| Solo una cella |

### Decisioni
- Data di collaudo entro il 20/11
`

describe('the slides of a text', () => {
  it('opens a slide at each heading and names the deck from the first-level one', () => {
    const content = deckContent('Titolo', REPORT)
    expect(content.title).toBe('Stato di avanzamento — Sprint 28')
    expect(content.slides.map((slide) => slide.title)).toEqual([
      'Titolo',
      'Sintesi',
      'Rischi',
      'Decisioni',
    ])
    const [, summary, risks] = content.slides
    expect(summary?.lines.map((line) => [line.marker, line.level])).toEqual([
      [null, 0],
      ['•', 0],
      ['•', 1],
      ['1.', 0],
      [null, 0],
      [null, 0],
    ])
    expect(summary?.lines[0]?.runs).toEqual([
      { text: 'Tre consegne su ', bold: false, italics: false },
      { text: 'quattro', bold: true, italics: false },
      { text: ', collaudo ', bold: false, italics: false },
      { text: 'pianificato', bold: false, italics: true },
      { text: '.', bold: false, italics: false },
    ])
    expect(summary?.lines[2]?.runs.map((run) => run.text).join('')).toBe(
      "Manca l'ambiente & il <test>",
    )
    expect(risks?.lines).toHaveLength(1)
    expect(risks?.table?.header.map((cell) => cell[0]?.text)).toEqual(['Rischio', 'Responsabile'])
    expect(risks?.table?.rows[0]?.[0]?.map((run) => run.text).join('')).toBe('Ambiente di prova')
  })

  it('continues on a numbered slide what is too long for one', () => {
    const lines = Array.from({ length: MAX_SLIDE_LINES + 1 }, (_unused, at) => `- voce ${at}`)
    const rows = Array.from({ length: MAX_TABLE_ROWS * 2 + 1 }, (_unused, at) => `| ${at} |`)
    const content = deckContent(
      'T',
      `## Lungo\n${lines.join('\n')}\n\n| N |\n|---|\n${rows.join('\n')}\n\n## Vuota\n| N |\n|---|\n`,
    )
    expect(content.slides.map((slide) => slide.title)).toEqual([
      'Lungo',
      'Lungo (2)',
      'Lungo (3)',
      'Lungo (4)',
      'Lungo (5)',
      'Vuota',
    ])
    expect(content.slides[1]?.lines).toHaveLength(1)
    expect(content.slides[2]?.lines).toHaveLength(0)
    expect(content.slides[4]?.table?.rows).toHaveLength(1)
    expect(content.slides[5]?.table?.rows).toEqual([])
    expect(deckContent('Solo titolo', '').slides).toEqual([])
  })
})

describe('a deck on the model of the PM', () => {
  it('keeps cover and closing, and writes one slide per section in place of the old ones', async () => {
    const model = deckPptx()
    const before = partsOf(model)
    const after = partsOf(await renderer.deck('Titolo', REPORT, model))

    // Cover without a title to fill and closing slide: untouched. The old content: gone.
    expect(after['ppt/slides/slide1.xml']).toBe(before['ppt/slides/slide1.xml'])
    expect(after['ppt/slides/slide4.xml']).toBe(before['ppt/slides/slide4.xml'])
    for (const gone of ['slides/slide2.xml', 'slides/slide3.xml', 'notesSlides/notesSlide1.xml']) {
      expect(after[`ppt/${gone}`]).toBeUndefined()
      expect(after['[Content_Types].xml']).not.toContain(`/ppt/${gone}`)
    }
    expect(after['ppt/slides/_rels/slide2.xml.rels']).toBeUndefined()
    expect(after['ppt/notesSlides/_rels/notesSlide1.xml.rels']).toBeUndefined()
    expect(after['ppt/_rels/presentation.xml.rels']).not.toContain('slides/slide2.xml')
    for (const same of ['ppt/theme/theme1.xml', 'ppt/slideMasters/slideMaster1.xml']) {
      expect(after[same]).toBe(before[same])
    }

    const presentation = after['ppt/presentation.xml'] ?? ''
    expect(presentation).toContain(
      '<p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="260" r:id="rIdOcto5"/><p:sldId id="261" r:id="rIdOcto6"/><p:sldId id="262" r:id="rIdOcto7"/><p:sldId id="263" r:id="rIdOcto8"/><p:sldId id="259" r:id="rId5"/></p:sldIdLst>',
    )
    expect(presentation).not.toContain('sectionLst')
    expect(after['ppt/_rels/presentation.xml.rels']).toContain(
      '<Relationship Id="rIdOcto5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide5.xml"/>',
    )
    expect(after['[Content_Types].xml']).toContain('PartName="/ppt/slides/slide8.xml"')
    expect(after['ppt/slides/_rels/slide6.xml.rels']).toContain(
      'Target="../slideLayouts/slideLayout1.xml"',
    )

    // The title keeps the look of the model's; the table its place and its style.
    const summary = after['ppt/slides/slide6.xml'] ?? ''
    expect(summary).toContain(
      '<a:p><a:r><a:rPr lang="it-IT" dirty="0"><a:latin typeface="Georgia"/></a:rPr><a:t>Sintesi</a:t></a:r></a:p>',
    )
    expect(summary).toContain('<a:buChar char="•"/>')
    expect(summary).toContain('<a:buAutoNum type="arabicPeriod" startAt="1"/>')
    expect(summary).toContain("<a:t>Manca l'ambiente &amp; il </a:t>")
    expect(summary).toContain('<a:t>&lt;test&gt;</a:t>')
    expect(summary).toContain(' b="1" dirty="0"/><a:t>quattro</a:t>')
    expect(summary).toContain(' i="1" dirty="0"/><a:t>pianificato</a:t>')
    expect(summary).not.toContain('<a:tbl>')
    const risks = after['ppt/slides/slide7.xml'] ?? ''
    expect(risks).toContain(`<a:tableStyleId>${DECK_TABLE_STYLE}</a:tableStyleId>`)
    expect(risks).toContain('<a:off x="400000" y="1500000"/><a:ext cx="11000000" cy="600000"/>')
    expect(risks).toContain('<a:off x="400000" y="2100000"/><a:ext cx="11000000" cy="1112520"/>')
    expect(risks).toContain('<a:gridCol w="5500000"/><a:gridCol w="5500000"/>')
    expect(textsOf(risks)).toEqual([
      'Rischi',
      'Dal tracker al 13/11.',
      'Rischio',
      'Responsabile',
      'Ambiente ',
      'di prova',
      'Cliente',
      'Solo una cella',
    ])
    expect(risks.match(/<a:tc>/g)).toHaveLength(6)
    expect(DECK_TABLE_PLACE).toContain('cy="3000000"')
  })

  it('fills the title of the cover when it has one, and works without a table or a closing', async () => {
    const model = deckPptx({ coverTitle: true, plain: true, open: true })
    const after = partsOf(await renderer.deck('Titolo', REPORT, model))
    expect(textsOf(after['ppt/slides/slide1.xml'])).toEqual(['Stato di avanzamento — Sprint 28'])
    expect(after['ppt/slides/slide3.xml']).toBeUndefined()
    expect(after['ppt/presentation.xml']).toContain('r:id="rIdOcto7"/></p:sldIdLst>')
    // No table in the model: the content takes a share of the slide, with a plain table.
    const risks = after['ppt/slides/slide6.xml'] ?? ''
    expect(risks).toContain('<a:tblPr firstRow="1" bandRow="1"/>')
    expect(risks).toContain('<a:off x="609600" y="1508760"/><a:ext cx="10972800" cy="905256"/>')
  })

  it('refuses what is not a deck it can write on', async () => {
    await expect(renderer.checkDeckModel(strToU8('not a zip'))).rejects.toThrow(
      'deck_model_invalid',
    )
    await expect(
      renderer.checkDeckModel(zipSync({ 'word/document.xml': strToU8('<w:document/>') })),
    ).rejects.toThrow('deck_model_invalid')
    const parts = unzipSync(deckPptx())
    // Only a cover: no slide to take the title and the layout from.
    const onlyCover = strFromU8(parts['ppt/presentation.xml'] as Uint8Array).replace(
      /<p:sldId id="25[789]"[^>]*\/>/g,
      '',
    )
    await expect(
      renderer.checkDeckModel(zipSync({ ...parts, 'ppt/presentation.xml': strToU8(onlyCover) })),
    ).rejects.toThrow('deck_model_invalid')
    const { 'ppt/slides/_rels/slide2.xml.rels': _rels, ...noLayout } = parts
    await expect(renderer.checkDeckModel(zipSync(noLayout))).rejects.toThrow('deck_model_invalid')
    await expect(renderer.checkDeckModel(deckPptx())).resolves.toBeUndefined()
  })
})
