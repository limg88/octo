import { cleanPreferences, type Preferences } from '@octo/domain'
import type { PreferencesStore } from './ports.ts'

export type AppPreferences = {
  get(): Promise<Preferences>
  save(preferences: Preferences): Promise<Preferences>
}

/** What a person set for the app on this computer: read and kept as a whole. */
export function createPreferences(deps: { store: PreferencesStore }): AppPreferences {
  return {
    get: async () => cleanPreferences(await deps.store.load()),
    async save(preferences) {
      const clean = cleanPreferences(preferences)
      await deps.store.save(clean)
      return clean
    },
  }
}
