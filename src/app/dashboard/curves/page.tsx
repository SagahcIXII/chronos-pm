'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, BarChart, Bar
} from 'recharts'
import { useLang } from '@/lib/i18n'
import { useProject } from '@/lib/projectContext'

interface Task {
  id: string; parentId: string | null; isGroup: boolean
  plannedStart?: string | null; plannedEnd?: string | null
  actualStart?: string | null; actualEnd?: string | null
  progress: number; status: string; weight: number
}

const todayISO = new Date().toISOString().slice(0, 10)
const todayDate = new Date(todayISO)

function weekLabel(date: Date, lang: string): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return lang === 'pt' ? `${d}/${m}` : `${m}/${d}`
}

function monthLabel(date: Date, lang: string): string {
  return date.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: '2-digit' })
}

function calcTrend(tasks: Task[], lang: string): { label: string; color: string; detail: string } {
  const leaves = tasks.filter(t => !t.isGroup && t.status !== 'COMPLETED' && t.status !== 'NOT_STARTED')
  if (!leaves.length) return { label: lang === 'pt' ? 'No Prazo' : 'On Track', color: '#60a5fa', detail: '' }
  let atRisk = 0, ahead = 0
  leaves.forEach(t => {
    if (!t.plannedStart || !t.plannedEnd) return
    const totalDays = (new Date(t.plannedEnd).getTime() - new Date(t.plannedStart).getTime()) / 86400000
    if (totalDays <= 0) return
    const elapsed = Math.max(0, (todayDate.getTime() - new Date(t.plannedStart).getTime()) / 86400000)
    const timeProgress = Math.min(100, (elapsed / totalDays) * 100)
    if (timeProgress > 10 && t.progress < timeProgress - 15) atRisk++
    else if (timeProgress > 10 && t.progress > timeProgress + 15) ahead++
  })
  const total = leaves.length
  if (atRisk / total >= 0.3) return {
    label: lang === 'pt' ? 'Atrasado' : 'Delayed', color: '#f87171',
    detail: lang === 'pt' ? `${atRisk} de ${total} tarefas em risco` : `${atRisk} of ${total} tasks at risk`
  }
  if (ahead / total >= 0.5 && atRisk === 0) return {
    label: lang === 'pt' ? 'Adiantado' : 'Ahead', color: '#4ade80',
    detail: lang === 'pt' ? `${ahead} de ${total} tarefas adiantadas` : `${ahead} of ${total} tasks ahead`
  }
  return { label: lang === 'pt' ? 'No Prazo' : 'On Track', color: '#60a5fa', detail: '' }
}

// ── Calcula planejado acumulado para um ponto de data específico ─────────────
// REGRA: a curva planejada é SEMPRE monotonicamente crescente (nunca decresce)
// - Passado / hoje: proporcional ao tempo decorrido (representa o esperado real)
// - Futuro: apenas tarefas com plannedEnd <= pointISO (degraus nos fins de tarefa)
function calcPlanned(leaves: Task[], totalW: number, pointDate: Date, pointISO: string): number {
  const isFuture = pointDate > todayDate
  let plannedDone = 0
  leaves.forEach(t => {
    const w = t.weight || 1
    if (t.plannedEnd && t.plannedEnd <= pointISO) {
      // Tarefa já encerrada neste ponto — peso total
      plannedDone += w
    } else if (!isFuture && t.plannedStart && t.plannedStart <= pointISO && t.plannedEnd && t.plannedEnd > pointISO) {
      // Tarefa em andamento neste ponto passado/hoje — proporcional ao tempo
      const tStart = new Date(t.plannedStart)
      const tEnd = new Date(t.plannedEnd)
      const totalDays = (tEnd.getTime() - tStart.getTime()) / 86400000
      const elapsedDays = Math.max(0, (pointDate.getTime() - tStart.getTime()) / 86400000)
      plannedDone += w * Math.min(1, totalDays > 0 ? elapsedDays / totalDays : 0)
    }
    // Futuro + tarefa não encerrada = 0 (degraus, não proporcional)
  })
  return totalW ? Math.round(plannedDone / totalW * 100) : 0
}

