import type { Preferences, ThemeChoice } from '@octo/domain'
import { useCallback, useEffect, useState } from 'react'
import type { OctoApi } from '../shared/api.ts'

export type ShownTheme = 'light' | 'dark'
type ThemeApi = Pick<OctoApi, 'preferences' | 'savePreferences'>

const DARK_QUERY = '(prefers-color-scheme: dark)'

const systemTheme = (): ShownTheme =>
  typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light'

/** Writes the choice on the page: without one the styles follow the system by themselves. */
function apply(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
}

/**
 * The theme of the interface. Until the person chooses, it is the one of the system; what they
 * choose is kept with the preferences of the app and found again at the next opening.
 */
export function useTheme(api: ThemeApi): {
  shown: ShownTheme
  choose: (theme: ShownTheme) => void
} {
  const [choice, setChoice] = useState<ThemeChoice>('system')
  const [system, setSystem] = useState<ShownTheme>(systemTheme)

  useEffect(() => {
    let current = true
    void api.preferences().then((result) => {
      if (!current || !result.ok) return
      setChoice(result.value.theme)
      apply(result.value.theme)
    })
    return () => {
      current = false
    }
  }, [api])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(DARK_QUERY)
    const follow = () => setSystem(query.matches ? 'dark' : 'light')
    query.addEventListener('change', follow)
    return () => query.removeEventListener('change', follow)
  }, [])

  const choose = useCallback(
    (theme: ShownTheme) => {
      setChoice(theme)
      apply(theme)
      const preferences: Preferences = { theme }
      void api.savePreferences(preferences)
    },
    [api],
  )

  return { shown: choice === 'system' ? system : choice, choose }
}
