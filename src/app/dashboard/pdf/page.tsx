'use client'
import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/lib/i18n'
import { useProject } from '@/lib/projectContext'

interface Task {
  id: string; parentId: string | null; isGroup: boolean; isCritical: boolean; isMilestone: boolean
  name: string; responsible?: string; weight: number
  plannedStart?: string | null; plannedEnd?: string | null
  actualStart?: string | null; actualEnd?: string | null
  progress: number; status: string; priority: string
}

// Data local correta — evita problema UTC vs fuso horário
function getLocalDateISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const todayISO = getLocalDateISO()
const todayDate = new Date(todayISO)

const fmtDate = (s?: string | null, lang = 'pt') => {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T12:00:00')
  return d.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const fmtShort = (s?: string | null) => {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T12:00:00')
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}

// ── Metodologia linear: planejado = diasDecorridos/diasTotais ─────────────────
function calcPlannedLinear(pointDate: Date, projectStart: string, projectEnd: string): number {
  const start = new Date(projectStart)
  const end = new Date(projectEnd)
  const totalDays = (end.getTime() - start.getTime()) / 86400000
  if (totalDays <= 0) return 0
  const elapsed = (pointDate.getTime() - start.getTime()) / 86400000
  return Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)))
}

// ── Executado: média simples igual ao banco ───────────────────────────────────
function calcExecutedSimple(leaves: Task[], pointISO: string): number {
  const active = leaves.filter(t => t.plannedStart && t.plannedStart <= pointISO)
  if (!active.length) return 0
  const sum = active.reduce((s, t) => {
    const endRef = t.actualEnd || (t.status === 'COMPLETED' ? t.plannedEnd : null)
    if (endRef && endRef <= pointISO) return s + 100
    return s + t.progress
  }, 0)
  return Math.round(sum / active.length)
}

// ── Curva S mensal para o PDF ─────────────────────────────────────────────────
function buildCurve(tasks: Task[], projectStart: string, projectEnd: string, lang: string, refISO: string = todayISO) {
  const leaves = tasks.filter(t => !t.isGroup)
  if (!leaves.length || !projectStart || !projectEnd) return []

  const start = new Date(projectStart.slice(0,7) + '-01')
  const end = new Date(projectEnd.slice(0,7) + '-01')
  end.setMonth(end.getMonth() + 1)

  const rows: any[] = []
  const cur = new Date(start)

  while (cur <= end) {
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    const endStr = endOfMonth.toISOString().slice(0, 10)
    const label = cur.toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: '2-digit' })

    const refDateObj = new Date(refISO)
    const isFuture = new Date(cur.getFullYear(), cur.getMonth(), 1) > refDateObj
    const isCurrent = !isFuture && endOfMonth >= refDateObj
    const refDate = isCurrent ? refDateObj : endOfMonth
    const refDateStr = refDate.toISOString().slice(0, 10)

    const plannedCumulative = calcPlannedLinear(refDate, projectStart, projectEnd)
    const executedCumulative = !isFuture ? calcExecutedSimple(leaves, refDateStr) : null
    const deviation = !isFuture && executedCumulative !== null ? executedCumulative - plannedCumulative : null

    rows.push({ period: label, plannedCumulative, executedCumulative, deviation, isCurrent, isFuture })
    cur.setMonth(cur.getMonth() + 1)
  }

  // Monotonicidade
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].plannedCumulative < rows[i-1].plannedCumulative) {
      rows[i].plannedCumulative = rows[i-1].plannedCumulative
    }
  }

  return rows
}

