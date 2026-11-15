import { describe, expect, it } from 'vitest'
import {
  type DeckDraft,
  type DeckOutline,
  deckMarkdown,
  deckProblemText,
  fitDeckDraft,
  mapDeckStrings,
} from '../src/index.ts'

const outline: DeckOutline = {
  slides: [
    {
      slide: 1,
      texts: [
        { id: 'S1.T1', text: 'Stato — PI6', title: true },
        { id: 'S1.T2', text: 'Ottobre 2026', title: false },
      ],
      tables: [{ id: 'S1.TAB1', columns: ['Voce', 'Stato', 'Nota'], rows: 2, sample: [] }],
    },
    { slide: 2, texts: [{ id: 'S2.T1', text: 'Grazie', title: false }], tables: [] },
  ],
}

describe('a deck made to fit the outline of its model', () => {
  it('keeps what fits, in the order of the model, and trims the texts', () => {
    const written: DeckDraft = {
      slides: [
        { slide: 2, skip: false, texts: [{ id: 'S2.T1', text: ' Grazie ' }], tables: [] },
        {
          slide: 1,
          skip: false,
          texts: [
            { id: 'S1.T2', text: 'Novembre 2026' },
            { id: 'S1.T1', text: 'Stato — PI7' },
          ],
          tables: [
            {
              id: 'S1.TAB1',
              columns: [' Voce ', 'Stato', 'Nota al 15/11'],
              rows: [['A', 'Done', '']],
            },
          ],
        },
      ],
    }
    const { deck, problems } = fitDeckDraft(outline, written)
    expect(problems).toEqual([])
    expect(deck.slides.map((slide) => slide.slide)).toEqual([1, 2])
    expect(deck.slides[0]?.texts).toEqual([
      { id: 'S1.T1', text: 'Stato — PI7' },
      { id: 'S1.T2', text: 'Novembre 2026' },
    ])
    expect(deck.slides[0]?.tables[0]?.columns).toEqual(['Voce', 'Stato', 'Nota al 15/11'])
    expect(deck.slides[1]?.texts).toEqual([{ id: 'S2.T1', text: 'Grazie' }])
  })

  it('leaves empty what was left out and drops what the model does not have, saying so', () => {
    const written: DeckDraft = {
      slides: [
        {
          slide: 1,
          skip: false,
          texts: [
            { id: 'S1.T1', text: 'Stato — PI7' },
            { id: 'S7.T1', text: 'Inventato' },
          ],
          tables: [
            {
              id: 'S1.TAB1',
              // One heading too many: the columns of the model stay.
              columns: ['Voce', 'Stato', 'Nota', 'In più'],
              rows: [['A', 'Done', 'ok', 'di troppo'], ['B']],
            },
            { id: 'S1.TAB9', columns: ['x'], rows: [['y']] },
          ],
        },
        { slide: 5, skip: false, texts: [], tables: [] },
      ],
    }
    const { deck, problems } = fitDeckDraft(outline, written)
    expect(deck.slides[0]?.texts).toEqual([
      { id: 'S1.T1', text: 'Stato — PI7' },
      { id: 'S1.T2', text: '' },
    ])
    expect(deck.slides[0]?.tables).toEqual([
      {
        id: 'S1.TAB1',
        columns: ['Voce', 'Stato', 'Nota'],
        rows: [
          ['A', 'Done', 'ok'],
          ['B', '', ''],
        ],
      },
    ])
    expect(deck.slides[1]).toEqual({ slide: 2, skip: true, texts: [], tables: [] })
    expect(problems).toEqual([
      { kind: 'text_missing', slide: 1, id: 'S1.T2', was: 'Ottobre 2026' },
      { kind: 'row_width', slide: 1, id: 'S1.TAB1', rows: 2 },
      { kind: 'slide_missing', slide: 2 },
    ])
    expect(problems.map(deckProblemText).join(' ')).toMatch(
      /Ottobre 2026.*2 righe.*Slide 2 del modello/,
    )
  })

  it('takes a slide marked to skip as left out on purpose, and a table not given as empty', () => {
    const written: DeckDraft = {
      slides: [
        {
          slide: 1,
          skip: false,
          texts: [
            { id: 'S1.T1', text: 'a' },
            { id: 'S1.T2', text: 'b' },
          ],
          tables: [],
        },
        { slide: 2, skip: true, texts: [{ id: 'S2.T1', text: 'ignorato' }], tables: [] },
      ],
    }
    const { deck, problems } = fitDeckDraft(outline, written)
    expect(deck.slides[1]).toEqual({ slide: 2, skip: true, texts: [], tables: [] })
    expect(deck.slides[0]?.tables).toEqual([
      { id: 'S1.TAB1', columns: ['Voce', 'Stato', 'Nota'], rows: [] },
    ])
    expect(problems).toEqual([{ kind: 'table_missing', slide: 1, id: 'S1.TAB1' }])
    expect(deckProblemText(problems[0] as never)).toMatch(/tabella del modello non è stata scritta/)
  })
})

describe('a deck as a text', () => {
  const deck: DeckDraft = {
    slides: [
      {
        slide: 1,
        skip: false,
        texts: [
          { id: 'S1.T1', text: 'Stato — PI7' },
          { id: 'S1.T2', text: 'Dati al 15/11 [1]\ndue righe' },
        ],
        tables: [
          { id: 'S1.TAB1', columns: ['Voce', 'Stato', 'Nota'], rows: [['A|B', 'Done [2]', '']] },
        ],
      },
      { slide: 2, skip: true, texts: [], tables: [] },
    ],
  }

  it('is a section per slide, with its lines and its tables, markers kept for the check', () => {
    expect(deckMarkdown('Sprint 28', outline, deck)).toBe(
      [
        '# Sprint 28',
        '',
        '## Slide 1 — Stato — PI7',
        '',
        '- Dati al 15/11 [1] due righe',
        '',
        '| Voce | Stato | Nota |',
        '|---|---|---|',
        '| A\\|B | Done [2] |  |',
        '',
      ].join('\n'),
    )
  })

  it('passes every string through a change: texts, headings and cells', () => {
    const upper = mapDeckStrings(deck, (text) => text.toUpperCase())
    expect(upper.slides[0]?.texts[0]?.text).toBe('STATO — PI7')
    expect(upper.slides[0]?.tables[0]).toEqual({
      id: 'S1.TAB1',
      columns: ['VOCE', 'STATO', 'NOTA'],
      rows: [['A|B', 'DONE [2]', '']],
    })
    expect(upper.slides[1]?.skip).toBe(true)
  })
})
