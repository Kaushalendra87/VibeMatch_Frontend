/**
 * Light/dark mode.
 *
 * The initial class is applied by an inline script in `index.html`, before
 * React mounts, so there is no flash of the wrong theme. This provider
 * reads that same class rather than re-deriving it — if it re-derived from
 * `matchMedia` it could disagree with what is already painted.
 *
 * The preference is persisted under the same key the inline script uses.
 * They have to stay in step; changing one without the other reintroduces
 * the flash.
 *
 * **Cross-tab.** The preference is per-browser (it is in `localStorage`, not
 * per tab), so a theme chosen in one tab used to leave the others painted in
 * the old one until they reloaded. The tab bus fixes that, and this provider
 * is where it belongs rather than a general listener: receiving a
 * `theme.changed` writes the same state `toggle` writes, so the two paths
 * cannot drift.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { TAB_EVENT, publish, startTabBus, subscribeToTabBus } from '../services/tabBus'

const STORAGE_KEY = 'vibematch.theme'

const ThemeContext = createContext(null)

/** 'light' | 'dark' | 'system' */
function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Private mode. Fall through to system.
  }
  return 'system'
}

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function applyTheme(preference) {
  const isDark = preference === 'dark' || (preference === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', isDark)
  return isDark
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStoredPreference)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    setIsDark(applyTheme(preference))
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      // Persisting is a nicety; the theme still applies for this session.
    }
  }, [preference])

  // Follow the OS while the preference is 'system'.
  useEffect(() => {
    if (preference !== 'system') return undefined
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setIsDark(applyTheme('system'))
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [preference])

  // Another tab picked a theme. Written through the raw setter, not
  // `choose`, so this does not echo the message back and bounce it
  // between tabs forever.
  useEffect(() => {
    startTabBus()
    return subscribeToTabBus((message) => {
      if (message.type === TAB_EVENT.THEME_CHANGED && message.payload?.preference) {
        setPreference(message.payload.preference)
      }
    })
  }, [])

  /** Set the preference explicitly, and tell the other tabs. */
  const choose = useCallback((next) => {
    setPreference(next)
    publish(TAB_EVENT.THEME_CHANGED, { preference: next })
  }, [])

  const toggle = useCallback(() => {
    // With no explicit preference, toggle away from what is painted
    // rather than from the literal 'system' value.
    if (preference === 'system') return choose(isDark ? 'light' : 'dark')
    return choose(preference === 'dark' ? 'light' : 'dark')
  }, [preference, isDark, choose])

  const value = useMemo(
    () => ({ preference, isDark, setPreference: choose, toggle }),
    [preference, isDark, choose, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider')
  return context
}
