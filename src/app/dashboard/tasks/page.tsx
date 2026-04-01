'use client'
import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/lib/i18n'

// ── Types ──────────────────────────────────────────────────────────────────
interface Task {
  id: string
  parentId: string | null
  level: number
  order: number
  isGroup: boolean
  isCritical: boolean
  isMilestone: boolean
  name: string
  description?: string
  responsible?: string
  weight: number
  plannedStart?: string | null
  plannedEnd?: string | null
  actualStart?: string | null
  actualEnd?: string | null
  progress: number
  status: string
  priority: string
  observations?: string
  predecessors?: { predecessor: { id: string; name: string } }[]
}

const EMPTY_FORM = {
  name: '', description: '', responsible: '', weight: 1,
  priority: 'MEDIUM', status: 'NOT_STARTED', progress: 0,
  plannedStart: '', plannedEnd: '', actualStart: '', actualEnd: '',
  isMilestone: false, isCritical: false, isGroup: false,
  parentId: '', observations: '', predecessorIds: [] as string[],
}

const PROJECT_ID = 'cmnfdkigp0003pxj805frieyd'

const fmt = (s?: string | null) => {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}
const toInput = (s?: string | null) => {
  if (!s) return ''
  return s.includes('T') ? s.slice(0, 10) : s
}
const isDelayed = (t: Task) =>
  t.status !== 'COMPLETED' && t.plannedEnd && t.plannedEnd < new Date().toISOString().slice(0, 10)