// ── Calcula executado acumulado para um ponto passado/hoje ───────────────────
function calcExecuted(leaves: Task[], totalW: number, pointISO: string): number {
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

// ── Gráfico principal: granularidade SEMANAL ─────────────────────────────────
function buildWeeklyData(tasks: Task[], lang: string) {
  const leaves = tasks.filter(t => !t.isGroup)
  if (!leaves.length) return { rows: [], todayLabel: '' }

  const dates = leaves.flatMap(t => [t.plannedStart, t.plannedEnd].filter(Boolean) as string[])
  if (!dates.length) return { rows: [], todayLabel: '' }

  const minD = dates.reduce((a, b) => a < b ? a : b)
  const maxD = dates.reduce((a, b) => a > b ? a : b)

  // Início: segunda-feira da semana do minD
  const start = new Date(minD)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))

  // Fim: 1 semana após maxD
  const end = new Date(maxD)
  end.setDate(end.getDate() + 7)

  const totalW = leaves.reduce((s, t) => s + (t.weight || 1), 0)
  const rows: any[] = []
  const cur = new Date(start)

  const todayLabel = weekLabel(new Date(todayISO), lang)

  // Gera pontos semanais
  while (cur <= end) {
    const pointDate = new Date(cur)
    const pointISO = pointDate.toISOString().slice(0, 10)
    const label = weekLabel(pointDate, lang)
    const isFuture = pointDate > todayDate
    const isToday = pointISO === todayISO

    const plannedCumulative = calcPlanned(leaves, totalW, pointDate, pointISO)
    const executedCumulative = !isFuture ? calcExecuted(leaves, totalW, pointISO) : null

    rows.push({ period: label, date: pointISO, plannedCumulative, executedCumulative, isToday, isFuture })
    cur.setDate(cur.getDate() + 7)
  }

  // Garante ponto exato de hoje se não caiu numa semana
  if (!rows.some(r => r.isToday)) {
    const todayPoint = {
      period: todayLabel,
      date: todayISO,
      plannedCumulative: calcPlanned(leaves, totalW, todayDate, todayISO),
      executedCumulative: calcExecuted(leaves, totalW, todayISO),
      isToday: true,
      isFuture: false,
    }
    const insertIdx = rows.findIndex(r => r.date > todayISO)
    if (insertIdx >= 0) rows.splice(insertIdx, 0, todayPoint)
    else rows.push(todayPoint)
  }

  // Garante monotonicidade: planejado nunca decresce entre pontos consecutivos
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].plannedCumulative < rows[i - 1].plannedCumulative) {
      rows[i].plannedCumulative = rows[i - 1].plannedCumulative
    }
  }

  return { rows, todayLabel }
}

// ── Tabela e barras: granularidade MENSAL ────────────────────────────────────
function buildMonthlyData(tasks: Task[], lang: string) {
  const leaves = tasks.filter(t => !t.isGroup)
  if (!leaves.length) return []

  const dates = leaves.flatMap(t => [t.plannedStart, t.plannedEnd].filter(Boolean) as string[])
  if (!dates.length) return []

  const minD = dates.reduce((a, b) => a < b ? a : b)
  const maxD = dates.reduce((a, b) => a > b ? a : b)
  const start = new Date(minD.slice(0, 7) + '-01')
  const end = new Date(maxD.slice(0, 7) + '-01')
  end.setMonth(end.getMonth() + 1)

  const totalW = leaves.reduce((s, t) => s + (t.weight || 1), 0)
  const rows: any[] = []
  const cur = new Date(start)

  while (cur <= end) {
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    const startOfMonth = new Date(cur.getFullYear(), cur.getMonth(), 1)
    const label = monthLabel(new Date(cur), lang)
    const isFuture = startOfMonth > todayDate
    const isCurrent = !isFuture && endOfMonth >= todayDate

    // Para a tabela, o "ponto de referência" do mês corrente é hoje; passado = fim do mês
    const refDate = isCurrent ? todayDate : endOfMonth
    const refISO = refDate.toISOString().slice(0, 10)

    const plannedCumulative = calcPlanned(leaves, totalW, refDate, refISO)
    const executedCumulative = !isFuture ? calcExecuted(leaves, totalW, refISO) : null

    // Avanço do período (mensal) para o gráfico de barras
    const prevEnd = new Date(cur); prevEnd.setDate(0)
    const prevISO = prevEnd.toISOString().slice(0, 10)
    const plannedPrev = calcPlanned(leaves, totalW, prevEnd, prevISO)
    const plannedPeriod = Math.max(0, plannedCumulative - plannedPrev)

    let execPrev = 0
    if (!isFuture) {
      leaves.forEach(t => {
        const endRef = t.actualEnd || (t.status === 'COMPLETED' ? t.plannedEnd : null)
        if (endRef && endRef <= prevISO) execPrev += (t.weight || 1)
      })
    }
    const executedPeriod = !isFuture && executedCumulative !== null
      ? Math.max(0, Math.round((calcExecuted(leaves, totalW, refISO) - execPrev / totalW * 100)))
      : null

    const deviation = !isFuture && executedCumulative !== null ? executedCumulative - plannedCumulative : null

    rows.push({ period: label, plannedCumulative, executedCumulative, plannedPeriod, executedPeriod, deviation, isCurrent, isFuture })
    cur.setMonth(cur.getMonth() + 1)
  }
  return rows
}

