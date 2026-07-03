'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useLang } from '@/lib/i18n'
import { useProject } from '@/lib/projectContext'
import { useSession } from 'next-auth/react'

type Scale = 'days' | 'weeks' | 'months'

interface Task {
  id: string; parentId: string | null; level: number; order: number
  isGroup: boolean; isCritical: boolean; isMilestone: boolean
  name: string; responsible?: string
  plannedStart?: string | null; plannedEnd?: string | null
  actualStart?: string | null; actualEnd?: string | null
  progress: number; status: string; priority: string
  predecessors?: { predecessor: { id: string; name: string } }[]
}

const fmtS = (s?: string | null) => s ? new Date(s.includes('T') ? s : s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
const isDelayed = (t: Task) => t.status !== 'COMPLETED' && t.plannedEnd && t.plannedEnd < new Date().toISOString().slice(0, 10)

export default function GanttPage() {
  const { lang, t } = useLang()
  const { activeProject } = useProject()
  const g = t.gantt
  const sl = (s: string) => (t.status as any)[s] ?? s

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState<Scale>('weeks')
  const [expanded, setExpanded] = useState(new Set<string>())
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const chartRef = useRef<HTMLDivElement>(null)

  const { data: session } = useSession()
  const editable = ['ADMIN', 'MANAGER'].includes((session?.user as any)?.role)
  type DragMode = 'move' | 'resize-l' | 'resize-r' | 'milestone'
  type DragState = { id: string; mode: DragMode; origStart: string | null; origEnd: string | null; startX: number }
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragDelta, setDragDelta] = useState(0)
  const dragRef = useRef<DragState | null>(null)
  const deltaRef = useRef(0)

  const load = useCallback(async () => {
    if (!activeProject?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?projectId=${activeProject.id}`)
      const json = await res.json()
      const data: Task[] = json.data ?? []
      setTasks(data)
      setExpanded(new Set(data.filter(t => t.isGroup).map(t => t.id)))
    } finally { setLoading(false) }
  }, [activeProject?.id])

  useEffect(() => { load() }, [load])

  const visible = tasks.filter(task => {
    if (task.parentId && !expanded.has(task.parentId)) return false
    if (search && !task.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Timeline bounds from actual tasks
  const allDates = tasks.flatMap(t => [t.plannedStart, t.plannedEnd, t.actualStart, t.actualEnd].filter(Boolean) as string[])
  const minDateStr = allDates.length ? allDates.reduce((a, b) => a < b ? a : b) : new Date().getFullYear() + '-01-01'
  const maxDateStr = allDates.length ? allDates.reduce((a, b) => a > b ? a : b) : new Date().getFullYear() + '-12-31'
  const tStart = new Date(minDateStr.slice(0, 7) + '-01')
  tStart.setMonth(tStart.getMonth() - 1)
  const tEnd = new Date(maxDateStr.slice(0, 7) + '-01')
  tEnd.setMonth(tEnd.getMonth() + 2)

  const COL_W = scale === 'days' ? 32 : scale === 'weeks' ? 72 : 110
  const PPD = scale === 'days' ? COL_W : scale === 'weeks' ? COL_W / 7 : COL_W / 30.44
  const d2x = (s?: string | null) => {
    if (!s) return 0
    return Math.round((new Date(s.includes('T') ? s : s + 'T12:00:00').getTime() - tStart.getTime()) / 86400000 * PPD)
  }
  const dur2w = (s?: string | null, e?: string | null) => {
    if (!s || !e) return 0
    return Math.max(6, Math.round((new Date(e.includes('T') ? e : e + 'T12:00:00').getTime() - new Date(s.includes('T') ? s : s + 'T12:00:00').getTime()) / 86400000 * PPD))
  }
  const todayX = d2x(new Date().toISOString().slice(0, 10))
  const totalW = Math.max(800, d2x(tEnd.toISOString().slice(0, 10)) + 60)

  const cols: any[] = []
  const cur = new Date(tStart)
  while (cur < tEnd) {
    if (scale === 'months') {
      const x = d2x(cur.toISOString().slice(0, 10)); const next = new Date(cur); next.setMonth(next.getMonth() + 1)
      cols.push({ key: cur.toISOString(), label: cur.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: '2-digit' }), x, w: d2x(next.toISOString().slice(0, 10)) - x })
      cur.setMonth(cur.getMonth() + 1)
    } else if (scale === 'weeks') {
      const x = d2x(cur.toISOString().slice(0, 10))
      cols.push({ key: cur.toISOString(), label: cur.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), x, w: COL_W })
      cur.setDate(cur.getDate() + 7)
    } else {
      const x = d2x(cur.toISOString().slice(0, 10))
      cols.push({ key: cur.toISOString(), label: cur.getDate(), x, w: COL_W })
      cur.setDate(cur.getDate() + 1)
    }
  }

  // ── Drag & drop de datas ──────────────────────────────
  const toDay = (s: string) => new Date(s.includes('T') ? s : s + 'T12:00:00')
  const addDaysStr = (s: string, n: number) => { const d = toDay(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

  const effDates = (task: Task): { s?: string | null; e?: string | null } => {
    if (!drag || drag.id !== task.id) return { s: task.plannedStart, e: task.plannedEnd }
    const n = dragDelta
    if (drag.mode === 'move') return { s: drag.origStart ? addDaysStr(drag.origStart, n) : task.plannedStart, e: drag.origEnd ? addDaysStr(drag.origEnd, n) : task.plannedEnd }
    if (drag.mode === 'resize-l') { let s = drag.origStart ? addDaysStr(drag.origStart, n) : task.plannedStart; const e = task.plannedEnd; if (s && e && s >= e) s = addDaysStr(e, -1); return { s, e } }
    if (drag.mode === 'resize-r') { const s = task.plannedStart; let e = drag.origEnd ? addDaysStr(drag.origEnd, n) : task.plannedEnd; if (s && e && e <= s) e = addDaysStr(s, 1); return { s, e } }
    if (drag.mode === 'milestone') return { s: task.plannedStart, e: drag.origEnd ? addDaysStr(drag.origEnd, n) : task.plannedEnd }
    return { s: task.plannedStart, e: task.plannedEnd }
  }

  const beginDrag = (e: { clientX: number; stopPropagation: () => void; preventDefault: () => void }, task: Task, mode: DragMode) => {
    if (!editable || task.isGroup) return
    if (mode !== 'milestone' && (!task.plannedStart || !task.plannedEnd)) return
    if (mode === 'milestone' && !task.plannedEnd) return
    e.stopPropagation(); e.preventDefault()
    const d: DragState = { id: task.id, mode, origStart: task.plannedStart ?? null, origEnd: task.plannedEnd ?? null, startX: e.clientX }
    dragRef.current = d; deltaRef.current = 0; setDrag(d); setDragDelta(0)
  }

  const commitDrag = async (d: DragState, dd: number) => {
    const task = tasks.find(t => t.id === d.id); if (!task) return
    let ns = task.plannedStart ?? null, ne = task.plannedEnd ?? null
    if (d.mode === 'move') { ns = d.origStart ? addDaysStr(d.origStart, dd) : ns; ne = d.origEnd ? addDaysStr(d.origEnd, dd) : ne }
    else if (d.mode === 'resize-l') { ns = d.origStart ? addDaysStr(d.origStart, dd) : ns; if (ns && ne && ns >= ne) ns = addDaysStr(ne, -1) }
    else if (d.mode === 'resize-r') { ne = d.origEnd ? addDaysStr(d.origEnd, dd) : ne; if (ns && ne && ne <= ns) ne = addDaysStr(ns, 1) }
    else if (d.mode === 'milestone') { ne = d.origEnd ? addDaysStr(d.origEnd, dd) : ne }
    setTasks(prev => prev.map(t => t.id === d.id ? { ...t, plannedStart: ns, plannedEnd: ne } : t))
    try {
      await fetch(`/api/tasks/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plannedStart: ns, plannedEnd: ne }) })
    } catch {}
    load()
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (e: MouseEvent) => { const dd = Math.round((e.clientX - drag.startX) / PPD); deltaRef.current = dd; setDragDelta(dd) }
    const onUp = () => {
      const d = dragRef.current; const dd = deltaRef.current
      dragRef.current = null; deltaRef.current = 0; setDrag(null); setDragDelta(0)
      if (d && dd !== 0) commitDrag(d, dd)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, PPD])

  const sel = selected ? tasks.find(t => t.id === selected) : null
  const ROW_H = 44, HEADER_H = 48

  if (!activeProject) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)' }}>
      Selecione um projeto para começar.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="scale-group">
          {(['days', 'weeks', 'months'] as Scale[]).map(s => (
            <button key={s} className={`scale-btn ${scale === s ? 'active' : ''}`} onClick={() => setScale(s)}>
              {({ days: g.days, weeks: g.weeks, months: g.months } as any)[s]}
            </button>
          ))}
        </div>
        <input className="form-control" style={{ height: 32, width: 200, fontSize: 12 }} placeholder={`🔍 ${g.search}`} value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(new Set(tasks.filter(t => t.isGroup).map(t => t.id)))}>{g.expandAll}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(new Set())}>{g.collapseAll}</button>
        {editable && <span style={{ fontSize: 11, color: 'var(--text3)' }}>✋ {lang === 'pt' ? 'Arraste as barras para ajustar datas' : 'Drag bars to adjust dates'}</span>}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text3)', alignItems: 'center' }}>
          {[{ c: '#3b82f6', l: g.legendPlanned }, { c: '#22c55e', l: g.legendExecuted }, { c: '#ef4444', l: g.legendDelayed }, { c: '#f59e0b', l: g.legendCritical }, { c: '#a855f7', l: g.legendMilestone }].map(x => (
            <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 18, height: 8, borderRadius: 3, background: x.c }} />{x.l}</div>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text3)' }}>
          {lang === 'pt' ? 'Carregando…' : 'Loading…'}
        </div>
      ) : tasks.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text3)' }}>
          {lang === 'pt' ? 'Nenhuma tarefa cadastrada' : 'No tasks yet'}
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          {/* Left panel */}
          <div style={{ width: 380, minWidth: 380, borderRight: '1px solid var(--border)', overflowY: 'auto', overflowX: 'hidden' }}
            onScroll={e => { if (chartRef.current) chartRef.current.scrollTop = (e.target as any).scrollTop }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 72px 72px 44px', padding: '0 12px', height: HEADER_H, alignItems: 'center', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 5 }}>
              {['', g.colTask, g.colStart, g.colEnd, '%'].map(h => <div key={h} style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>)}
            </div>
            {visible.map(task => {
              const hasKids = tasks.some(t => t.parentId === task.id)
              const delayed = isDelayed(task)
              return (
                <div key={task.id}
                  style={{ display: 'grid', gridTemplateColumns: '32px 1fr 72px 72px 44px', paddingLeft: 8 + task.level * 16, paddingRight: 12, minHeight: ROW_H, alignItems: 'center', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: task.id === selected ? 'rgba(59,130,246,0.1)' : task.isGroup ? 'var(--surface2)' : 'transparent' }}
                  onClick={() => setSelected(task.id === selected ? null : task.id)}>
                  <div>{hasKids ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12 }} onClick={e => { e.stopPropagation(); toggle(task.id) }}>{expanded.has(task.id) ? '▾' : '▸'}</button> : <span style={{ width: 16, display: 'block' }} />}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    {task.isMilestone && <span style={{ color: '#a855f7', fontSize: 11 }}>◆</span>}
                    {task.isCritical && !task.isMilestone && <span style={{ color: '#f59e0b', fontSize: 11 }}>⚡</span>}
                    <span style={{ fontSize: 12.5, fontWeight: task.isGroup ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtS(task.plannedStart)}</div>
                  <div style={{ fontSize: 11, color: delayed ? 'var(--red)' : 'var(--text3)' }}>{fmtS(task.plannedEnd)}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: task.progress === 100 ? '#4ade80' : delayed ? 'var(--red)' : 'var(--text3)' }}>{task.progress}%</div>
                </div>
              )
            })}
          </div>

          {/* Chart panel */}
          <div ref={chartRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
            <div style={{ minWidth: totalW, position: 'relative' }}>
              <svg width={totalW} height={HEADER_H} style={{ display: 'block', position: 'sticky', top: 0, zIndex: 4, background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                {cols.map(col => (<g key={col.key}><line x1={col.x} y1={0} x2={col.x} y2={HEADER_H} stroke="var(--border)" strokeWidth={1} /><text x={col.x + col.w / 2} y={HEADER_H / 2 + 4} textAnchor="middle" fill="var(--text3)" fontSize={11} fontFamily="DM Sans,sans-serif">{col.label}</text></g>))}
                <rect x={todayX - 1} y={0} width={2} height={HEADER_H} fill="#ef4444" opacity={0.9} />
              </svg>
              <svg width={totalW} height={Math.max(visible.length * ROW_H, 200)} style={{ display: 'block' }}>
                <defs><marker id="arr" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--text3)" /></marker></defs>
                {cols.map(col => <line key={col.key + 'g'} x1={col.x} y1={0} x2={col.x} y2={visible.length * ROW_H} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="2,3" />)}
                {visible.map((_, i) => i % 2 === 1 && <rect key={i} x={0} y={i * ROW_H} width={totalW} height={ROW_H} fill="rgba(255,255,255,0.012)" />)}
                {visible.map((task, i) => task.id === selected && <rect key={task.id + 's'} x={0} y={i * ROW_H} width={totalW} height={ROW_H} fill="rgba(59,130,246,0.08)" />)}
                {visible.map((task, i) => (task.predecessors ?? []).map(p => {
                  const predTask = tasks.find(t => t.id === p.predecessor.id)
                  if (!predTask) return null
                  const pi = visible.findIndex(t => t.id === predTask.id); if (pi < 0) return null
                  const x1 = d2x(visible[pi].plannedEnd), y1 = pi * ROW_H + ROW_H / 2, x2 = d2x(task.plannedStart), y2 = i * ROW_H + ROW_H / 2
                  return <path key={`d${p.predecessor.id}${task.id}`} d={`M${x1},${y1} C${x1 + 24},${y1} ${x2 - 24},${y2} ${x2},${y2}`} fill="none" stroke="var(--text3)" strokeWidth={1} strokeDasharray="4,3" markerEnd="url(#arr)" opacity={0.4} />
                }))}
                {visible.map((task, i) => {
                  const y = i * ROW_H; const delayed = isDelayed(task)
                  if (task.isMilestone) {
                    const ed = effDates(task)
                    const mx = d2x(ed.e), my = y + ROW_H / 2, sz = 10
                    const dragging = drag?.id === task.id
                    return <g key={task.id + 'b'} onClick={() => setSelected(task.id === selected ? null : task.id)}>
                      <polygon points={`${mx},${my - sz} ${mx + sz},${my} ${mx},${my + sz} ${mx - sz},${my}`} fill="#a855f7" opacity={dragging ? 1 : 0.9}
                        style={{ cursor: editable ? (dragging ? 'grabbing' : 'grab') : 'pointer' }}
                        onMouseDown={e => beginDrag(e, task, 'milestone')} />
                      {task.actualEnd && <polygon points={`${d2x(task.actualEnd)},${my - sz * .7} ${d2x(task.actualEnd) + sz * .7},${my} ${d2x(task.actualEnd)},${my + sz * .7} ${d2x(task.actualEnd) - sz * .7},${my}`} fill="#22c55e" opacity={0.7} />}
                      {dragging && <text x={mx} y={my - sz - 4} textAnchor="middle" fill="var(--text)" fontSize={10} fontFamily="DM Sans,sans-serif">{fmtS(ed.e)}</text>}
                    </g>
                  }
                  const ed = effDates(task)
                  const px = d2x(ed.s), pw = dur2w(ed.s, ed.e)
                  const bc = delayed ? '#ef4444' : task.isCritical ? '#f59e0b' : '#3b82f6'
                  const PY = task.isGroup ? y + ROW_H * .2 : y + ROW_H * .18, PH = task.isGroup ? ROW_H * .42 : ROW_H * .35
                  const EY = y + ROW_H * .58, EH = task.isGroup ? ROW_H * .2 : ROW_H * .25
                  const ax = task.actualStart ? d2x(task.actualStart) : null
                  const aw = ax !== null ? task.actualEnd ? dur2w(task.actualStart, task.actualEnd) : Math.max(4, pw * task.progress / 100) : null
                  const canDrag = editable && !task.isGroup
                  const dragging = drag?.id === task.id
                  return <g key={task.id + 'b'} onClick={() => setSelected(task.id === selected ? null : task.id)}>
                    <rect x={px} y={PY} width={pw} height={PH} rx={3} fill={bc} opacity={task.isGroup ? .5 : dragging ? 1 : .85}
                      style={{ cursor: canDrag ? (dragging ? 'grabbing' : 'grab') : 'pointer' }}
                      onMouseDown={e => canDrag && beginDrag(e, task, 'move')} />
                    {canDrag && pw >= 16 && <>
                      <rect x={px} y={PY} width={6} height={PH} fill="transparent" style={{ cursor: 'ew-resize' }} onMouseDown={e => beginDrag(e, task, 'resize-l')} />
                      <rect x={px + pw - 6} y={PY} width={6} height={PH} fill="transparent" style={{ cursor: 'ew-resize' }} onMouseDown={e => beginDrag(e, task, 'resize-r')} />
                    </>}
                    {ax !== null && aw !== null && <rect x={ax} y={EY} width={aw} height={EH} rx={2} fill="#22c55e" opacity={.9} />}
                    {pw > 36 && task.progress > 0 && <text x={px + 5} y={PY + PH * .75} fill="white" fontSize={9.5} fontFamily="DM Sans,sans-serif" opacity={.95} style={{ pointerEvents: 'none' }}>{task.progress}%</text>}
                    {task.isCritical && !task.isGroup && <rect x={px} y={y + ROW_H - 3} width={pw} height={2} fill="#f59e0b" opacity={.6} style={{ pointerEvents: 'none' }} />}
                    {dragging && <text x={px + pw / 2} y={PY - 4} textAnchor="middle" fill="var(--text)" fontSize={10} fontFamily="DM Sans,sans-serif">{fmtS(ed.s)} → {fmtS(ed.e)}</text>}
                  </g>
                })}
                <line x1={todayX} y1={0} x2={todayX} y2={visible.length * ROW_H} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,4" opacity={.9} />
                <rect x={todayX - 18} y={4} width={36} height={16} rx={4} fill="#ef4444" opacity={.85} />
                <text x={todayX} y={16} textAnchor="middle" fill="white" fontSize={9} fontFamily="DM Sans,sans-serif" fontWeight={600}>{g.legendToday}</text>
                {visible.map((_, i) => <line key={i + 's'} x1={0} y1={(i + 1) * ROW_H} x2={totalW} y2={(i + 1) * ROW_H} stroke="var(--border)" strokeWidth={0.5} />)}
              </svg>
            </div>
          </div>

          {/* Detail panel */}
          {sel && (
            <div style={{ width: 300, minWidth: 300, borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {sel.isCritical && <span className="badge badge-yellow">⚡ {g.panelCritical}</span>}
                    {sel.isMilestone && <span className="badge badge-purple">◆ {g.panelMilestone}</span>}
                    {isDelayed(sel) && <span className="badge badge-red">⏰ {g.panelDelayed}</span>}
                  </div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{sel.name}</h3>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
              </div>
              <hr style={{ borderColor: 'var(--border)' }} />
              <div>
                <p style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{g.panelProgress}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div className="progress-bar" style={{ flex: 1, height: 8 }}><div className={`progress-fill ${sel.progress === 100 ? 'progress-green' : isDelayed(sel) ? 'progress-red' : 'progress-blue'}`} style={{ width: sel.progress + '%' }} /></div>
                  <span style={{ marginLeft: 12, fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{sel.progress}%</span>
                </div>
              </div>
              <hr style={{ borderColor: 'var(--border)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[[g.panelResp, sel.responsible || '—'], [g.panelPlanStart, fmtS(sel.plannedStart)], [g.panelPlanEnd, fmtS(sel.plannedEnd)], [g.panelActStart, fmtS(sel.actualStart)], [g.panelActEnd, fmtS(sel.actualEnd)]].map(([l, v]) => (
                  <div key={l}>
                    <p style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{l}</p>
                    <p style={{ fontSize: 13, color: 'var(--text)' }}>{v}</p>
                  </div>
                ))}
                <div>
                  <p style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Status</p>
                  <span className={`badge badge-${sel.status === 'COMPLETED' ? 'green' : sel.status === 'IN_PROGRESS' ? 'blue' : 'gray'}`}>{sl(sel.status)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
