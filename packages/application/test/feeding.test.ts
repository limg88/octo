import { DomainError, type Project, type SourceRun } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createFeeding, type FeedingStep } from '../src/index.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const run = (written: number): SourceRun => ({
  at: '2026-11-14T10:00:00.000Z',
  written,
  unchanged: 0,
  error: null,
})
const never = async (): Promise<never> => {
  throw new Error('not used by this test')
}

function feeding(options: {
  mail: boolean
  feeds: Array<'ado' | 'jira'>
  busy?: boolean
  broken?: boolean
}) {
  const calls: string[] = []
  const service = createFeeding({
    sources: {
      mail: never,
      saveMail: never,
      previewMail: never,
      hasMail: async () => options.mail,
      syncMail: async () => {
        calls.push('mail')
        if (options.busy) throw new DomainError('source_busy')
        return run(2)
      },
    },
    feeds: {
      view: never,
      save: never,
      choices: never,
      configured: async () => options.feeds,
      sync: async (_project, feed) => {
        calls.push(feed)
        if (options.broken) throw new Error('disk full')
        return run(5)
      },
    },
    documents: {
      state: never,
      convert: async () => {
        calls.push('documents')
        return run(1)
      },
    },
  })
  return { service, calls }
}

describe('filling a project from all its sources', () => {
  it('reads the mail, then the systems, then the documents, telling each step', async () => {
    const { service, calls } = feeding({ mail: true, feeds: ['ado', 'jira'] })
    const told: FeedingStep[] = []

    const steps = await service.fill(project, (step) => told.push(step))

    expect(calls).toEqual(['mail', 'ado', 'jira', 'documents'])
    expect(steps.map((step) => [step.source, step.run?.written])).toEqual([
      ['mail', 2],
      ['ado', 5],
      ['jira', 5],
      ['documents', 1],
    ])
    expect(told).toEqual(steps)
    expect(await service.status(project)).toEqual({ mail: true, feeds: ['ado', 'jira'] })
  })

  it('converts the documents even when nothing else is set up', async () => {
    const { service, calls } = feeding({ mail: false, feeds: [] })
    await service.fill(project)
    expect(calls).toEqual(['documents'])
  })

  it('goes on when a source cannot start, and stops on an unexpected error', async () => {
    const busy = feeding({ mail: true, feeds: [], busy: true })
    const steps = await busy.service.fill(project)
    expect(steps[0]).toEqual({ source: 'mail', run: null, error: 'source_busy' })
    expect(busy.calls).toEqual(['mail', 'documents'])

    const broken = feeding({ mail: false, feeds: ['ado'], broken: true })
    await expect(broken.service.fill(project)).rejects.toThrow('disk full')
  })
})
