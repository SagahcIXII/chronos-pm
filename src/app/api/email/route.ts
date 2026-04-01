import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to, subject, projectCode, projectName, senderName, lang } = body

    if (!to || (Array.isArray(to) && to.length === 0)) {
      return NextResponse.json({ error: 'Informe pelo menos um destinatário.' }, { status: 400 })
    }

    const recipients = Array.isArray(to) ? to.join(', ') : to
    const isEN = lang === 'en'
    const date = new Date().toLocaleDateString(isEN ? 'en-US' : 'pt-BR')

    // ── Curva S como gráfico de barras HTML (compatível com Gmail) ──
    const CURVE = [
      { m:'Fev/25', me:'Feb/25', plan:8,   exec:9    },
      { m:'Mar/25', me:'Mar/25', plan:15,  exec:16   },
      { m:'Abr/25', me:'Apr/25', plan:25,  exec:26   },
      { m:'Mai/25', me:'May/25', plan:37,  exec:35   },
      { m:'Jun/25', me:'Jun/25', plan:52,  exec:null },
      { m:'Jul/25', me:'Jul/25', plan:65,  exec:null },
      { m:'Ago/25', me:'Aug/25', plan:80,  exec:null },
      { m:'Set/25', me:'Sep/25', plan:95,  exec:null },
      { m:'Out/25', me:'Oct/25', plan:100, exec:null },
    ]

    // Gráfico de barras verticais — 100% compatível com Gmail
    const barChartHTML = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;table-layout:fixed">
      <tr>
        <td style="padding:0 8px 16px;font-size:12px;font-weight:700;color:#334155;text-align:center" colspan="${CURVE.length}">
          ${isEN ? 'S-Curve — Cumulative Physical Progress (%)' : 'Curva S — Avanço Físico Acumulado (%)'}
        </td>
      </tr>
      <tr valign="bottom" style="height:120px">
        ${CURVE.map(d => {
          const planH = Math.round((d.plan / 100) * 110)
          const execH = d.exec !== null ? Math.round(((d.exec as number) / 100) * 110) : 0
          const dev = d.exec !== null ? (d.exec as number) - d.plan : null
          const isToday = d.m === 'Mai/25'
          return `
          <td style="padding:0 3px;text-align:center;vertical-align:bottom;position:relative">
            ${isToday ? `<div style="font-size:9px;color:#ef4444;font-weight:700;margin-bottom:2px">${isEN?'TODAY':'HOJE'}</div>` : ''}
            <div style="display:inline-block;position:relative;width:100%;min-width:28px">
              <!-- Barra planejado -->
              <div style="background:#bfdbfe;height:${planH}px;border-radius:3px 3px 0 0;margin-bottom:1px;position:relative">
                <div style="position:absolute;top:-16px;left:0;right:0;text-align:center;font-size:9px;color:#1e40af;font-weight:700">${d.plan}%</div>
              </div>
              ${d.exec !== null ? `
              <!-- Barra executado -->
              <div style="background:${dev !== null && dev < 0 ? '#fca5a5' : '#86efac'};height:${execH}px;border-radius:3px 3px 0 0;margin-top:-${planH+1}px;opacity:0.85;border:2px solid ${dev !== null && dev < 0 ? '#ef4444' : '#22c55e'}">
              </div>` : ''}
            </div>
          </td>`
        }).join('')}
      </tr>
      <tr style="border-top:2px solid #cbd5e1">
        ${CURVE.map(d => {
          const isToday = d.m === 'Mai/25'
          return `<td style="padding:4px 2px 0;text-align:center;font-size:9px;color:${isToday?'#ef4444':'#64748b'};font-weight:${isToday?'700':'400'}">${isEN?d.me:d.m}</td>`
        }).join('')}
      </tr>
      <tr>
        <td colspan="${CURVE.length}" style="padding:12px 8px 4px;text-align:center">
          <span style="display:inline-block;width:12px;height:12px;background:#bfdbfe;border-radius:2px;margin-right:4px;vertical-align:middle"></span>
          <span style="font-size:11px;color:#64748b;margin-right:12px">${isEN?'Planned':'Planejado'}</span>
          <span style="display:inline-block;width:12px;height:12px;background:#86efac;border-radius:2px;margin-right:4px;vertical-align:middle"></span>
          <span style="font-size:11px;color:#64748b;margin-right:12px">${isEN?'Executed (on track)':'Executado (no prazo)'}</span>
          <span style="display:inline-block;width:12px;height:12px;background:#fca5a5;border-radius:2px;margin-right:4px;vertical-align:middle"></span>
          <span style="font-size:11px;color:#64748b">${isEN?'Executed (delayed)':'Executado (atrasado)'}</span>
        </td>
      </tr>
    </table>`

    // ── Linha do tempo visual da Curva S ──────────────────
    const timelineHTML = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px">
      <tr>
        <th style="padding:7px 10px;text-align:left;background:#f1f5f9;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${isEN?'Period':'Período'}</th>
        <th style="padding:7px 10px;text-align:center;background:#f1f5f9;color:#3b82f6;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${isEN?'Planned':'Planejado'}</th>
        <th style="padding:7px 10px;text-align:center;background:#f1f5f9;color:#22c55e;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${isEN?'Executed':'Executado'}</th>
        <th style="padding:7px 10px;text-align:center;background:#f1f5f9;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${isEN?'Deviation':'Desvio'}</th>
        <th style="padding:7px 10px;text-align:center;background:#f1f5f9;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${isEN?'Progress Bar':'Barra'}</th>
      </tr>
      ${CURVE.map((d, i) => {
        const dev = d.exec !== null ? (d.exec as number) - d.plan : null
        const devColor = dev === null ? '#94a3b8' : dev < 0 ? '#ef4444' : '#22c55e'
        const execColor = d.exec !== null ? (dev !== null && dev < 0 ? '#ef4444' : '#22c55e') : '#94a3b8'
        const planBarW = d.plan
        const execBarW = d.exec !== null ? (d.exec as number) : 0
        const rowBg = i % 2 === 0 ? '#f8fafc' : '#ffffff'
        const isToday = d.m === 'Mai/25'
        return `
        <tr style="background:${isToday?'#fefce8':rowBg}">
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:${isToday?'700':'500'};color:${isToday?'#d97706':'#334155'}">
            ${isEN?d.me:d.m}${isToday?` ◀ ${isEN?'Today':'Hoje'}`:''}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;color:#3b82f6;font-weight:600">${d.plan}%</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;color:${execColor};font-weight:600">${d.exec !== null ? d.exec+'%' : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;color:${devColor};font-weight:700">${dev !== null ? (dev >= 0 ? '+' : '') + dev + '%' : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="background:#e2e8f0;border-radius:3px;height:6px;padding:0">
                <div style="background:#3b82f6;width:${planBarW}%;height:6px;border-radius:3px;min-width:2px"></div>
              </td>
            </tr></table>
            ${d.exec !== null ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:2px"><tr>
              <td style="background:#e2e8f0;border-radius:3px;height:6px;padding:0">
                <div style="background:${execColor};width:${execBarW}%;height:6px;border-radius:3px;min-width:2px"></div>
              </td>
            </tr></table>` : ''}
          </td>
        </tr>`
      }).join('')}
    </table>`

    // ── Atividades em andamento ───────────────────────────
    const ACTIVE_TASKS = [
      { name: isEN?'3.2 Steel Structure':'3.2 Estrutura metálica',      resp:'Metalcon',       progress:70, dueDate:isEN?'05/30/2025':'30/05/2025', critical:true  },
      { name: isEN?'4.2 LV Distribution':'4.2 Distribuição BT',         resp:'Elétrica Norte', progress:40, dueDate:isEN?'06/30/2025':'30/06/2025', critical:true  },
      { name: isEN?'3. Civil Infrastructure':'3. Infra. Civil',          resp:'Eng. Pedro',     progress:58, dueDate:isEN?'06/30/2025':'30/06/2025', critical:true  },
      { name: isEN?'4. Electrical Infrastructure':'4. Infra. Elétrica',  resp:'Eng. Ana',       progress:35, dueDate:isEN?'07/31/2025':'31/07/2025', critical:false },
    ]

    const activeTasksHTML = ACTIVE_TASKS.map((task, i) => {
      const barColor = task.progress >= 70 ? '#22c55e' : task.progress >= 40 ? '#3b82f6' : '#f59e0b'
      const rowBg = i % 2 === 0 ? '#f8fafc' : '#ffffff'
      return `
      <tr style="background:${rowBg}">
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:6px;font-size:14px">${task.critical ? '⚡' : '●'}</td>
            <td style="font-size:13px;font-weight:500;color:#1e293b">${task.name}</td>
          </tr></table>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px">${task.resp}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;min-width:100px">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="background:#e2e8f0;border-radius:3px;height:8px;padding:0;width:70%">
              <div style="background:${barColor};width:${task.progress}%;height:8px;border-radius:3px"></div>
            </td>
            <td style="padding-left:8px;font-size:12px;font-weight:700;color:${barColor};white-space:nowrap">${task.progress}%</td>
          </tr></table>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px;white-space:nowrap">${task.dueDate}</td>
      </tr>`
    }).join('')

    const emailHtml = `
