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

const today = new Date().toISOString().slice(0, 10)

function computeCurveData(tasks: Task[], lang: string) {
  const leaves = tasks.filter(t => !t.isGroup)
  if (!leaves.length) return []
  const dates = leaves.flatMap(t => [t.plannedStart, t.plannedEnd].filter(Boolean) as string[])
  if (!dates.length) return []
  const minDate = new Date(dates.reduce((a, b) => a < b ? a : b))
  const maxDate = new Date(dates.reduce((a, b) => a > b ? a : b))
  minDate.setDate(1)
  maxDate.setMonth(maxDate.getMonth() + 1); maxDate.setDate(1)

  const months: { period: string; plannedCumulative: number; executedCumulative: number | null }[] = []
  const cur = new Date(minDate)
  while (cur <= maxDate) {
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    const endStr = endOfMonth.toISOString().slice(0, 10)
    const label = cur.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: '2-digit' })

    let plannedDone = 0, totalWeight = 0
    leaves.forEach(t => {
      const w = t.weight || 1
      totalWeight += w
      if (t.plannedEnd && t.plannedEnd <= endStr) plannedDone += w
    })
    const plannedCumulative = totalWeight ? Math.round(plannedDone / totalWeight * 100) : 0

    let execDone = 0
    const isPast = endStr <= today
    if (isPast) {
      leaves.forEach(t => {
        const w = t.weight || 1
        const endRef = t.actualEnd || (t.status === 'COMPLETED' ? t.plannedEnd : null)
        if (endRef && endRef <= endStr) execDone += w
        else if (t.status === 'IN_PROGRESS' && t.plannedStart && t.plannedStart <= endStr)
          execDone += w * (t.progress / 100)
      })
    }
    const executedCumulative = isPast ? (totalWeight ? Math.round(execDone / totalWeight * 100) : 0) : null

    months.push({ period: label, plannedCumulative, executedCumulative })
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
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
  const delayed = leaves.filter(t => t.status !== 'COMPLETED' && t.plannedEnd && t.plannedEnd < today)
  const milestones = leaves.filter(t => t.isMilestone)
  const mDone = milestones.filter(t => t.status === 'COMPLETED').length
  const totalProgress = activeProject?.progress ?? 0
  const plannedProgress = (() => {
    if (!leaves.length) return 0
    const totalW = leaves.reduce((s, t) => s + (t.weight || 1), 0)
    const doneW = leaves.reduce((s, t) => {
      const w = t.weight || 1
      if (t.plannedEnd && t.plannedEnd <= today) return s + w
      return s
    }, 0)
    return totalW ? Math.round(doneW / totalW * 100) : 0
  })()
  const deviation = totalProgress - plannedProgress

  const curveData = computeCurveData(tasks, lang)
  const todayLabel = new Date().toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: '2-digit' })

  const fd = (s: string) => {
    const [y, m, day] = s.split('-')
    return lang === 'pt' ? `${day}/${m}/${y}` : `${m}/${day}/${y}`
  }

  if (!activeProject) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)' }}>
      Selecione um projeto para começar.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
          {activeProject.name}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
          {activeProject.code} · {activeProject.responsible} · {activeProject.startDate ? fd(activeProject.startDate.slice(0,10)) : '?'} → {activeProject.endDate ? fd(activeProject.endDate.slice(0,10)) : '?'}
        </p>
      </div>

      {deviation < -3 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 13, color: '#fbbf24' }}>
          ⚠ {lang === 'pt' ? `Projeto com desvio de ${Math.abs(deviation)}% abaixo do planejado. Atenção ao caminho crítico.` : `Project is ${Math.abs(deviation)}% behind schedule. Watch critical path.`}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>{lang === 'pt' ? 'Carregando…' : 'Loading…'}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[
              { label: d.kpi1Label, value: String(leaves.length), sub: `${completed} ${d.kpi1Sub}`, cls: 'blue' },
              { label: d.kpi2Label, value: `${totalProgress}%`, sub: `${lang==='pt'?'Planejado':'Planned'}: ${plannedProgress}% · ${lang==='pt'?'Desvio':'Dev'}: ${deviation >= 0 ? '+' : ''}${deviation}%`, cls: 'green' },
              { label: d.kpi3Label, value: String(delayed.length), sub: `${leaves.filter(t=>t.priority==='CRITICAL').length} ${d.kpi3Sub}`, cls: 'red' },
              { label: d.kpi4Label, value: String(milestones.length), sub: `${mDone} ${d.kpi4Sub}`, cls: 'purple' },
            ].map(k => (
              <div key={k.label} className={`kpi-card ${k.cls}`}>
                <p className="kpi-label">{k.label}</p>
                <p className="kpi-value">{k.value}</p>
                <p className="kpi-sub">{k.sub}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div className="card-header"><h2 className="card-title">{d.curvaTitle}</h2></div>
              <div style={{ padding: '16px 16px 16px 0', height: 220 }}>
                {curveData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={curveData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="period" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} />
                      <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} tickFormatter={v => v + '%'} axisLine={{ stroke: 'var(--border)' }} />
                      <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} formatter={(v: any, n: string) => [v + '%', n]} />
                      <ReferenceLine x={todayLabel} stroke="var(--red)" strokeDasharray="4,3" />
                      <Area type="monotone" dataKey="plannedCumulative" name={lang === 'pt' ? 'Planejado' : 'Planned'} stroke="#3b82f6" strokeWidth={2} fill="rgba(59,130,246,0.1)" connectNulls />
                      <Area type="monotone" dataKey="executedCumulative" name={lang === 'pt' ? 'Executado' : 'Executed'} stroke="#22c55e" strokeWidth={2} fill="rgba(34,197,94,0.1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>{lang === 'pt' ? 'Sem tarefas cadastradas' : 'No tasks yet'}</div>}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h2 className="card-title">{d.fasesTitle}</h2></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {groups.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text3)' }}>{lang === 'pt' ? 'Nenhum grupo cadastrado' : 'No groups yet'}</p>
                ) : groups.map(p => (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.progress}%</span>
                        <span className={`badge ${p.status === 'COMPLETED' ? 'badge-green' : p.status === 'IN_PROGRESS' ? 'badge-blue' : 'badge-gray'}`}>{sl(p.status)}</span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className={`progress-fill ${p.status === 'COMPLETED' ? 'progress-green' : p.progress < 20 ? 'progress-red' : 'progress-blue'}`} style={{ width: p.progress + '%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="card-title">{d.resumoTitle}</h2></div>
            <div className="table-wrap">
              <table>
                <thead><tr>{[d.colFase, d.colInicio, d.colTermino, d.colProgresso, d.colStatus].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{groups.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.plannedStart ? fd(p.plannedStart.slice(0,10)) : '—'}</td>
                    <td>{p.plannedEnd ? fd(p.plannedEnd.slice(0,10)) : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ flex: 1, minWidth: 80 }}>
                          <div className={`progress-fill ${p.status === 'COMPLETED' ? 'progress-green' : 'progress-blue'}`} style={{ width: p.progress + '%' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${p.status === 'COMPLETED' ? 'badge-green' : p.status === 'IN_PROGRESS' ? 'badge-blue' : 'badge-gray'}`}>{sl(p.status)}</span></td>
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
