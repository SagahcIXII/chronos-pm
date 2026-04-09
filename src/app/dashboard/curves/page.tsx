'use client'
import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar } from 'recharts'
import { useLang } from '@/lib/i18n'
import { useProject } from '@/lib/projectContext'

interface Task {
  id: string; parentId: string | null; isGroup: boolean
  plannedStart?: string | null; plannedEnd?: string | null
  actualStart?: string | null; actualEnd?: string | null
  progress: number; status: string; weight: number
}

// Data de hoje em ISO (YYYY-MM-DD) — usada como referência única em todo o componente
const todayISO = new Date().toISOString().slice(0, 10)

// ─── Gera o label do mês no mesmo formato usado por buildCurveData ────────────
function monthLabel(date: Date, lang: string): string {
  return date.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: '2-digit' })
}

// ─── Calcula tendência real baseada nos prazos individuais de cada tarefa ─────
// Lógica: para cada tarefa em andamento, verifica se o progresso é compatível
// com o tempo decorrido. Se >30% das tarefas ativas estão em risco → Atrasado.
function calcTrend(tasks: Task[], lang: string): { label: string; color: string; detail: string } {
  const leaves = tasks.filter(t => !t.isGroup && t.status !== 'COMPLETED' && t.status !== 'NOT_STARTED')
  if (!leaves.length) return { label: lang === 'pt' ? 'No Prazo' : 'On Track', color: '#60a5fa', detail: '' }

  let atRisk = 0
  let ahead = 0
  const today = new Date(todayISO)

  leaves.forEach(t => {
    if (!t.plannedStart || !t.plannedEnd) return
    const start = new Date(t.plannedStart)
    const end = new Date(t.plannedEnd)
    const totalDays = (end.getTime() - start.getTime()) / 86400000
    if (totalDays <= 0) return
    const elapsed = Math.max(0, (today.getTime() - start.getTime()) / 86400000)
    const timeProgress = Math.min(100, (elapsed / totalDays) * 100) // % do prazo já decorrido
    const taskProgress = t.progress // % de execução

    // Se o prazo já passou mais de 10% e a execução está >15pp abaixo do tempo decorrido → risco
    if (timeProgress > 10 && taskProgress < timeProgress - 15) atRisk++
    // Se a execução está >15pp acima do tempo decorrido → adiantado
    else if (timeProgress > 10 && taskProgress > timeProgress + 15) ahead++
  })

  const total = leaves.length
  const riskPct = atRisk / total
  const aheadPct = ahead / total

  if (riskPct >= 0.3) {
    return {
      label: lang === 'pt' ? 'Atrasado' : 'Delayed',
      color: '#f87171',
      detail: lang === 'pt' ? `${atRisk} de ${total} tarefas em risco` : `${atRisk} of ${total} tasks at risk`
    }
  }
  if (aheadPct >= 0.5 && riskPct === 0) {
    return {
      label: lang === 'pt' ? 'Adiantado' : 'Ahead',
      color: '#4ade80',
      detail: lang === 'pt' ? `${ahead} de ${total} tarefas adiantadas` : `${ahead} of ${total} tasks ahead`
    }
  }
  return {
    label: lang === 'pt' ? 'No Prazo' : 'On Track',
    color: '#60a5fa',
    detail: ''
  }
}

