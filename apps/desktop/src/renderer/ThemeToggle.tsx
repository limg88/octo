import { messages } from './messages.ts'
import type { ShownTheme } from './use-theme.ts'

type Props = {
  shown: ShownTheme
  onChoose: (theme: ShownTheme) => void
}

const SUN = (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
const MOON = (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
)
const CHOICES: ReadonlyArray<{ theme: ShownTheme; icon: typeof SUN }> = [
  { theme: 'light', icon: SUN },
  { theme: 'dark', icon: MOON },
]

/** Light or dark: the one in use is pressed, and each says its name to who does not see the sign. */
export function ThemeToggle({ shown, onChoose }: Props) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of two buttons, not a set of form fields.
    <div className="theme-toggle" role="group" aria-label={messages.theme.label}>
      {CHOICES.map(({ theme, icon }) => (
        <button
          key={theme}
          type="button"
          aria-label={messages.theme[theme]}
          title={messages.theme[theme]}
          aria-pressed={shown === theme}
          onClick={() => onChoose(theme)}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}
