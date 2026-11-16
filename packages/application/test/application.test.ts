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
  const setAside = memoryRegistry()
  const created: Array<{ parent: string; name: string; paths: string[] }> = []
  const projects = createProjects({
    registry: memoryRegistry(initial),
    setAside,
    folders: folderProbe([FOLDER, `${FOLDER}/`, '/progetti/Boreale 2']),
    scaffold: {
      create: async (parent, name, files) => {
        created.push({ parent, name, paths: files.map((file) => file.path) })
        return `${parent}/${name}`
      },
    },
    clock: steppingClock(),
    ids: countingIds('p'),
  })
  return { projects, setAside, created }
}

describe('projects', () => {
  it('adds a readable folder as a project named after it', async () => {
    const { projects } = projectsWith()
    const added = await projects.add(FOLDER)

    expect(added).toMatchObject({ id: 'p-1', name: 'Aurora', folder: FOLDER })
    expect(await projects.list()).toEqual([added])
    expect(await projects.get('p-1')).toEqual(added)
  })

  it('makes the folder of a new project with its starter files, and adds it', async () => {
    const { projects, created } = projectsWith()
    const made = await projects.create('/progetti', '  Boreale   2 ')
    expect(made).toMatchObject({ name: 'Boreale 2', folder: '/progetti/Boreale 2' })
    expect(created).toEqual([
      {
        parent: '/progetti',
        name: 'Boreale 2',
        paths: [
          'LEGGIMI.md',
          'Contratti/LEGGIMI.md',
          'Documenti/LEGGIMI.md',
          'Riunioni/LEGGIMI.md',
          'Tracker/LEGGIMI.md',
        ],
      },
    ])
    for (const name of ['', '  ', 'a/b', 'a\\b', '.nascosto', 'fine.', 'x'.repeat(81), 'a:b']) {
      await expect(projects.create('/progetti', name)).rejects.toMatchObject({
        code: 'project_name_invalid',
      })
    }
    expect(created).toHaveLength(1)
  })

  it('refuses a folder it cannot read and a folder already added', async () => {
    const { projects } = projectsWith([project])

    await expect(projects.add('/altrove')).rejects.toMatchObject({ code: 'folder_not_readable' })
    await expect(projects.add(`${FOLDER}/`)).rejects.toMatchObject({
      code: 'project_already_added',
    })
  })

  it('takes a project off the list and puts it back as it was', async () => {
    const { projects, setAside } = projectsWith([project])

    await projects.remove(project.id)

    expect(await projects.list()).toEqual([])
    expect(await setAside.list()).toEqual([project])
    await expect(projects.get(project.id)).rejects.toMatchObject({ code: 'project_not_found' })

    expect(await projects.restore(project.id)).toEqual(project)
    expect(await projects.list()).toEqual([project])
    expect(await setAside.list()).toEqual([])
    await expect(projects.restore(project.id)).rejects.toMatchObject({
      code: 'project_not_found',
    })
  })

  it('gives back the same project when its folder is added again', async () => {
    const { projects, setAside } = projectsWith([project])
    await projects.remove(project.id)

    // The same folder, written another way, is the same project: same id, same readings.
    expect(await projects.add(`${FOLDER}/`)).toEqual(project)
    expect(await setAside.list()).toEqual([])

    // Taken off twice, it is kept once.
    await projects.remove(project.id)
    await projects.restore(project.id)
    await projects.remove(project.id)
    expect(await setAside.list()).toEqual([project])
  })

  it('does not reuse an id that is already in the list', async () => {
    const kept: Project = { ...project, id: 'p-9' }
    const { projects, setAside } = projectsWith([{ ...kept, folder: '/progetti/Boreale 2' }])
    await setAside.save([kept])

    const added = await projects.add(FOLDER)

    expect(added.id).toBe('p-1')
    expect(await setAside.list()).toEqual([kept])
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
    expect(await questions.list(project.folder)).toEqual([record])
  })

  it('starts a conversation, and tells a question that continues it what came before', async () => {
    const agent = agentAnswering(draft)
    const questions = memoryQuestionLog()
    const ask = createAskQuestion({
      agent,
      evidence,
      questions,
      clock: steppingClock(),
      ids: countingIds('q'),
    })

    const first = await ask({ project, question: 'Quando consegniamo?' })
    // A new conversation has nothing before it.
    expect(agent.requests[0]?.history).toEqual([])
    expect(first.conversationId).toBe('q-2')

    const second = await ask({
      project,
      question: 'E il collaudo?',
      conversationId: first.conversationId ?? null,
    })
    expect(second.conversationId).toBe(first.conversationId)
    expect(agent.requests[1]?.history).toEqual([
      { question: 'Quando consegniamo?', answer: first.answer?.text },
    ])

    // Another conversation knows nothing of the first.
    const other = await ask({ project, question: 'Chi è il referente?', conversationId: null })
    expect(other.conversationId).not.toBe(first.conversationId)
    expect(agent.requests[2]?.history).toEqual([])
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