function buildCurveData(tasks: Task[], lang: string) {
  const leaves = tasks.filter(t => !t.isGroup)
  if (!leaves.length) return { rows: [], todayLabel: '' }

  const dates = leaves.flatMap(t => [t.plannedStart, t.plannedEnd].filter(Boolean) as string[])
  if (!dates.length) return { rows: [], todayLabel: '' }

  const minD = dates.reduce((a, b) => a < b ? a : b)
  const maxD = dates.reduce((a, b) => a > b ? a : b)
  const start = new Date(minD.slice(0, 7) + '-01')
  const end = new Date(maxD.slice(0, 7) + '-01')
  end.setMonth(end.getMonth() + 1)

  const totalW = leaves.reduce((s, t) => s + (t.weight || 1), 0)
  const rows: any[] = []
  const cur = new Date(start)

  // Gera o label de "Hoje" usando o mesmo formato e locale do loop abaixo
  // Aponta para o primeiro dia do mês atual para garantir match exato
  const todayMonth = new Date(todayISO.slice(0, 7) + '-01')
  const todayLabel = monthLabel(todayMonth, lang)

  while (cur <= end) {
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    const endStr = endOfMonth.toISOString().slice(0, 10)
    const label = monthLabel(new Date(cur), lang) // mesmo formato do todayLabel

    let plannedDone = 0
    leaves.forEach(t => { if (t.plannedEnd && t.plannedEnd <= endStr) plannedDone += (t.weight || 1) })
    const plannedCumulative = totalW ? Math.round(plannedDone / totalW * 100) : 0

    // "Passado" = o fim do mês já ocorreu (endStr <= hoje)
    const isPast = endStr <= todayISO
    let execDone = 0
    if (isPast) {
      leaves.forEach(t => {
        const w = t.weight || 1
        const endRef = t.actualEnd || (t.status === 'COMPLETED' ? t.plannedEnd : null)
        if (endRef && endRef <= endStr) execDone += w
        else if (t.status === 'IN_PROGRESS' && t.plannedStart && t.plannedStart <= endStr)
          execDone += w * (t.progress / 100)
      })
    }
    const executedCumulative = isPast ? (totalW ? Math.round(execDone / totalW * 100) : 0) : null

    // Avanço do período (mensal)
    const prevEnd = new Date(cur); prevEnd.setDate(0)
    const prevEndStr = prevEnd.toISOString().slice(0, 10)
    let plannedPrev = 0
    leaves.forEach(t => { if (t.plannedEnd && t.plannedEnd <= prevEndStr) plannedPrev += (t.weight || 1) })
    const plannedPeriod = Math.round((plannedDone - plannedPrev) / totalW * 100)

    let execPrev = 0
    if (isPast) {
      leaves.forEach(t => {
        const w = t.weight || 1
        const endRef = t.actualEnd || (t.status === 'COMPLETED' ? t.plannedEnd : null)
        if (endRef && endRef <= prevEndStr) execPrev += w
      })
    }
    const executedPeriod = isPast ? Math.round((execDone - execPrev) / totalW * 100) : null
    const deviation = isPast && executedCumulative !== null ? executedCumulative - plannedCumulative : null

    rows.push({ period: label, plannedCumulative, executedCumulative, plannedPeriod, executedPeriod, deviation })
    cur.setMonth(cur.getMonth() + 1)
  }

  return { rows, todayLabel }
}

const tt = {
  contentStyle: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' },
  formatter: (v: any, n: string) => [v != null ? v + '%' : '—', n]
}

