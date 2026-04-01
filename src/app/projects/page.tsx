'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useProject } from '@/lib/projectContext'
import { useLang, LangSwitcher } from '@/lib/i18n'
import { signOut, useSession } from 'next-auth/react'

interface Project {
  id: string; code: string; name: string; description?: string
  responsible: string; startDate: string; endDate: string
  status: string; progress: number; observations?: string
  totalTasks?: number; completedTasks?: number; inProgressTasks?: number
  computedProgress?: number
}

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
  const [form, setForm] = useState({
    code: project?.code ?? '',
    name: project?.name ?? '',
    description: project?.description ?? '',
    responsible: project?.responsible ?? '',
    startDate: project?.startDate ? project.startDate.slice(0,10) : '',
    endDate: project?.endDate ? project.endDate.slice(0,10) : '',
    status: project?.status ?? 'IN_PROGRESS',
    observations: project?.observations ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
        body: JSON.stringify(form)
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
            {isEdit ? (lang==='pt'?'✏️ Editar Projeto':'✏️ Edit Project') : (lang==='pt'?'➕ Novo Projeto':'➕ New Project')}
          </h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:20}}>✕</button>
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
          <div>
            <label style={LABEL}>{lang==='pt'?'Observações':'Observations'}</label>
            <textarea style={{...INPUT,minHeight:60,resize:'vertical' as const}} value={form.observations}
              onChange={e=>setForm(p=>({...p,observations:e.target.value}))}
              placeholder={lang==='pt'?'Observações adicionais...':'Additional notes...'}/>
          </div>
          {error && (
            <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#f87171'}}>
              ❌ {error}
            </div>
          )}
        </div>
        {/* Footer */}
        <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:10}}>
          <button onClick={onClose} className="btn btn-secondary">{lang==='pt'?'Cancelar':'Cancel'}</button>
          <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
            {saving ? '⏳' : (isEdit ? (lang==='pt'?'💾 Salvar Alterações':'💾 Save Changes') : (lang==='pt'?'✅ Criar Projeto':'✅ Create Project'))}
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
          <div style={{fontSize:48}}>🗑️</div>
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
              {deleting ? '⏳' : (lang==='pt'?'🗑️ Arquivar':'🗑️ Archive')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const { setActiveProject } = useProject()
  const { lang } = useLang()
  const { data: session } = useSession()

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

  const handleSelect = (p: Project) => {
    setActiveProject({
      id: p.id, code: p.code,
      name: p.name, nameEn: p.name,
      client: '', manager: p.responsible,
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
          <LangSwitcher/>
          <span style={{width:1,height:20,background:'var(--border)'}}/>
          <span style={{fontSize:13,color:'var(--text2)'}}>{session?.user?.name}</span>
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
          <button onClick={()=>setShowNewModal(true)} className="btn btn-primary" style={{padding:'10px 20px',fontSize:14}}>
            ➕ {lang==='pt'?'Novo Projeto':'New Project'}
          </button>
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
          <div style={{textAlign:'center',padding:48,color:'var(--text3)',fontSize:14}}>
            ⏳ {lang==='pt'?'Carregando projetos...':'Loading projects...'}
          </div>
        )}

        {/* Project cards */}
        {!loading && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:20}}>
            {projects.length === 0 && (
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:64,color:'var(--text3)'}}>
                <div style={{fontSize:48,marginBottom:12}}>📂</div>
                <p style={{fontSize:16,fontWeight:600,marginBottom:6}}>{lang==='pt'?'Nenhum projeto cadastrado':'No projects registered'}</p>
                <p style={{fontSize:13}}>{lang==='pt'?'Clique em "Novo Projeto" para começar.':'Click "New Project" to get started.'}</p>
              </div>
            )}
            {projects.map(project => {
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
                      style={{flex:1,background:color,color:'white',border:'none',padding:'9px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>
                      {lang==='pt'?'→ Abrir':'→ Open'}
                    </button>
                    <button onClick={e=>{e.stopPropagation();setEditProject(project)}}
                      style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'9px 14px',borderRadius:8,cursor:'pointer',fontSize:14}}
                      title={lang==='pt'?'Editar':'Edit'}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();setDeleteProject(project)}}
                      style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',padding:'9px 14px',borderRadius:8,cursor:'pointer',fontSize:14}}
                      title={lang==='pt'?'Arquivar':'Archive'}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
