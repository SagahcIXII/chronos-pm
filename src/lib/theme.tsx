'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeCtx { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }
const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {}, setTheme: () => {} })

const KEY = 'chronos_theme'

function applyTheme(t: Theme) {
  const el = document.documentElement
  el.setAttribute('data-theme', t)
  el.classList.toggle('dark', t === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    let saved: Theme | null = null
    try { saved = localStorage.getItem(KEY) as Theme | null } catch {}
    const initial: Theme = saved === 'light' || saved === 'dark' ? saved : 'dark'
    setThemeState(initial)
    applyTheme(initial)
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    try { localStorage.setItem(KEY, t) } catch {}
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