export default function CurveSPage() {
  const { lang, t } = useLang()
  const { activeProject } = useProject()
  const c = t.curves

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

  const { rows: data, todayLabel } = buildCurveData(tasks, lang)

  // KPIs de avanço acumulado — baseados no último mês com dado executado
  const lastExec = [...data].reverse().find(d => d.executedCumulative !== null)
  const lastPlan = [...data].reverse().find(d => d.plannedCumulative !== null)
  const execVal = lastExec?.executedCumulative ?? 0
  const planVal = lastExec?.plannedCumulative ?? lastPlan?.plannedCumulative ?? 0
  const deviation = execVal - planVal

  // Tendência: calculada por prazo individual de tarefa (não só desvio acumulado)
  const trend = calcTrend(tasks, lang)

  const getStatus = (d: any) => {
    if (d.executedCumulative === null) return c.statusFuturo
    if (d.deviation !== null && d.deviation <= -2) return c.statusAtrasado
    if (d.deviation !== null && d.deviation >= 2) return c.statusAdiantado
    return c.statusNoPrazo
  }
  const getStatusColor = (d: any) => {
    if (d.executedCumulative === null) return 'badge-gray'
    if (d.deviation !== null && d.deviation <= -2) return 'badge-red'
    if (d.deviation !== null && d.deviation >= 2) return 'badge-green'
    return 'badge-blue'
  }

  if (!activeProject) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)' }}>
      Selecione um projeto para começar.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{c.title}</h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{c.subtitle}</p>
      </div>

      {trend.label === (lang === 'pt' ? 'Atrasado' : 'Delayed') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 13, color: '#fbbf24' }}>
          ⚠ {lang === 'pt'
            ? `Projeto com tendência de atraso — ${trend.detail}.`
            : `Project at risk of delay — ${trend.detail}.`}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>{lang === 'pt' ? 'Carregando…' : 'Loading…'}</div>
      ) : tasks.filter(t => !t.isGroup).length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>{lang === 'pt' ? 'Nenhuma tarefa cadastrada' : 'No tasks yet'}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[
              { label: c.kpi1, value: planVal + '%', color: '#60a5fa' },
              { label: c.kpi2, value: execVal + '%', color: deviation < 0 ? '#f87171' : '#4ade80' },
              { label: c.kpi3, value: (deviation >= 0 ? '+' : '') + deviation + '%', color: deviation < 0 ? '#f87171' : '#4ade80' },
              { label: c.kpi4, value: trend.label, color: trend.color },
            ].map(k => (
              <div key={k.label} className="card" style={{ padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{k.label}</p>
                <p style={{ fontFamily: 'Syne,sans-serif', fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</p>
                {k.label === c.kpi4 && trend.detail ? (
                  <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{trend.detail}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><h2 className="card-title">{c.chartTitle}</h2></div>
            <div style={{ padding: '16px 16px 16px 0', height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} domain={[0, 100]} tickFormatter={v => v + '%'} />
                  <Tooltip {...tt} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} formatter={(v: string) => <span style={{ color: 'var(--text2)' }}>{v}</span>} />
                  {/* ReferenceLine usa o mesmo todayLabel gerado pelo buildCurveData — match garantido */}
                  <ReferenceLine
                    x={todayLabel}
                    stroke="var(--red)"
                    strokeWidth={1.5}
                    strokeDasharray="5,4"
                    label={{ value: lang === 'pt' ? 'Hoje' : 'Today', fill: 'var(--red)', fontSize: 10, position: 'top' }}
                  />
                  <Area type="monotone" dataKey="plannedCumulative" name={c.planned} stroke="#3b82f6" strokeWidth={2.5} fill="url(#gP)" dot={{ fill: '#3b82f6', r: 3 }} connectNulls />
                  <Area type="monotone" dataKey="executedCumulative" name={c.executed} stroke="#22c55e" strokeWidth={2.5} fill="url(#gE)" dot={{ fill: '#22c55e', r: 4 }} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div className="card-header"><h2 className="card-title">{c.barTitle}</h2></div>
              <div style={{ padding: '12px 12px 12px 0', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} barGap={4} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="period" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
                    <Tooltip {...tt} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v: string) => <span style={{ color: 'var(--text2)' }}>{v}</span>} />
                    <Bar dataKey="plannedPeriod" name={c.planned} fill="#3b82f6" fillOpacity={.7} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="executedPeriod" name={c.executed} fill="#22c55e" fillOpacity={.8} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h2 className="card-title">{c.tableTitle}</h2></div>
              <div className="table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>{[c.colPeriod, c.colPlanAcum, c.colExecAcum, c.colDesvio, c.colStatus].map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>{data.map(d => (
                    <tr key={d.period}>
                      <td style={{ fontWeight: 600 }}>{d.period}</td>
                      <td>{d.plannedCumulative}%</td>
                      <td style={{ color: d.executedCumulative != null ? '#4ade80' : 'var(--text3)' }}>
                        {d.executedCumulative != null ? d.executedCumulative + '%' : '—'}
                      </td>
                      <td style={{ color: d.deviation == null ? 'var(--text3)' : d.deviation < 0 ? '#f87171' : d.deviation > 0 ? '#4ade80' : 'var(--text2)' }}>
                        {d.deviation != null ? (d.deviation >= 0 ? '+' : '') + d.deviation + '%' : '—'}
                      </td>
                      <td><span className={`badge ${getStatusColor(d)}`}>{getStatus(d)}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
