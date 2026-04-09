'use client'
import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useLang } from '@/lib/i18n'
import { useProject } from '@/lib/projectContext'

interface Task {
  id: string; parentId: string | null; isGroup: boolean; isMilestone: boolean
  name: string; responsible?: string; weight: number
  plannedStart?: string | null; plannedEnd?: string | null
  actualStart?: string | null; actualEnd?: string | null
  progress: number; status: string; priority: string
}

const todayISO = new Date().toISOString().slice(0, 10)
const todayDate = new Date(todayISO)

function monthLabel(date: Date, lang: string): string {
  return date.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: '2-digit' })
}

// Planejado: passado/hoje = proporcional; futuro = degraus (nunca decresce)
// ── Planejado: linha reta (diasDecorridos/diasTotais) ────────────────────────
function calcPlannedLinear(pointDate: Date, projectStart: string, projectEnd: string): number {
  const start = new Date(projectStart)
  const end = new Date(projectEnd)
  const totalDays = (end.getTime() - start.getTime()) / 86400000
  if (totalDays <= 0) return 0
  const elapsed = (pointDate.getTime() - start.getTime()) / 86400000
  return Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)))
}

// ── Executado: progresso real ponderado das tarefas ───────────────────────────
function calcExecutedLinear(leaves: Task[], totalW: number, pointISO: string): number {
  let execDone = 0
  leaves.forEach(t => {
    const w = t.weight || 1
    const endRef = t.actualEnd || (t.status === 'COMPLETED' ? t.plannedEnd : null)
    if (endRef && endRef <= pointISO) execDone += w
    else if (t.status === 'IN_PROGRESS' && t.plannedStart && t.plannedStart <= pointISO)
      execDone += w * (t.progress / 100)
  })
  return totalW ? Math.round(execDone / totalW * 100) : 0
}

// ── Gráfico semanal com metodologia linear ────────────────────────────────────
function computeCurveData(tasks: Task[], lang: string, projectStart: string, projectEnd: string) {
  const leaves = tasks.filter(t => !t.isGroup)
  if (!leaves.length) return { rows: [], todayLabel: '' }

  const dates = leaves.flatMap(t => [t.plannedStart, t.plannedEnd].filter(Boolean) as string[])
  if (!dates.length) return { rows: [], todayLabel: '' }

  const minD = dates.reduce((a, b) => a < b ? a : b)
  const maxD = dates.reduce((a, b) => a > b ? a : b)

  const start = new Date(projectStart || minD)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(projectEnd || maxD)
  end.setDate(end.getDate() + 7)

  const totalW = leaves.reduce((s, t) => s + (t.weight || 1), 0)
  const rows: any[] = []
  const cur = new Date(start)

  const weekLabel = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return lang === 'pt' ? `${dd}/${mm}` : `${mm}/${dd}`
  }

  const todayLabel = weekLabel(todayDate)
  let todayInserted = false

  while (cur <= end) {
    const pointDate = new Date(cur)
    const pointISO = pointDate.toISOString().slice(0, 10)

    // Insere ponto de hoje antes do primeiro futuro
    if (!todayInserted && pointISO > todayISO) {
      rows.push({
        period: todayLabel,
        date: todayISO,
        plannedCumulative: calcPlannedLinear(todayDate, projectStart, projectEnd),
        executedCumulative: calcExecutedLinear(leaves, totalW, todayISO),
        isToday: true,
        isFuture: false,
      })
      todayInserted = true
    }

    const isFuture = pointDate > todayDate
    const isToday = pointISO === todayISO
    if (isToday) todayInserted = true

    rows.push({
      period: isToday ? todayLabel : weekLabel(pointDate),
      date: pointISO,
      plannedCumulative: calcPlannedLinear(pointDate, projectStart, projectEnd),
      executedCumulative: !isFuture ? calcExecutedLinear(leaves, totalW, pointISO) : null,
      isToday,
      isFuture,
    })
    cur.setDate(cur.getDate() + 7)
  }

  if (!todayInserted) {
    rows.push({
      period: todayLabel,
      date: todayISO,
      plannedCumulative: calcPlannedLinear(todayDate, projectStart, projectEnd),
      executedCumulative: calcExecutedLinear(leaves, totalW, todayISO),
      isToday: true,
      isFuture: false,
    })
  }

  rows.sort((a, b) => a.date.localeCompare(b.date))

  // Monotonicidade
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].plannedCumulative < rows[i - 1].plannedCumulative) {
      rows[i].plannedCumulative = rows[i - 1].plannedCumulative
    }
  }

  return { rows, todayLabel }
}