const CustomTooltip = ({ active, payload, label, lang }: any) => {
  if (!active || !payload?.length) return null
  const planned = payload.find((p: any) => p.dataKey === 'plannedCumulative')
  const executed = payload.find((p: any) => p.dataKey === 'executedCumulative')
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{label}</p>
      {planned && <p style={{ color: '#60a5fa', margin: '2px 0' }}>{lang === 'pt' ? 'Planejado' : 'Planned'}: <strong>{planned.value}%</strong></p>}
      {executed && executed.value != null && <p style={{ color: '#4ade80', margin: '2px 0' }}>{lang === 'pt' ? 'Executado' : 'Executed'}: <strong>{executed.value}%</strong></p>}
    </div>
  )
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

  const { rows: weeklyData, todayLabel } = buildWeeklyData(tasks, lang)
  const monthlyData = buildMonthlyData(tasks, lang)

  // KPIs: ponto exato de hoje
  const todayPoint = weeklyData.find(r => r.isToday)
  const execVal = todayPoint?.executedCumulative ?? 0
  const planVal = todayPoint?.plannedCumulative ?? 0
  const deviation = execVal - planVal

  const trend = calcTrend(tasks, lang)

  const getStatus = (d: any) => {
    if (d.isFuture) return c.statusFuturo
    if (d.isCurrent) return lang === 'pt' ? 'Atual' : 'Current'
    if (d.deviation !== null && d.deviation <= -2) return c.statusAtrasado
    if (d.deviation !== null && d.deviation >= 2) return c.statusAdiantado
    return c.statusNoPrazo
  }
  const getStatusColor = (d: any) => {
    if (d.isFuture) return 'badge-gray'
    if (d.isCurrent) return 'badge-blue'
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
          ⚠ {lang === 'pt' ? `Projeto com tendência de atraso — ${trend.detail}.` : `Project at risk of delay — ${trend.detail}.`}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>{lang === 'pt' ? 'Carregando…' : 'Loading…'}</div>
      ) : tasks.filter(t => !t.isGroup).length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>{lang === 'pt' ? 'Nenhuma tarefa cadastrada' : 'No tasks yet'}</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[
              { label: c.kpi1, value: planVal + '%', color: '#60a5fa' },
              { label: c.kpi2, value: execVal + '%', color: deviation < 0 ? '#f87171' : '#4ade80' },
              { label: c.kpi3, value: (deviation >= 0 ? '+' : '') + deviation + '%', color: deviation < 0 ? '#f87171' : deviation > 0 ? '#4ade80' : 'var(--text2)' },
              { label: c.kpi4, value: trend.label, color: trend.color },
            ].map(k => (
              <div key={k.label} className="card" style={{ padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{k.label}</p>
                <p style={{ fontFamily: 'Syne,sans-serif', fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</p>
                {k.label === c.kpi4 && trend.detail
                  ? <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{trend.detail}</p>
                  : null}
              </div>
            ))}
          </div>

          {/* Gráfico semanal */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">{c.chartTitle}</h2>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
                {lang === 'pt' ? '(granularidade semanal)' : '(weekly granularity)'}
              </span>
            </div>
            <div style={{ padding: '16px 16px 16px 0', height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
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
                  <XAxis
                    dataKey="period"
                    tick={{ fill: 'var(--text3)', fontSize: 10 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} domain={[0, 100]} tickFormatter={v => v + '%'} />
                  <Tooltip content={<CustomTooltip lang={lang} />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} formatter={(v: string) => <span style={{ color: 'var(--text2)' }}>{v}</span>} />
                  <ReferenceLine
                    x={todayLabel}
                    stroke="var(--red)"
                    strokeWidth={2}
                    strokeDasharray="5,4"
                    label={{ value: lang === 'pt' ? `Hoje ${todayISO.slice(8, 10)}/${todayISO.slice(5, 7)}` : `Today ${todayISO.slice(5, 7)}/${todayISO.slice(8, 10)}`, fill: 'var(--red)', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <Area type="monotone" dataKey="plannedCumulative" name={lang === 'pt' ? 'Planejado' : 'Planned'} stroke="#3b82f6" strokeWidth={2.5} fill="url(#gP)" dot={false} connectNulls />
                  <Area type="monotone" dataKey="executedCumulative" name={lang === 'pt' ? 'Executado' : 'Executed'} stroke="#22c55e" strokeWidth={2.5} fill="url(#gE)" dot={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Barras mensais + Tabela mensal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <div className="card-header"><h2 className="card-title">{c.barTitle}</h2></div>
              <div style={{ padding: '12px 12px 12px 0', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barGap={4} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="period" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
                    <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(v: any, n: string) => [v != null ? v + '%' : '—', n]} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v: string) => <span style={{ color: 'var(--text2)' }}>{v}</span>} />
                    <Bar dataKey="plannedPeriod" name={lang === 'pt' ? 'Planejado' : 'Planned'} fill="#3b82f6" fillOpacity={.7} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="executedPeriod" name={lang === 'pt' ? 'Executado' : 'Executed'} fill="#22c55e" fillOpacity={.8} radius={[2, 2, 0, 0]} />
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
                  <tbody>{monthlyData.map((d: any) => (
                    <tr key={d.period} style={d.isCurrent ? { background: 'rgba(59,130,246,0.07)', fontWeight: 600 } : {}}>
                      <td style={{ fontWeight: 600 }}>
                        {d.period}
                        {d.isCurrent && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--red)', fontWeight: 700 }}>● {lang === 'pt' ? 'Hoje' : 'Today'}</span>}
                      </td>
                      <td style={{ color: '#60a5fa' }}>{d.plannedCumulative}%</td>
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
