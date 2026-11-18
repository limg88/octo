import type { Extraction, Project } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createAskQuestion, createChatFiles } from '../src/index.ts'
import type { AskRequest } from '../src/ports.ts'
import { memoryWriter } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const bytes = (text: string) => new TextEncoder().encode(text)
const extraction: Extraction = {
  extractor: 'fake@1',
  chunks: [{ text: 'Il collaudo dura tre giorni.', locator: { kind: 'page', page: 1 } }],
  truncated: false,
  metadataDate: null,
  warnings: [],
}

function setup() {
  const writer = memoryWriter()
  const read: string[] = []
  const chatFiles = createChatFiles({
    files: {
      under: async (_folder, folder) =>
        [...writer.files.keys()].filter((path) => path.startsWith(`${folder}/`)).sort(),
    },
    extractor: {
      extensions: ['docx', 'pdf'],
      version: 'fake@1',
      extract: async (_bytes, name) => {
        read.push(name)
        return extraction
      },
    },
    writer,
    clock: { now: () => new Date('2026-11-18T09:00:00.000Z') },
  })
  return { chatFiles, writer, read }
}

describe('the files the PM attaches to a conversation', () => {
  it('copies a text as it is and a document with its text, inside the folder of the conversation', async () => {
    const { chatFiles, writer, read } = setup()
    // The name alone is kept, whatever folder of the computer the file came from.
    const note = await chatFiles.attach(project, 'c-1', {
      name: '/Users/pm/Desktop/appunti.TXT',
      bytes: bytes('Da chiarire: ambiente di prova.'),
    })
    expect(note).toEqual({ name: 'appunti.TXT', path: '_octo/.lavori/chiedi/c-1/appunti.TXT' })
    const brief = await chatFiles.attach(project, 'c-1', {
      name: 'C:\\Documenti\\capitolato.docx',
      bytes: bytes('docx'),
    })
    expect(brief).toEqual({
      name: 'capitolato.docx',
      path: '_octo/.lavori/chiedi/c-1/capitolato.docx.md',
    })
    expect(read).toEqual(['capitolato.docx'])
    expect(writer.files.get(brief.path)).toContain('Il collaudo dura tre giorni.')
    // The conversation lists its files, each with what is read of it; another one has none.
    expect(await chatFiles.of(project, 'c-1')).toEqual([note, brief])
    expect(await chatFiles.of(project, 'c-2')).toEqual([])
  })

  it('refuses what Octo does not read, what is too large, and an id that names another place', async () => {
    const { chatFiles, writer } = setup()
    await expect(
      chatFiles.attach(project, 'c-1', { name: 'foto.heic', bytes: bytes('x') }),
    ).rejects.toMatchObject({
      code: 'attachment_unsupported',
      message: 'attachment_unsupported: heic',
    })
    await expect(
      chatFiles.attach(project, 'c-1', { name: '  ', bytes: bytes('x') }),
    ).rejects.toMatchObject({ code: 'attachment_unsupported' })
    await expect(
      chatFiles.attach(project, '../../altrove', { name: 'a.txt', bytes: bytes('x') }),
    ).rejects.toMatchObject({ code: 'attachment_unsupported' })
    const huge = { name: 'a.txt', bytes: { length: 101 * 1024 * 1024 } as Uint8Array }
    await expect(chatFiles.attach(project, 'c-1', huge)).rejects.toMatchObject({
      code: 'attachment_too_large',
    })
    expect(writer.files.size).toBe(0)
  })

  it('are told to who answers, for the conversation they were attached to', async () => {
    const { chatFiles } = setup()
    await chatFiles.attach(project, 'c-1', { name: 'appunti.txt', bytes: bytes('x') })
    const asked: AskRequest[] = []
    let id = 0
    const ask = createAskQuestion({
      agent: {
        status: async () => ({ available: true, version: '1' }),
        ask: async (request) => {
          asked.push(request)
          return { text: 'Non lo dice.', citations: [], missing: [] }
        },
        compute: async () => ({ text: '', citations: [], missing: [] }),
      },
      evidence: { read: async () => ({ kind: 'missing' }) },
      questions: { list: async () => [], append: async () => {} },
      clock: { now: () => new Date('2026-11-18T09:00:00.000Z') },
      ids: { next: () => `id-${++id}` },
      attachments: (owner, conversationId) => chatFiles.of(owner, conversationId),
    })
    await ask({ project, question: 'Che cosa manca?', conversationId: 'c-1' })
    await ask({ project, question: 'E qui?', conversationId: null })
    expect(asked.map((request) => request.attachments)).toEqual([
      ['_octo/.lavori/chiedi/c-1/appunti.txt'],
      [],
    ])
  })
})
