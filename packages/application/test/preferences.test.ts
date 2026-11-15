import { DEFAULT_PREFERENCES, type Preferences } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createPreferences } from '../src/index.ts'

function setup(kept: unknown = null) {
  const saved: Preferences[] = []
  const store = {
    load: async () => kept,
    save: async (preferences: Preferences) => {
      saved.push(preferences)
    },
  }
  return { preferences: createPreferences({ store }), saved }
}

describe('what a person set for the app', () => {
  it('follows the system until something is chosen', async () => {
    expect(await setup().preferences.get()).toEqual(DEFAULT_PREFERENCES)
    expect(DEFAULT_PREFERENCES.theme).toBe('system')
  })

  it('keeps the theme chosen and gives it back', async () => {
    const { preferences, saved } = setup({ theme: 'dark' })
    expect(await preferences.get()).toEqual({ theme: 'dark' })
    expect(await preferences.save({ theme: 'light' })).toEqual({ theme: 'light' })
    expect(saved).toEqual([{ theme: 'light' }])
  })

  it('falls back to the default on what it does not understand', async () => {
    for (const kept of [{ theme: 'sepia' }, { other: 1 }, 'dark', 7, []]) {
      expect(await setup(kept).preferences.get()).toEqual(DEFAULT_PREFERENCES)
    }
    const { preferences, saved } = setup()
    await preferences.save({ theme: 'sepia' } as unknown as Preferences)
    expect(saved).toEqual([DEFAULT_PREFERENCES])
  })
})
