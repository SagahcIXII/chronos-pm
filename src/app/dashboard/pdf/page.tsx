'use client'
import { useState } from 'react'
import { useLang } from '@/lib/i18n'
import { useProject } from '@/lib/projectContext'

type Lang = 'pt' | 'en'

const T = {
  pt: {
    title:'Relatório em PDF', subtitle:'Relatório executivo — 4 páginas · Paisagem (A4)',
    info:'Use o Chrome. Botão → nova aba → 🖨 Salvar como PDF · Paisagem · ✅ Gráficos em segundo plano',
    content:'Conteúdo (Paisagem)',
    pages:['📄 Pág. 1 — Capa executiva','📊 Pág. 2 — Resumo + KPIs + Fases','📈 Pág. 3 — Curva S (gráfico + tabela)','📋 Pág. 4 — Tabela de 20 tarefas'],
    projectData:'Dados do Projeto',
    btnGenerate:'🖨 Abrir Relatório → Salvar como PDF', btnGenerating:'⏳ Abrindo...',
    btnTitle:'Gerar Relatório Executivo — Paisagem',
    btnDesc:'4 páginas A4 paisagem: capa · KPIs · Curva S com gráfico · tabela de tarefas',
    hint:'Chrome: ⌘+P → Salvar como PDF · A4 · Paisagem · ✅ Gráficos em segundo plano',
    // Email
    emailTitle:'Enviar Relatório por Email',
    emailDesc:'Envie um resumo executivo do cronograma diretamente para os stakeholders do projeto.',
    emailTo:'Destinatários (emails separados por vírgula)',
    emailToPlaceholder:'cliente@empresa.com, gerente@bd7d.com.br',
    emailSubject:'Assunto',
    emailSubjectDefault:'Relatório de Cronograma',
    emailSender:'Seu nome',
    emailSenderPlaceholder:'Eng. Carlos Souza',
    emailSend:'📧 Enviar Relatório por Email',
    emailSending:'⏳ Enviando...',
    emailSuccess:'✅ Email enviado com sucesso!',
    emailError:'❌ Erro ao enviar. Verifique as configurações.',
    emailNote:'O email incluirá: dados do projeto, KPIs, avanço por fase e link para o relatório completo.',
    // PDF
    pdfTag:'Relatório Executivo de Cronograma · BD7D Solutions Engenharia LTDA',
    pdfAvancoLabel:'Avanço Físico', pdfStatus:'Em Andamento',
    pdfFooter:'Emitido em', pdfConf:'Chronos PM · Confidencial',
    pdfResp:'Responsável', pdfStart:'Início do Projeto', pdfEnd:'Término Planejado',
    pdfResume:'Resumo Executivo',
    pdfResumeText:'O projeto apresenta <strong style="color:#e8edf5">42%</strong> de avanço físico frente a <strong style="color:#e8edf5">45%</strong> planejado, desvio de <strong style="color:#f87171">-3%</strong>. <strong style="color:#22c55e">Planejamento</strong> e <strong style="color:#22c55e">Mobilização</strong> concluídos. Civil em <strong style="color:#60a5fa">58%</strong>, Elétrica em <strong style="color:#60a5fa">35%</strong>. Automação e Entrega não iniciadas.',
    pdfKpis:'Indicadores do Projeto',
    kpiLabels:['Total de Tarefas','Concluídas','Em Andamento','Não Iniciadas','Tarefas Críticas','Marcos'],
    pdfFases:'Avanço por Fase',
    faseNames:['1. Planejamento','2. Mobilização','3. Infraestrutura Civil','4. Infraestrutura Elétrica','5. Automação Industrial'],
    faseStatus:['Concluída','Concluída','Em Andamento','Em Andamento','Não Iniciada'],
    pdfCurvaS:'Curva S — Avanço Físico Acumulado',
    curvaKpis:['Planejado Acum.','Executado Acum.','Desvio','Tendência'],
    curvaVals:['37%','35%','-2%','Atrasado'],
    pdfDetMensal:'Detalhamento Mensal',
    tblCols:['Período','Plan. Acum.','Exec. Acum.','Desvio','Status'],
    curvaStatus:['No Prazo','No Prazo','No Prazo','Atrasado','Futuro','Futuro','Futuro','Futuro','Futuro'],
    pdfAlert:'⚠ <strong>Atenção:</strong> Desvio de -2% a partir de mai/2025. Revisar cronograma.',
    pdfGrafico:'Gráfico — Avanço Físico Acumulado (%)',
    pdfTabela:'Tabela Completa de Tarefas',
    tblTask:['Tarefa','Responsável','Início','Término','%','Status'],
    taskStatus:['Concluída','Em Andamento','Não Iniciada'],
    pdfHoje:'Hoje', pdfPlanejado:'Planejado', pdfExecutado:'Executado',
    pg:'Página', de:'de',
  },
  en: {
    title:'PDF Report', subtitle:'Executive report — 4 pages · Landscape (A4)',
    info:'Use Chrome. Button → new tab → 🖨 Save as PDF · Landscape · ✅ Background graphics',
    content:'Contents (Landscape)',
    pages:['📄 Pg. 1 — Executive cover','📊 Pg. 2 — Summary + KPIs + Phases','📈 Pg. 3 — S-Curve (chart + table)','📋 Pg. 4 — Task table (20 tasks)'],
    projectData:'Project Data',
    btnGenerate:'🖨 Open Report → Save as PDF', btnGenerating:'⏳ Opening...',
    btnTitle:'Generate Executive Report — Landscape',
    btnDesc:'4 A4 landscape pages: cover · KPIs · S-Curve with chart · task table',
    hint:'Chrome: ⌘+P → Save as PDF · A4 · Landscape · ✅ Background graphics',
    // Email
    emailTitle:'Send Report by Email',
    emailDesc:'Send an executive schedule summary directly to project stakeholders.',
    emailTo:'Recipients (comma-separated emails)',
    emailToPlaceholder:'client@company.com, manager@bd7d.com.br',
    emailSubject:'Subject',
    emailSubjectDefault:'Schedule Report',
    emailSender:'Your name',
    emailSenderPlaceholder:'Eng. Carlos Souza',
    emailSend:'📧 Send Report by Email',
    emailSending:'⏳ Sending...',
    emailSuccess:'✅ Email sent successfully!',
    emailError:'❌ Error sending. Check your settings.',
    emailNote:'The email will include: project data, KPIs, phase progress and link to the full report.',
    // PDF
    pdfTag:'Executive Schedule Report · BD7D Solutions Engineering LTDA',
    pdfAvancoLabel:'Physical Progress', pdfStatus:'In Progress',
    pdfFooter:'Issued on', pdfConf:'Chronos PM · Confidential',
    pdfResp:'Manager', pdfStart:'Project Start', pdfEnd:'Planned End',
    pdfResume:'Executive Summary',
    pdfResumeText:'The project shows <strong style="color:#e8edf5">42%</strong> cumulative progress against <strong style="color:#e8edf5">45%</strong> planned, resulting in a <strong style="color:#f87171">-3%</strong> deviation. <strong style="color:#22c55e">Planning</strong> and <strong style="color:#22c55e">Mobilization</strong> complete. Civil at <strong style="color:#60a5fa">58%</strong>, Electrical at <strong style="color:#60a5fa">35%</strong>. Automation and Delivery not started.',
    pdfKpis:'Project Indicators',
    kpiLabels:['Total Tasks','Completed','In Progress','Not Started','Critical Tasks','Milestones'],
    pdfFases:'Phase Progress',
    faseNames:['1. Planning','2. Mobilization','3. Civil Infrastructure','4. Electrical Infrastructure','5. Industrial Automation'],
    faseStatus:['Completed','Completed','In Progress','In Progress','Not Started'],
    pdfCurvaS:'S-Curve — Cumulative Physical Progress',
    curvaKpis:['Planned Cum.','Executed Cum.','Deviation','Trend'],
    curvaVals:['37%','35%','-2%','Delayed'],
    pdfDetMensal:'Monthly Breakdown',
    tblCols:['Period','Plan. Cum.','Exec. Cum.','Deviation','Status'],
    curvaStatus:['On Track','On Track','On Track','Delayed','Future','Future','Future','Future','Future'],
    pdfAlert:'⚠ <strong>Warning:</strong> -2% deviation from May/2025. Review critical schedule.',
    pdfGrafico:'Chart — Cumulative Physical Progress (%)',
    pdfTabela:'Complete Task Table',
    tblTask:['Task','Responsible','Start','End','%','Status'],
    taskStatus:['Completed','In Progress','Not Started'],
    pdfHoje:'Today', pdfPlanejado:'Planned', pdfExecutado:'Executed',
    pg:'Page', de:'of',
  }
}

