'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProject } from '@/lib/projectContext'
import { useLang, LangSwitcher } from '@/lib/i18n'
import { signOut, useSession } from 'next-auth/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useCanEdit } from '@/lib/useCanEdit'
import { Plus, Pencil, Trash2, X, Save, AlertCircle, Loader2, Users, KeyRound, FolderOpen, Archive, ArrowRight, Copy, Building2, ChevronDown, ChevronRight } from 'lucide-react'

interface Project {
  id: string; code: string; name: string; description?: string
  responsible: string; startDate: string; endDate: string
  status: string; progress: number; observations?: string
  totalTasks?: number; completedTasks?: number; inProgressTasks?: number
  computedProgress?: number
  organizationId?: string | null
  organization?: { id: string; name: string; active?: boolean } | null
}

interface OrgOption { id: string; name: string; active: boolean }

const STATUS_COLORS: Record<string,string> = {
  IN_PROGRESS:'#3b82f6', COMPLETED:'#22c55e', NOT_STARTED:'#5a6a84', ON_HOLD:'#f59e0b'
}
const STATUS_BADGES: Record<string,string> = {
  IN_PROGRESS:'badge-blue', COMPLETED:'badge-green', NOT_STARTED:'badge-gray', ON_HOLD:'badge-yellow'
}

const INPUT = {
  width:'100%', background:'var(--surface2)', border:'1px solid var(--border)',
  borderRadius:8, padding:'8px 12px', color:'var(--text)', fontSize:13,
  outline:'none', fontFamily:'DM Sans, sans-serif',
}
const LABEL = {
  fontSize:11, fontWeight:600 as const, color:'var(--text3)',
  textTransform:'uppercase' as const, letterSpacing:'0.5px', display:'block' as const, marginBottom:5,
}