export default function PDFPage() {
  const { lang } = useLang()
  const { activeProject } = useProject()
  const pt = lang === 'pt'

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  // Data de referência configurável — padrão = data local de hoje
  const [refDateISO, setRefDateISO] = useState<string>(todayISO)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [senderName, setSenderName] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle'|'sending'|'success'|'error'>('idle')
  const [emailMsg, setEmailMsg] = useState('')
  // Seleção e planos de recuperação para o relatório executivo
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [itemContext, setItemContext] = useState<Record<string, string>>({})
  const [itemAction, setItemAction] = useState<Record<string, string>>({})

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

  if (!activeProject) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',color:'var(--text3)'}}>
      {pt ? 'Selecione um projeto.' : 'Select a project.'}
    </div>
  )

  const ap = activeProject as any
  const pStart = ap.startDate?.slice(0,10) ?? ''
  const pEnd = ap.endDate?.slice(0,10) ?? ''

  const leaves = tasks.filter(t => !t.isGroup)
  const groups = tasks.filter(t => t.isGroup)

  // KPIs de tarefas
  const completed = leaves.filter(t => t.status==='COMPLETED').length
  const inProgress = leaves.filter(t => t.status==='IN_PROGRESS').length
  const notStarted = leaves.filter(t => t.status==='NOT_STARTED').length
  const critical = leaves.filter(t => t.isCritical).length
  const milestones = leaves.filter(t => t.isMilestone).length

  // Avanço: média simples igual ao banco
  const totalProgress = leaves.length
    ? Math.round(leaves.reduce((s,t) => s + t.progress, 0) / leaves.length)
    : ap.progress ?? 0

  // Curva S com metodologia linear
  const curveData = buildCurve(tasks, pStart, pEnd, lang, refDateISO)
  const currentRow = curveData.find(d => d.isCurrent)
  const lastExecRow = currentRow ?? [...curveData].reverse().find((d:any) => d.executedCumulative !== null)
  const execVal = lastExecRow?.executedCumulative ?? 0
  const planVal = lastExecRow?.plannedCumulative ?? 0
  const deviation = execVal - planVal

  // Todas as tarefas com desvio, ordenadas do maior para o menor
  const tasksWithGap = [...leaves]
    .filter(t => t.status !== 'COMPLETED' && t.plannedStart && t.plannedEnd)
    .map(t => {
      const totalDays = (new Date(t.plannedEnd!).getTime() - new Date(t.plannedStart!).getTime()) / 86400000
      const elapsed = Math.max(0, (todayDate.getTime() - new Date(t.plannedStart!).getTime()) / 86400000)
      const timePct = totalDays > 0 ? Math.min(100, Math.round((elapsed / totalDays) * 100)) : 0
      const gap = timePct - t.progress
      return { ...t, timePct, gap }
    })
    .filter(t => t.gap > 0)
    .sort((a, b) => b.gap - a.gap)

  // Itens selecionados para o relatório (na ordem de seleção)
  const reportItems = tasksWithGap.filter(t => selectedItems[t.id])

  const fields = [
    [pt?'Projeto':'Project', activeProject.name],
    ['Código/Code', activeProject.code],
    [pt?'Responsável':'Manager', ap.responsible ?? '—'],
    [pt?'Início':'Start', fmtDate(pStart, lang)],
    [pt?'Término':'End', fmtDate(pEnd, lang)],
    [pt?'Avanço':'Progress', `${totalProgress}%`],
    ['Status', pt?'Em Andamento':'In Progress'],
  ]

  const sendEmail = async () => {
    if (!emailTo.trim()) { setEmailMsg(pt?'Informe pelo menos um destinatário.':'Enter at least one recipient.'); setEmailStatus('error'); return }
    setEmailStatus('sending')
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          to: emailTo.split(',').map((e:string)=>e.trim()).filter(Boolean),
          subject: emailSubject || `${pt?'Relatório de Cronograma':'Schedule Report'} — ${activeProject.code}`,
          projectCode: activeProject.code,
          projectName: activeProject.name,
          senderName: senderName || ap.responsible || 'Chronos PM',
          lang,
        }),
      })
      const data = await res.json()
      if (res.ok) { setEmailStatus('success'); setEmailMsg(pt?'✅ Email enviado com sucesso!':'✅ Email sent successfully!') }
      else { setEmailStatus('error'); setEmailMsg(`❌ ${data.error ?? 'Erro ao enviar'}`) }
    } catch(e:any) { setEmailStatus('error'); setEmailMsg(`❌ ${e.message}`) }
  }

  const openReport = async () => {
    setGenerating(true)

    const date = new Date().toLocaleDateString(pt?'pt-BR':'en-US')
    const statusLabel = (s:string) => pt
      ? ({COMPLETED:'Concluída',IN_PROGRESS:'Em Andamento',NOT_STARTED:'Não Iniciada',ON_HOLD:'Em Espera',DELAYED:'Atrasado'}[s]??s)
      : ({COMPLETED:'Completed',IN_PROGRESS:'In Progress',NOT_STARTED:'Not Started',ON_HOLD:'On Hold',DELAYED:'Delayed'}[s]??s)
    const statusColor = (s:string) => ({COMPLETED:'#22c55e',IN_PROGRESS:'#60a5fa',NOT_STARTED:'#5a6a84',ON_HOLD:'#f59e0b',DELAYED:'#f87171'}[s]??'#5a6a84')

    // ── SVG Curva S — linha reta planejada ────────────────────────────────────
    const W=700, H=210, padL=40, padR=18, padT=16, padB=34
    const cW=W-padL-padR, cH=H-padT-padB
    const xStep = curveData.length>1 ? cW/(curveData.length-1) : cW
    const px = (i:number) => padL+i*xStep
    const py = (v:number) => padT+cH-(v/100)*cH

    const gridLines = [0,25,50,75,100].map(v=>{
      const y=py(v)
      return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#2a3650" stroke-width="0.5" stroke-dasharray="3,3"/><text x="${padL-5}" y="${y+3.5}" text-anchor="end" fill="#5a6a84" font-size="9" font-family="Arial">${v}%</text>`
    }).join('')

    const xLabels = curveData.map((d:any,i:number)=>
      `<text x="${px(i)}" y="${H-5}" text-anchor="middle" fill="#5a6a84" font-size="8" font-family="Arial">${d.period}</text>`
    ).join('')

    // Linha reta planejada: de (0,0) a (end, 100)
    const planPts = curveData.map((d:any,i:number)=>`${px(i)},${py(d.plannedCumulative)}`).join(' ')
    const execDataPts = curveData.filter((d:any)=>d.executedCumulative!==null)
    const execPts = execDataPts.map((d:any)=>`${px(curveData.indexOf(d))},${py(d.executedCumulative)}`).join(' ')

    // Linha "Hoje": último ponto com executado
    const todayI = curveData.findIndex((d:any)=>d.isCurrent)  // mês atual conforme refDateISO
    const todayX = todayI>=0 ? px(todayI) : px(Math.floor(curveData.length/2))

    const planArea = `${padL},${py(0)} ${planPts} ${px(curveData.length-1)},${py(0)}`
    const execArea = execDataPts.length>0 ? `${padL},${py(0)} ${execPts} ${px(curveData.indexOf(execDataPts[execDataPts.length-1]))},${py(0)}` : ''

    const svgCurve = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%">
      <defs>
        <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/></linearGradient>
        <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.3"/><stop offset="100%" stop-color="#22c55e" stop-opacity="0.02"/></linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="#0d1829" rx="3"/>
      ${gridLines}${xLabels}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#2a3650" stroke-width="0.5"/>
      <polygon points="${planArea}" fill="url(#gP)"/>
      <polyline points="${planPts}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/>
      ${execArea?`<polygon points="${execArea}" fill="url(#gE)"/><polyline points="${execPts}" fill="none" stroke="#22c55e" stroke-width="3" stroke-linejoin="round"/>`:''}
      <line x1="${todayX}" y1="${padT}" x2="${todayX}" y2="${padT+cH}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,3"/>
      <rect x="${todayX-16}" y="${padT-1}" width="32" height="13" rx="2" fill="#ef4444"/>
      <text x="${todayX}" y="${padT+9}" text-anchor="middle" fill="white" font-size="8" font-family="Arial" font-weight="700">${pt?'Hoje':'Today'}</text>
      <circle cx="${W-120}" cy="${H-18}" r="4" fill="#3b82f6"/>
      <text x="${W-113}" y="${H-14}" fill="#9aabc4" font-size="9" font-family="Arial">${pt?'Planejado (linear)':'Planned (linear)'}</text>
      <circle cx="${W-55}" cy="${H-18}" r="4" fill="#22c55e"/>
      <text x="${W-48}" y="${H-14}" fill="#9aabc4" font-size="9" font-family="Arial">${pt?'Executado':'Executed'}</text>
    </svg>`

    // ── KPIs de tarefas ───────────────────────────────────────────────────────
    const kpisHTML = [
      [pt?'Total de Tarefas':'Total Tasks', String(leaves.length)],
      [pt?'Concluídas':'Completed', String(completed)],
      [pt?'Em Andamento':'In Progress', String(inProgress)],
      [pt?'Não Iniciadas':'Not Started', String(notStarted)],
      [pt?'Tarefas Críticas':'Critical Tasks', String(critical)],
      ['Marcos/Milestones', String(milestones)],
    ].map(([l,v]) => `
      <div style="background:#1a2235;padding:4mm 5mm;border-radius:2mm">
        <div style="color:#5a6a84;font-size:7pt;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1.5mm">${l}</div>
        <div style="color:#e8edf5;font-size:22pt;font-weight:800;line-height:1">${v}</div>
      </div>`).join('')

    // ── Itens selecionados com contexto e contramedida ───────────────────────────
    const reportItemsHTML = reportItems.length > 0 ? `
      <div style="margin-top:5mm">
        <h2 style="color:#ef4444;border-bottom-color:#ef4444;font-size:11pt;font-weight:800;padding-bottom:2mm;margin-bottom:3mm;border-bottom:1px solid #ef4444">
          ⚠ ${pt?'Desvios Críticos — Análise e Contramedidas':'Critical Deviations — Analysis & Countermeasures'}
        </h2>
        ${reportItems.map((t, i) => {
          const ctx = itemContext[t.id] || ''
          const act = itemAction[t.id] || ''
          const gapColor = t.gap > 50 ? '#ef4444' : t.gap > 25 ? '#f59e0b' : '#fbbf24'
          const barPct = t.timePct > 0 ? Math.round((t.progress / t.timePct) * 100) : 0
          return `<div style="margin-bottom:4mm;background:#1a2235;border-radius:2mm;padding:4mm 5mm;border-left:3px solid ${gapColor}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2.5mm">
              <div style="font-size:9.5pt;font-weight:700;color:#e8edf5;max-width:60%">${i+1}. ${t.name}${t.responsible?`<span style="font-size:7.5pt;color:#9aabc4;font-weight:400;margin-left:3mm">${t.responsible}</span>`:''}</div>
              <div style="display:flex;gap:2.5mm;flex-wrap:wrap;justify-content:flex-end">
                <span style="font-size:7.5pt;background:#1e3a5f;color:#60a5fa;padding:1mm 2.5mm;border-radius:1mm">${pt?'Prazo':'Time'}: ${t.timePct}%</span>
                <span style="font-size:7.5pt;background:#1a3a2a;color:#4ade80;padding:1mm 2.5mm;border-radius:1mm">${pt?'Progresso':'Progress'}: ${t.progress}%</span>
                <span style="font-size:8pt;font-weight:700;background:${gapColor}22;color:${gapColor};padding:1mm 3mm;border-radius:1mm">Δ -${t.gap}pp</span>
              </div>
            </div>
            <div style="margin-bottom:3mm">
              <div style="display:flex;justify-content:space-between;font-size:7pt;color:#5a6a84;margin-bottom:1mm">
                <span>${pt?'Prazo decorrido':'Elapsed'}</span><span>${pt?'Progresso real':'Actual progress'}</span>
              </div>
              <div style="background:#222d42;border-radius:1mm;height:4mm;margin-bottom:1.5mm">
                <div style="background:#3b82f6;width:${t.timePct}%;height:4mm;border-radius:1mm"></div>
              </div>
              <div style="background:#222d42;border-radius:1mm;height:4mm">
                <div style="background:${gapColor};width:${t.progress}%;height:4mm;border-radius:1mm"></div>
              </div>
            </div>
            ${ctx ? `<div style="margin-bottom:2.5mm">
              <div style="font-size:7.5pt;color:#9aabc4;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1mm;font-weight:600">📋 ${pt?'Contexto / Causa':'Context / Cause'}</div>
              <div style="font-size:8.5pt;color:#e8edf5;line-height:1.6;background:#111827;padding:2.5mm 3mm;border-radius:1mm;border-left:2px solid #3b82f6">${ctx}</div>
            </div>` : ''}
            ${act ? `<div>
              <div style="font-size:7.5pt;color:#9aabc4;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1mm;font-weight:600">⚡ ${pt?'Contramedida':'Countermeasure'}</div>
              <div style="font-size:8.5pt;color:#e8edf5;line-height:1.6;background:#111827;padding:2.5mm 3mm;border-radius:1mm;border-left:2px solid #22c55e">${act}</div>
            </div>` : ''}
          </div>`
        }).join('')}
      </div>` : ''

    // ── Fases: usa grupos se existirem, senão usa tarefas ─────────────────────
    const phaseItems = groups.length > 0 ? groups : leaves.slice(0, 8)
    const fasesHTML = phaseItems.map(g => {
      const c = g.status==='COMPLETED'?'#22c55e':g.status==='IN_PROGRESS'?'#3b82f6':'#2a3650'
      const tc = g.status==='COMPLETED'?'#22c55e':g.status==='IN_PROGRESS'?'#60a5fa':'#5a6a84'
      return `<div style="margin-bottom:3.5mm">
        <div style="display:flex;justify-content:space-between;font-size:9pt;margin-bottom:2mm">
          <span style="color:#e8edf5;overflow:hidden;white-space:nowrap;max-width:65%">${g.name}</span>
          <span style="color:${tc};font-weight:700;white-space:nowrap">${g.progress}% — ${statusLabel(g.status)}</span>
        </div>
        <div style="background:#222d42;border-radius:1mm;height:4mm">
          <div style="background:${c};width:${g.progress}%;height:4mm;border-radius:1mm"></div>
        </div>
      </div>`
    }).join('')

    // ── KPIs Curva S ──────────────────────────────────────────────────────────
    const trendLabel = deviation<-2?(pt?'Atrasado':'Delayed'):deviation>2?(pt?'Adiantado':'Ahead'):(pt?'No Prazo':'On Track')
    const curveKpisHTML = [
      [pt?'Planejado Acum.':'Planned Cum.', `${planVal}%`, '#60a5fa'],
      [pt?'Executado Acum.':'Executed Cum.', `${execVal}%`, deviation<0?'#f87171':'#4ade80'],
      [pt?'Desvio':'Deviation', `${deviation>=0?'+':''}${deviation}%`, deviation<0?'#f87171':'#4ade80'],
      [pt?'Tendência':'Trend', trendLabel, deviation<-2?'#f87171':deviation>2?'#4ade80':'#60a5fa'],
    ].map(([l,v,c]) => `
      <div style="background:#1a2235;padding:3mm 4mm;border-radius:2mm">
        <div style="color:#5a6a84;font-size:6.5pt;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1.5mm">${l}</div>
        <div style="color:${c};font-size:14pt;font-weight:800;line-height:1">${v}</div>
      </div>`).join('')

    // ── Tabela Curva S ────────────────────────────────────────────────────────
    const tblCols = pt?['Período','Plan. Acum.','Exec. Acum.','Desvio','Status']:['Period','Plan. Cum.','Exec. Cum.','Deviation','Status']
    const curveTableRows = curveData.map((d:any,i:number)=>{
      const dev=d.deviation
      const devColor=dev===null?'#5a6a84':dev<0?'#f87171':dev>0?'#22c55e':'#9aabc4'
      const sColor=d.isFuture?'#5a6a84':dev!==null&&dev<=-2?'#f87171':dev!==null&&dev>=2?'#22c55e':'#60a5fa'
      const sText=d.isFuture?(pt?'Futuro':'Future'):d.isCurrent?(pt?'Atual ●':'Current ●'):dev!==null&&dev<=-2?(pt?'Atrasado':'Delayed'):dev!==null&&dev>=2?(pt?'Adiantado':'Ahead'):(pt?'No Prazo':'On Track')
      return `<tr style="background:${d.isCurrent?'rgba(59,130,246,0.1)':i%2===0?'#111827':'transparent'}">
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${d.isCurrent?'#93c5fd':'#e8edf5'};font-size:8pt;font-weight:${d.isCurrent?700:600}">${d.period}</td>
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#60a5fa;font-size:8pt">${d.plannedCumulative}%</td>
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${d.executedCumulative!==null?'#22c55e':'#5a6a84'};font-size:8pt">${d.executedCumulative!==null?d.executedCumulative+'%':'—'}</td>
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${devColor};font-size:8pt;font-weight:600">${dev!==null?(dev>=0?'+':'')+dev+'%':'—'}</td>
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${sColor};font-size:8pt">${sText}</td>
      </tr>`
    }).join('')

    // ── Tabela de tarefas ─────────────────────────────────────────────────────
    const tblTask = pt?['Tarefa','Responsável','Início','Término','%','Status']:['Task','Responsible','Start','End','%','Status']
    const tasksHTML = tasks.map(task => {
      const color = statusColor(task.status)
      return `<tr style="background:${task.isGroup?'#1a2235':'transparent'}">
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${task.isGroup?'#e8edf5':'#c8d5e8'};font-weight:${task.isGroup?700:400};font-size:8pt">${task.name}</td>
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#9aabc4;font-size:7.5pt">${task.responsible||'—'}</td>
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#9aabc4;font-size:7.5pt">${fmtShort(task.plannedStart)}</td>
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#9aabc4;font-size:7.5pt">${fmtShort(task.plannedEnd)}</td>
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${color};font-weight:600;font-size:7.5pt">${task.progress}%</td>
        <td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${color};font-size:7.5pt">${statusLabel(task.status)}</td>
      </tr>`
    }).join('')

    // ── Resumo executivo ──────────────────────────────────────────────────────
    const delayed = leaves.filter(t => t.status !== 'COMPLETED' && t.plannedEnd && t.plannedEnd < todayISO)
    const atRisk = leaves.filter(t => {
      if (t.status === 'COMPLETED' || !t.plannedStart || !t.plannedEnd) return false
      const total = (new Date(t.plannedEnd).getTime() - new Date(t.plannedStart).getTime()) / 86400000
      const elapsed = (todayDate.getTime() - new Date(t.plannedStart).getTime()) / 86400000
      const timePct = total > 0 ? Math.min(100, (elapsed/total)*100) : 0
      return timePct > 10 && t.progress < timePct - 15
    })

    const resumeText = pt
      ? `O projeto <strong style="color:#e8edf5">${activeProject.name}</strong> apresenta <strong style="color:#22c55e">${totalProgress}%</strong> de avanço físico, com ${completed} tarefa(s) concluída(s) de ${leaves.length} no total. O planejado para hoje é <strong style="color:#60a5fa">${planVal}%</strong>, resultando em desvio de <strong style="color:${deviation<0?'#f87171':'#4ade80'}">${deviation>=0?'+':''}${deviation}%</strong>${atRisk.length>0?`. <span style="color:#fbbf24">${atRisk.length} tarefa(s) em risco de atraso.</span>`:'.'}` 
      : `Project <strong style="color:#e8edf5">${activeProject.name}</strong> shows <strong style="color:#22c55e">${totalProgress}%</strong> physical progress, with ${completed} task(s) completed out of ${leaves.length} total. Planned for today is <strong style="color:#60a5fa">${planVal}%</strong>, resulting in a deviation of <strong style="color:${deviation<0?'#f87171':'#4ade80'}">${deviation>=0?'+':''}${deviation}%</strong>${atRisk.length>0?`. <span style="color:#fbbf24">${atRisk.length} task(s) at risk of delay.</span>`:'.'}` 

    const fieldsHTML = [
      [pt?'Responsável':'Manager', ap.responsible??'—'],
      [pt?'Início do Projeto':'Project Start', fmtDate(pStart, lang)],
      [pt?'Término Planejado':'Planned End', fmtDate(pEnd, lang)],
    ].map(([l,v])=>`
      <div style="display:flex;justify-content:space-between;padding:3.5mm 0;border-bottom:1px solid #1e293b">
        <span style="color:#9aabc4;font-size:10pt">${l}</span>
        <span style="color:#e8edf5;font-weight:600;font-size:10pt">${v}</span>
      </div>`).join('')

    const html = `<!DOCTYPE html><html lang="${pt?'pt-BR':'en-US'}">
<head><meta charset="UTF-8"><title>Chronos PM — ${activeProject.code}</title>
<style>
  @page{size:A4 landscape;margin:12mm 15mm}
  @media print{.noprint{display:none!important}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.pb{page-break-before:always}}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;background:#0b0f1a;color:#e8edf5;font-size:9pt}
  .page{background:#0b0f1a}
  .ph{background:#111827;padding:3mm 0;margin-bottom:5mm;border-bottom:1px solid #2a3650;display:flex;justify-content:space-between;align-items:center}
  h1{font-size:14pt;font-weight:800;color:#e8edf5;margin:5mm 0 3mm;border-bottom:1px solid #3b82f6;padding-bottom:2mm}
  h2{font-size:11pt;font-weight:700;color:#e8edf5;margin:4mm 0 2.5mm}
  h3{font-size:10pt;font-weight:700;color:#e8edf5;margin:3mm 0 2mm}
  table{width:100%;border-collapse:collapse}
  th{background:#1e293b;color:#9aabc4;text-align:left;padding:2.5mm 2mm;font-size:7pt;text-transform:uppercase;letter-spacing:.4px}
  p{color:#9aabc4;font-size:9pt;line-height:1.7}
</style></head><body>

<!-- PÁG 1: CAPA -->
<div style="page-break-after:always;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15mm 30mm;background:#0b0f1a">
  <div style="background:#111827;border:1px solid #3b82f6;border-radius:4mm;padding:14mm 20mm;width:100%;max-width:230mm">
    <p style="color:#9aabc4;font-size:7.5pt;letter-spacing:2px;text-transform:uppercase;margin-bottom:8mm">
      ${pt?'Relatório Executivo de Cronograma':'Executive Schedule Report'}
    </p>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10mm">
      <div>
        <div style="font-size:24pt;font-weight:800;color:#e8edf5;margin-bottom:3mm">${activeProject.name}</div>
        <p style="color:#9aabc4;font-size:11pt">${activeProject.code}</p>
      </div>
      <div style="text-align:right">
        <div style="color:#5a6a84;font-size:8pt;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1mm">${pt?'Avanço Físico':'Physical Progress'}</div>
        <div style="color:#22c55e;font-size:36pt;font-weight:800;line-height:1">${totalProgress}%</div>
        <div style="color:#60a5fa;font-size:10pt;font-weight:600;margin-top:2mm">${pt?'Em Andamento':'In Progress'}</div>
      </div>
    </div>
    <div style="border-top:1px solid #2a3650">
      ${fieldsHTML}
      <div style="display:flex;justify-content:space-between;padding:3mm 0">
        <span style="color:#9aabc4;font-size:9pt">Status</span>
        <span style="color:#60a5fa;font-weight:600;font-size:9pt">${pt?'Em Andamento':'In Progress'}</span>
      </div>
    </div>
  </div>
  <p style="color:#5a6a84;font-size:7.5pt;margin-top:8mm">${pt?'Emitido em':'Issued on'}: ${date} · Chronos PM · ${pt?'Confidencial':'Confidential'}</p>
</div>

<!-- PÁG 2: RESUMO + KPIs + FASES -->
<div class="page">
  <div class="ph">
    <span style="color:#9aabc4;font-size:8pt;font-weight:700">${activeProject.code} · ${activeProject.name}</span>
    <span style="color:#5a6a84;font-size:7.5pt">${pt?'Página':'Page'} 2 ${pt?'de':'of'} 4 · ${date}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
    <div>
      <h1 style="margin-top:0">${pt?'Resumo Executivo':'Executive Summary'}</h1>
      <div style="background:#0d1829;border-left:3px solid #3b82f6;padding:4mm 5mm;margin-bottom:5mm;border-radius:0 2mm 2mm 0">
        <p>${resumeText}</p>
      </div>
      <h2>${pt?'Indicadores do Projeto':'Project Indicators'}</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3mm">${kpisHTML}</div>
      ${reportItemsHTML}
    </div>
    <div>
      <h1 style="margin-top:0">${groups.length>0?(pt?'Avanço por Fase':'Phase Progress'):(pt?'Avanço por Tarefa':'Task Progress')}</h1>
      <div>${fasesHTML||`<p style="color:#5a6a84">${pt?'Nenhuma tarefa cadastrada':'No tasks yet'}</p>`}</div>
    </div>
  </div>
</div>

<!-- PÁG 3: CURVA S -->
<div class="page pb">
  <div class="ph">
    <span style="color:#9aabc4;font-size:8pt;font-weight:700">${activeProject.code} · ${activeProject.name}</span>
    <span style="color:#5a6a84;font-size:7.5pt">${pt?'Página':'Page'} 3 ${pt?'de':'of'} 4 · ${date}</span>
  </div>
  <h1 style="margin-top:0">${pt?'Curva S — Avanço Físico Acumulado':'S-Curve — Cumulative Physical Progress'}</h1>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
    <div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:4mm">${curveKpisHTML}</div>
      ${deviation<=-2?`<div style="margin-bottom:4mm;background:#2d1a1a;border-left:3px solid #ef4444;padding:3mm 4mm;border-radius:0 2mm 2mm 0"><p style="color:#fca5a5;font-size:8pt">⚠ ${pt?`Desvio de ${Math.abs(deviation)}% abaixo do planejado.`:`${Math.abs(deviation)}% behind schedule.`}</p></div>`:''}
      <h3>${pt?'Detalhamento Mensal':'Monthly Breakdown'}</h3>
      <table style="margin-top:2mm">
        <thead><tr>${tblCols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${curveTableRows||`<tr><td colspan="5" style="padding:3mm;color:#5a6a84;text-align:center">${pt?'Sem dados':'No data'}</td></tr>`}</tbody>
      </table>
    </div>
    <div>
      <h3 style="margin-bottom:3mm">${pt?'Gráfico — Avanço Físico Acumulado (%)':'Chart — Cumulative Physical Progress (%)'}</h3>
      <div style="background:#0d1829;border-radius:3mm;padding:4mm;border:1px solid #1e293b">${svgCurve}</div>
      <p style="font-size:7pt;color:#5a6a84;margin-top:3mm">
        ${pt?'Metodologia: planejado = proporção linear do prazo total. Executado = média do progresso das tarefas.':'Methodology: planned = linear proportion of total duration. Executed = average task progress.'}
      </p>
    </div>
  </div>
</div>

<!-- PÁG 4: TABELA DE TAREFAS -->
<div class="page pb">
  <div class="ph">
    <span style="color:#9aabc4;font-size:8pt;font-weight:700">${activeProject.code} · ${activeProject.name}</span>
    <span style="color:#5a6a84;font-size:7.5pt">${pt?'Página':'Page'} 4 ${pt?'de':'of'} 4 · ${date}</span>
  </div>
  <h1 style="margin-top:0">${pt?'Tabela Completa de Tarefas':'Complete Task Table'}</h1>
  <table>
    <thead><tr>${tblTask.map((c,i)=>`<th style="width:${[35,18,9,9,7,22][i]}%">${c}</th>`).join('')}</tr></thead>
    <tbody>${tasksHTML||`<tr><td colspan="6" style="padding:3mm;color:#5a6a84;text-align:center">${pt?'Nenhuma tarefa cadastrada':'No tasks yet'}</td></tr>`}</tbody>
  </table>
  <p style="margin-top:8mm;color:#5a6a84;font-size:7.5pt;text-align:center">Chronos PM · ${date} · ${activeProject.code}</p>
</div>

<div class="noprint" style="position:fixed;bottom:20px;right:20px;display:flex;gap:10px;z-index:999">
  <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,.4)">
    🖨 ${pt?'Salvar como PDF (⌘+P)':'Save as PDF (⌘+P)'}
  </button>
  <button onclick="window.close()" style="background:#1e293b;color:#9aabc4;border:1px solid #2a3650;padding:12px 16px;border-radius:8px;font-size:14px;cursor:pointer">✕</button>
</div>
</body></html>`

    const blob = new Blob([html], {type:'text/html;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (!win) alert(pt?'Permita popups.':'Allow popups.')
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    setGenerating(false)
  }

  const LABEL: React.CSSProperties = {fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6}

  return (
    <div style={{maxWidth:760,display:'flex',flexDirection:'column',gap:20}}>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <h1 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)'}}>{pt?'Relatório em PDF':'PDF Report'}</h1>
            <p style={{fontSize:13,color:'var(--text3)',marginTop:4}}>{pt?'Relatório executivo — 4 páginas · Paisagem (A4)':'Executive report — 4 pages · Landscape (A4)'}</p>
          </div>
          {/* Seletor de data de referência */}
          <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 14px'}}>
            <span style={{fontSize:12,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>
              📅 {pt?'Data de referência':'Reference date'}
            </span>
            <input
              type="date"
              value={refDateISO}
              max={todayISO}
              onChange={e => setRefDateISO(e.target.value || todayISO)}
              style={{fontSize:13,fontWeight:600,color:'var(--text)',background:'transparent',border:'none',outline:'none',cursor:'pointer'}}
            />
            {refDateISO !== todayISO && (
              <button
                onClick={() => setRefDateISO(todayISO)}
                style={{fontSize:11,color:'#60a5fa',background:'none',border:'none',cursor:'pointer',textDecoration:'underline',padding:0,whiteSpace:'nowrap'}}
              >
                {pt?'Hoje':'Today'}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="alert alert-info">ℹ️ &nbsp;{pt?'Use o Chrome. Botão → nova aba → 🖨 Salvar como PDF · Paisagem · ✅ Gráficos em segundo plano':'Use Chrome. Button → new tab → 🖨 Save as PDF · Landscape · ✅ Background graphics'}</div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card">
          <div className="card-header"><h2 className="card-title">{pt?'Conteúdo (Paisagem)':'Contents (Landscape)'}</h2></div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
            {(pt
              ?['📄 Pág. 1 — Capa executiva','📊 Pág. 2 — Resumo + KPIs + Fases','📈 Pág. 3 — Curva S (gráfico + tabela)','📋 Pág. 4 — Tabela de tarefas']
              :['📄 Pg. 1 — Executive cover','📊 Pg. 2 — Summary + KPIs + Phases','📈 Pg. 3 — S-Curve (chart + table)','📋 Pg. 4 — Task table']
            ).map(i=><span key={i} style={{fontSize:13,color:'var(--text2)'}}>{i}</span>)}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2 className="card-title">{pt?'Dados do Projeto':'Project Data'}</h2></div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
            {fields.map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.3px'}}>{l}</span>
                <span style={{fontSize:13,color:String(l).includes('Avanço')||String(l).includes('Progress')?'#4ade80':'var(--text)',fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seção de Desvios Críticos — seleção manual */}
      {tasksWithGap.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">⚠ {pt?'Desvios Críticos — Análise e Contramedidas':'Critical Deviations — Analysis & Countermeasures'}</h2>
          </div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:0}}>
            <p style={{fontSize:13,color:'var(--text3)',marginBottom:16}}>
              {pt
                ?'Selecione as ocorrências que deseja reportar à diretoria. Para cada uma, descreva o contexto (causa do desvio) e a contramedida (ação corretiva). Apenas os itens selecionados aparecerão no PDF.'
                :'Select the items you want to report to management. For each, describe the context (cause) and countermeasure (corrective action). Only selected items will appear in the PDF.'}
            </p>

            {/* Tabela de seleção */}
            <div style={{marginBottom:20}}>
              <div style={{display:'grid',gridTemplateColumns:'32px 1fr 80px 80px 70px',gap:'0 12px',padding:'8px 0',borderBottom:'1px solid var(--border)',marginBottom:4}}>
                <div/>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{pt?'Tarefa':'Task'}</div>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'center'}}>{pt?'Prazo':'Time'}</div>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'center'}}>{pt?'Progresso':'Progress'}</div>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'center'}}>Δ Gap</div>
              </div>
              {tasksWithGap.map(t => (
                <div key={t.id} style={{display:'grid',gridTemplateColumns:'32px 1fr 80px 80px 70px',gap:'0 12px',padding:'10px 0',borderBottom:'1px solid var(--border)',alignItems:'center',background:selectedItems[t.id]?'rgba(59,130,246,0.05)':'transparent',cursor:'pointer'}}
                  onClick={() => setSelectedItems(prev => ({...prev, [t.id]: !prev[t.id]}))}>
                  <input type="checkbox" checked={!!selectedItems[t.id]} onChange={()=>{}} style={{cursor:'pointer',width:16,height:16,accentColor:'#3b82f6'}}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:selectedItems[t.id]?600:400,color:'var(--text)'}}>{t.name}</div>
                    {t.responsible && <div style={{fontSize:11,color:'var(--text3)'}}>{t.responsible}</div>}
                  </div>
                  <div style={{textAlign:'center',fontSize:13,color:'#60a5fa',fontWeight:600}}>{t.timePct}%</div>
                  <div style={{textAlign:'center',fontSize:13,color:'#4ade80',fontWeight:600}}>{t.progress}%</div>
                  <div style={{textAlign:'center',fontSize:13,fontWeight:700,color:t.gap>50?'#ef4444':t.gap>25?'#f59e0b':'#fbbf24'}}>-{t.gap}pp</div>
                </div>
              ))}
            </div>

            {/* Campos de contexto e contramedida para cada selecionado */}
            {reportItems.length > 0 && (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text)',paddingTop:4,borderTop:'1px solid var(--border)'}}>
                  {pt?`${reportItems.length} item(ns) selecionado(s) — preencha contexto e contramedida:`:`${reportItems.length} item(s) selected — fill in context and countermeasure:`}
                </div>
                {reportItems.map((t, i) => (
                  <div key={t.id} style={{background:'var(--surface2)',border:`1px solid ${t.gap>50?'rgba(239,68,68,0.3)':t.gap>25?'rgba(245,158,11,0.3)':'rgba(251,191,36,0.25)'}`,borderRadius:8,padding:16,borderLeft:`3px solid ${t.gap>50?'#ef4444':t.gap>25?'#f59e0b':'#fbbf24'}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:11,fontWeight:700,color:'var(--text3)'}}>#{i+1}</span>
                        <span style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{t.name}</span>
                        {t.responsible && <span style={{fontSize:12,color:'var(--text3)'}}>· {t.responsible}</span>}
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <span style={{fontSize:12,color:'#60a5fa',background:'rgba(59,130,246,0.1)',padding:'3px 8px',borderRadius:4}}>{pt?'Prazo':'Time'}: {t.timePct}%</span>
                        <span style={{fontSize:12,color:'#4ade80',background:'rgba(34,197,94,0.1)',padding:'3px 8px',borderRadius:4}}>{pt?'Prog.':'Prog.'}: {t.progress}%</span>
                        <span style={{fontSize:12,fontWeight:700,color:t.gap>50?'#ef4444':t.gap>25?'#f59e0b':'#fbbf24',background:t.gap>50?'rgba(239,68,68,0.1)':t.gap>25?'rgba(245,158,11,0.1)':'rgba(251,191,36,0.1)',padding:'3px 8px',borderRadius:4}}>Δ -{t.gap}pp</span>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6}}>
                          📋 {pt?'Contexto / Causa':'Context / Cause'}
                        </label>
                        <textarea
                          className="form-control"
                          rows={4}
                          placeholder={pt?'Descreva a causa do desvio, fatores externos, bloqueios...':'Describe the cause of delay, external factors, blockers...'}
                          value={itemContext[t.id] || ''}
                          onChange={e => setItemContext(prev => ({...prev, [t.id]: e.target.value}))}
                          style={{width:'100%',fontSize:13,resize:'vertical'}}
                        />
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6}}>
                          ⚡ {pt?'Contramedida':'Countermeasure'}
                        </label>
                        <textarea
                          className="form-control"
                          rows={4}
                          placeholder={pt?'Descreva a ação corretiva, responsável e prazo de recuperação...':'Describe corrective action, owner and recovery deadline...'}
                          value={itemAction[t.id] || ''}
                          onChange={e => setItemAction(prev => ({...prev, [t.id]: e.target.value}))}
                          style={{width:'100%',fontSize:13,resize:'vertical'}}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{textAlign:'center',padding:32,display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <div style={{fontSize:48,opacity:0.3}}>📄</div>
          <div>
            <h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,color:'var(--text)',marginBottom:6}}>{pt?'Gerar Relatório Executivo — Paisagem':'Generate Executive Report — Landscape'}</h2>
            <p style={{color:'var(--text3)',maxWidth:480,margin:'0 auto',fontSize:13}}>{pt?'4 páginas A4 paisagem: capa · KPIs · Curva S com gráfico · tabela de tarefas':'4 A4 landscape pages: cover · KPIs · S-Curve with chart · task table'}</p>
          </div>
          <button onClick={openReport} disabled={generating||loading} className="btn btn-primary" style={{padding:'12px 32px',fontSize:14}}>
            {loading?(pt?'⏳ Carregando dados...':'⏳ Loading data...'):generating?(pt?'⏳ Abrindo...':'⏳ Opening...'):(pt?'🖨 Abrir Relatório → Salvar como PDF':'🖨 Open Report → Save as PDF')}
          </button>
          <p style={{fontSize:11,color:'var(--text3)'}}>{pt?'Chrome: ⌘+P → Salvar como PDF · A4 · Paisagem · ✅ Gráficos em segundo plano':'Chrome: ⌘+P → Save as PDF · A4 · Landscape · ✅ Background graphics'}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="card-title">📧 {pt?'Enviar Relatório por Email':'Send Report by Email'}</h2></div>
        <div className="card-body" style={{display:'flex',flexDirection:'column',gap:14}}>
          <p style={{fontSize:13,color:'var(--text3)'}}>{pt?'Envie um resumo executivo do cronograma diretamente para os stakeholders do projeto.':'Send an executive schedule summary directly to project stakeholders.'}</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={LABEL}>{pt?'Destinatários (emails separados por vírgula)':'Recipients (comma-separated emails)'}</label>
              <input className="form-control" placeholder={pt?'cliente@empresa.com, gerente@email.com.br':'client@company.com, manager@email.com'} value={emailTo} onChange={e=>{setEmailTo(e.target.value);setEmailStatus('idle')}} style={{width:'100%',fontSize:13}}/>
            </div>
            <div>
              <label style={LABEL}>{pt?'Assunto':'Subject'}</label>
              <input className="form-control" placeholder={`${pt?'Relatório de Cronograma':'Schedule Report'} — ${activeProject.code}`} value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} style={{width:'100%',fontSize:13}}/>
            </div>
            <div>
              <label style={LABEL}>{pt?'Seu nome':'Your name'}</label>
              <input className="form-control" placeholder={ap.responsible||'Chronos PM'} value={senderName} onChange={e=>setSenderName(e.target.value)} style={{width:'100%',fontSize:13}}/>
            </div>
          </div>
          {emailStatus!=='idle'&&(
            <div style={{padding:'10px 14px',borderRadius:8,fontSize:13,fontWeight:500,background:emailStatus==='success'?'rgba(34,197,94,0.1)':emailStatus==='error'?'rgba(239,68,68,0.1)':'rgba(59,130,246,0.1)',border:`1px solid ${emailStatus==='success'?'rgba(34,197,94,0.3)':emailStatus==='error'?'rgba(239,68,68,0.3)':'rgba(59,130,246,0.3)'}`,color:emailStatus==='success'?'#4ade80':emailStatus==='error'?'#f87171':'#93c5fd'}}>
              {emailStatus==='sending'?(pt?'⏳ Enviando email...':'⏳ Sending email...'):emailMsg}
            </div>
          )}
          <button onClick={sendEmail} disabled={emailStatus==='sending'} className="btn btn-primary" style={{alignSelf:'flex-start',padding:'11px 28px',fontSize:14}}>
            {emailStatus==='sending'?(pt?'⏳ Enviando...':'⏳ Sending...'):(pt?'📧 Enviar Relatório por Email':'📧 Send Report by Email')}
          </button>
        </div>
      </div>
    </div>
  )
}
