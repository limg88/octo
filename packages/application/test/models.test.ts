import {
  type CheckedAnswer,
  cleanModelSettings,
  DEFAULT_MODEL_SETTINGS,
  DomainError,
  type ModelSettings,
  type Project,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { type AskRequest, createAskQuestion, createModels } from '../src/index.ts'
import { countingIds, evidenceFrom, memoryQuestionLog, steppingClock } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }

describe('the models of a project', () => {
  it('keeps the choice of each task and falls back on the default for what is not a choice', async () => {
    let kept: ModelSettings = DEFAULT_MODEL_SETTINGS
    const models = createModels({
      store: {
        load: async () => kept,
        save: async (_folder, next) => {
          kept = next
        },
      },
    })
    expect(await models.get(project)).toEqual({ ask: null, write: null, review: null })
    const typed = { ask: 'haiku', write: 'opus', review: 'gpt' } as unknown as ModelSettings
    expect(await models.save(project, typed)).toEqual({ ask: 'haiku', write: 'opus', review: null })
    expect(await models.get(project)).toEqual({ ask: 'haiku', write: 'opus', review: null })
    expect(cleanModelSettings({})).toEqual(DEFAULT_MODEL_SETTINGS)
  })

  it('asks with the model chosen for answers and records the one that answered', async () => {
    const requests: AskRequest[] = []
    const askWith = (models?: ModelSettings, fails = false) =>
      createAskQuestion({
        agent: {
          status: async () => ({ available: true, version: 'fake' }),
          ask: async (request) => {
            requests.push(request)
            request.onModel?.(`claude-${request.model ?? 'default'}-x`)
            if (fails) throw new DomainError('agent_failed')
            return { text: 'Non lo so.', citations: [], missing: [] }
          },
          compute: async () => ({ text: '', citations: [], missing: [] }),
        },
        evidence: evidenceFrom({}),
        questions: memoryQuestionLog(),
        clock: steppingClock(),
        ids: countingIds('q'),
        ...(models ? { models: async () => models } : {}),
      })

    const chosen = await askWith({ ask: 'sonnet', write: 'opus', review: null })({
      project,
      question: 'Quando?',
    })
    expect(requests[0]?.model).toBe('sonnet')
    expect(chosen.model).toBe('claude-sonnet-x')
    expect((chosen.answer as CheckedAnswer).text).toBe('Non lo so.')

    const plain = await askWith()({ project, question: 'Quando?' })
    expect(requests[1]?.model).toBeNull()
    expect(plain.model).toBe('claude-default-x')

    // A question that fails still says which model was at work.
    const failed = await askWith(undefined, true)({ project, question: 'Quando?' })
    expect(failed).toMatchObject({ answer: null, error: 'agent_failed', model: 'claude-default-x' })
  })
})
