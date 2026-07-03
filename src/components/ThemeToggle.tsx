'use client'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme'

export function ThemeToggle({ size = 18 }: { size?: number }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      style={{
        background: 'none', border: '1px solid var(--border)', borderRadius: 8,
        cursor: 'pointer', color: 'var(--text2)', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', padding: 7,
      }}
    >
      {theme === 'dark' ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  )
}
