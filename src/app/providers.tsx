'use client'
import { SessionProvider } from 'next-auth/react'
import { LangProvider } from '@/lib/i18n'
import { ProjectProvider } from '@/lib/projectContext'
import { ThemeProvider } from '@/lib/theme'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LangProvider>
          <ProjectProvider>
            {children}
          </ProjectProvider>
        </LangProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
