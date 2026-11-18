import type { OctoApi } from '../shared/api.ts'

/** What is asked of Claude: while one of these runs for a project, its section says so. */
const AGENT_CALLS = [
  'ask',
  'runScripted',
  'correctScripted',
  'startDeliverable',
  'reviseDeliverable',
  'correctKind',
  'commentDashboard',
  'draftReminder',
  'evaluateToday',
  'closeToday',
  'proposeRisks',
] as const satisfies ReadonlyArray<keyof OctoApi>

type AgentCall = (projectId: string, ...rest: never[]) => Promise<unknown>

/**
 * The same api, telling when Claude starts working for a project and when its last request for
 * that project ends. A plain copy: what the bridge exposes is frozen and cannot be wrapped.
 */
export function watchedApi(
  api: OctoApi,
  onBusy: (projectId: string, busy: boolean) => void,
): OctoApi {
  const running = new Map<string, number>()
  const watched: Record<string, unknown> = { ...api }
  for (const name of AGENT_CALLS) {
    const call = api[name] as AgentCall
    watched[name] = async (projectId: string, ...rest: never[]) => {
      const before = running.get(projectId) ?? 0
      running.set(projectId, before + 1)
      if (before === 0) onBusy(projectId, true)
      try {
        return await call(projectId, ...rest)
      } finally {
        const left = (running.get(projectId) ?? 1) - 1
        running.set(projectId, left)
        if (left === 0) onBusy(projectId, false)
      }
    }
  }
  return watched as OctoApi
}