// ── Modal ──────────────────────────────────────────────────────────────────
function TaskModal({ task, tasks, onClose, onSaved }: {
  task: Task | null, tasks: Task[], onClose: () => void, onSaved: () => void
}) {
  const { lang } = useLang()
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (task) {
      setForm({
        name: task.name,
        description: task.description ?? '',
        responsible: task.responsible ?? '',
        weight: task.weight,
        priority: task.priority,
        status: task.status,
        progress: task.progress,
        plannedStart: toInput(task.plannedStart),
        plannedEnd: toInput(task.plannedEnd),
        actualStart: toInput(task.actualStart),
        actualEnd: toInput(task.actualEnd),
        isMilestone: task.isMilestone,
        isCritical: task.isCritical,
        isGroup: task.isGroup,
        parentId: task.parentId ?? '',
        observations: task.observations ?? '',
        predecessorIds: task.predecessors?.map(p => p.predecessor.id) ?? [],
      })
    } else {
      setForm({ ...EMPTY_FORM })
    }
  }, [task])

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError(lang === 'pt' ? 'Nome obrigatório' : 'Name required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        projectId: PROJECT_ID,
        parentId: form.parentId || null,
        plannedStart: form.plannedStart || undefined,
        plannedEnd: form.plannedEnd || undefined,
        actualStart: form.actualStart || undefined,
        actualEnd: form.actualEnd || undefined,
      }
      const url = task ? `/api/tasks/${task.id}` : '/api/tasks'
      const method = task ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Erro'); }
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const pt = lang === 'pt'
  const groups = tasks.filter(t => t.isGroup)
  const others = tasks.filter(t => t.id !== task?.id)

  const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block' }
  const ROW: React.CSSProperties = { display: 'grid', gap: 12 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
            {task ? (pt ? 'Editar Tarefa' : 'Edit Task') : (pt ? 'Nova Tarefa' : 'New Task')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Nome */}
          <div>
            <label style={LABEL}>{pt ? 'Nome *' : 'Name *'}</label>
            <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder={pt ? 'Nome da tarefa' : 'Task name'} />
          </div>

          {/* Responsável + Peso */}
          <div style={{ ...ROW, gridTemplateColumns: '1fr 100px' }}>
            <div>
              <label style={LABEL}>{pt ? 'Responsável' : 'Responsible'}</label>
              <input className="form-control" value={form.responsible} onChange={e => set('responsible', e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>{pt ? 'Peso (%)' : 'Weight (%)'}</label>
              <input className="form-control" type="number" min={0} max={100} value={form.weight} onChange={e => set('weight', Number(e.target.value))} />
            </div>
          </div>

          {/* Status + Prioridade */}
          <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={LABEL}>Status</label>
              <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="NOT_STARTED">{pt ? 'Não Iniciado' : 'Not Started'}</option>
                <option value="IN_PROGRESS">{pt ? 'Em Andamento' : 'In Progress'}</option>
                <option value="COMPLETED">{pt ? 'Concluído' : 'Completed'}</option>
                <option value="ON_HOLD">{pt ? 'Em Espera' : 'On Hold'}</option>
                <option value="DELAYED">{pt ? 'Atrasado' : 'Delayed'}</option>
              </select>
            </div>
            <div>
              <label style={LABEL}>{pt ? 'Prioridade' : 'Priority'}</label>
              <select className="form-control" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="LOW">{pt ? 'Baixa' : 'Low'}</option>
                <option value="MEDIUM">{pt ? 'Média' : 'Medium'}</option>
                <option value="HIGH">{pt ? 'Alta' : 'High'}</option>
                <option value="CRITICAL">{pt ? 'Crítica' : 'Critical'}</option>
              </select>
            </div>
          </div>

          {/* Progresso */}
          <div>
            <label style={LABEL}>{pt ? `Progresso: ${form.progress}%` : `Progress: ${form.progress}%`}</label>
            <input type="range" min={0} max={100} value={form.progress} onChange={e => set('progress', Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--blue)' }} />
          </div>

          {/* Datas planejadas */}
          <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={LABEL}>{pt ? 'Início Planejado' : 'Planned Start'}</label>
              <input className="form-control" type="date" value={form.plannedStart} onChange={e => set('plannedStart', e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>{pt ? 'Fim Planejado' : 'Planned End'}</label>
              <input className="form-control" type="date" value={form.plannedEnd} onChange={e => set('plannedEnd', e.target.value)} />
            </div>
          </div>

          {/* Datas reais */}
          <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={LABEL}>{pt ? 'Início Real' : 'Actual Start'}</label>
              <input className="form-control" type="date" value={form.actualStart} onChange={e => set('actualStart', e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>{pt ? 'Fim Real' : 'Actual End'}</label>
              <input className="form-control" type="date" value={form.actualEnd} onChange={e => set('actualEnd', e.target.value)} />
            </div>
          </div>

          {/* Grupo pai */}
          <div>
            <label style={LABEL}>{pt ? 'Grupo Pai' : 'Parent Group'}</label>
            <select className="form-control" value={form.parentId} onChange={e => set('parentId', e.target.value)}>
              <option value="">{pt ? '— Nenhum (raiz) —' : '— None (root) —'}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {/* Flags */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              ['isGroup', pt ? 'É Grupo' : 'Is Group'],
              ['isCritical', pt ? 'Crítico' : 'Critical'],
              ['isMilestone', 'Milestone'],
            ].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                <input type="checkbox" checked={(form as any)[k]} onChange={e => set(k, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--blue)' }} />
                {label}
              </label>
            ))}
          </div>

          {/* Predecessoras */}
          <div>
            <label style={LABEL}>{pt ? 'Predecessoras' : 'Predecessors'}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {others.filter(t => !t.isGroup).map(t => {
                const checked = form.predecessorIds.includes(t.id)
                return (
                  <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text2)', background: checked ? 'rgba(59,130,246,0.15)' : 'var(--surface2)', border: `1px solid ${checked ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 6, padding: '3px 8px' }}>
                    <input type="checkbox" checked={checked} onChange={e => {
                      const ids = e.target.checked ? [...form.predecessorIds, t.id] : form.predecessorIds.filter(id => id !== t.id)
                      set('predecessorIds', ids)
                    }} style={{ accentColor: 'var(--blue)' }} />
                    {t.name}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={LABEL}>{pt ? 'Observações' : 'Observations'}</label>
            <textarea className="form-control" rows={2} value={form.observations} onChange={e => set('observations', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>{pt ? 'Cancelar' : 'Cancel'}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (pt ? 'Salvando…' : 'Saving…') : (pt ? 'Salvar' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { lang, t } = useLang()
  const tk = t.tasks
  const pt = lang === 'pt'

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(new Set<string>())
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [modalTask, setModalTask] = useState<Task | 'new' | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?projectId=${PROJECT_ID}`)
      const json = await res.json()
      const data: Task[] = json.data ?? []
      setTasks(data)
      setExpanded(new Set(data.filter(t => t.isGroup).map(t => t.id)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const visible = tasks.filter(task => {
    if (task.parentId && !expanded.has(task.parentId)) return false
    if (search && !task.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus && task.status !== filterStatus) return false
    return true
  })

  const sel = selected ? tasks.find(t => t.id === selected) : null
  const leaves = tasks.filter(t => !t.isGroup)

  const sl = (s: string) => (t.status as any)[s] ?? s
  const pl = (p: string) => (t.priority as any)[p] ?? p
  const sb = (s: string) => ({ COMPLETED: 'badge-green', IN_PROGRESS: 'badge-blue', NOT_STARTED: 'badge-gray', DELAYED: 'badge-red', ON_HOLD: 'badge-yellow' }[s] ?? 'badge-gray')
  const pb = (p: string) => ({ CRITICAL: 'badge-red', HIGH: 'badge-yellow', MEDIUM: 'badge-blue', LOW: 'badge-gray' }[p] ?? 'badge-gray')

  const handleDelete = async (id: string) => {
    if (!confirm(pt ? 'Confirma exclusão da tarefa?' : 'Confirm task deletion?')) return
    setDeleting(id)
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      if (selected === id) setSelected(null)
      await load()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 110px)', gap: 0 }}>
      {/* Modal */}
      {modalTask !== null && (
        <TaskModal
          task={modalTask === 'new' ? null : modalTask}
          tasks={tasks}
          onClose={() => setModalTask(null)}
          onSaved={() => { setModalTask(null); load() }}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{tk.title}</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
              {leaves.length} {pt ? 'tarefas' : 'tasks'} · {leaves.filter(t => t.status === 'COMPLETED').length} {tk.completed.toLowerCase()} · <span style={{ color: 'var(--red)' }}>{leaves.filter(t => isDelayed(t)).length} {pt ? 'atrasadas' : 'delayed'}</span>
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModalTask('new')}>
            + {pt ? 'Nova Tarefa' : 'New Task'}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <input className="form-control" style={{ height: 32, width: 220, fontSize: 12 }} placeholder={`🔍 ${tk.search}`} value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-control" style={{ height: 32, width: 180, fontSize: 12 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">{tk.allStatus}</option>
            <option value="COMPLETED">{tk.completed}</option>
            <option value="IN_PROGRESS">{tk.inProgress}</option>
            <option value="NOT_STARTED">{tk.notStarted}</option>
            <option value="DELAYED">{pt ? 'Atrasado' : 'Delayed'}</option>
            <option value="ON_HOLD">{pt ? 'Em Espera' : 'On Hold'}</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(new Set(tasks.filter(t => t.isGroup).map(t => t.id)))}>{tk.expand}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(new Set())}>{tk.collapse}</button>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{visible.length} {tk.displayed}</span>
        </div>

        {/* Table */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text3)', fontSize: 14 }}>
              {pt ? 'Carregando tarefas…' : 'Loading tasks…'}
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, color: 'var(--text3)' }}>
              <span style={{ fontSize: 32 }}>📋</span>
              <p style={{ fontSize: 14 }}>{pt ? 'Nenhuma tarefa cadastrada' : 'No tasks yet'}</p>
              <button className="btn btn-primary btn-sm" onClick={() => setModalTask('new')}>+ {pt ? 'Nova Tarefa' : 'New Task'}</button>
            </div>
          ) : (
            <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
              <table>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  <tr>
                    <th style={{ width: 32 }} />
                    {[tk.colTask, tk.colResp, tk.colPlanStart, tk.colPlanEnd, tk.colProgress, tk.colStatus, tk.colPriority, ''].map((h, i) => <th key={i}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(task => {
                    const hasKids = tasks.some(t => t.parentId === task.id)
                    const delayed = isDelayed(task)
                    return (
                      <tr key={task.id}
                        style={{ background: task.id === selected ? 'rgba(59,130,246,0.08)' : task.isGroup ? 'var(--surface2)' : '', cursor: 'pointer' }}
                        onClick={() => setSelected(task.id === selected ? null : task.id)}>
                        <td style={{ width: 32 }}>
                          {hasKids
                            ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12 }} onClick={e => { e.stopPropagation(); toggle(task.id) }}>{expanded.has(task.id) ? '▾' : '▸'}</button>
                            : <span style={{ width: 16, display: 'block' }} />}
                        </td>
                        <td style={{ paddingLeft: task.level * 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {task.isMilestone && <span style={{ color: '#a855f7', fontSize: 11 }}>◆</span>}
                            {task.isCritical && !task.isMilestone && <span style={{ color: '#f59e0b', fontSize: 11 }}>⚡</span>}
                            {delayed && <span style={{ color: 'var(--red)', fontSize: 11 }}>⏰</span>}
                            <span style={{ fontSize: 12.5, fontWeight: task.isGroup ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{task.name}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{task.responsible || '—'}</td>
                        <td style={{ fontSize: 12 }}>{fmt(task.plannedStart)}</td>
                        <td style={{ fontSize: 12, color: delayed ? 'var(--red)' : '' }}>{fmt(task.plannedEnd)}</td>
                        <td style={{ minWidth: 130 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ flex: 1 }}>
                              <div className={`progress-fill ${task.status === 'COMPLETED' ? 'progress-green' : delayed ? 'progress-red' : 'progress-blue'}`} style={{ width: task.progress + '%' }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 26 }}>{task.progress}%</span>
                          </div>
                        </td>
                        <td><span className={`badge ${sb(task.status)}`}>{sl(task.status)}</span></td>
                        <td><span className={`badge ${pb(task.priority)}`}>{pl(task.priority)}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                            <button title={pt ? 'Editar' : 'Edit'} onClick={() => setModalTask(task)}
                              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                            <button title={pt ? 'Excluir' : 'Delete'} onClick={() => handleDelete(task.id)} disabled={deleting === task.id}
                              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {sel && (
        <div style={{ width: 320, minWidth: 320, borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {sel.isCritical && <span className="badge badge-yellow">⚡ {(t.priority as any).CRITICAL}</span>}
                {sel.isMilestone && <span className="badge badge-purple">◆ Milestone</span>}
                {isDelayed(sel) && <span className="badge badge-red">⏰ {(t.status as any).DELAYED}</span>}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{sel.name}</h3>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
          </div>
          <hr style={{ borderColor: 'var(--border)' }} />
          <div>
            <p style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{tk.panelProgress}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div className="progress-bar" style={{ flex: 1, height: 8 }}>
                <div className={`progress-fill ${sel.progress === 100 ? 'progress-green' : isDelayed(sel) ? 'progress-red' : 'progress-blue'}`} style={{ width: sel.progress + '%' }} />
              </div>
              <span style={{ marginLeft: 12, fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{sel.progress}%</span>
            </div>
          </div>
          <hr style={{ borderColor: 'var(--border)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              [tk.panelResp, sel.responsible || '—'],
              [tk.panelStatus, sl(sel.status)],
              [tk.panelPriority, pl(sel.priority)],
              [tk.panelPlanStart, fmt(sel.plannedStart)],
              [tk.panelPlanEnd, fmt(sel.plannedEnd)],
              [tk.panelActStart, fmt(sel.actualStart)],
              [tk.panelActEnd, fmt(sel.actualEnd)],
            ].map(([l, v]) => (
              <div key={l}>
                <p style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{l}</p>
                <p style={{ fontSize: 13, color: 'var(--text)' }}>{v}</p>
              </div>
            ))}
          </div>
          {sel.observations && (
            <>
              <hr style={{ borderColor: 'var(--border)' }} />
              <div>
                <p style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{pt ? 'Observações' : 'Observations'}</p>
                <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{sel.observations}</p>
              </div>
            </>
          )}
          <hr style={{ borderColor: 'var(--border)' }} />
          <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => setModalTask(sel)}>
            ✏️ {pt ? 'Editar Tarefa' : 'Edit Task'}
          </button>
        </div>
      )}
    </div>
  )
}