<!DOCTYPE html>
<html lang="${isEN ? 'en' : 'pt-BR'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9">
<tr><td align="center" style="padding:24px 16px">
<table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%">

  <!-- Header -->
  <tr>
    <td style="background:#0f172a;border-radius:12px 12px 0 0;padding:22px 28px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="font-size:20px;font-weight:800;color:#f8fafc">Chronos PM</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-top:2px">BD7D Solutions Engenharia</div>
        </td>
        <td align="right">
          <span style="background:#1e40af;color:#bfdbfe;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:600">
            ${isEN ? 'Schedule Report' : 'Relatório de Cronograma'}
          </span>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:28px">

      <!-- Saudação -->
      <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.7">
        ${isEN
          ? `Hello,<br><br>Find below the executive schedule report for project <strong>${projectName}</strong>, sent by <strong>${senderName || 'BD7D Solutions'}</strong>.`
          : `Olá,<br><br>Segue o relatório executivo de cronograma do projeto <strong>${projectName}</strong>, enviado por <strong>${senderName || 'BD7D Solutions'}</strong>.`
        }
      </p>

      <!-- Card projeto -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;border-left:4px solid #3b82f6;margin-bottom:24px">
        <tr><td style="padding:18px 22px">
          <div style="font-size:11px;color:#3b82f6;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${projectCode}</div>
          <div style="font-size:17px;font-weight:700;color:#0f172a;margin-bottom:14px">${projectName}</div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><span style="font-size:12px;color:#64748b;font-weight:600">${isEN?'Physical Progress':'Avanço Físico'}</span></td>
            <td align="right"><span style="font-size:20px;font-weight:800;color:#22c55e">42%</span></td>
          </tr></table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 14px"><tr>
            <td style="background:#e2e8f0;border-radius:4px;height:8px;padding:0">
              <div style="background:linear-gradient(90deg,#3b82f6,#22c55e);width:42%;height:8px;border-radius:4px"></div>
            </td>
          </tr></table>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="width:25%;padding-right:8px">
              <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${isEN?'Manager':'Responsável'}</div>
              <div style="font-size:13px;color:#334155;font-weight:500;margin-top:2px">${senderName||'Eng. Carlos Souza'}</div>
            </td>
            <td style="width:25%;padding-right:8px">
              <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Status</div>
              <div style="font-size:13px;color:#3b82f6;font-weight:600;margin-top:2px">${isEN?'In Progress':'Em Andamento'}</div>
            </td>
            <td style="width:25%;padding-right:8px">
              <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${isEN?'Start':'Início'}</div>
              <div style="font-size:13px;color:#334155;font-weight:500;margin-top:2px">${isEN?'02/01/2025':'01/02/2025'}</div>
            </td>
            <td style="width:25%">
              <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${isEN?'Planned End':'Término'}</div>
              <div style="font-size:13px;color:#334155;font-weight:500;margin-top:2px">${isEN?'09/30/2025':'30/09/2025'}</div>
            </td>
          </tr></table>
        </td></tr>
      </table>

      <!-- KPIs -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
        <tr>
          ${[
            [isEN?'Tasks':'Tarefas',    '14', '#1e293b'],
            [isEN?'Done':'Concluídas',  '6',  '#22c55e'],
            [isEN?'Active':'Andamento', '3',  '#3b82f6'],
            [isEN?'Deviation':'Desvio', '-3%','#ef4444'],
          ].map(([l,v,c],i)=>`
          <td style="padding:${i>0?'0 0 0 10px':'0'};width:25%">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${l}</div>
              </td>
            </tr></table>
          </td>`).join('')}
        </tr>
      </table>

      <!-- CURVA S título -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
        <tr>
          <td style="width:3px;background:#3b82f6;border-radius:2px;padding:0">&nbsp;</td>
          <td style="padding-left:10px;font-size:14px;font-weight:700;color:#0f172a">
            ${isEN?'S-Curve — Cumulative Physical Progress':'Curva S — Avanço Físico Acumulado'}
          </td>
        </tr>
      </table>

      <!-- Alerta desvio -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px">
        <tr>
          <td style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;padding-right:8px">⚠️</td>
              <td style="font-size:12px;color:#dc2626;font-weight:500">
                ${isEN
                  ? 'Project is 2% behind schedule from May/2025. Planned: 37% vs. Executed: 35%.'
                  : 'Projeto com desvio de -2% a partir de mai/2025. Planejado: 37% vs. Executado: 35%.'}
              </td>
            </tr></table>
          </td>
        </tr>
      </table>

      <!-- Gráfico de barras Curva S (tabela HTML) -->
      ${barChartHTML}

      <!-- Tabela de dados Curva S -->
      <div style="margin-top:14px;margin-bottom:28px">
        ${timelineHTML}
      </div>

      <!-- ATIVIDADES EM ANDAMENTO título -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
        <tr>
          <td style="width:3px;background:#22c55e;border-radius:2px;padding:0">&nbsp;</td>
          <td style="padding-left:10px">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;font-weight:700;color:#0f172a;padding-right:10px">
                ${isEN?'Active Tasks':'Atividades em Andamento'}
              </td>
              <td style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px">
                3 ${isEN?'tasks':'tarefas'}
              </td>
            </tr></table>
          </td>
        </tr>
      </table>

      <!-- Alerta crítico -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
        <tr>
          <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;padding-right:8px">⚡</td>
              <td style="font-size:12px;color:#92400e;font-weight:500">
                ${isEN
                  ? '2 critical tasks require immediate attention to avoid schedule delays.'
                  : '2 tarefas críticas requerem atenção imediata para evitar atrasos no cronograma.'}
              </td>
            </tr></table>
          </td>
        </tr>
      </table>

      <!-- Tabela atividades -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
        <tr style="background:#f1f5f9">
          <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${isEN?'Task':'Tarefa'}</th>
          <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${isEN?'Responsible':'Responsável'}</th>
          <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${isEN?'Progress':'Progresso'}</th>
          <th style="padding:8px 12px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${isEN?'Due Date':'Término Plan.'}</th>
        </tr>
        ${activeTasksHTML}
      </table>

      <!-- Avanço por fase -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
        <tr>
          <td style="width:3px;background:#a855f7;border-radius:2px;padding:0">&nbsp;</td>
          <td style="padding-left:10px;font-size:14px;font-weight:700;color:#0f172a;padding-bottom:14px">
            ${isEN?'Phase Progress':'Avanço por Fase'}
          </td>
        </tr>
        ${[
          [isEN?'1. Planning':'1. Planejamento',             100,'#22c55e',isEN?'Completed':'Concluída'],
          [isEN?'2. Mobilization':'2. Mobilização',          100,'#22c55e',isEN?'Completed':'Concluída'],
          [isEN?'3. Civil Infrastructure':'3. Infra. Civil',  58,'#3b82f6',isEN?'In Progress':'Em Andamento'],
          [isEN?'4. Electrical Infra.':'4. Infra. Elétrica',  35,'#3b82f6',isEN?'In Progress':'Em Andamento'],
          [isEN?'5. Automation':'5. Automação',                0,'#94a3b8',isEN?'Not Started':'Não Iniciada'],
        ].map(([n,p,c,s])=>`
        <tr>
          <td colspan="2" style="padding:0 0 10px 13px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#334155;font-weight:500">${n}</td>
                <td align="right">
                  <span style="font-size:12px;font-weight:700;color:${c};margin-right:8px">${p}%</span>
                  <span style="font-size:11px;color:${c};background:${c}18;padding:2px 8px;border-radius:4px">${s}</span>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:5px"><tr>
              <td style="background:#e2e8f0;border-radius:3px;height:6px;padding:0">
                <div style="background:${c};width:${p}%;height:6px;border-radius:3px;min-width:${Number(p)>0?'4':'0'}px"></div>
              </td>
            </tr></table>
          </td>
        </tr>`).join('')}
      </table>

      <!-- Nota -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;text-align:center">
            <p style="font-size:12px;color:#1e40af;margin:0">
              📋 ${isEN
                ? 'For the full report with Gantt chart and complete task table, access Chronos PM.'
                : 'Para o relatório completo com Gantt e tabela de tarefas, acesse o Chronos PM.'}
            </p>
          </td>
        </tr>
      </table>

      <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:16px;margin-bottom:0">
        ${isEN
          ? `Sent automatically by Chronos PM on ${date}.`
          : `Enviado automaticamente pelo Chronos PM em ${date}.`
        }
      </p>

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#0f172a;border-radius:0 0 12px 12px;padding:18px 28px;text-align:center">
      <div style="font-size:13px;color:#94a3b8;font-weight:600;margin-bottom:4px">Chronos PM · BD7D Solutions Engenharia LTDA</div>
      <div style="font-size:11px;color:#475569;line-height:1.8">
        ${isEN
          ? 'Professional schedule management · Manaus, Amazonas, Brazil'
          : 'Gestão profissional de cronograma · Manaus, Amazonas, Brasil'
        }
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `Chronos PM <${process.env.EMAIL_USER}>`,
      to: recipients,
      subject: subject || `${isEN?'Schedule Report':'Relatório de Cronograma'} — ${projectCode}`,
      html: emailHtml,
    })

    return NextResponse.json({ success: true, message: `Email enviado para ${recipients}` })
  } catch (error: any) {
    console.error('Erro ao enviar email:', error)
    return NextResponse.json(
      { error: 'Falha ao enviar email', detail: error.message },
      { status: 500 }
    )
  }
}
