import { romeDateString, settingsWithPlans, sheetPlansText } from '@octo/domain'
import type { Clock, ForecastSettingsStore, RetiredSheetPlans } from './ports.ts'

/**
 * The settings of the monthly forecast of a project whose plans left Octo. The first time they
 * are asked for, the rates and the costs the plans carried are taken over, so the forecast gives
 * the figures it gave, and the plans are handed back to the PM as a text in the project. The
 * settings come first: a take-over cut short is done again, and doing it twice changes nothing.
 */
export function forecastSettingsAfterPlans(
  settings: ForecastSettingsStore,
  plans: RetiredSheetPlans,
  clock: Clock,
): ForecastSettingsStore {
  const done = new Set<string>()

  async function takeOver(projectFolder: string): Promise<void> {
    if (done.has(projectFolder)) return
    const pending = await plans.pending(projectFolder)
    if (pending !== null) {
      const written = await settings.load(projectFolder)
      await settings.save(projectFolder, settingsWithPlans(written, pending))
      await plans.handBack(projectFolder, sheetPlansText(pending, romeDateString(clock.now())))
    }
    done.add(projectFolder)
  }

  return {
    async load(projectFolder) {
      await takeOver(projectFolder)
      return settings.load(projectFolder)
    },
    async save(projectFolder, next) {
      await takeOver(projectFolder)
      await settings.save(projectFolder, next)
    },
  }
}
