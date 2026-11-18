import { type Glossary, NO_GLOSSARY, type Project } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createGlossary } from '../src/index.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }

function setup(advised = true) {
  let kept: Glossary = NO_GLOSSARY
  const asked: Array<{ known: number; model: string | null | undefined }> = []
  const glossary = createGlossary({
    store: {
      load: async () => kept,
      save: async (_folder, next) => {
        kept = next
      },
    },
    ...(advised
      ? {
          advisor: {
            propose: async (request) => {
              asked.push({ known: request.known.length, model: request.model })
              return [
                { heard: 'sal', right: 'SAL' },
                { heard: 'aurora uan', right: 'Aurora ONE' },
              ]
            },
          },
          model: async () => 'sonnet',
        }
      : {}),
  })
  return { glossary, asked }
}

describe('the glossary of a project, kept and proposed', () => {
  it('keeps what the PM approved, and proposes without applying', async () => {
    const { glossary, asked } = setup()
    expect(await glossary.get(project)).toEqual(NO_GLOSSARY)
    await glossary.save(project, { entries: [{ heard: ' sal ', right: 'SAL' }], proposed: [] })
    expect(await glossary.entries(project)).toEqual([{ heard: 'sal', right: 'SAL' }])
    // Claude is told what is already known; what it gives again is not proposed twice.
    const proposed = await glossary.propose(project)
    expect(asked).toEqual([{ known: 1, model: 'sonnet' }])
    expect(proposed.proposed).toEqual([{ heard: 'aurora uan', right: 'Aurora ONE' }])
    expect(await glossary.entries(project)).toEqual([{ heard: 'sal', right: 'SAL' }])
  })

  it('proposes nothing where nobody reads the project', async () => {
    const { glossary } = setup(false)
    expect(await glossary.propose(project)).toEqual(NO_GLOSSARY)
  })
})
