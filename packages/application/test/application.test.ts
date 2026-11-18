import { DomainError, type Project } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  type AgentProgress,
  createAskQuestion,
  createKeepWork,
  createProjects,
} from '../src/index.ts'
import {
  agentAnswering,
  countingIds,
  evidenceFrom,
  folderProbe,
  memoryQuestionLog,
  memoryRegistry,
  memoryWorkFolders,
  memoryWriter,
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

  it('answers with calculations in a work folder outside the project, and checks what the tables come from', async () => {
    const computed = {
      ...draft,
      tables: [
        {
          title: 'Totali',
          columns: ['voce', 'totale'],
          rows: [['budget', '14500']],
          sources: ['wiki/stato.md', 'wiki/assente.md'],
          file: 'totali.csv',
        },
        { title: 'A mano', columns: ['x'], rows: [['1']], sources: ['wiki/stato.md'], file: '' },
        {
          title: 'Senza file',
          columns: ['x'],
          rows: [],
          sources: ['wiki/stato.md'],
          file: 'no.csv',
        },
      ],
    }
    const agent = agentAnswering(computed)
    const questions = memoryQuestionLog()
    const work = memoryWorkFolders({
      'totali.csv': 'voce,totale\nbudget,14500\n',
      'calcolo.py': '',
    })
    const written = new Map<string, string>()
    const writer = {
      ...memoryWriter(),
      written,
      writeBytes: async (_folder: string, path: string, bytes: Uint8Array) => {
        written.set(path, new TextDecoder().decode(bytes))
      },
    }
    const deps = { agent, evidence, questions, clock: steppingClock(), ids: countingIds('q'), work }
    const ask = createAskQuestion(deps)

    const record = await ask({ project, question: 'Quanto resta?', compute: true })
    // The run got a folder of its own, named by the question, and never the project's.
    expect(work.created).toEqual(['p-1/q-1'])
    expect(agent.computed).toEqual(['/lavoro/p-1/q-1'])
    expect(record.work).toEqual({ files: ['calcolo.py', 'totali.csv'], keptIn: null })
    expect(record.answer?.tables?.map((table) => [table.sources, table.fileWritten])).toEqual([
      [
        [
          { path: 'wiki/stato.md', found: true },
          { path: 'wiki/assente.md', found: false },
        ],
        true,
      ],
      [[{ path: 'wiki/stato.md', found: true }], true],
      [[{ path: 'wiki/stato.md', found: true }], false],
    ])
    // A question asked without calculations never touches a work folder.
    await ask({ project, question: 'Quando consegniamo?' })
    expect(work.created).toHaveLength(1)

    // The files go in the project only when the PM says so, once, and the question says where.
    const keep = createKeepWork({ questions, work, writer })
    const kept = await keep(project, record.id)
    expect(kept.work?.keptIn).toBe(`_octo/analisi/${record.askedAt.slice(0, 10)}-q-1`)
    expect([...writer.written.keys()].sort()).toEqual([
      `${kept.work?.keptIn}/calcolo.py`,
      `${kept.work?.keptIn}/totali.csv`,
    ])
    expect((await questions.list(project.folder)).find((known) => known.id === record.id)).toEqual(
      kept,
    )
    writer.written.clear()
    expect(await keep(project, record.id)).toEqual(kept)
    expect(writer.written.size).toBe(0)
    await expect(keep(project, 'q-3')).rejects.toMatchObject({ code: 'work_not_found' })
    await expect(keep(project, 'mai-chiesta')).rejects.toMatchObject({ code: 'work_not_found' })
  })

  it('refuses to compute where nothing keeps the agent inside a work folder', async () => {
    const agent = agentAnswering(draft)
    const questions = memoryQuestionLog()
    const bare = createAskQuestion({
      agent,
      evidence,
      questions,
      clock: steppingClock(),
      ids: countingIds('q'),
    })
    const record = await bare({ project, question: 'Quanto resta?', compute: true })
    expect(record).toMatchObject({ answer: null, error: 'fence_unavailable' })
    expect(agent.computed).toEqual([])
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
