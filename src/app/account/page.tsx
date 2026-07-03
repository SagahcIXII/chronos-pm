'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang, LangSwitcher } from '@/lib/i18n'
import { signOut, useSession } from 'next-auth/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ArrowLeft, KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

const INPUT = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13,
  outline: 'none', fontFamily: 'DM Sans, sans-serif',
}
const LABEL = {
  fontSize: 11, fontWeight: 600 as const, color: 'var(--text3)',
  textTransform: 'uppercase' as const, letterSpacing: '0.5px', display: 'block' as const, marginBottom: 5,
}

export default function AccountPage() {
  const router = useRouter()
  const { lang } = useLang()
  const { data: session } = useSession()

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const submit = async () => {
    setError(''); setOk(false)
    if (!form.currentPassword || !form.newPassword) {
      setError(lang === 'pt' ? 'Preencha todos os campos.' : 'Fill all fields.'); return
    }
    if (form.newPassword.length < 6) {
      setError(lang === 'pt' ? 'A nova senha deve ter ao menos 6 caracteres.' : 'New password must be at least 6 characters.'); return
    }
    if (form.newPassword !== form.confirm) {
      setError(lang === 'pt' ? 'A confirmação não confere.' : 'Confirmation does not match.'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || (lang === 'pt' ? 'Erro ao trocar senha' : 'Error changing password')) }
      else { setOk(true); setForm({ currentPassword: '', newPassword: '', confirm: '' }) }
    } catch { setError(lang === 'pt' ? 'Erro de conexão' : 'Connection error') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Chronos PM</div>
          <span style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>{lang === 'pt' ? 'Minha Conta' : 'My Account'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard')} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={15} /> {lang === 'pt' ? 'Painel' : 'Dashboard'}</button>
          <ThemeToggle />
          <LangSwitcher />
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{lang === 'pt' ? 'Trocar Senha' : 'Change Password'}</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{session?.user?.email}</p>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL}>{lang === 'pt' ? 'Senha atual' : 'Current password'}</label>
              <input type="password" style={INPUT} value={form.currentPassword}
                onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))} placeholder="••••••" />
            </div>
            <div>
              <label style={LABEL}>{lang === 'pt' ? 'Nova senha' : 'New password'}</label>
              <input type="password" style={INPUT} value={form.newPassword}
                onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))} placeholder={lang === 'pt' ? 'mínimo 6 caracteres' : 'min 6 characters'} />
            </div>
            <div>
              <label style={LABEL}>{lang === 'pt' ? 'Confirmar nova senha' : 'Confirm new password'}</label>
              <input type="password" style={INPUT} value={form.confirm}
                onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••" />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle size={15} /> {error}</div>
            )}
            {ok && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={15} /> {lang === 'pt' ? 'Senha alterada com sucesso.' : 'Password changed successfully.'}
              </div>
            )}

            <button onClick={submit} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} {lang === 'pt' ? 'Salvar nova senha' : 'Save new password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
