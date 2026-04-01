'use client'
import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/lib/i18n'
import { useProject } from '@/lib/projectContext'

type Lang = 'pt' | 'en'

interface Task {
  id: string; parentId: string | null; isGroup: boolean; isCritical: boolean; isMilestone: boolean
  name: string; responsible?: string; weight: number
  plannedStart?: string | null; plannedEnd?: string | null
  actualStart?: string | null; actualEnd?: string | null
  progress: number; status: string; priority: string
}

const today = new Date().toISOString().slice(0, 10)

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

function buildCurve(tasks: Task[], lang: string) {
  const leaves = tasks.filter(t => !t.isGroup)
  if (!leaves.length) return []
  const dates = leaves.flatMap(t => [t.plannedStart, t.plannedEnd].filter(Boolean) as string[])
  if (!dates.length) return []
  const minD = dates.reduce((a,b) => a<b?a:b)
  const maxD = dates.reduce((a,b) => a>b?a:b)
  const start = new Date(minD.slice(0,7)+'-01')
  const end = new Date(maxD.slice(0,7)+'-01')
  end.setMonth(end.getMonth()+1)
  const totalW = leaves.reduce((s,t) => s+(t.weight||1), 0)
  const rows: any[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const endOfMonth = new Date(cur.getFullYear(), cur.getMonth()+1, 0)
    const endStr = endOfMonth.toISOString().slice(0,10)
    const label = cur.toLocaleDateString(lang==='pt'?'pt-BR':'en-US', {month:'short', year:'2-digit'})
    let planDone = 0
    leaves.forEach(t => { if (t.plannedEnd && t.plannedEnd <= endStr) planDone += (t.weight||1) })
    const plannedCumulative = totalW ? Math.round(planDone/totalW*100) : 0
    const isPast = endStr <= today
    let execDone = 0
    if (isPast) {
      leaves.forEach(t => {
        const w = t.weight||1
        const endRef = t.actualEnd||(t.status==='COMPLETED'?t.plannedEnd:null)
        if (endRef && endRef<=endStr) execDone += w
        else if (t.status==='IN_PROGRESS' && t.plannedStart && t.plannedStart<=endStr) execDone += w*(t.progress/100)
      })
    }
    const executedCumulative = isPast ? (totalW ? Math.round(execDone/totalW*100) : 0) : null
    const prevEnd = new Date(cur); prevEnd.setDate(0)
    const prevEndStr = prevEnd.toISOString().slice(0,10)
    let planPrev=0
    leaves.forEach(t => { if(t.plannedEnd && t.plannedEnd<=prevEndStr) planPrev+=(t.weight||1) })
    const plannedPeriod = Math.round((planDone-planPrev)/totalW*100)
    rows.push({period:label, plannedCumulative, executedCumulative, plannedPeriod, deviation: isPast&&executedCumulative!==null?executedCumulative-plannedCumulative:null})
    cur.setMonth(cur.getMonth()+1)
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
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [senderName, setSenderName] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle'|'sending'|'success'|'error'>('idle')
  const [emailMsg, setEmailMsg] = useState('')

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

  const leaves = tasks.filter(t => !t.isGroup)
  const groups = tasks.filter(t => t.isGroup)
  const completed = leaves.filter(t => t.status==='COMPLETED').length
  const inProgress = leaves.filter(t => t.status==='IN_PROGRESS').length
  const notStarted = leaves.filter(t => t.status==='NOT_STARTED').length
  const critical = leaves.filter(t => t.isCritical).length
  const milestones = leaves.filter(t => t.isMilestone).length
  const curveData = buildCurve(tasks, lang)
  const lastExec = [...curveData].reverse().find(d => d.executedCumulative !== null)
  const execVal = lastExec?.executedCumulative ?? 0
  const planVal = lastExec?.plannedCumulative ?? 0
  const deviation = execVal - planVal
  const ap = activeProject as any

  const fields = [
    [pt?'Projeto':'Project', activeProject.name],
    ['Código/Code', activeProject.code],
    [pt?'Responsável':'Manager', ap.responsible ?? '—'],
    [pt?'Início':'Start', fmtDate(ap.startDate, lang)],
    [pt?'Término':'End', fmtDate(ap.endDate, lang)],
    [pt?'Avanço':'Progress', `${activeProject.progress}%`],
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
          senderName: senderName || ap.responsible || 'BD7D Solutions',
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
    // Build SVG curve chart
    const W=700, H=210, padL=40, padR=18, padT=16, padB=34
    const cW=W-padL-padR, cH=H-padT-padB
    const xStep = curveData.length>1 ? cW/(curveData.length-1) : cW
    const px = (i:number) => padL+i*xStep
    const py = (v:number) => padT+cH-(v/100)*cH
    const gridLines = [0,25,50,75,100].map(v=>{const y=py(v);return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#2a3650" stroke-width="0.5" stroke-dasharray="3,3"/><text x="${padL-5}" y="${y+3.5}" text-anchor="end" fill="#5a6a84" font-size="9" font-family="Arial">${v}%</text>`}).join('')
    const xLabels = curveData.map((d,i)=>`<text x="${px(i)}" y="${H-5}" text-anchor="middle" fill="#5a6a84" font-size="8" font-family="Arial">${d.period}</text>`).join('')
    const planPts = curveData.map((d,i)=>`${px(i)},${py(d.plannedCumulative)}`).join(' ')
    const execData = curveData.filter(d=>d.executedCumulative!==null)
    const execPts = execData.map(d=>`${px(curveData.indexOf(d))},${py(d.executedCumulative as number)}`).join(' ')
    const todayI = curveData.findIndex(d=>d.executedCumulative!==null&&(curveData[curveData.indexOf(d)+1]?.executedCumulative===null||curveData.indexOf(d)===curveData.length-1))
    const todayX = todayI>=0 ? px(todayI) : px(Math.floor(curveData.length/2))
    const planArea = curveData.length>0 ? `${padL},${py(0)} ${planPts} ${px(curveData.length-1)},${py(0)}` : ''
    const execArea = execData.length>0 ? `${padL},${py(0)} ${execPts} ${px(execData.length-1)},${py(0)}` : ''
    const planDots = curveData.map((d,i)=>`<circle cx="${px(i)}" cy="${py(d.plannedCumulative)}" r="3" fill="#3b82f6"/>`).join('')
    const execDots = execData.map(d=>{const i=curveData.indexOf(d);return `<circle cx="${px(i)}" cy="${py(d.executedCumulative as number)}" r="3.5" fill="#22c55e"/>`}).join('')
    const svgCurve = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%"><defs><linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/></linearGradient><linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.3"/><stop offset="100%" stop-color="#22c55e" stop-opacity="0.02"/></linearGradient></defs><rect width="${W}" height="${H}" fill="#0d1829" rx="3"/>${gridLines}${xLabels}<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#2a3650" stroke-width="0.5"/>${planArea?`<polygon points="${planArea}" fill="url(#gP)"/><polyline points="${planPts}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/>`:''}${execArea?`<polygon points="${execArea}" fill="url(#gE)"/><polyline points="${execPts}" fill="none" stroke="#22c55e" stroke-width="3" stroke-linejoin="round"/>`:''}${planDots}${execDots}<line x1="${todayX}" y1="${padT}" x2="${todayX}" y2="${padT+cH}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,3"/><rect x="${todayX-16}" y="${padT-1}" width="32" height="13" rx="2" fill="#ef4444"/><text x="${todayX}" y="${padT+9}" text-anchor="middle" fill="white" font-size="8" font-family="Arial" font-weight="700">${pt?'Hoje':'Today'}</text><circle cx="${W-120}" cy="${H-18}" r="4" fill="#3b82f6"/><text x="${W-113}" y="${H-14}" fill="#9aabc4" font-size="9" font-family="Arial">${pt?'Planejado':'Planned'}</text><circle cx="${W-55}" cy="${H-18}" r="4" fill="#22c55e"/><text x="${W-48}" y="${H-14}" fill="#9aabc4" font-size="9" font-family="Arial">${pt?'Executado':'Executed'}</text></svg>`

    // Build HTML sections
    const date = new Date().toLocaleDateString(pt?'pt-BR':'en-US')
    const statusLabel = (s:string) => pt ? ({COMPLETED:'Concluída',IN_PROGRESS:'Em Andamento',NOT_STARTED:'Não Iniciada',ON_HOLD:'Em Espera',DELAYED:'Atrasado'}[s]??s) : ({COMPLETED:'Completed',IN_PROGRESS:'In Progress',NOT_STARTED:'Not Started',ON_HOLD:'On Hold',DELAYED:'Delayed'}[s]??s)
    const statusColor = (s:string) => ({COMPLETED:'#22c55e',IN_PROGRESS:'#60a5fa',NOT_STARTED:'#5a6a84',ON_HOLD:'#f59e0b',DELAYED:'#f87171'}[s]??'#5a6a84')

    const tasksHTML = tasks.map(task => {
      const color = statusColor(task.status)
      return `<tr style="background:${task.isGroup?'#1a2235':'transparent'}"><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${task.isGroup?'#e8edf5':'#c8d5e8'};font-weight:${task.isGroup?700:400};font-size:8pt">${task.name}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#9aabc4;font-size:7.5pt">${task.responsible||'—'}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#9aabc4;font-size:7.5pt">${fmtShort(task.plannedStart)}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#9aabc4;font-size:7.5pt">${fmtShort(task.plannedEnd)}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${color};font-weight:600;font-size:7.5pt">${task.progress}%</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${color};font-size:7.5pt">${statusLabel(task.status)}</td></tr>`
    }).join('')

    const fasesHTML = groups.map(g => {
      const c = g.status==='COMPLETED'?'#22c55e':g.status==='IN_PROGRESS'?'#3b82f6':'#2a3650'
      const tc = g.status==='COMPLETED'?'#22c55e':g.status==='IN_PROGRESS'?'#60a5fa':'#5a6a84'
      return `<div style="margin-bottom:3.5mm"><div style="display:flex;justify-content:space-between;font-size:9pt;margin-bottom:2mm"><span style="color:#e8edf5">${g.name}</span><span style="color:${tc};font-weight:700">${g.progress}% — ${statusLabel(g.status)}</span></div><div style="background:#222d42;border-radius:1mm;height:4mm"><div style="background:${c};width:${g.progress}%;height:4mm;border-radius:1mm"></div></div></div>`
    }).join('')

    const kpisHTML = [
      [pt?'Total de Tarefas':'Total Tasks', String(leaves.length)],
      [pt?'Concluídas':'Completed', String(completed)],
      [pt?'Em Andamento':'In Progress', String(inProgress)],
      [pt?'Não Iniciadas':'Not Started', String(notStarted)],
      [pt?'Tarefas Críticas':'Critical Tasks', String(critical)],
      ['Marcos/Milestones', String(milestones)],
    ].map(([l,v]) => `<div style="background:#1a2235;padding:4mm 5mm;border-radius:2mm"><div style="color:#5a6a84;font-size:7pt;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1.5mm">${l}</div><div style="color:#e8edf5;font-size:22pt;font-weight:800;line-height:1">${v}</div></div>`).join('')

    const curveKpis = [pt?'Planejado Acum.':'Planned Cum.', pt?'Executado Acum.':'Executed Cum.', pt?'Desvio':'Deviation', pt?'Tendência':'Trend']
    const trendLabel = deviation<-2?(pt?'Atrasado':'Delayed'):deviation>2?(pt?'Adiantado':'Ahead'):(pt?'No Prazo':'On Track')
    const curveVals = [`${planVal}%`, `${execVal}%`, `${deviation>=0?'+':''}${deviation}%`, trendLabel]
    const curveKpisHTML = curveKpis.map((l,i)=>`<div style="background:#1a2235;padding:3mm 4mm;border-radius:2mm"><div style="color:#5a6a84;font-size:6.5pt;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1.5mm">${l}</div><div style="color:${i===0?'#60a5fa':deviation<0?'#f87171':'#4ade80'};font-size:14pt;font-weight:800;line-height:1">${curveVals[i]}</div></div>`).join('')

    const curveTableRows = curveData.map((d,i)=>{
      const dev=d.deviation; const devColor=dev===null?'#5a6a84':dev<0?'#f87171':dev>0?'#22c55e':'#9aabc4'
      const sColor=d.executedCumulative===null?'#5a6a84':dev!==null&&dev<=-2?'#f87171':dev!==null&&dev>=2?'#22c55e':'#60a5fa'
      const sText=d.executedCumulative===null?(pt?'Futuro':'Future'):dev!==null&&dev<=-2?(pt?'Atrasado':'Delayed'):dev!==null&&dev>=2?(pt?'Adiantado':'Ahead'):(pt?'No Prazo':'On Track')
      return `<tr style="background:${i%2===0?'#111827':'transparent'}"><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#e8edf5;font-size:8pt;font-weight:600">${d.period}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#60a5fa;font-size:8pt">${d.plannedCumulative}%</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${d.executedCumulative!==null?'#22c55e':'#5a6a84'};font-size:8pt">${d.executedCumulative!==null?d.executedCumulative+'%':'—'}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${devColor};font-size:8pt;font-weight:600">${dev!==null?(dev>=0?'+':'')+dev+'%':'—'}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${sColor};font-size:8pt">${sText}</td></tr>`
    }).join('')

    const resumeText = groups.length>0
      ? `${pt?'O projeto':'The project'} <strong style="color:#e8edf5">${activeProject.name}</strong> ${pt?'apresenta':'shows'} <strong style="color:#e8edf5">${activeProject.progress}%</strong> ${pt?'de avanço físico':'physical progress'}. ${groups.filter(g=>g.status==='COMPLETED').map(g=>g.name).join(', ')} ${pt?'concluídos.':'completed.'} ${groups.filter(g=>g.status==='IN_PROGRESS').map(g=>`${g.name} ${pt?'em':'at'} ${g.progress}%`).join(', ')}.`
      : `${pt?'Projeto':'Project'} ${activeProject.name} — ${activeProject.progress}% ${pt?'concluído':'complete'}.`

    const fieldsHTML = [
      [pt?'Responsável':'Manager', ap.responsible??'—'],
      [pt?'Início do Projeto':'Project Start', fmtDate(ap.startDate, lang)],
      [pt?'Término Planejado':'Planned End', fmtDate(ap.endDate, lang)],
    ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:3.5mm 0;border-bottom:1px solid #1e293b"><span style="color:#9aabc4;font-size:10pt">${l}</span><span style="color:#e8edf5;font-weight:600;font-size:10pt">${v}</span></div>`).join('')

    const tblCols = pt?['Período','Plan. Acum.','Exec. Acum.','Desvio','Status']:['Period','Plan. Cum.','Exec. Cum.','Deviation','Status']
    const tblTask = pt?['Tarefa','Responsável','Início','Término','%','Status']:['Task','Responsible','Start','End','%','Status']

    const html = `<!DOCTYPE html><html lang="${pt?'pt-BR':'en-US'}"><head><meta charset="UTF-8"><title>Chronos PM — ${activeProject.code}</title><style>@page{size:A4 landscape;margin:12mm 15mm}@media print{.noprint{display:none!important}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.pb{page-break-before:always}}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#0b0f1a;color:#e8edf5;font-size:9pt}.page{background:#0b0f1a}.ph{background:#111827;padding:3mm 0;margin-bottom:5mm;border-bottom:1px solid #2a3650;display:flex;justify-content:space-between;align-items:center}h1{font-size:14pt;font-weight:800;color:#e8edf5;margin:5mm 0 3mm;border-bottom:1px solid #3b82f6;padding-bottom:2mm}h2{font-size:11pt;font-weight:700;color:#e8edf5;margin:4mm 0 2.5mm}h3{font-size:10pt;font-weight:700;color:#e8edf5;margin:3mm 0 2mm}table{width:100%;border-collapse:collapse}th{background:#1e293b;color:#9aabc4;text-align:left;padding:2.5mm 2mm;font-size:7pt;text-transform:uppercase;letter-spacing:.4px}p{color:#9aabc4;font-size:9pt;line-height:1.7}</style></head><body>
<div style="page-break-after:always;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15mm 30mm;background:#0b0f1a">
  <div style="background:#111827;border:1px solid #3b82f6;border-radius:4mm;padding:14mm 20mm;width:100%;max-width:230mm">
    <p style="color:#9aabc4;font-size:7.5pt;letter-spacing:2px;text-transform:uppercase;margin-bottom:8mm">${pt?'Relatório Executivo de Cronograma · BD7D Solutions Engenharia LTDA':'Executive Schedule Report · BD7D Solutions Engineering LTDA'}</p>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10mm">
      <div><div style="font-size:24pt;font-weight:800;color:#e8edf5;margin-bottom:3mm">${activeProject.name}</div><p style="color:#9aabc4;font-size:11pt">${activeProject.code}</p></div>
      <div style="text-align:right"><div style="color:#5a6a84;font-size:8pt;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1mm">${pt?'Avanço Físico':'Physical Progress'}</div><div style="color:#22c55e;font-size:36pt;font-weight:800;line-height:1">${activeProject.progress}%</div><div style="color:#60a5fa;font-size:10pt;font-weight:600;margin-top:2mm">${pt?'Em Andamento':'In Progress'}</div></div>
    </div>
    <div style="border-top:1px solid #2a3650">${fieldsHTML}<div style="display:flex;justify-content:space-between;padding:3mm 0"><span style="color:#9aabc4;font-size:9pt">Status</span><span style="color:#60a5fa;font-weight:600;font-size:9pt">${pt?'Em Andamento':'In Progress'}</span></div></div>
  </div>
  <p style="color:#5a6a84;font-size:7.5pt;margin-top:8mm">${pt?'Emitido em':'Issued on'}: ${date} · Chronos PM · ${pt?'Confidencial':'Confidential'}</p>
</div>
<div class="page">
  <div class="ph"><span style="color:#9aabc4;font-size:8pt;font-weight:700">${activeProject.code} · ${activeProject.name}</span><span style="color:#5a6a84;font-size:7.5pt">${pt?'Página':'Page'} 2 ${pt?'de':'of'} 4 · ${date}</span></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
    <div>
      <h1 style="margin-top:0">${pt?'Resumo Executivo':'Executive Summary'}</h1>
      <div style="background:#0d1829;border-left:3px solid #3b82f6;padding:4mm 5mm;margin-bottom:5mm;border-radius:0 2mm 2mm 0"><p>${resumeText}</p></div>
      <h2>${pt?'Indicadores do Projeto':'Project Indicators'}</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3mm">${kpisHTML}</div>
    </div>
    <div>
      <h1 style="margin-top:0">${pt?'Avanço por Fase':'Phase Progress'}</h1>
      <div>${fasesHTML||`<p style="color:#5a6a84">${pt?'Nenhum grupo cadastrado':'No groups yet'}</p>`}</div>
    </div>
  </div>
</div>
<div class="page pb">
  <div class="ph"><span style="color:#9aabc4;font-size:8pt;font-weight:700">${activeProject.code} · ${activeProject.name}</span><span style="color:#5a6a84;font-size:7.5pt">${pt?'Página':'Page'} 3 ${pt?'de':'of'} 4 · ${date}</span></div>
  <h1 style="margin-top:0">${pt?'Curva S — Avanço Físico Acumulado':'S-Curve — Cumulative Physical Progress'}</h1>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
    <div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:4mm">${curveKpisHTML}</div>
      <h3>${pt?'Detalhamento Mensal':'Monthly Breakdown'}</h3>
      <table style="margin-top:2mm"><thead><tr>${tblCols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${curveTableRows||`<tr><td colspan="5" style="padding:3mm;color:#5a6a84;text-align:center">${pt?'Sem dados':'No data'}</td></tr>`}</tbody></table>
      ${deviation<=-2?`<div style="margin-top:4mm;background:#2d1a1a;border-left:3px solid #ef4444;padding:3mm 4mm;border-radius:0 2mm 2mm 0"><p style="color:#fca5a5;font-size:8pt">⚠ ${pt?`Desvio de ${Math.abs(deviation)}% abaixo do planejado.`:`${Math.abs(deviation)}% behind schedule.`}</p></div>`:''}
    </div>
    <div>
      <h3 style="margin-bottom:3mm">${pt?'Gráfico — Avanço Físico Acumulado (%)':'Chart — Cumulative Physical Progress (%)'}</h3>
      <div style="background:#0d1829;border-radius:3mm;padding:4mm;border:1px solid #1e293b">${svgCurve}</div>
    </div>
  </div>
</div>
<div class="page pb">
  <div class="ph"><span style="color:#9aabc4;font-size:8pt;font-weight:700">${activeProject.code} · ${activeProject.name}</span><span style="color:#5a6a84;font-size:7.5pt">${pt?'Página':'Page'} 4 ${pt?'de':'of'} 4 · ${date}</span></div>
  <h1 style="margin-top:0">${pt?'Tabela Completa de Tarefas':'Complete Task Table'}</h1>
  <table><thead><tr>${tblTask.map((c,i)=>`<th style="width:${[35,18,9,9,7,22][i]}%">${c}</th>`).join('')}</tr></thead><tbody>${tasksHTML||`<tr><td colspan="6" style="padding:3mm;color:#5a6a84;text-align:center">${pt?'Nenhuma tarefa cadastrada':'No tasks yet'}</td></tr>`}</tbody></table>
  <p style="margin-top:8mm;color:#5a6a84;font-size:7.5pt;text-align:center">Chronos PM · BD7D Solutions · ${date} · ${activeProject.code}</p>
</div>
<div class="noprint" style="position:fixed;bottom:20px;right:20px;display:flex;gap:10px;z-index:999">
  <button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,.4)">🖨 ${pt?'Salvar como PDF (⌘+P)':'Save as PDF (⌘+P)'}</button>
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
        <h1 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)'}}>{pt?'Relatório em PDF':'PDF Report'}</h1>
        <p style={{fontSize:13,color:'var(--text3)',marginTop:4}}>{pt?'Relatório executivo — 4 páginas · Paisagem (A4)':'Executive report — 4 pages · Landscape (A4)'}</p>
      </div>
      <div className="alert alert-info">ℹ️ &nbsp;{pt?'Use o Chrome. Botão → nova aba → 🖨 Salvar como PDF · Paisagem · ✅ Gráficos em segundo plano':'Use Chrome. Button → new tab → 🖨 Save as PDF · Landscape · ✅ Background graphics'}</div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card">
          <div className="card-header"><h2 className="card-title">{pt?'Conteúdo (Paisagem)':'Contents (Landscape)'}</h2></div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
            {(pt?['📄 Pág. 1 — Capa executiva','📊 Pág. 2 — Resumo + KPIs + Fases','📈 Pág. 3 — Curva S (gráfico + tabela)','📋 Pág. 4 — Tabela de tarefas']:['📄 Pg. 1 — Executive cover','📊 Pg. 2 — Summary + KPIs + Phases','📈 Pg. 3 — S-Curve (chart + table)','📋 Pg. 4 — Task table']).map(i=><span key={i} style={{fontSize:13,color:'var(--text2)'}}>{i}</span>)}
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
              <input className="form-control" placeholder={pt?'cliente@empresa.com, gerente@bd7d.com.br':'client@company.com, manager@bd7d.com.br'} value={emailTo} onChange={e=>{setEmailTo(e.target.value);setEmailStatus('idle')}} style={{width:'100%',fontSize:13}}/>
            </div>
            <div>
              <label style={LABEL}>{pt?'Assunto':'Subject'}</label>
              <input className="form-control" placeholder={`${pt?'Relatório de Cronograma':'Schedule Report'} — ${activeProject.code}`} value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} style={{width:'100%',fontSize:13}}/>
            </div>
            <div>
              <label style={LABEL}>{pt?'Seu nome':'Your name'}</label>
              <input className="form-control" placeholder={ap.responsible||'BD7D Solutions'} value={senderName} onChange={e=>setSenderName(e.target.value)} style={{width:'100%',fontSize:13}}/>
            </div>
          </div>
          <p style={{fontSize:12,color:'var(--text3)',background:'var(--surface2)',padding:'10px 14px',borderRadius:8,border:'1px solid var(--border)'}}>
            💡 {pt?'O email incluirá: dados do projeto, KPIs, avanço por fase e link para o relatório completo.':'The email will include: project data, KPIs, phase progress and a link to the full report.'}
          </p>
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