function classifyTasks(leaves: Task[]) {
  const delayed: Task[] = []
  const atRisk: Task[] = []

  leaves.forEach(t => {
    if (t.status === 'COMPLETED') return
    const isDelayed = t.plannedEnd && t.plannedEnd <= todayISO
    if (isDelayed) { delayed.push(t); return }

    if (!t.plannedStart || !t.plannedEnd) return
    const totalDays = (new Date(t.plannedEnd).getTime() - new Date(t.plannedStart).getTime()) / 86400000
    if (totalDays <= 0) return
    const elapsed = Math.max(0, (todayDate.getTime() - new Date(t.plannedStart).getTime()) / 86400000)
    const timePct = Math.min(100, (elapsed / totalDays) * 100)
    if (timePct > 15 && t.progress < timePct - 15) atRisk.push(t)
  })

  return { delayed, atRisk }
}

export default function DashboardPage() {
  const { lang, t } = useLang()
  const { activeProject } = useProject()
  const d = t.dashboard
  const sl = (s: string) => (t.status as any)[s] ?? s

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeProject?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?projectId=${activeProject.id}`)
      const json = await res.json()
      setTasks(json.data ?? [])
    } finally { setLoading(false) }
  }, [activeProject?.id])

  useEffect(() => { load() }, [load])

  const leaves = tasks.filter(t => !t.isGroup)
  const groups = tasks.filter(t => t.isGroup)
  const completed = leaves.filter(t => t.status === 'COMPLETED').length
  const milestones = leaves.filter(t => t.isMilestone)
  const mDone = milestones.filter(t => t.status === 'COMPLETED').length
  const totalProgress = activeProject?.progress ?? 0

  // Fix 1: plannedProgress proporcional ao tempo (não só tarefas já encerradas)
  // Planejado linear: mesma metodologia da Curva S
  const plannedProgress = (() => {
    const pS = (activeProject as any).startDate?.slice(0,10) ?? ''
    const pE = (activeProject as any).endDate?.slice(0,10) ?? ''
    if (!pS || !pE) return 0
    return calcPlannedLinear(todayDate, pS, pE)
  })()

  const deviation = totalProgress - plannedProgress

  // Fix 2: delayed = vencidas + em risco
  const { delayed, atRisk } = classifyTasks(leaves)
  const problemCount = delayed.length + atRisk.length

  const pStart = (activeProject as any).startDate?.slice(0,10) ?? ''
  const pEnd = (activeProject as any).endDate?.slice(0,10) ?? ''
  const { rows: curveData, todayLabel } = computeCurveData(tasks, lang, pStart, pEnd)

  const fd = (s: string) => {
    const [y, m, day] = s.split('-')
    return lang === 'pt' ? `${day}/${m}/${y}` : `${m}/${day}/${y}`
  }

  if (!activeProject) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)' }}>
      Selecione um projeto para começar.
    </div>
  )

  // Fix 4: quando não há grupos, usa as próprias tarefas no resumo
  const phaseItems = groups.length > 0 ? groups : leaves.slice(0, 8)
  const hasGroups = groups.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
          {activeProject.name}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
          {activeProject.code} · {(activeProject as any).responsible} · {activeProject.startDate ? fd(activeProject.startDate.slice(0, 10)) : '?'} → {activeProject.endDate ? fd(activeProject.endDate.slice(0, 10)) : '?'}
        </p>
      </div>

      {deviation < -3 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 13, color: '#fbbf24' }}>
          ⚠ {lang === 'pt'
            ? `Projeto com desvio de ${Math.abs(deviation)}% abaixo do planejado. Atenção ao caminho crítico.`
            : `Project is ${Math.abs(deviation)}% behind schedule. Watch critical path.`}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>{lang === 'pt' ? 'Carregando…' : 'Loading…'}</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[
              {
                label: d.kpi1Label,
                value: String(leaves.length),
                sub: `${completed} ${d.kpi1Sub}`,
                cls: 'blue'
              },
              {
                label: d.kpi2Label,
                value: `${totalProgress}%`,
                sub: `${lang === 'pt' ? 'Planejado' : 'Planned'}: ${plannedProgress}% · ${lang === 'pt' ? 'Desvio' : 'Dev'}: ${deviation >= 0 ? '+' : ''}${deviation}%`,
                cls: deviation < -3 ? 'red' : 'green'
              },
              {
                label: d.kpi3Label,
                value: String(problemCount),
                sub: delayed.length > 0
                  ? `${delayed.length} ${lang === 'pt' ? 'vencidas' : 'overdue'}${atRisk.length > 0 ? ` · ${atRisk.length} ${lang === 'pt' ? 'em risco' : 'at risk'}` : ''}`
                  : atRisk.length > 0
                    ? `${atRisk.length} ${lang === 'pt' ? 'em risco de atraso' : 'at risk'}`
                    : `0 ${lang === 'pt' ? 'tarefas críticas' : 'critical tasks'}`,
                cls: problemCount > 0 ? 'red' : 'green'
              },
              {
                label: d.kpi4Label,
                value: String(milestones.length),
                sub: `${mDone} ${d.kpi4Sub}`,
                cls: 'purple'
              },
            ].map(k => (
              <div key={k.label} className={`kpi-card ${k.cls}`}>
                <p className="kpi-label">{k.label}</p>
                <p className="kpi-value">{k.value}</p>
                <p className="kpi-sub">{k.sub}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Fix 3: Curva S com executado e linha Hoje correta */}
            <div className="card">
              <div className="card-header"><h2 className="card-title">{d.curvaTitle}</h2></div>
              <div style={{ padding: '16px 16px 16px 0', height: 220 }}>
                {curveData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={curveData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gDP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gDE" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="period" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={1} />
                      <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} tickFormatter={v => v + '%'} axisLine={{ stroke: 'var(--border)' }} tickLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                        formatter={(v: any, n: string) => [v != null ? v + '%' : '—', n]}
                      />
                      <ReferenceLine
                        x={todayLabel}
                        stroke="var(--red)"
                        strokeWidth={2}
                        strokeDasharray="5,4"
                        label={{ value: lang === 'pt' ? `Hoje ${todayISO.slice(8,10)}/${todayISO.slice(5,7)}` : `Today ${todayISO.slice(5,7)}/${todayISO.slice(8,10)}`, fill: 'var(--red)', fontSize: 9, position: 'top' }}
                      />
                      <Area type="monotone" dataKey="plannedCumulative" name={lang === 'pt' ? 'Planejado' : 'Planned'} stroke="#3b82f6" strokeWidth={2} fill="url(#gDP)" connectNulls />
                      <Area type="monotone" dataKey="executedCumulative" name={lang === 'pt' ? 'Executado' : 'Executed'} stroke="#22c55e" strokeWidth={2} fill="url(#gDE)" connectNulls={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>
                    {lang === 'pt' ? 'Sem tarefas cadastradas' : 'No tasks yet'}
                  </div>
                )}
              </div>
            </div>

            {/* Fix 4: Avanço por Fase — mostra tarefas quando não há grupos */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">{d.fasesTitle}</h2>
                {!hasGroups && (
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
                    ({lang === 'pt' ? 'tarefas principais' : 'main tasks'})
                  </span>
                )}
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {phaseItems.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text3)' }}>
                    {lang === 'pt' ? 'Nenhuma tarefa cadastrada' : 'No tasks yet'}
                  </p>
                ) : phaseItems.map(p => (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{p.name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.progress}%</span>
                        <span className={`badge ${p.status === 'COMPLETED' ? 'badge-green' : p.status === 'IN_PROGRESS' ? 'badge-blue' : 'badge-gray'}`}>
                          {sl(p.status)}
                        </span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${p.status === 'COMPLETED' ? 'progress-green' : p.progress < 20 ? 'progress-red' : 'progress-blue'}`}
                        style={{ width: p.progress + '%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resumo do Cronograma */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">{d.resumoTitle}</h2>
              {!hasGroups && (
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
                  ({lang === 'pt' ? 'tarefas — sem grupos cadastrados' : 'tasks — no groups registered'})
                </span>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>{[d.colFase, d.colInicio, d.colTermino, d.colProgresso, d.colStatus].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>{phaseItems.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.plannedStart ? fd(p.plannedStart.slice(0, 10)) : '—'}</td>
                    <td>{p.plannedEnd ? fd(p.plannedEnd.slice(0, 10)) : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ flex: 1, minWidth: 80 }}>
                          <div
                            className={`progress-fill ${p.status === 'COMPLETED' ? 'progress-green' : 'progress-blue'}`}
                            style={{ width: p.progress + '%' }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.status === 'COMPLETED' ? 'badge-green' : p.status === 'IN_PROGRESS' ? 'badge-blue' : p.status === 'DELAYED' ? 'badge-red' : 'badge-gray'}`}>
                        {sl(p.status)}
                      </span>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