const TASKS = [
  {pt:'1. PLANEJAMENTO',            en:'1. PLANNING',              r:'Equipe BD7D',   i:'01/02',f:'28/02',p:'100%',si:0,g:true },
  {pt:'  1.1 Levantamento inicial', en:'  1.1 Initial Survey',     r:'Eng. Carlos',   i:'01/02',f:'10/02',p:'100%',si:0,g:false},
  {pt:'  1.2 Elaboração projetos',  en:'  1.2 Project Design',     r:'Eng. Ana',      i:'10/02',f:'20/02',p:'100%',si:0,g:false},
  {pt:'  1.3 Aprovações regul.',    en:'  1.3 Reg. Approvals',     r:'Eng. Carlos',   i:'20/02',f:'28/02',p:'100%',si:0,g:false},
  {pt:'2. MOBILIZAÇÃO',             en:'2. MOBILIZATION',          r:'Equipe BD7D',   i:'01/03',f:'15/03',p:'100%',si:0,g:true },
  {pt:'  2.1 Contratação equipe',   en:'  2.1 Team Hiring',        r:'RH',            i:'01/03',f:'08/03',p:'100%',si:0,g:false},
  {pt:'  2.2 Montagem canteiro',    en:'  2.2 Site Setup',         r:'Eng. Pedro',    i:'08/03',f:'15/03',p:'100%',si:0,g:false},
  {pt:'3. INFRA. CIVIL',            en:'3. CIVIL INFRASTRUCTURE',  r:'Eng. Pedro',    i:'15/03',f:'30/06',p:'58%', si:1,g:true },
  {pt:'  3.1 Fundações',            en:'  3.1 Foundations',        r:'Eng. Pedro',    i:'15/03',f:'15/04',p:'100%',si:0,g:false},
  {pt:'  3.2 Estrutura metálica',   en:'  3.2 Steel Structure',    r:'Metalcon',      i:'15/04',f:'30/05',p:'70%', si:1,g:false},
  {pt:'  3.3 Cobertura',            en:'  3.3 Roofing',            r:'Eng. Pedro',    i:'30/05',f:'30/06',p:'0%',  si:2,g:false},
  {pt:'4. INFRA. ELÉTRICA',         en:'4. ELECTRICAL INFRA.',     r:'Eng. Ana',      i:'01/04',f:'31/07',p:'35%', si:1,g:true },
  {pt:'  4.1 Subestação MT/BT',     en:'  4.1 MV/LV Substation',  r:'Eng. Ana',      i:'01/04',f:'01/05',p:'100%',si:0,g:false},
  {pt:'  4.2 Distribuição BT',      en:'  4.2 LV Distribution',   r:'Elétrica Norte', i:'01/05',f:'30/06',p:'40%', si:1,g:false},
  {pt:'  4.3 Iluminação',           en:'  4.3 Lighting',          r:'Elétrica Norte', i:'30/06',f:'31/07',p:'0%',  si:2,g:false},
  {pt:'5. AUTOMAÇÃO',               en:'5. AUTOMATION',            r:'BD7D Solutions',i:'01/07',f:'15/09',p:'0%',  si:2,g:true },
  {pt:'  5.1 SDCD',                 en:'  5.1 DCS',                r:'Eng. Rocha',    i:'01/07',f:'31/07',p:'0%',  si:2,g:false},
  {pt:'  5.2 IHM e SCADA',          en:'  5.2 HMI & SCADA',       r:'BD7D Solutions',i:'31/07',f:'31/08',p:'0%',  si:2,g:false},
  {pt:'  5.3 Comissionamento',      en:'  5.3 Commissioning',     r:'BD7D Solutions',i:'31/08',f:'15/09',p:'0%',  si:2,g:false},
  {pt:'6. ENTREGA FINAL',           en:'6. FINAL DELIVERY',        r:'Eng. Carlos',   i:'15/09',f:'30/09',p:'0%',  si:2,g:true },
]
const FASES_PCT=[100,100,58,35,0]
const FASES_C=['done','done','prog','prog','none']
const CURVE=[
  {m:'Fev/25',me:'Feb/25',plan:8,  exec:9   },
  {m:'Mar/25',me:'Mar/25',plan:15, exec:16  },
  {m:'Abr/25',me:'Apr/25',plan:25, exec:26  },
  {m:'Mai/25',me:'May/25',plan:37, exec:35  },
  {m:'Jun/25',me:'Jun/25',plan:52, exec:null},
  {m:'Jul/25',me:'Jul/25',plan:65, exec:null},
  {m:'Ago/25',me:'Aug/25',plan:80, exec:null},
  {m:'Set/25',me:'Sep/25',plan:95, exec:null},
  {m:'Out/25',me:'Oct/25',plan:100,exec:null},
]

