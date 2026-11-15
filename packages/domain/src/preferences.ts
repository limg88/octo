/** How the interface is lit: as the system says, or as the person chose. */
export const THEME_CHOICES = ['system', 'light', 'dark'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]

/** What a person set for the app itself, on this computer, whatever the project. */
export type Preferences = {
  theme: ThemeChoice
}

/** Before anything is chosen the interface follows the system. */
export const DEFAULT_PREFERENCES: Preferences = { theme: 'system' }

/** Preferences as they were kept or sent: what is not understood falls back to the default. */
export function cleanPreferences(value: unknown): Preferences {
  const theme =
    typeof value === 'object' && value !== null && 'theme' in value ? value.theme : undefined
  return {
    theme: THEME_CHOICES.find((choice) => choice === theme) ?? DEFAULT_PREFERENCES.theme,
  }
}
