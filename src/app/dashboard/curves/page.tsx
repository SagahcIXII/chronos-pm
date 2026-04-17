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

// Data local correta — evita problema de UTC vs fuso horário
function getLocalDateISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const todayISO = getLocalDateISO()
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

// ── Planejado: linha reta proporcional ao prazo total do projeto ─────────────
// Metodologia: planejado = (diasDecorridos / diasTotais) × 100
// Isso representa o avanço esperado se o projeto seguir ritmo constante.
// Simples, honesto e amplamente usado em gestão de obras.
// Para pontos futuros: extrapolação linear até 100%.
function calcPlanned(leaves: Task[], _totalW: number, pointDate: Date, projectStart: string, projectEnd: string): number {
  const start = new Date(projectStart)
  const end = new Date(projectEnd)
  const totalDays = (end.getTime() - start.getTime()) / 86400000
  if (totalDays <= 0) return 0
  const elapsed = (pointDate.getTime() - start.getTime()) / 86400000
  return Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)))
}
// ── Executado: média simples igual ao banco (Σ progress / n tarefas ativas) ──
// Mesma fórmula da API: allTasks.reduce((sum, t) => sum + t.progress, 0) / allTasks.length
function calcExecuted(leaves: Task[], _totalW: number, pointISO: string): number {
  // Considera apenas tarefas que já iniciaram neste ponto
  const active = leaves.filter(t => t.plannedStart && t.plannedStart <= pointISO)
  if (!active.length) return 0
  const sum = active.reduce((s, t) => {
    const endRef = t.actualEnd || (t.status === 'COMPLETED' ? t.plannedEnd : null)
    if (endRef && endRef <= pointISO) return s + 100  // concluída = 100%
    return s + t.progress
  }, 0)
  return Math.round(sum / active.length)
}
// ── Gráfico principal: granularidade SEMANAL ─────────────────────────────────
function buildWeeklyData(tasks: Task[], lang: string, projectStart: string, projectEnd: string, refISO: string = todayISO) {
  const leaves = tasks.filter(t => !t.isGroup)
  if (!leaves.length) return { rows: [], todayLabel: '' }

  const dates = leaves.flatMap(t => [t.plannedStart, t.plannedEnd].filter(Boolean) as string[])
  if (!dates.length) return { rows: [], todayLabel: '' }

  const minD = dates.reduce((a, b) => a < b ? a : b)
  const maxD = dates.reduce((a, b) => a > b ? a : b)

  const start = new Date(minD)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(maxD)
  end.setDate(end.getDate() + 7)

  const totalW = leaves.reduce((s, t) => s + (t.weight || 1), 0)
  const rows: any[] = []
  const cur = new Date(start)

  // Label do ponto de hoje — usado no array e na ReferenceLine
  const refDate = new Date(refISO)
  const todayLabel = weekLabel(refDate, lang)
  let todayInserted = false

  while (cur <= end) {
    const pointDate = new Date(cur)
    const pointISO = pointDate.toISOString().slice(0, 10)

    // Insere o ponto de referência antes do primeiro ponto futuro
    if (!todayInserted && pointISO > refISO) {
      rows.push({
        period: todayLabel,
        date: refISO,
        plannedCumulative: calcPlanned(leaves, totalW, refDate, projectStart, projectEnd),
        executedCumulative: calcExecuted(leaves, totalW, refISO),
        isToday: true,
        isFuture: false,
      })
      todayInserted = true
    }

    const isFuture = pointDate > refDate
    const isToday = pointISO === refISO
    if (isToday) todayInserted = true

    rows.push({
      period: isToday ? todayLabel : weekLabel(pointDate, lang),
      date: pointISO,
      plannedCumulative: calcPlanned(leaves, totalW, pointDate, projectStart, projectEnd),
      executedCumulative: !isFuture ? calcExecuted(leaves, totalW, pointISO) : null,
      isToday,
      isFuture,
    })
    cur.setDate(cur.getDate() + 7)
  }

  // Garante ponto de hoje se ainda não inserido
  if (!todayInserted) {
    rows.push({
      period: todayLabel,
      date: refISO,
      plannedCumulative: calcPlanned(leaves, totalW, refDate, projectStart, projectEnd),
      executedCumulative: calcExecuted(leaves, totalW, refISO),
      isToday: true,
      isFuture: false,
    })
  }

  // Ordena por data
  rows.sort((a, b) => a.date.localeCompare(b.date))

  // Monotonicidade
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].plannedCumulative < rows[i - 1].plannedCumulative) {
      rows[i].plannedCumulative = rows[i - 1].plannedCumulative
    }
  }

  return { rows, todayLabel }
}
// ── Tabela e barras: granularidade MENSAL ────────────────────────────────────
function buildMonthlyData(tasks: Task[], lang: string, projectStart: string, projectEnd: string, refISO: string = todayISO) {
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
    const refDateObj = new Date(refISO)
    const isFuture = startOfMonth > refDateObj
    const isCurrent = !isFuture && endOfMonth >= refDateObj
    const refDate = isCurrent ? refDateObj : endOfMonth
    const refDateStr = refDate.toISOString().slice(0, 10)

    const plannedCumulative = calcPlanned(leaves, totalW, refDate, projectStart, projectEnd)
    const executedCumulative = !isFuture ? calcExecuted(leaves, totalW, refDateStr) : null

    const prevEnd = new Date(cur); prevEnd.setDate(0)
    const prevISO = prevEnd.toISOString().slice(0, 10)
    const plannedPrev = calcPlanned(leaves, totalW, prevEnd, projectStart, projectEnd)
    const plannedPeriod = Math.max(0, plannedCumulative - plannedPrev)

    let execPrev = 0
    if (!isFuture) {
      leaves.forEach(t => {
        const endRef = t.actualEnd || (t.status === 'COMPLETED' ? t.plannedEnd : null)
        if (endRef && endRef <= prevISO) execPrev += (t.weight || 1)
      })
    }
    const executedPeriod = !isFuture && executedCumulative !== null
      ? Math.max(0, executedCumulative - Math.round(execPrev / totalW * 100))
      : null
    const deviation = !isFuture && executedCumulative !== null ? executedCumulative - plannedCumulative : null

    rows.push({ period: label, plannedCumulative, executedCumulative, plannedPeriod, executedPeriod, deviation, isCurrent, isFuture })
    cur.setMonth(cur.getMonth() + 1)
  }

  // Monotonicidade na tabela também
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].plannedCumulative < rows[i - 1].plannedCumulative) {
      rows[i].plannedCumulative = rows[i - 1].plannedCumulative
    }
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
  // Data de referência configurável — padrão = data local de hoje
  const [refDateISO, setRefDateISO] = useState<string>(todayISO)

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

  const pStart = (activeProject as any).startDate?.slice(0,10) ?? ''
  const pEnd = (activeProject as any).endDate?.slice(0,10) ?? ''
  const { rows: weeklyData, todayLabel } = buildWeeklyData(tasks, lang, pStart, pEnd, refDateISO)
  const monthlyData = buildMonthlyData(tasks, lang, pStart, pEnd, refDateISO)

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{c.title}</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{c.subtitle}</p>
          </div>
          {/* Seletor de data de referência */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
              📅 {lang === 'pt' ? 'Data de referência' : 'Reference date'}
            </span>
            <input
              type="date"
              value={refDateISO}
              max={todayISO}
              onChange={e => setRefDateISO(e.target.value || todayISO)}
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}
            />
            {refDateISO !== todayISO && (
              <button
                onClick={() => setRefDateISO(todayISO)}
                style={{ fontSize: 11, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, whiteSpace: 'nowrap' }}
              >
                {lang === 'pt' ? 'Hoje' : 'Today'}
              </button>
            )}
          </div>
        </div>
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

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">{c.chartTitle}</h2>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
                {lang === 'pt' ? '(granularidade semanal · planejado proporcional ao tempo)' : '(weekly · time-proportional planned)'}
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
                  <XAxis dataKey="period" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={1} />
                  <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} domain={[0, 100]} tickFormatter={v => v + '%'} />
                  <Tooltip content={<CustomTooltip lang={lang} />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} formatter={(v: string) => <span style={{ color: 'var(--text2)' }}>{v}</span>} />
                  <ReferenceLine
                    x={todayLabel}
                    stroke="var(--red)"
                    strokeWidth={2}
                    strokeDasharray="5,4"
                    label={{ value: lang === 'pt' ? `${refDateISO === todayISO ? 'Hoje' : 'Ref.'} ${refDateISO.slice(8,10)}/${refDateISO.slice(5,7)}` : `${refDateISO === todayISO ? 'Today' : 'Ref.'} ${refDateISO.slice(5,7)}/${refDateISO.slice(8,10)}`, fill: 'var(--red)', fontSize: 10, position: 'insideTopRight' }}
                  />
                  <Area type="monotone" dataKey="plannedCumulative" name={lang === 'pt' ? 'Planejado' : 'Planned'} stroke="#3b82f6" strokeWidth={2.5} fill="url(#gP)" dot={false} connectNulls />
                  <Area type="monotone" dataKey="executedCumulative" name={lang === 'pt' ? 'Executado' : 'Executed'} stroke="#22c55e" strokeWidth={2.5} fill="url(#gE)" dot={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

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
