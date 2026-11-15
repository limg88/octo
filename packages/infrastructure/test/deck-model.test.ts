import type { DeckDraft } from '@octo/domain'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createWordRenderer } from '../src/index.ts'
import { fillDeck, readDeckOutline } from '../src/office/deck-model.ts'
import { DECK_BLUE, DECK_GREEN, deckPptx } from './support/deck-pptx.ts'

const partsOf = (bytes: Uint8Array) =>
  Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, part]) => [name, strFromU8(part)]),
  )
const textsOf = (xml: string | undefined) =>
  [...(xml ?? '').matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((match) => match[1])
const rowsOf = (xml: string | undefined) =>
  [...(xml ?? '').matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)].map((row) => row[0])
const shownSlides = (parts: Record<string, string>) =>
  [...(parts['ppt/presentation.xml'] ?? '').matchAll(/<p:sldId [^>]*r:id="([^"]+)"/g)].map(
    (entry) =>
      new RegExp(`Id="${entry[1]}"[^>]*Target="([^"]+)"`).exec(
        parts['ppt/_rels/presentation.xml.rels'] ?? '',
      )?.[1],
  )

const model = deckPptx({ rich: true })

describe('the outline of a model deck', () => {
  it('lists every line of text and every table of every slide, in the order they are shown', () => {
    const outline = readDeckOutline(model)
    expect(outline.slides.map((slide) => slide.slide)).toEqual([1, 2, 3, 4])
    expect(outline.slides[0]).toEqual({
      slide: 1,
      texts: [{ id: 'S1.T1', text: 'Progetto Aurora', title: false }],
      tables: [],
    })
    expect(outline.slides[1]).toEqual({
      slide: 2,
      texts: [
        { id: 'S2.T1', text: 'Aurora - Avanzamento — PI6', title: true },
        { id: 'S2.T2', text: 'Dati al 23/10/2026', title: false },
        // Two lines of one tile, an entity read as its character; the slide number is not content.
        { id: 'S2.T3', text: 'Consegne\n3 & mezzo', title: false },
      ],
      tables: [
        {
          id: 'S2.TAB1',
          columns: ['Voce', 'Stato', 'Cons. 23/10'],
          rows: 3,
          sample: [
            ['Modulo ordini', '✅ Done', '12'],
            ['Magazzino', '🔄 In corso', ''],
            ['Totale', '', '12'],
          ],
        },
      ],
    })
    expect(outline.slides[3]?.texts).toEqual([{ id: 'S4.T1', text: 'GRAZIE', title: false }])
  })

  it('refuses what is not a deck with something on it', async () => {
    expect(() => readDeckOutline(new Uint8Array([1, 2, 3]))).toThrow('deck_model_invalid')
    const renderer = createWordRenderer()
    await expect(renderer.checkDeckModel(new Uint8Array())).rejects.toThrow('deck_model_invalid')
    await expect(renderer.checkDeckModel(model)).resolves.toBeUndefined()
    expect((await renderer.deckOutline(model)).slides).toHaveLength(4)
  })
})