export default function PDFPage() {
  const { lang } = useLang()
  const { activeProject } = useProject()
  const [generating, setGenerating] = useState(false)
  // Email state
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [senderName, setSenderName] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle'|'sending'|'success'|'error'>('idle')
  const [emailMsg, setEmailMsg] = useState('')

  const tr = T[lang as Lang]
  const projectName = lang==='pt' ? activeProject.name : activeProject.nameEn

  const sendEmail = async () => {
    if (!emailTo.trim()) { setEmailMsg(lang==='pt'?'Informe pelo menos um destinatário.':'Please enter at least one recipient.'); setEmailStatus('error'); return }
    setEmailStatus('sending')
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo.split(',').map((e: string) => e.trim()).filter(Boolean),
          subject: emailSubject || `${tr.emailSubjectDefault} — ${activeProject.code}`,
          projectCode: activeProject.code,
          projectName,
          senderName: senderName || activeProject.manager,
          lang,
          reportHtml: '',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setEmailStatus('success')
        setEmailMsg(tr.emailSuccess + (data.message ? ` (${data.message})` : ''))
      } else {
        setEmailStatus('error')
        setEmailMsg(`${tr.emailError} — ${data.detail || data.error}`)
      }
    } catch (e: any) {
      setEmailStatus('error')
      setEmailMsg(`${tr.emailError} — ${e.message}`)
    }
  }

  const openReport = () => {
    setGenerating(true)
    const date = new Date().toLocaleDateString(lang==='pt'?'pt-BR':'en-US')
    const W=700,H=210,padL=40,padR=18,padT=16,padB=34
    const cW=W-padL-padR,cH=H-padT-padB
    const xStep=cW/(CURVE.length-1)
    const px=(i:number)=>padL+i*xStep
    const py=(v:number)=>padT+cH-(v/100)*cH
    const gridLines=[0,25,50,75,100].map(v=>{const y=py(v);return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#2a3650" stroke-width="0.5" stroke-dasharray="3,3"/><text x="${padL-5}" y="${y+3.5}" text-anchor="end" fill="#5a6a84" font-size="9" font-family="Arial">${v}%</text>`}).join('')
    const xLabels=CURVE.map((d,i)=>`<text x="${px(i)}" y="${H-5}" text-anchor="middle" fill="#5a6a84" font-size="8.5" font-family="Arial">${lang==='pt'?d.m:d.me}</text>`).join('')
    const planPts=CURVE.map((d,i)=>`${px(i)},${py(d.plan)}`).join(' ')
    const planArea=`${padL},${py(0)} ${planPts} ${W-padR},${py(0)}`
    const execData=CURVE.filter(d=>d.exec!==null)
    const execPts=execData.map(d=>`${px(CURVE.indexOf(d))},${py(d.exec as number)}`).join(' ')
    const lastExecX=px(execData.length-1)
    const execArea=`${padL},${py(0)} ${execPts} ${lastExecX},${py(0)}`
    const todayX=px(3)
    const planDots=CURVE.map((d,i)=>`<circle cx="${px(i)}" cy="${py(d.plan)}" r="3" fill="#3b82f6"/>`).join('')
    const execDots=execData.map(d=>{const i=CURVE.indexOf(d);return `<circle cx="${px(i)}" cy="${py(d.exec as number)}" r="3.5" fill="#22c55e"/>`}).join('')
    const svgCurve=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%"><defs><linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/></linearGradient><linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.3"/><stop offset="100%" stop-color="#22c55e" stop-opacity="0.02"/></linearGradient></defs><rect width="${W}" height="${H}" fill="#0d1829" rx="3"/>${gridLines}${xLabels}<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#2a3650" stroke-width="0.5"/><polygon points="${planArea}" fill="url(#gP)"/><polyline points="${planPts}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/><polygon points="${execArea}" fill="url(#gE)"/><polyline points="${execPts}" fill="none" stroke="#22c55e" stroke-width="3" stroke-linejoin="round"/>${planDots}${execDots}<line x1="${todayX}" y1="${padT}" x2="${todayX}" y2="${padT+cH}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,3"/><rect x="${todayX-16}" y="${padT-1}" width="32" height="13" rx="2" fill="#ef4444"/><text x="${todayX}" y="${padT+9}" text-anchor="middle" fill="white" font-size="8" font-family="Arial" font-weight="700">${tr.pdfHoje}</text><circle cx="${W-120}" cy="${H-18}" r="4" fill="#3b82f6"/><text x="${W-113}" y="${H-14}" fill="#9aabc4" font-size="9" font-family="Arial">${tr.pdfPlanejado}</text><circle cx="${W-55}" cy="${H-18}" r="4" fill="#22c55e"/><text x="${W-48}" y="${H-14}" fill="#9aabc4" font-size="9" font-family="Arial">${tr.pdfExecutado}</text></svg>`
    const tasksHTML=TASKS.map(task=>{const name=lang==='pt'?task.pt:task.en;const statusLabel=tr.taskStatus[task.si];const color=task.si===0?'#22c55e':task.si===1?'#60a5fa':'#5a6a84';return `<tr style="background:${task.g?'#1a2235':'transparent'}"><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${task.g?'#e8edf5':'#c8d5e8'};font-weight:${task.g?700:400};font-size:8pt">${name}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#9aabc4;font-size:7.5pt">${task.r}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#9aabc4;font-size:7.5pt">${task.i}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#9aabc4;font-size:7.5pt">${task.f}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${color};font-weight:600;font-size:7.5pt">${task.p}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${color};font-size:7.5pt">${statusLabel}</td></tr>`}).join('')
    const fasesHTML=tr.faseNames.map((n,i)=>{const p=FASES_PCT[i],c=FASES_C[i];const color=c==='done'?'#22c55e':c==='prog'?'#3b82f6':'#2a3650';const textColor=c==='done'?'#22c55e':c==='prog'?'#60a5fa':'#5a6a84';return `<div style="margin-bottom:3.5mm"><div style="display:flex;justify-content:space-between;font-size:9pt;margin-bottom:2mm"><span style="color:#e8edf5">${n}</span><span style="color:${textColor};font-weight:700">${p}% — ${tr.faseStatus[i]}</span></div><div style="background:#222d42;border-radius:1mm;height:4mm"><div style="background:${color};width:${p}%;height:4mm;border-radius:1mm"></div></div></div>`}).join('')
    const kpisHTML=tr.kpiLabels.map((l,i)=>{const vals=['14','6','3','5','9','3'];return `<div style="background:#1a2235;padding:4mm 5mm;border-radius:2mm"><div style="color:#5a6a84;font-size:7pt;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1.5mm">${l}</div><div style="color:#e8edf5;font-size:22pt;font-weight:800;line-height:1">${vals[i]}</div></div>`}).join('')
    const curveTableRows=CURVE.map((d,i)=>{const period=lang==='pt'?d.m:d.me;const dev=d.exec!==null?d.exec-d.plan:null;const devColor=dev===null?'#5a6a84':dev<0?'#f87171':dev>0?'#22c55e':'#9aabc4';const statusText=tr.curvaStatus[i];const statusColor=d.exec===null?'#5a6a84':dev!==null&&dev<=-2?'#f87171':dev!==null&&dev>=2?'#22c55e':'#60a5fa';return `<tr style="background:${i%2===0?'#111827':'transparent'}"><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#e8edf5;font-size:8pt;font-weight:600">${period}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:#60a5fa;font-size:8pt">${d.plan}%</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${d.exec!==null?'#22c55e':'#5a6a84'};font-size:8pt">${d.exec!==null?d.exec+'%':'—'}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${devColor};font-size:8pt;font-weight:600">${dev!==null?(dev>=0?'+':'')+dev+'%':'—'}</td><td style="padding:2.5mm 2mm;border-bottom:1px solid #1e293b;color:${statusColor};font-size:8pt">${statusText}</td></tr>`}).join('')
    const fieldsData=[[tr.pdfResp,'Eng. Carlos Souza'],[tr.pdfStart,lang==='pt'?'01/02/2025':'02/01/2025'],[tr.pdfEnd,lang==='pt'?'30/09/2025':'09/30/2025']]
    const fieldsHTML=fieldsData.map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:3.5mm 0;border-bottom:1px solid #1e293b"><span style="color:#9aabc4;font-size:10pt">${l}</span><span style="color:#e8edf5;font-weight:600;font-size:10pt">${v}</span></div>`).join('')
    const html=`<!DOCTYPE html><html lang="${lang==='pt'?'pt-BR':'en-US'}"><head><meta charset="UTF-8"><title>Chronos PM — ${lang==='pt'?'Relatório':'Report'} ${activeProject.code}</title><style>@page{size:A4 landscape;margin:12mm 15mm}@media print{.noprint{display:none!important}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.pb{page-break-before:always}}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#0b0f1a;color:#e8edf5;font-size:9pt}.page{background:#0b0f1a}.cover{page-break-after:always;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15mm 30mm;background:#0b0f1a}.ph{background:#111827;padding:3mm 0;margin-bottom:5mm;border-bottom:1px solid #2a3650;display:flex;justify-content:space-between;align-items:center}h1{font-size:14pt;font-weight:800;color:#e8edf5;margin:5mm 0 3mm;border-bottom:1px solid #3b82f6;padding-bottom:2mm}h2{font-size:11pt;font-weight:700;color:#e8edf5;margin:4mm 0 2.5mm}h3{font-size:10pt;font-weight:700;color:#e8edf5;margin:3mm 0 2mm}table{width:100%;border-collapse:collapse}th{background:#1e293b;color:#9aabc4;text-align:left;padding:2.5mm 2mm;font-size:7pt;text-transform:uppercase;letter-spacing:.4px}p{color:#9aabc4;font-size:9pt;line-height:1.7}</style></head><body><div class="cover"><div style="background:#111827;border:1px solid #3b82f6;border-radius:4mm;padding:14mm 20mm;width:100%;max-width:230mm"><p style="color:#9aabc4;font-size:7.5pt;letter-spacing:2px;text-transform:uppercase;margin-bottom:8mm">${tr.pdfTag}</p><div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10mm"><div><h1 style="font-size:24pt;border:none;margin:0 0 3mm">${projectName}</h1><p style="color:#9aabc4;font-size:11pt">${activeProject.code}</p></div><div style="text-align:right"><div style="color:#5a6a84;font-size:8pt;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1mm">${tr.pdfAvancoLabel}</div><div style="color:#22c55e;font-size:36pt;font-weight:800;line-height:1">${activeProject.progress}%</div><div style="color:#60a5fa;font-size:10pt;font-weight:600;margin-top:2mm">${tr.pdfStatus}</div></div></div><div style="border-top:1px solid #2a3650">${fieldsHTML}<div style="display:flex;justify-content:space-between;padding:3mm 0"><span style="color:#9aabc4;font-size:9pt">Status</span><span style="color:#60a5fa;font-weight:600;font-size:9pt">${tr.pdfStatus}</span></div></div></div><p style="color:#5a6a84;font-size:7.5pt;margin-top:8mm">${tr.pdfFooter}: ${date} · ${tr.pdfConf}</p></div><div class="page"><div class="ph"><span style="color:#9aabc4;font-size:8pt;font-weight:700">${activeProject.code} · ${projectName}</span><span style="color:#5a6a84;font-size:7.5pt">${tr.pg} 2 ${tr.de} 4 · ${date}</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm"><div><h1 style="margin-top:0">${tr.pdfResume}</h1><div style="background:#0d1829;border-left:3px solid #3b82f6;padding:4mm 5mm;margin-bottom:5mm;border-radius:0 2mm 2mm 0"><p>${tr.pdfResumeText}</p></div><h2>${tr.pdfKpis}</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3mm">${kpisHTML}</div></div><div><h1 style="margin-top:0">${tr.pdfFases}</h1><div>${fasesHTML}</div></div></div></div><div class="page pb"><div class="ph"><span style="color:#9aabc4;font-size:8pt;font-weight:700">${activeProject.code} · ${projectName}</span><span style="color:#5a6a84;font-size:7.5pt">${tr.pg} 3 ${tr.de} 4 · ${date}</span></div><h1 style="margin-top:0">${tr.pdfCurvaS}</h1><div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm"><div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:4mm">${tr.curvaKpis.map((l,i)=>`<div style="background:#1a2235;padding:3mm 4mm;border-radius:2mm"><div style="color:#5a6a84;font-size:6.5pt;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1.5mm">${l}</div><div style="color:${i===0?'#60a5fa':'#f87171'};font-size:14pt;font-weight:800;line-height:1">${tr.curvaVals[i]}</div></div>`).join('')}</div><h3>${tr.pdfDetMensal}</h3><table style="margin-top:2mm"><thead><tr>${tr.tblCols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${curveTableRows}</tbody></table><div style="margin-top:4mm;background:#2d1a1a;border-left:3px solid #ef4444;padding:3mm 4mm;border-radius:0 2mm 2mm 0"><p style="color:#fca5a5;font-size:8pt">${tr.pdfAlert}</p></div></div><div><h3 style="margin-bottom:3mm">${tr.pdfGrafico}</h3><div style="background:#0d1829;border-radius:3mm;padding:4mm;border:1px solid #1e293b">${svgCurve}</div></div></div></div><div class="page pb"><div class="ph"><span style="color:#9aabc4;font-size:8pt;font-weight:700">${activeProject.code} · ${projectName}</span><span style="color:#5a6a84;font-size:7.5pt">${tr.pg} 4 ${tr.de} 4 · ${date}</span></div><h1 style="margin-top:0">${tr.pdfTabela}</h1><table><thead><tr>${tr.tblTask.map((c,i)=>`<th style="width:${[35,18,9,9,7,22][i]}%">${c}</th>`).join('')}</tr></thead><tbody>${tasksHTML}</tbody></table><p style="margin-top:8mm;color:#5a6a84;font-size:7.5pt;text-align:center">Chronos PM · BD7D Solutions · ${date} · ${activeProject.code}</p></div><div class="noprint" style="position:fixed;bottom:20px;right:20px;display:flex;gap:10px;z-index:999"><button onclick="window.print()" style="background:#3b82f6;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,.4)">🖨 ${lang==='pt'?'Salvar como PDF (⌘+P)':'Save as PDF (⌘+P)'}</button><button onclick="window.close()" style="background:#1e293b;color:#9aabc4;border:1px solid #2a3650;padding:12px 16px;border-radius:8px;font-size:14px;cursor:pointer">✕</button></div></body></html>`
    const blob=new Blob([html],{type:'text/html;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const win=window.open(url,'_blank')
    if(!win) alert(lang==='pt'?'Permita popups para localhost:3000.':'Allow popups for localhost:3000.')
    setTimeout(()=>URL.revokeObjectURL(url),5000)
    setGenerating(false)
  }

  const fields = [
    ['Projeto', lang==='pt' ? activeProject.name : activeProject.nameEn],
    ['Código', activeProject.code],
    [lang==='pt'?'Responsável':'Manager', activeProject.manager],
    [lang==='pt'?'Início':'Start', lang==='pt'?'01/02/2025':'02/01/2025'],
    [lang==='pt'?'Término':'End', lang==='pt'?'30/09/2025':'09/30/2025'],
    [lang==='pt'?'Avanço':'Progress', `${activeProject.progress}%`],
    ['Status', lang==='pt'?'Em Andamento':'In Progress'],
  ]

  return (
    <div style={{maxWidth:760,display:'flex',flexDirection:'column',gap:20}}>
      <div>
        <h1 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)'}}>{tr.title}</h1>
        <p style={{fontSize:13,color:'var(--text3)',marginTop:4}}>{tr.subtitle}</p>
      </div>
      <div className="alert alert-info">ℹ️ &nbsp;{tr.info}</div>

      {/* Cards superiores */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card">
          <div className="card-header"><h2 className="card-title">{tr.content}</h2></div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
            {tr.pages.map(i=><span key={i} style={{fontSize:13,color:'var(--text2)'}}>{i}</span>)}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2 className="card-title">{tr.projectData}</h2></div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
            {fields.map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:11,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.3px'}}>{l}</span>
                <span style={{fontSize:13,color:l==='Avanço'||l==='Progress'?'#4ade80':'var(--text)',fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botão PDF */}
      <div className="card">
        <div className="card-body" style={{textAlign:'center',padding:32,display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <div style={{fontSize:48,opacity:0.3}}>📄</div>
          <div>
            <h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,color:'var(--text)',marginBottom:6}}>{tr.btnTitle}</h2>
            <p style={{color:'var(--text3)',maxWidth:480,margin:'0 auto',fontSize:13}}>{tr.btnDesc}</p>
          </div>
          <button onClick={openReport} disabled={generating} className="btn btn-primary" style={{padding:'12px 32px',fontSize:14}}>
            {generating?tr.btnGenerating:tr.btnGenerate}
          </button>
          <p style={{fontSize:11,color:'var(--text3)'}}>{tr.hint}</p>
        </div>
      </div>

      {/* Formulário de Email */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📧 {tr.emailTitle}</h2>
        </div>
        <div className="card-body" style={{display:'flex',flexDirection:'column',gap:14}}>
          <p style={{fontSize:13,color:'var(--text3)'}}>{tr.emailDesc}</p>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {/* Destinatários */}
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6}}>
                {tr.emailTo}
              </label>
              <input
                className="form-control"
                placeholder={tr.emailToPlaceholder}
                value={emailTo}
                onChange={e=>{ setEmailTo(e.target.value); setEmailStatus('idle') }}
                style={{width:'100%',fontSize:13}}
              />
            </div>

            {/* Assunto */}
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6}}>
                {tr.emailSubject}
              </label>
              <input
                className="form-control"
                placeholder={`${tr.emailSubjectDefault} — ${activeProject.code}`}
                value={emailSubject}
                onChange={e=>setEmailSubject(e.target.value)}
                style={{width:'100%',fontSize:13}}
              />
            </div>

            {/* Remetente */}
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6}}>
                {tr.emailSender}
              </label>
              <input
                className="form-control"
                placeholder={tr.emailSenderPlaceholder}
                value={senderName}
                onChange={e=>setSenderName(e.target.value)}
                style={{width:'100%',fontSize:13}}
              />
            </div>
          </div>

          {/* Nota */}
          <p style={{fontSize:12,color:'var(--text3)',background:'var(--surface2)',padding:'10px 14px',borderRadius:8,border:'1px solid var(--border)'}}>
            💡 {tr.emailNote}
          </p>

          {/* Status feedback */}
          {emailStatus!=='idle' && (
            <div style={{
              padding:'10px 14px',borderRadius:8,fontSize:13,fontWeight:500,
              background: emailStatus==='success'?'rgba(34,197,94,0.1)':emailStatus==='error'?'rgba(239,68,68,0.1)':'rgba(59,130,246,0.1)',
              border: `1px solid ${emailStatus==='success'?'rgba(34,197,94,0.3)':emailStatus==='error'?'rgba(239,68,68,0.3)':'rgba(59,130,246,0.3)'}`,
              color: emailStatus==='success'?'#4ade80':emailStatus==='error'?'#f87171':'#93c5fd',
            }}>
              {emailStatus==='sending'
                ? (lang==='pt'?'⏳ Enviando email...':'⏳ Sending email...')
                : emailMsg
              }
            </div>
          )}

          {/* Botão enviar */}
          <button
            onClick={sendEmail}
            disabled={emailStatus==='sending'}
            className="btn btn-primary"
            style={{alignSelf:'flex-start',padding:'11px 28px',fontSize:14}}
          >
            {emailStatus==='sending' ? tr.emailSending : tr.emailSend}
          </button>
        </div>
      </div>
    </div>
  )
}
