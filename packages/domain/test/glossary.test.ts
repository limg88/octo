import { describe, expect, it } from 'vitest'
import { applyGlossary, cleanGlossary, MAX_GLOSSARY_WORD } from '../src/index.ts'

describe('the glossary of a project', () => {
  it('writes in its right form what a transcript heard badly, whole words only', () => {
    const entries = [
      { heard: 'sal', right: 'SAL' },
      { heard: 'aurora uan', right: 'Aurora ONE' },
      { heard: 'c++ (vecchio)', right: 'C++' },
      { heard: ' ', right: 'niente' },
    ]
    const said = 'Il Sal parte lunedì; aurora uan no. Salta se il sal-2 regge, e il c++ (vecchio).'
    expect(applyGlossary(said, entries)).toBe(
      'Il SAL parte lunedì; Aurora ONE no. Salta se il SAL-2 regge, e il C++.',
    )
    // A right form with a sign of a pattern in it is written as it is.
    expect(applyGlossary('costa uno', [{ heard: 'uno', right: '$1' }])).toBe('costa $1')
    expect(applyGlossary('nulla da cambiare', [])).toBe('nulla da cambiare')
  })

  it('keeps one pair for a word heard, none that changes nothing, and proposes only what is new', () => {
    const long = 'x'.repeat(MAX_GLOSSARY_WORD + 10)
    expect(
      cleanGlossary({
        entries: [
          { heard: ' sal ', right: 'Sal.' },
          { heard: 'SAL', right: ' Stato avanzamento ' },
          { heard: 'uguale', right: 'uguale' },
          { heard: '', right: 'vuota' },
          { heard: long, right: 'lunga' },
        ],
        proposed: [
          { heard: 'Sal', right: 'SAL' },
          { heard: 'esse a elle', right: 'S.A.L.' },
        ],
      }),
    ).toEqual({
      entries: [
        { heard: 'SAL', right: 'Stato avanzamento' },
        { heard: 'x'.repeat(MAX_GLOSSARY_WORD), right: 'lunga' },
      ],
      proposed: [{ heard: 'esse a elle', right: 'S.A.L.' }],
    })
  })
})