describe('a model deck filled for another period', () => {
  const deck: DeckDraft = {
    slides: [
      { slide: 1, skip: false, texts: [{ id: 'S1.T1', text: 'Progetto Aurora' }], tables: [] },
      {
        slide: 2,
        skip: false,
        texts: [
          { id: 'S2.T1', text: 'Aurora - Avanzamento — PI7' },
          { id: 'S2.T2', text: 'Dati al 15/11/2026' },
          { id: 'S2.T3', text: 'Consegne\n5 <cinque>' },
        ],
        tables: [
          {
            id: 'S2.TAB1',
            columns: ['Voce', 'Stato', 'Cons. 15/11'],
            rows: [
              ['Listino', 'In corso', '4'],
              ['Fatture', 'done', ''],
              ['Resi', 'Da avviare', '0'],
              ['Totale', '', '4'],
            ],
          },
        ],
      },
      { slide: 3, skip: true, texts: [], tables: [] },
      { slide: 4, skip: false, texts: [{ id: 'S4.T1', text: 'GRAZIE' }], tables: [] },
    ],
  }

  it('keeps the slides, puts each text and row in its place and draws a row like its status', () => {
    const parts = partsOf(fillDeck(model, deck))
    const slide = parts['ppt/slides/slide2.xml'] ?? ''
    expect(textsOf(slide)).toEqual([
      'Aurora - Avanzamento — PI7',
      'Voce',
      'Stato',
      'Cons. 15/11',
      'Listino',
      'In corso',
      '4',
      'Fatture',
      'done',
      'Resi',
      'Da avviare',
      '0',
      'Totale',
      '4',
      'Dati al 15/11/2026',
      'Consegne',
      '5 &lt;cinque&gt;',
      '2',
    ])
    const rows = rowsOf(slide)
    // The same status, whatever mark or case it is written with, keeps its colour; «Totale» its own.
    expect(rows[1]).toContain(DECK_BLUE)
    expect(rows[2]).toContain(DECK_GREEN)
    expect(rows[4]).toContain('EEEEEE')
    // A value in a cell that was empty takes the look the cell ends with, not the default one.
    expect(rows[1]).toMatch(/<a:rPr lang="it-IT" sz="1100"\/><a:t>4<\/a:t>/)
    // The frame is as tall as its rows, and the title keeps its look.
    expect(slide).toMatch(/<a:ext cx="11000000" cy="1500000"\/>/)
    expect(slide).toContain('<a:latin typeface="Georgia"/></a:rPr><a:t>Aurora - Avanzamento — PI7')
    expect(slide).toContain('<a:br/>')
    expect(slide).toContain('type="slidenum"')
  })

  it('leaves out a slide marked to skip, with its part, and the sections that named it', () => {
    const parts = partsOf(fillDeck(model, deck))
    expect(shownSlides(parts)).toEqual([
      'slides/slide1.xml',
      'slides/slide2.xml',
      'slides/slide4.xml',
    ])
    expect(parts['ppt/slides/slide3.xml']).toBeUndefined()
    expect(parts['[Content_Types].xml']).not.toContain('slide3.xml')
    expect(parts['ppt/presentation.xml']).not.toContain('sectionLst')
    // The notes of a slide that stays are kept.
    expect(parts['ppt/notesSlides/notesSlide1.xml']).toBeDefined()
  })

  it('leaves empty what was not written, never what the model said', () => {
    const partial: DeckDraft = {
      slides: [
        { slide: 1, skip: false, texts: [], tables: [] },
        { slide: 2, skip: false, texts: [{ id: 'S2.T1', text: 'Titolo' }], tables: [] },
      ],
    }
    const parts = partsOf(fillDeck(model, partial))
    expect(textsOf(parts['ppt/slides/slide1.xml'])).toEqual([])
    const slide = parts['ppt/slides/slide2.xml'] ?? ''
    expect(slide).not.toContain('Dati al 23/10/2026')
    // A table nobody wrote stays as the model drew it: the use case empties it before.
    expect(shownSlides(parts)).toEqual(['slides/slide1.xml', 'slides/slide2.xml'])
    expect(parts['ppt/notesSlides/notesSlide1.xml']).toBeDefined()
    expect(() => fillDeck(model, { slides: [] })).toThrow('deck_model_invalid')
  })

  it('goes on a copy of the slide when a table is too long for one', () => {
    const many = Array.from({ length: 30 }, (_unused, at) => [
      `Voce ${at + 1}`,
      'In corso',
      String(at),
    ])
    const long: DeckDraft = {
      slides: [
        {
          slide: 2,
          skip: false,
          texts: [{ id: 'S2.T1', text: 'Avanzamento' }],
          tables: [{ id: 'S2.TAB1', columns: ['Voce', 'Stato', 'Cons.'], rows: many }],
        },
      ],
    }
    const parts = partsOf(fillDeck(model, long))
    const shown = shownSlides(parts)
    expect(shown).toEqual(['slides/slide2.xml', 'slides/slide5.xml', 'slides/slide6.xml'])
    expect(rowsOf(parts['ppt/slides/slide2.xml'])).toHaveLength(13)
    expect(rowsOf(parts['ppt/slides/slide6.xml'])).toHaveLength(7)
    expect(textsOf(parts['ppt/slides/slide5.xml'])[0]).toBe('Avanzamento (segue)')
    expect(textsOf(parts['ppt/slides/slide2.xml'])[0]).toBe('Avanzamento')
    // A copy stands on the same layout and takes no notes with it.
    expect(parts['ppt/slides/_rels/slide5.xml.rels']).toContain('slideLayout1.xml')
    expect(parts['ppt/slides/_rels/slide5.xml.rels']).not.toContain('notesSlide')
    expect(parts['[Content_Types].xml']).toContain('/ppt/slides/slide6.xml')
  })
})
