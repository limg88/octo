import { describe, expect, it } from 'vitest'
import { applyGlossary, cleanGlossary, MAX_GLOSSARY_WORD } from '../src/index.ts'

describe('the glossary of a project', () => {
  it('writes in its right form what a transcript heard badly, whole words only', () => {
    const entries = [
      { heard: 'dim', right: 'DEEM' },
      { heard: 'aurora uan', right: 'Aurora ONE' },
      { heard: 'c++ (vecchio)', right: 'C++' },
      { heard: ' ', right: 'niente' },
    ]
    const said = 'Il Dim parte lunedì; aurora uan no. Dimmi se il dim-2 regge, e il c++ (vecchio).'
    expect(applyGlossary(said, entries)).toBe(
      'Il DEEM parte lunedì; Aurora ONE no. Dimmi se il DEEM-2 regge, e il C++.',
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
          { heard: ' dim ', right: 'Deem' },
          { heard: 'DIM', right: ' DEEM ' },
          { heard: 'uguale', right: 'uguale' },
          { heard: '', right: 'vuota' },
          { heard: long, right: 'lunga' },
        ],
        proposed: [
          { heard: 'Dim', right: 'DEEM' },
          { heard: 'esse a elle', right: 'SAL' },
        ],
      }),
    ).toEqual({
      entries: [
        { heard: 'DIM', right: 'DEEM' },
        { heard: 'x'.repeat(MAX_GLOSSARY_WORD), right: 'lunga' },
      ],
      proposed: [{ heard: 'esse a elle', right: 'SAL' }],
    })
  })
})
