'use client'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
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
      setError('Email ou senha inválidos')
    } else {
      router.push('/projects')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 16, padding: 40,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 28, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>
            Chronos PM
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>BD7D Solutions Engenharia</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13,
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>SENHA</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: 8, height: 44, fontSize: 15, fontWeight: 700 }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>Carregando…</div>}>
      <LoginForm />
    </Suspense>
  )
}