function ProjectModal({ project, onClose, onSave, lang }: {
  project?: Project | null
  onClose: () => void
  onSave: () => void
  lang: string
}) {
  const isEdit = !!project
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'ADMIN'
  const [form, setForm] = useState({
    code: project?.code ?? '',
    name: project?.name ?? '',
    description: project?.description ?? '',
    responsible: project?.responsible ?? '',
    startDate: project?.startDate ? project.startDate.slice(0,10) : '',
    endDate: project?.endDate ? project.endDate.slice(0,10) : '',
    status: project?.status ?? 'IN_PROGRESS',
    observations: project?.observations ?? '',
    organizationId: project?.organizationId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [orgs, setOrgs] = useState<OrgOption[]>([])

  // Carrega as empresas para o seletor (apenas admin usa o campo).
  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/organizations')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => setOrgs(j.data ?? []))
      .catch(() => setOrgs([]))
  }, [isAdmin])

  const statusOptions = lang === 'pt'
    ? [['IN_PROGRESS','Em Andamento'],['NOT_STARTED','Não Iniciado'],['COMPLETED','Concluído'],['ON_HOLD','Pausado']]
    : [['IN_PROGRESS','In Progress'],['NOT_STARTED','Not Started'],['COMPLETED','Completed'],['ON_HOLD','On Hold']]

  const handleSubmit = async () => {
    if (!form.code || !form.name || !form.responsible || !form.startDate || !form.endDate) {
      setError(lang==='pt'?'Preencha todos os campos obrigatórios.':'Fill all required fields.')
      return
    }
    setSaving(true); setError('')
    try {
      const url = isEdit ? `/api/projects/${project!.id}` : '/api/projects'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: {'Content-Type':'application/json'},
        // Só o admin envia a empresa; para os demais o servidor usa a do usuário.
        body: JSON.stringify(isAdmin ? { ...form, organizationId: form.organizationId || null } : (({ organizationId, ...rest }) => rest)(form))
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Erro ao salvar')
      } else {
        onSave()
      }
    } catch { setError('Erro de conexão') }
    finally { setSaving(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,width:'100%',maxWidth:580,maxHeight:'90vh',overflow:'auto',boxShadow:'0 24px 48px rgba(0,0,0,0.4)'}}>
        {/* Header */}
        <div style={{padding:'20px 24px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,color:'var(--text)'}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:8}}>{isEdit ? <Pencil size={17}/> : <Plus size={18}/>} {isEdit ? (lang==='pt'?'Editar Projeto':'Edit Project') : (lang==='pt'?'Novo Projeto':'New Project')}</span>
          </h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',display:'flex',alignItems:'center'}}><X size={20}/></button>
        </div>
        {/* Body */}
        <div style={{padding:24,display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12}}>
            <div>
              <label style={LABEL}>{lang==='pt'?'Código *':'Code *'}</label>
              <input style={INPUT} value={form.code} disabled={isEdit}
                onChange={e=>setForm(p=>({...p,code:e.target.value}))}
                placeholder="BD7D-2025-001"/>
            </div>
            <div>
              <label style={LABEL}>{lang==='pt'?'Nome do Projeto *':'Project Name *'}</label>
              <input style={INPUT} value={form.name}
                onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                placeholder={lang==='pt'?'Infraestrutura Industrial':'Industrial Infrastructure'}/>
            </div>
          </div>
          <div>
            <label style={LABEL}>{lang==='pt'?'Descrição':'Description'}</label>
            <textarea style={{...INPUT,minHeight:72,resize:'vertical' as const}} value={form.description}
              onChange={e=>setForm(p=>({...p,description:e.target.value}))}
              placeholder={lang==='pt'?'Descrição do projeto...':'Project description...'}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={LABEL}>{lang==='pt'?'Responsável *':'Manager *'}</label>
              <input style={INPUT} value={form.responsible}
                onChange={e=>setForm(p=>({...p,responsible:e.target.value}))}
                placeholder="Eng. Carlos Souza"/>
            </div>
            <div>
              <label style={LABEL}>Status</label>
              <select style={{...INPUT,cursor:'pointer'}} value={form.status}
                onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                {statusOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={LABEL}>{lang==='pt'?'Início *':'Start Date *'}</label>
              <input type="date" style={INPUT} value={form.startDate}
                onChange={e=>setForm(p=>({...p,startDate:e.target.value}))}/>
            </div>
            <div>
              <label style={LABEL}>{lang==='pt'?'Término *':'End Date *'}</label>
              <input type="date" style={INPUT} value={form.endDate}
                onChange={e=>setForm(p=>({...p,endDate:e.target.value}))}/>
            </div>
          </div>
          {isAdmin && (
            <div>
              <label style={LABEL}>{lang==='pt'?'Empresa':'Company'}</label>
              <select style={{...INPUT,cursor:'pointer'}} value={form.organizationId}
                onChange={e=>setForm(p=>({...p,organizationId:e.target.value}))}>
                <option value="">{lang==='pt'?'— BD7D (projeto interno) —':'— BD7D (internal project) —'}</option>
                {orgs.map(o=><option key={o.id} value={o.id}>{o.name}{o.active?'':(lang==='pt'?' (inativa)':' (inactive)')}</option>)}
              </select>
              <p style={{fontSize:11,color:'var(--text3)',marginTop:5}}>
                {lang==='pt'
                  ? 'Todos os usuários da empresa verão este projeto; gerentes da empresa podem editá-lo.'
                  : 'All users of the company will see this project; company managers can edit it.'}
              </p>
            </div>
          )}
          <div>
            <label style={LABEL}>{lang==='pt'?'Observações':'Observations'}</label>
            <textarea style={{...INPUT,minHeight:60,resize:'vertical' as const}} value={form.observations}
              onChange={e=>setForm(p=>({...p,observations:e.target.value}))}
              placeholder={lang==='pt'?'Observações adicionais...':'Additional notes...'}/>
          </div>
          {error && (
            <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#f87171'}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:8}}><AlertCircle size={15}/> {error}</span>
            </div>
          )}
        </div>
        {/* Footer */}
        <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:10}}>
          <button onClick={onClose} className="btn btn-secondary">{lang==='pt'?'Cancelar':'Cancel'}</button>
          <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
            <span style={{display:'inline-flex',alignItems:'center',gap:7}}>{saving ? <Loader2 size={15} className="animate-spin"/> : (isEdit ? <Save size={15}/> : <Plus size={15}/>)} {isEdit ? (lang==='pt'?'Salvar Alterações':'Save Changes') : (lang==='pt'?'Criar Projeto':'Create Project')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteModal({ project, onClose, onConfirm, lang }: {
  project: Project; onClose: () => void; onConfirm: () => void; lang: string
}) {
  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    onConfirm()
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,width:'100%',maxWidth:420,boxShadow:'0 24px 48px rgba(0,0,0,0.4)'}}>
        <div style={{padding:24,display:'flex',flexDirection:'column',gap:16,textAlign:'center'}}>
          <div style={{color:'var(--red2)',display:'flex',justifyContent:'center'}}><Trash2 size={44}/></div>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,color:'var(--text)'}}>
            {lang==='pt'?'Arquivar Projeto?':'Archive Project?'}
          </h2>
          <p style={{fontSize:13,color:'var(--text3)',lineHeight:1.6}}>
            {lang==='pt'
              ? <>O projeto <strong style={{color:'var(--text)'}}>{project.name}</strong> será arquivado e não aparecerá mais na lista. Esta ação pode ser revertida pelo banco de dados.</>
              : <>Project <strong style={{color:'var(--text)'}}>{project.name}</strong> will be archived and no longer appear in the list.</>
            }
          </p>
          <div style={{display:'flex',gap:10,justifyContent:'center'}}>
            <button onClick={onClose} className="btn btn-secondary">{lang==='pt'?'Cancelar':'Cancel'}</button>
            <button onClick={handleDelete} disabled={deleting} style={{background:'#ef4444',color:'white',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:7}}>{deleting ? <Loader2 size={15} className="animate-spin"/> : <Archive size={15}/>} {lang==='pt'?'Arquivar':'Archive'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const { setActiveProject, reload: reloadContext } = useProject()
  const { lang } = useLang()
  const { data: session } = useSession()
  const canEdit = useCanEdit()
  const isAdminUser = (session?.user as any)?.role === 'ADMIN'
  const [duplicating, setDuplicating] = useState<string|null>(null)
  // Grupos (empresas) recolhidos — lembrado por navegador.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('chronos_collapsed_orgs') || '[]')) } catch { return new Set() }
  })
  const toggleGroup = (key: string) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    try { localStorage.setItem('chronos_collapsed_orgs', JSON.stringify([...next])) } catch {}
    return next
  })

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [editProject, setEditProject] = useState<Project|null>(null)
  const [deleteProject, setDeleteProject] = useState<Project|null>(null)

  const statusLabel: Record<string,string> = lang === 'pt'
    ? { IN_PROGRESS:'Em Andamento', COMPLETED:'Concluído', NOT_STARTED:'Não Iniciado', ON_HOLD:'Pausado' }
    : { IN_PROGRESS:'In Progress',  COMPLETED:'Completed', NOT_STARTED:'Not Started',  ON_HOLD:'On Hold'  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (res.ok) setProjects(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Copia o projeto com tarefas, hierarquia e dependências (progresso zerado).
  const handleDuplicate = async (p: Project) => {
    if (!confirm(lang==='pt' ? `Duplicar "${p.name}"? A cópia terá as mesmas tarefas, com progresso zerado.` : `Duplicate "${p.name}"? The copy keeps all tasks, with progress reset.`)) return
    setDuplicating(p.id)
    try {
      const res = await fetch(`/api/projects/${p.id}/duplicate`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || (lang==='pt' ? 'Falha ao duplicar' : 'Failed to duplicate'))
        return
      }
      await Promise.all([load(), reloadContext()])
    } finally { setDuplicating(null) }
  }

  // ADMIN: um grupo por empresa (A→Z) e "BD7D — internos" por último.
  // Demais usuários: um único grupo sem cabeçalho (já veem só a própria empresa).
  type ProjectGroup = { key: string; label: string | null; inactive?: boolean; items: Project[] }
  const projectGroups: ProjectGroup[] = (() => {
    if (!isAdminUser) return projects.length ? [{ key: 'all', label: null, items: projects }] : []
    const map = new Map<string, ProjectGroup>()
    for (const p of projects) {
      const key = p.organization?.id ?? '__internal__'
      const label = p.organization?.name ?? (lang==='pt' ? 'BD7D — projetos internos' : 'BD7D — internal projects')
      const g = map.get(key) ?? { key, label, inactive: p.organization?.active === false, items: [] }
      g.items.push(p)
      map.set(key, g)
    }
    return [...map.values()].sort((a, b) =>
      a.key === '__internal__' ? 1 : b.key === '__internal__' ? -1 : (a.label ?? '').localeCompare(b.label ?? '', 'pt-BR'))
  })()

  const handleSelect = (p: Project) => {
    setActiveProject({
      id: p.id, code: p.code,
      name: p.name, nameEn: p.name,
      client: '', manager: p.responsible, responsible: p.responsible,
      startDate: p.startDate.slice(0,10),
      endDate: p.endDate.slice(0,10),
      progress: p.computedProgress ?? p.progress,
      status: p.status as any,
      type: '', typeEn: '',
      description: p.description || '', descriptionEn: '',
      totalTasks: p.totalTasks ?? 0,
      completedTasks: p.completedTasks ?? 0,
      inProgressTasks: p.inProgressTasks ?? 0,
      delayedTasks: 0, milestones: 0, deviation: 0,
      color: STATUS_COLORS[p.status] || '#3b82f6',
    })
    router.push('/dashboard')
  }

  const fd = (s: string) => {
    const d = new Date(s.includes('T') ? s : s+'T12:00:00')
    return lang==='pt'
      ? d.toLocaleDateString('pt-BR')
      : d.toLocaleDateString('en-US')
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',flexDirection:'column'}}>
      {/* Modais */}
      {showNewModal && (
        <ProjectModal lang={lang} onClose={()=>setShowNewModal(false)} onSave={()=>{setShowNewModal(false);load()}}/>
      )}
      {editProject && (
        <ProjectModal lang={lang} project={editProject} onClose={()=>setEditProject(null)} onSave={()=>{setEditProject(null);load()}}/>
      )}
      {deleteProject && (
        <DeleteModal lang={lang} project={deleteProject} onClose={()=>setDeleteProject(null)} onConfirm={()=>{setDeleteProject(null);load()}}/>
      )}

      {/* Header */}
      <header style={{background:'var(--surface)',borderBottom:'1px solid var(--border)',padding:'0 32px',height:64,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)'}}>Chronos PM</div>
          <span style={{width:1,height:20,background:'var(--border)'}}/>
          <span style={{fontSize:13,color:'var(--text3)'}}>BD7D Solutions Engenharia</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {(session?.user as any)?.role === 'ADMIN' && (
            <button onClick={()=>router.push('/users')}
              style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:13,display:'inline-flex',alignItems:'center',gap:6}}>
              <Users size={15}/> {lang==='pt'?'Usuários':'Users'}
            </button>
          )}
          <ThemeToggle/>
          <LangSwitcher/>
          <span style={{width:1,height:20,background:'var(--border)'}}/>
          <span style={{fontSize:13,color:'var(--text2)'}}>{session?.user?.name}</span>
          <button onClick={()=>router.push('/account')}
            style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:13,display:'inline-flex',alignItems:'center',gap:6}}>
            <KeyRound size={15}/> {lang==='pt'?'Senha':'Password'}
          </button>
          <button onClick={()=>signOut({callbackUrl:'/auth/login'})}
            style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:13}}>
            {lang==='pt'?'Sair':'Sign Out'}
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{flex:1,padding:'36px 32px',maxWidth:1140,margin:'0 auto',width:'100%'}}>
        {/* Título + botão novo */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
          <div>
            <h1 style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,color:'var(--text)',marginBottom:6}}>
              {lang==='pt'?'Projetos':'Projects'}
            </h1>
            <p style={{fontSize:14,color:'var(--text3)'}}>
              {loading ? '...' : `${projects.length} ${lang==='pt'?'projetos cadastrados':'registered projects'}`}
            </p>
          </div>
          {canEdit && (
            <button onClick={()=>setShowNewModal(true)} className="btn btn-primary" style={{padding:'10px 20px',fontSize:14,display:'inline-flex',alignItems:'center',gap:7}}>
              <Plus size={16}/> {lang==='pt'?'Novo Projeto':'New Project'}
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:28}}>
          {[
            {label:lang==='pt'?'Total':'Total',        value:projects.length,                                              color:'var(--text)'},
            {label:lang==='pt'?'Em Andamento':'Active',value:projects.filter(p=>p.status==='IN_PROGRESS').length,          color:'#60a5fa'},
            {label:lang==='pt'?'Concluídos':'Done',    value:projects.filter(p=>p.status==='COMPLETED').length,            color:'#22c55e'},
            {label:lang==='pt'?'Não Iniciados':'Pending',value:projects.filter(p=>p.status==='NOT_STARTED').length,        color:'#5a6a84'},
          ].map(s=>(
            <div key={s.label} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 20px'}}>
              <p style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>{s.label}</p>
              <p style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,color:s.color}}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:48,color:'var(--text3)',fontSize:14}}>
            <Loader2 size={16} className="animate-spin"/> {lang==='pt'?'Carregando projetos...':'Loading projects...'}
          </div>
        )}

        {/* Project cards — ADMIN vê agrupado por empresa; demais, lista única */}
        {!loading && projects.length === 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:20}}>
            {(
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:64,color:'var(--text3)'}}>
                <div style={{marginBottom:12,display:'flex',justifyContent:'center',color:'var(--text3)'}}><FolderOpen size={44}/></div>
                <p style={{fontSize:16,fontWeight:600,marginBottom:6}}>{lang==='pt'?'Nenhum projeto cadastrado':'No projects registered'}</p>
                <p style={{fontSize:13}}>{canEdit
                  ? (lang==='pt'?'Clique em "Novo Projeto" para começar.':'Click "New Project" to get started.')
                  : (lang==='pt'?'Nenhum projeto foi compartilhado com você ainda.':'No projects have been shared with you yet.')}</p>
              </div>
            )}
          </div>
        )}
        {!loading && projectGroups.map(group => {
          const isCollapsed = group.label !== null && collapsed.has(group.key)
          const avg = group.items.length ? Math.round(group.items.reduce((s, p) => s + (p.computedProgress ?? p.progress), 0) / group.items.length) : 0
          return (
          <section key={group.key} style={{marginBottom:28}}>
            {group.label !== null && (
              <button onClick={()=>toggleGroup(group.key)}
                style={{display:'flex',alignItems:'center',gap:10,width:'100%',background:'none',border:'none',borderBottom:'1px solid var(--border)',padding:'0 0 10px',marginBottom:16,cursor:'pointer',color:'var(--text)',textAlign:'left',fontFamily:'inherit'}}>
                {isCollapsed ? <ChevronRight size={18} style={{color:'var(--text3)'}}/> : <ChevronDown size={18} style={{color:'var(--text3)'}}/>}
                <Building2 size={17} style={{color:'var(--text3)'}}/>
                <span style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:800}}>{group.label}</span>
                {group.inactive && <span style={{fontSize:11,color:'#f87171'}}>{lang==='pt'?'(inativa)':'(inactive)'}</span>}
                <span style={{fontSize:12,color:'var(--text3)'}}>
                  {group.items.length} {lang==='pt'?(group.items.length===1?'projeto':'projetos'):(group.items.length===1?'project':'projects')} · {lang==='pt'?'avanço médio':'avg. progress'} {avg}%
                </span>
              </button>
            )}
            {!isCollapsed && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:20}}>
            {group.items.map(project => {
              const color = STATUS_COLORS[project.status] || '#3b82f6'
              const progress = project.computedProgress ?? project.progress
              return (
                <div key={project.id}
                  style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:22,display:'flex',flexDirection:'column',gap:14,position:'relative',overflow:'hidden',transition:'all 0.2s'}}
                  onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=color;el.style.boxShadow=`0 6px 20px ${color}22`}}
                  onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor='var(--border)';el.style.boxShadow='none'}}>

                  {/* Accent top */}
                  <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:color}}/>

                  {/* Header */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginTop:4}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
                        <span style={{fontSize:11,color,fontWeight:700,background:`${color}18`,padding:'2px 8px',borderRadius:4}}>{project.code}</span>
                        <span className={`badge ${STATUS_BADGES[project.status]||'badge-gray'}`}>{statusLabel[project.status]||project.status}</span>
                        {isAdminUser && (
                          <span style={{fontSize:10.5,color:'var(--text3)',border:'1px solid var(--border)',padding:'1px 7px',borderRadius:4}}>
                            {project.organization?.name ?? 'BD7D'}
                          </span>
                        )}
                      </div>
                      <h2 style={{fontFamily:'Syne,sans-serif',fontSize:14,fontWeight:700,color:'var(--text)',lineHeight:1.35,marginBottom:2}}>{project.name}</h2>
                      {project.description && <p style={{fontSize:12,color:'var(--text3)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:1,WebkitBoxOrient:'vertical'}}>{project.description}</p>}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0,marginLeft:12}}>
                      <div style={{fontFamily:'Syne,sans-serif',fontSize:24,fontWeight:800,color}}>{progress}%</div>
                      <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase'}}>{lang==='pt'?'Avanço':'Progress'}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{background:'var(--surface2)',borderRadius:4,height:5,overflow:'hidden'}}>
                    <div style={{background:color,width:`${progress}%`,height:'100%',borderRadius:4,transition:'width 0.5s'}}/>
                  </div>

                  {/* Meta */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      [lang==='pt'?'Responsável':'Manager', project.responsible],
                      [lang==='pt'?'Início':'Start', fd(project.startDate)],
                      [lang==='pt'?'Término':'End', fd(project.endDate)],
                      [lang==='pt'?'Tarefas':'Tasks', `${project.completedTasks||0}/${project.totalTasks||0}`],
                    ].map(([l,v])=>(
                      <div key={l} style={{background:'var(--surface2)',borderRadius:7,padding:'6px 10px'}}>
                        <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:1}}>{l}</div>
                        <div style={{color:'var(--text2)',fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Buttons */}
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>handleSelect(project)}
                      style={{flex:1,background:color,color:'white',border:'none',padding:'9px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      <ArrowRight size={15}/> {lang==='pt'?'Abrir':'Open'}
                    </button>
                    {canEdit && <>
                    <button onClick={e=>{e.stopPropagation();setEditProject(project)}}
                      style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'9px 12px',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center'}}
                      title={lang==='pt'?'Editar':'Edit'}><Pencil size={15}/></button>
                    <button onClick={e=>{e.stopPropagation();handleDuplicate(project)}} disabled={duplicating===project.id}
                      style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'9px 12px',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center'}}
                      title={lang==='pt'?'Duplicar':'Duplicate'}>{duplicating===project.id ? <Loader2 size={15} className="animate-spin"/> : <Copy size={15}/>}</button>
                    <button onClick={e=>{e.stopPropagation();setDeleteProject(project)}}
                      style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',padding:'9px 12px',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center'}}
                      title={lang==='pt'?'Arquivar':'Archive'}><Trash2 size={15}/></button>
                    </>}
                  </div>
                </div>
              )
            })}
          </div>
            )}
          </section>
          )
        })}
      </main>
    </div>
  )
}
