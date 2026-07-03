'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLang, LangSwitcher } from '@/lib/i18n'
import { signOut, useSession } from 'next-auth/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Plus, Pencil, X, Save, Loader2, AlertCircle, FolderKanban, ArrowLeft, LogOut } from 'lucide-react'

interface UserRow {
  id: string; name: string; email: string; role: string; active: boolean
  createdAt: string
  _count?: { projects: number; clientProjects: number }
}

const ROLES = ['ADMIN', 'MANAGER', 'CLIENT', 'VIEWER'] as const

const ROLE_LABEL: Record<string, { pt: string; en: string; color: string }> = {
  ADMIN:   { pt: 'Administrador', en: 'Admin',    color: '#a855f7' },
  MANAGER: { pt: 'Gerente',       en: 'Manager',  color: '#3b82f6' },
  CLIENT:  { pt: 'Cliente',       en: 'Client',   color: '#22c55e' },
  VIEWER:  { pt: 'Visualizador',  en: 'Viewer',   color: '#5a6a84' },
}

const INPUT = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13,
  outline: 'none', fontFamily: 'DM Sans, sans-serif',
}
const LABEL = {
  fontSize: 11, fontWeight: 600 as const, color: 'var(--text3)',
  textTransform: 'uppercase' as const, letterSpacing: '0.5px', display: 'block' as const, marginBottom: 5,
}

