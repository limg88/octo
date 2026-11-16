import {
  acceptCandidate,
  addRisk,
  checkCitation,
  DomainError,
  dismissCandidate,
  type LiveSource,
  type ModelSettings,
  type Project,
  RISKS_FILE,
  type RiskChange,
  type RiskRegister,
  risksMarkdown,
  romeDateString,
  updateRisk,
  withCandidates,
} from '@octo/domain'
import type {
  AgentProgress,
  Clock,
  EvidenceReader,
  MemoryWriter,
  RiskRegisterStore,
  TodayJudge,
} from './ports.ts'

export type RisksDeps = {
  store: RiskRegisterStore
  writer: MemoryWriter
  judge: TodayJudge
  evidence: EvidenceReader
  clock: Clock
  models?: (project: Project) => Promise<ModelSettings>
  liveSources?: (project: Project) => Promise<LiveSource[]>
}

export type ProposeInput = {
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

export type Risks = {
  register(project: Project): Promise<RiskRegister>
  /** Asks Claude which risks the memory shows; what it finds waits for the PM as candidates. */
  propose(project: Project, input?: ProposeInput): Promise<RiskRegister>
  accept(project: Project, candidateId: string, title: string): Promise<RiskRegister>
  dismiss(project: Project, candidateId: string): Promise<RiskRegister>
  add(project: Project, title: string): Promise<RiskRegister>
  update(project: Project, riskId: string, change: RiskChange): Promise<RiskRegister>
}

/**
 * The register of the risks of a project. Claude proposes with its sources, the code checks each
 * source, the PM decides: only what the PM accepted is written as a text of the project.
 */
export function createRisks(deps: RisksDeps): Risks {
  async function keep(project: Project, register: RiskRegister): Promise<RiskRegister> {
    await deps.store.save(project.folder, register)
    await deps.writer.claim(project.folder)
    await deps.writer.write(project.folder, RISKS_FILE, risksMarkdown(register))
    return register
  }

  const today = (): string => romeDateString(deps.clock.now())

  return {
    register: (project) => deps.store.load(project.folder),

    async propose(project, input = {}) {
      const register = await deps.store.load(project.folder)
      let model: string | null = null
      const proposed = await deps.judge.risks({
        projectFolder: project.folder,
        known: register.risks.map((risk) => risk.title),
        model: (await deps.models?.(project))?.ask ?? null,
        liveSources: (await deps.liveSources?.(project)) ?? [],
        onModel: (used) => {
          model = used
        },
        ...(input.onProgress ? { onProgress: input.onProgress } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      })
      const checked = await Promise.all(
        proposed.map(async (risk) => {
          const citation = { n: 1, path: risk.path, quote: risk.quote }
          const found = checkCitation(citation, await deps.evidence.read(project.folder, risk.path))
          return {
            title: risk.title,
            why: risk.why,
            source: { path: risk.path, quote: risk.quote, verified: found.status === 'verified' },
          }
        }),
      )
      const next = withCandidates(register, checked, deps.clock.now().toISOString(), model)
      await deps.store.save(project.folder, next)
      return next
    },

    async accept(project, candidateId, title) {
      const register = await deps.store.load(project.folder)
      const next = acceptCandidate(register, candidateId, title, today())
      if (next === register) throw new DomainError('risk_invalid', candidateId)
      return keep(project, next)
    },

    async dismiss(project, candidateId) {
      const register = await deps.store.load(project.folder)
      const next = dismissCandidate(register, candidateId)
      if (next === register) throw new DomainError('risk_invalid', candidateId)
      await deps.store.save(project.folder, next)
      return next
    },

    async add(project, title) {
      const register = await deps.store.load(project.folder)
      const next = addRisk(register, title, today())
      if (next === register) throw new DomainError('risk_invalid', 'title')
      return keep(project, next)
    },

    async update(project, riskId, change) {
      const register = await deps.store.load(project.folder)
      if (!register.risks.some((risk) => risk.id === riskId)) {
        throw new DomainError('risk_invalid', riskId)
      }
      return keep(project, updateRisk(register, riskId, change))
    },
  }
}
