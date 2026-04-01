'use client'
// src/app/auth/login/page.tsx
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('admin@bd7d.com.br')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(params.get('error') ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', {
      email, password, redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError('Email ou senha incorretos.')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden">
      {/* Grid bg */}
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(59,130,246,0.15),transparent)]" />

      <div className="relative w-full max-w-sm">
        <div className="card p-10 shadow-2xl">
          {/* Logo */}
          <div className="mb-8">
            <div className="text-display text-3xl font-black text-[var(--text)] mb-1">
              Chronos PM
            </div>
            <p className="text-xs text-[var(--text3)] uppercase tracking-widest">
              Gestão de Cronograma · BD7D Solutions
            </p>
          </div>

          {error && (
            <div className="alert alert-danger mb-5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@bd7d.com.br"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="form-label">Senha</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
            </button>
          </form>

          <p className="text-center text-xs text-[var(--text3)] mt-6">
            admin@bd7d.com.br · chronos2025
          </p>
        </div>
      </div>
    </div>
  )
}
