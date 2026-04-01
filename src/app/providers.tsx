'use client'
import { SessionProvider } from 'next-auth/react'
import { LangProvider } from '@/lib/i18n'
import { ProjectProvider } from '@/lib/projectContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LangProvider>
        <ProjectProvider>
          {children}
        </ProjectProvider>
      </LangProvider>
    </SessionProvider>
  )
}
