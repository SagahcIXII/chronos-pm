'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLang, LangSwitcher } from '@/lib/i18n'
import { signOut, useSession } from 'next-auth/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Plus, Pencil, X, Save, Loader2, AlertCircle, FolderKanban, ArrowLeft, LogOut, Building2 } from 'lucide-react'

interface UserRow {
  id: string; name: string; email: string; role: string; active: boolean
  createdAt: string
  organization?: { id: string; name: string; active: boolean } | null
}

interface OrgRow {
  id: string; name: string; active: boolean; createdAt: string
  _count: { users: number; projects: number }
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

function UserModal({ user, orgs, onClose, onSave, lang }: {
  user?: UserRow | null; orgs: OrgRow[]; onClose: () => void; onSave: () => void; lang: string
}) {
  const isEdit = !!user
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'MANAGER',
    active: user?.active ?? true,
    organizationId: user?.organization?.id ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.name || !form.email.trim()) {
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
      const organizationId = form.role === 'ADMIN' ? null : (form.organizationId || null)
      const body: any = isEdit
        ? { name: form.name, email: form.email, role: form.role, active: form.active, organizationId }
        : { name: form.name, email: form.email, password: form.password, role: form.role, organizationId }
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
            <input style={INPUT} value={form.email}
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
          <div>
            <label style={LABEL}>{lang === 'pt' ? 'Empresa' : 'Company'}</label>
            <select style={{ ...INPUT, cursor: form.role === 'ADMIN' ? 'not-allowed' : 'pointer', opacity: form.role === 'ADMIN' ? 0.6 : 1 }}
              value={form.role === 'ADMIN' ? '' : form.organizationId} disabled={form.role === 'ADMIN'}
              onChange={e => setForm(p => ({ ...p, organizationId: e.target.value }))}>
              <option value="">{lang === 'pt' ? '— BD7D (interno) —' : '— BD7D (internal) —'}</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.active ? '' : (lang === 'pt' ? ' (inativa)' : ' (inactive)')}</option>)}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
              {form.role === 'ADMIN'
                ? (lang === 'pt' ? 'Administradores não pertencem a empresa: veem todos os projetos.' : 'Admins belong to no company: they see all projects.')
                : (lang === 'pt' ? 'O usuário verá apenas os projetos desta empresa. Gerentes editam; Cliente/Visualizador só leem e comentam.' : 'The user will only see this company\'s projects. Managers edit; Client/Viewer read and comment.')}
            </p>
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
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [newOrgName, setNewOrgName] = useState('')
  const [orgError, setOrgError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ru, ro] = await Promise.all([fetch('/api/users'), fetch('/api/organizations')])
      if (ru.ok) { const j = await ru.json(); setUsers(j.data ?? []) }
      if (ro.ok) { const j = await ro.json(); setOrgs(j.data ?? []) }
    } finally { setLoading(false) }
  }, [])

  const orgRequest = async (url: string, method: string, body: object) => {
    setOrgError('')
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); setOrgError(d.error || (lang === 'pt' ? 'Erro ao salvar empresa' : 'Error saving company')); return false }
    await load(); return true
  }
  const createOrg = async () => {
    if (newOrgName.trim().length < 2) return
    if (await orgRequest('/api/organizations', 'POST', { name: newOrgName.trim() })) setNewOrgName('')
  }
  const renameOrg = async (o: OrgRow) => {
    const name = prompt(lang === 'pt' ? 'Novo nome da empresa:' : 'New company name:', o.name)
    if (name && name.trim() && name.trim() !== o.name) await orgRequest(`/api/organizations/${o.id}`, 'PATCH', { name: name.trim() })
  }
  const toggleOrg = async (o: OrgRow) => {
    if (o.active && !confirm(lang === 'pt'
      ? `Desativar "${o.name}"? Os ${o._count.users} usuário(s) dela perdem o acesso imediatamente. Os dados são preservados.`
      : `Deactivate "${o.name}"? Its ${o._count.users} user(s) lose access immediately. Data is preserved.`)) return
    await orgRequest(`/api/organizations/${o.id}`, 'PATCH', { active: !o.active })
  }

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
      {showNew && <UserModal lang={lang} orgs={orgs} onClose={() => setShowNew(false)} onSave={() => { setShowNew(false); load() }} />}
      {editUser && <UserModal lang={lang} orgs={orgs} user={editUser} onClose={() => setEditUser(null)} onSave={() => { setEditUser(null); load() }} />}

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
          {/* Empresas */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Building2 size={22} /> {lang === 'pt' ? 'Empresas' : 'Companies'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, marginBottom: 14 }}>
              {lang === 'pt' ? 'Cada empresa só enxerga os próprios projetos. Projetos sem empresa são internos da BD7D.' : 'Each company only sees its own projects. Projects without a company are BD7D internal.'}
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input style={{ ...INPUT, maxWidth: 320 }} value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createOrg() }} placeholder={lang === 'pt' ? 'Nome da nova empresa' : 'New company name'} />
              <button onClick={createOrg} disabled={newOrgName.trim().length < 2} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={15} /> {lang === 'pt' ? 'Criar empresa' : 'Create company'}
              </button>
            </div>
            {orgError && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={14} /> {orgError}</p>}
            {!loading && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                      {[lang === 'pt' ? 'Empresa' : 'Company', lang === 'pt' ? 'Usuários' : 'Users', lang === 'pt' ? 'Projetos' : 'Projects', 'Status', ''].map((h, i) => (
                        <th key={i} style={{ padding: '12px 16px', color: 'var(--text3)', fontWeight: 600, textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map(o => (
                      <tr key={o.id} style={{ borderTop: '1px solid var(--border)', opacity: o.active ? 1 : 0.5 }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 500 }}>{o.name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>{o._count.users}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>{o._count.projects}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: o.active ? '#22c55e' : '#f87171', background: o.active ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)', padding: '2px 8px', borderRadius: 5 }}>
                            {o.active ? (lang === 'pt' ? 'Ativa' : 'Active') : (lang === 'pt' ? 'Inativa' : 'Inactive')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => renameOrg(o)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: 'var(--text2)', fontSize: 12, marginRight: 8 }}>
                            {lang === 'pt' ? 'Renomear' : 'Rename'}
                          </button>
                          <button onClick={() => toggleOrg(o)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: o.active ? '#f87171' : '#22c55e', fontSize: 12 }}>
                            {o.active ? (lang === 'pt' ? 'Desativar' : 'Deactivate') : (lang === 'pt' ? 'Ativar' : 'Activate')}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {orgs.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>{lang === 'pt' ? 'Nenhuma empresa cadastrada.' : 'No companies yet.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
                    <th style={{ padding: '12px 16px', color: 'var(--text3)', fontWeight: 600 }}>{lang === 'pt' ? 'Empresa' : 'Company'}</th>
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
                        <td style={{ padding: '12px 16px', color: u.organization ? 'var(--text2)' : 'var(--text3)' }}>
                          {u.role === 'ADMIN' ? (lang === 'pt' ? 'Todas' : 'All') : (u.organization?.name ?? 'BD7D')}
                          {u.organization && !u.organization.active && <span style={{ color: '#f87171', fontSize: 11 }}> {lang === 'pt' ? '(inativa)' : '(inactive)'}</span>}
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
