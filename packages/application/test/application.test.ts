import { DomainError, type Project } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { type AgentProgress, createAskQuestion, createProjects } from '../src/index.ts'
import {
  agentAnswering,
  countingIds,
  evidenceFrom,
  folderProbe,
  memoryQuestionLog,
  memoryRegistry,
  STEP_MS,
  steppingClock,
} from './fakes.ts'

const FOLDER = '/progetti/Aurora'
const project: Project = {
  id: 'p-1',
  name: 'Aurora',
  folder: FOLDER,
  addedAt: '2026-11-01T00:00:00.000Z',
}

function projectsWith(initial: Project[] = []) {
  const questions = memoryQuestionLog()
  const projects = createProjects({
    registry: memoryRegistry(initial),
    questions,
    folders: folderProbe([FOLDER, `${FOLDER}/`]),
    clock: steppingClock(),
    ids: countingIds('p'),
  })
  return { projects, questions }
}

describe('projects', () => {
  it('adds a readable folder as a project named after it', async () => {
    const { projects } = projectsWith()
    const added = await projects.add(FOLDER)

    expect(added).toMatchObject({ id: 'p-1', name: 'Aurora', folder: FOLDER })
    expect(await projects.list()).toEqual([added])
    expect(await projects.get('p-1')).toEqual(added)
  })

  it('refuses a folder it cannot read and a folder already added', async () => {
    const { projects } = projectsWith([project])

    await expect(projects.add('/altrove')).rejects.toMatchObject({ code: 'folder_not_readable' })
    await expect(projects.add(`${FOLDER}/`)).rejects.toMatchObject({
      code: 'project_already_added',
    })
  })

  it('forgets a project with its questions', async () => {
    const { projects, questions } = projectsWith([project])
    await questions.append({
      id: 'q-1',
      projectId: project.id,
      question: 'x',
      askedAt: project.addedAt,
      durationMs: 0,
      answer: null,
      error: 'agent_failed',
    })

    await projects.remove(project.id)

    expect(await projects.list()).toEqual([])
    expect(questions.all()).toEqual([])
    await expect(projects.get(project.id)).rejects.toMatchObject({ code: 'project_not_found' })
  })
})

describe('askQuestion', () => {
  const draft = {
    text: 'Consegna il 12 dicembre [1], budget 14.500 euro [2].',
    citations: [
      { n: 1, path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026' },
      { n: 2, path: 'wiki/stato.md', quote: 'budget residuo di 99.000 euro' },
    ],
    missing: [],
  }
  const evidence = evidenceFrom({
    'wiki/stato.md': {
      kind: 'found',
      text: 'La consegna è fissata al 12 dicembre 2026.',
      modifiedAt: '2026-11-10T09:00:00.000Z',
    },
  })

  it('checks the citations, keeps the record and reports progress', async () => {
    const agent = agentAnswering(draft)
    const questions = memoryQuestionLog()
    const ask = createAskQuestion({
      agent,
      evidence,
      questions,
      clock: steppingClock(),
      ids: countingIds('q'),
    })
    const progress: AgentProgress[] = []

    const record = await ask({
      project,
      question: '  Quando consegniamo?  ',
      onProgress: (step) => progress.push(step),
    })

    expect(agent.requests[0]).toMatchObject({
      projectFolder: FOLDER,
      question: 'Quando consegniamo?',
    })
    expect(record.answer?.citations.map((c) => c.status)).toEqual(['verified', 'quote_not_found'])
    expect(record).toMatchObject({ id: 'q-1', error: null, durationMs: STEP_MS })
    expect(progress).toEqual([{ kind: 'reading', target: 'wiki/stato.md' }])
    expect(await questions.list(project.id)).toEqual([record])
  })

  it('keeps a failure of the agent as the outcome of the question', async () => {
    const questions = memoryQuestionLog()
    const ask = createAskQuestion({
      agent: agentAnswering(new DomainError('agent_not_signed_in')),
      evidence,
      questions,
      clock: steppingClock(),
      ids: countingIds('q'),
    })

    const record = await ask({ project, question: 'Quando consegniamo?' })

    expect(record).toMatchObject({ answer: null, error: 'agent_not_signed_in' })
    expect(questions.all()).toHaveLength(1)
  })

  it('refuses an empty question and lets unexpected errors through', async () => {
    const deps = {
      evidence,
      questions: memoryQuestionLog(),
      clock: steppingClock(),
      ids: countingIds('q'),
    }
    const ask = createAskQuestion({ ...deps, agent: agentAnswering(draft) })
    await expect(ask({ project, question: ' ' })).rejects.toMatchObject({ code: 'empty_question' })

    const broken = createAskQuestion({ ...deps, agent: agentAnswering(new Error('disk full')) })
    await expect(broken({ project, question: 'x' })).rejects.toThrow('disk full')
  })
})
