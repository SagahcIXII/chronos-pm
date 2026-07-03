// src/app/layout.tsx
import type { Metadata } from 'next'
import { DM_Sans, Syne } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
})

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Chronos PM — Gestão de Cronograma',
  description: 'Sistema profissional de gestão e controle de cronograma de projetos. BD7D Solutions.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('chronos_theme')||'dark';document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}`,
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${syne.variable} font-sans bg-bg text-text antialiased`}>
        <Providers>
          {children}
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