function UserModal({ user, onClose, onSave, lang }: {
  user?: UserRow | null; onClose: () => void; onSave: () => void; lang: string
}) {
  const isEdit = !!user
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'CLIENT',
    active: user?.active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.name || (!isEdit && !form.email)) {
      setError(lang === 'pt' ? 'Preencha nome e e-mail.' : 'Fill name and email.')
      return
    }
    if (!isEdit && form.password.length < 6) {
      setError(lang === 'pt' ? 'Senha deve ter ao menos 6 caracteres.' : 'Password must be at least 6 characters.')
      return
    }
    setSaving(true); setError('')
    try {
      const url = isEdit ? `/api/users/${user!.id}` : '/api/users'
      const method = isEdit ? 'PATCH' : 'POST'
      const body: any = isEdit
        ? { name: form.name, role: form.role, active: form.active }
        : { name: form.name, email: form.email, password: form.password, role: form.role }
      // Reset de senha opcional na edição.
      if (isEdit && form.password) {
        if (form.password.length < 6) { setError(lang === 'pt' ? 'Senha deve ter ao menos 6 caracteres.' : 'Password must be at least 6 characters.'); setSaving(false); return }
        body.password = form.password
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || (lang === 'pt' ? 'Erro ao salvar' : 'Save error'))
      } else { onSave() }
    } catch { setError(lang === 'pt' ? 'Erro de conexão' : 'Connection error') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEdit ? <Pencil size={17} /> : <Plus size={18} />} {isEdit ? (lang === 'pt' ? 'Editar Usuário' : 'Edit User') : (lang === 'pt' ? 'Novo Usuário' : 'New User')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL}>{lang === 'pt' ? 'Nome *' : 'Name *'}</label>
            <input style={INPUT} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={lang === 'pt' ? 'Nome completo' : 'Full name'} />
          </div>
          <div>
            <label style={LABEL}>{lang === 'pt' ? 'E-mail *' : 'Email *'}</label>
            <input style={{ ...INPUT, opacity: isEdit ? 0.6 : 1 }} value={form.email} disabled={isEdit}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="cliente@empresa.com" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>{lang === 'pt' ? 'Papel' : 'Role'}</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{lang === 'pt' ? ROLE_LABEL[r].pt : ROLE_LABEL[r].en}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>{isEdit ? (lang === 'pt' ? 'Nova senha' : 'New password') : (lang === 'pt' ? 'Senha *' : 'Password *')}</label>
              <input type="password" style={INPUT} value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder={isEdit ? (lang === 'pt' ? 'deixe em branco p/ manter' : 'blank to keep') : '••••••'} />
            </div>
          </div>
          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
              {lang === 'pt' ? 'Usuário ativo (pode fazer login)' : 'Active user (can sign in)'}
            </label>
          )}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle size={15} /> {error}</div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} className="btn btn-secondary">{lang === 'pt' ? 'Cancelar' : 'Cancel'}</button>
          <button onClick={handleSubmit} disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : (isEdit ? <Save size={15} /> : <Plus size={15} />)} {isEdit ? (lang === 'pt' ? 'Salvar' : 'Save') : (lang === 'pt' ? 'Criar' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const router = useRouter()
  const { lang } = useLang()
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      if (res.ok) { const j = await res.json(); setUsers(j.data ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleActive = async (u: UserRow) => {
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    })
    load()
  }

  const fd = (s: string) => new Date(s).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US')

  // Bloqueio de acesso: apenas ADMIN.
  if (status !== 'loading' && role !== 'ADMIN') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Chronos PM</div>
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>{lang === 'pt' ? 'Acesso restrito a administradores.' : 'Admins only.'}</p>
        <button onClick={() => router.push('/dashboard')} className="btn btn-secondary">{lang === 'pt' ? 'Voltar ao painel' : 'Back to dashboard'}</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {showNew && <UserModal lang={lang} onClose={() => setShowNew(false)} onSave={() => { setShowNew(false); load() }} />}
      {editUser && <UserModal lang={lang} user={editUser} onClose={() => setEditUser(null)} onSave={() => { setEditUser(null); load() }} />}

      {/* Header */}
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Chronos PM</div>
          <span style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>{lang === 'pt' ? 'Gestão de Usuários' : 'User Management'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/projects')} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FolderKanban size={15} /> {lang === 'pt' ? 'Projetos' : 'Projects'}</button>
          <button onClick={() => router.push('/dashboard')} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={15} /> {lang === 'pt' ? 'Painel' : 'Dashboard'}</button>
          <ThemeToggle />
          <LangSwitcher />
          <button onClick={() => signOut({ callbackUrl: '/auth/login' })} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><LogOut size={15} /> {lang === 'pt' ? 'Sair' : 'Sign out'}</button>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>{lang === 'pt' ? 'Usuários' : 'Users'}</h1>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                {loading ? '...' : `${users.length} ${lang === 'pt' ? 'usuários cadastrados' : 'registered users'}`}
              </p>
            </div>
            <button onClick={() => setShowNew(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> {lang === 'pt' ? 'Novo Usuário' : 'New User'}</button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 60, color: 'var(--text3)' }}><Loader2 size={16} className="animate-spin" /> {lang === 'pt' ? 'Carregando...' : 'Loading...'}</div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text3)', fontWeight: 600 }}>{lang === 'pt' ? 'Nome' : 'Name'}</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text3)', fontWeight: 600 }}>E-mail</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text3)', fontWeight: 600 }}>{lang === 'pt' ? 'Papel' : 'Role'}</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text3)', fontWeight: 600 }}>{lang === 'pt' ? 'Projetos' : 'Projects'}</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text3)', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text3)', fontWeight: 600, textAlign: 'right' }}>{lang === 'pt' ? 'Ações' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const rl = ROLE_LABEL[u.role] ?? ROLE_LABEL.VIEWER
                    return (
                      <tr key={u.id} style={{ borderTop: '1px solid var(--border)', opacity: u.active ? 1 : 0.5 }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 500 }}>{u.name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{u.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: rl.color, background: `${rl.color}18`, padding: '2px 8px', borderRadius: 5 }}>
                            {lang === 'pt' ? rl.pt : rl.en}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>
                          {u.role === 'CLIENT' ? (u._count?.clientProjects ?? 0) : (u._count?.projects ?? 0)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: u.active ? '#22c55e' : '#f87171', background: u.active ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)', padding: '2px 8px', borderRadius: 5 }}>
                            {u.active ? (lang === 'pt' ? 'Ativo' : 'Active') : (lang === 'pt' ? 'Inativo' : 'Inactive')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => setEditUser(u)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, marginRight: 8 }}>
                            {lang === 'pt' ? 'Editar' : 'Edit'}
                          </button>
                          <button onClick={() => toggleActive(u)} disabled={u.id === (session?.user as any)?.id}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: u.id === (session?.user as any)?.id ? 'not-allowed' : 'pointer', color: u.active ? '#f87171' : '#22c55e', fontSize: 12, opacity: u.id === (session?.user as any)?.id ? 0.4 : 1 }}
                            title={u.id === (session?.user as any)?.id ? (lang === 'pt' ? 'Não é possível desativar a própria conta' : 'Cannot deactivate your own account') : ''}>
                            {u.active ? (lang === 'pt' ? 'Desativar' : 'Deactivate') : (lang === 'pt' ? 'Ativar' : 'Activate')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {users.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{lang === 'pt' ? 'Nenhum usuário.' : 'No users.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
