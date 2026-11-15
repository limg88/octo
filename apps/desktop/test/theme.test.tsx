// @vitest-environment jsdom
import type { Preferences } from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Logo } from '../src/renderer/Logo.tsx'
import { messages } from '../src/renderer/messages.ts'
import { ThemeToggle } from '../src/renderer/ThemeToggle.tsx'
import { useTheme } from '../src/renderer/use-theme.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
type ThemeApi = Pick<OctoApi, 'preferences' | 'savePreferences'>

const themeApi = (theme: Preferences['theme']): ThemeApi => ({
  preferences: vi.fn(async () => ok<Preferences>({ theme })),
  savePreferences: vi.fn(async (preferences: Preferences) => ok(preferences)),
})

/** Says to the page that the system is dark or light, as a browser would. */
function systemIs(dark: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    matches: dark,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => query)
  return (next: boolean) => {
    query.matches = next
    for (const listener of listeners) listener()
  }
}

function Page({ api }: { api: ThemeApi }) {
  const theme = useTheme(api)
  return <ThemeToggle shown={theme.shown} onChoose={theme.choose} />
}

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.theme
})

describe('the theme of the interface', () => {
  it('follows the system until the person chooses, then keeps what was chosen', async () => {
    const turn = systemIs(true)
    const api = themeApi('system')
    render(<Page api={api} />)
    await waitFor(() => expect(api.preferences).toHaveBeenCalled())
    // Nothing is written on the page: the styles follow the system by themselves.
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(pressed(messages.theme.dark)).toBe('true')
    turn(false)
    await waitFor(() => expect(pressed(messages.theme.light)).toBe('true'))

    fireEvent.click(screen.getByRole('button', { name: messages.theme.dark }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(pressed(messages.theme.dark)).toBe('true')
    expect(api.savePreferences).toHaveBeenCalledWith({ theme: 'dark' })
    // The system no longer decides.
    turn(false)
    expect(pressed(messages.theme.dark)).toBe('true')
  })

  it('opens with the theme kept from the time before', async () => {
    systemIs(true)
    render(<Page api={themeApi('light')} />)
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
    expect(pressed(messages.theme.light)).toBe('true')
    expect(screen.getByRole('group', { name: messages.theme.label })).toBeTruthy()
  })

  it('draws the mark at the size asked, with eight arms, and hides it from who listens', () => {
    const { container } = render(<Logo size={48} />)
    const mark = container.querySelector('svg')
    expect(mark?.getAttribute('width')).toBe('48')
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelectorAll('.logo-arms path')).toHaveLength(8)
  })
})
