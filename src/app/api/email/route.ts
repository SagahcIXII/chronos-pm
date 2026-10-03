// src/app/api/email/route.ts
// Envia o relatório executivo do projeto por e-mail, com dados REAIS do banco
// (mesmas fórmulas do Dashboard / Relatório PDF via '@/lib/progress').
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser, assertProjectAccess, accessErrorResponse } from '@/lib/access'
import { projectProgress, buildMonthlyCurve, workItems } from '@/lib/progress'
import { buildOrderedTasks } from '@/lib/taskTree'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

const EmailSchema = z.object({
  projectId: z.string().min(1),
  to: z.union([z.string(), z.array(z.string())]),
  subject: z.string().max(200).optional(),
  senderName: z.string().max(120).optional(),
  lang: z.enum(['pt', 'en']).default('pt'),
  // Data de referência do relatório ('YYYY-MM-DD', fuso local do usuário).
  refDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const MAX_RECIPIENTS = 20
const MAX_ACTIVE_TASKS = 10

/** Escapa texto do usuário/banco antes de inserir no HTML do e-mail. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const STATUS = {
  pt: { COMPLETED: 'Concluída', IN_PROGRESS: 'Em Andamento', NOT_STARTED: 'Não Iniciada', ON_HOLD: 'Em Espera', DELAYED: 'Atrasada', PLANNING: 'Planejamento', CANCELLED: 'Cancelado' },
  en: { COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', NOT_STARTED: 'Not Started', ON_HOLD: 'On Hold', DELAYED: 'Delayed', PLANNING: 'Planning', CANCELLED: 'Cancelled' },
} as const

export async function POST(req: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }

  const parsed = EmailSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.errors }, { status: 422 })
  }
  const { projectId, subject, senderName, lang } = parsed.data
  const isEN = lang === 'en'

  const recipients = (Array.isArray(parsed.data.to) ? parsed.data.to : parsed.data.to.split(','))
    .map(e => e.trim()).filter(Boolean)
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Informe pelo menos um destinatário.' }, { status: 400 })
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `Máximo de ${MAX_RECIPIENTS} destinatários.` }, { status: 400 })
  }
  const invalid = recipients.filter(e => !z.string().email().safeParse(e).success)
  if (invalid.length) {
    return NextResponse.json({ error: `E-mail inválido: ${invalid.join(', ')}` }, { status: 400 })
  }

  // Só envia relatório de projeto que o usuário pode ver.
  let project
  try {
    project = await assertProjectAccess(projectId, user)
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }

  try {
    const tasks = await prisma.task.findMany({ where: { projectId } })
    const ordered = buildOrderedTasks(tasks)
    const leaves = workItems(ordered)

    // ── Datas ────────────────────────────────────────────
    const refISO = parsed.data.refDate ?? new Date().toISOString().slice(0, 10)
    const pStart = project.startDate.toISOString().slice(0, 10)
    const pEnd = project.endDate.toISOString().slice(0, 10)
    const fmtDate = (d: Date | string | null | undefined) => {
      if (!d) return '—'
      const [y, m, day] = (typeof d === 'string' ? d : d.toISOString()).slice(0, 10).split('-')
      return isEN ? `${m}/${day}/${y}` : `${day}/${m}/${y}`
    }
    const statusLabel = (s: string) => (STATUS[lang] as Record<string, string>)[s] ?? s
    const isDelayed = (t: { status: string; plannedEnd: Date | null }) =>
      t.status !== 'COMPLETED' && !!t.plannedEnd && t.plannedEnd.toISOString().slice(0, 10) < refISO

    // ── Indicadores ──────────────────────────────────────
    const progress = projectProgress(tasks)
    const completedCount = leaves.filter(t => t.status === 'COMPLETED').length
    const activeAll = leaves.filter(t => t.status === 'IN_PROGRESS')
    const activeTasks = activeAll.slice(0, MAX_ACTIVE_TASKS)
    const attention = activeAll.filter(t => t.isCritical || isDelayed(t)).length

    const curve = buildMonthlyCurve(tasks, pStart, pEnd, refISO, lang)
    const current = curve.find(r => r.isCurrent) ?? [...curve].reverse().find(r => r.executedCumulative !== null)
    const planVal = current?.plannedCumulative ?? 0
    const execVal = current?.executedCumulative ?? 0
    const deviation = execVal - planVal
    const devText = `${deviation >= 0 ? '+' : ''}${deviation}%`
    const phases = ordered.filter(t => t.isGroup && t.parentId === null)

    const date = fmtDate(refISO)
    const projectName = esc(project.name)
    const projectCode = esc(project.code)
    const sender = esc(senderName || project.responsible || 'Chronos PM')
    const finalSubject = subject?.trim() || `${isEN ? 'Schedule Report' : 'Relatório de Cronograma'} — ${project.code}`

    // ── Curva S: gráfico de barras em tabela HTML (compatível com Gmail) ──
    const barChartHTML = curve.length === 0 ? '' : `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;table-layout:fixed">
      <tr>
        <td style="padding:0 8px 16px;font-size:12px;font-weight:700;color:#334155;text-align:center" colspan="${curve.length}">
          ${isEN ? 'S-Curve — Cumulative Physical Progress (%)' : 'Curva S — Avanço Físico Acumulado (%)'}
        </td>
      </tr>
      <tr valign="bottom" style="height:120px">
        ${curve.map(d => {
          const planH = Math.round((d.plannedCumulative / 100) * 110)
          const execH = d.executedCumulative !== null ? Math.round((d.executedCumulative / 100) * 110) : 0
          const behind = d.deviation !== null && d.deviation < 0
          return `
          <td style="padding:0 3px;text-align:center;vertical-align:bottom;position:relative">
            ${d.isCurrent ? `<div style="font-size:9px;color:#ef4444;font-weight:700;margin-bottom:2px">${isEN ? 'TODAY' : 'HOJE'}</div>` : ''}
            <div style="display:inline-block;position:relative;width:100%;min-width:20px">
              <div style="background:#bfdbfe;height:${planH}px;border-radius:3px 3px 0 0;margin-bottom:1px;position:relative">
                <div style="position:absolute;top:-16px;left:0;right:0;text-align:center;font-size:9px;color:#1e40af;font-weight:700">${d.plannedCumulative}%</div>
              </div>
              ${d.executedCumulative !== null ? `
              <div style="background:${behind ? '#fca5a5' : '#86efac'};height:${execH}px;border-radius:3px 3px 0 0;margin-top:-${planH + 1}px;opacity:0.85;border:2px solid ${behind ? '#ef4444' : '#22c55e'}"></div>` : ''}
            </div>
          </td>`
        }).join('')}
      </tr>
      <tr style="border-top:2px solid #cbd5e1">
        ${curve.map(d => `<td style="padding:4px 2px 0;text-align:center;font-size:9px;color:${d.isCurrent ? '#ef4444' : '#64748b'};font-weight:${d.isCurrent ? '700' : '400'}">${esc(d.period)}</td>`).join('')}
      </tr>
      <tr>
        <td colspan="${curve.length}" style="padding:12px 8px 4px;text-align:center">
          <span style="display:inline-block;width:12px;height:12px;background:#bfdbfe;border-radius:2px;margin-right:4px;vertical-align:middle"></span>
          <span style="font-size:11px;color:#64748b;margin-right:12px">${isEN ? 'Planned' : 'Planejado'}</span>
          <span style="display:inline-block;width:12px;height:12px;background:#86efac;border-radius:2px;margin-right:4px;vertical-align:middle"></span>
          <span style="font-size:11px;color:#64748b;margin-right:12px">${isEN ? 'Executed (on track)' : 'Executado (no prazo)'}</span>
          <span style="display:inline-block;width:12px;height:12px;background:#fca5a5;border-radius:2px;margin-right:4px;vertical-align:middle"></span>
          <span style="font-size:11px;color:#64748b">${isEN ? 'Executed (delayed)' : 'Executado (atrasado)'}</span>
        </td>
      </tr>
    </table>`

    // ── Curva S: tabela mês a mês ────────────────────────
    const th = (label: string, color: string, align = 'center') =>
      `<th style="padding:7px 10px;text-align:${align};background:#f1f5f9;color:${color};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${label}</th>`
    const timelineHTML = curve.length === 0 ? '' : `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px">
      <tr>
        ${th(isEN ? 'Period' : 'Período', '#64748b', 'left')}
        ${th(isEN ? 'Planned' : 'Planejado', '#3b82f6')}
        ${th(isEN ? 'Executed' : 'Executado', '#22c55e')}
        ${th(isEN ? 'Deviation' : 'Desvio', '#64748b')}
        ${th(isEN ? 'Progress Bar' : 'Barra', '#64748b')}
      </tr>
      ${curve.map((d, i) => {
        const dev = d.deviation
        const devColor = dev === null ? '#94a3b8' : dev < 0 ? '#ef4444' : '#22c55e'
        const execColor = d.executedCumulative !== null ? (dev !== null && dev < 0 ? '#ef4444' : '#22c55e') : '#94a3b8'
        const rowBg = d.isCurrent ? '#fefce8' : i % 2 === 0 ? '#f8fafc' : '#ffffff'
        return `
        <tr style="background:${rowBg}">
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:${d.isCurrent ? '700' : '500'};color:${d.isCurrent ? '#d97706' : '#334155'}">
            ${esc(d.period)}${d.isCurrent ? ` ◀ ${isEN ? 'Today' : 'Hoje'}` : ''}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;color:#3b82f6;font-weight:600">${d.plannedCumulative}%</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;color:${execColor};font-weight:600">${d.executedCumulative !== null ? d.executedCumulative + '%' : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;color:${devColor};font-weight:700">${dev !== null ? (dev >= 0 ? '+' : '') + dev + '%' : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="background:#e2e8f0;border-radius:3px;height:6px;padding:0">
                <div style="background:#3b82f6;width:${d.plannedCumulative}%;height:6px;border-radius:3px;min-width:2px"></div>
              </td>
            </tr></table>
            ${d.executedCumulative !== null ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:2px"><tr>
              <td style="background:#e2e8f0;border-radius:3px;height:6px;padding:0">
                <div style="background:${execColor};width:${d.executedCumulative}%;height:6px;border-radius:3px;min-width:2px"></div>
              </td>
            </tr></table>` : ''}
          </td>
        </tr>`
      }).join('')}
    </table>`

    // ── Atividades em andamento ──────────────────────────
    const activeTasksHTML = activeTasks.length === 0
      ? `<tr><td colspan="4" style="padding:14px 12px;text-align:center;color:#94a3b8;font-size:12px">${isEN ? 'No tasks in progress.' : 'Nenhuma tarefa em andamento.'}</td></tr>`
      : activeTasks.map((task, i) => {
        const delayed = isDelayed(task)
        const barColor = delayed ? '#ef4444' : task.progress >= 70 ? '#22c55e' : task.progress >= 40 ? '#3b82f6' : '#f59e0b'
        const rowBg = i % 2 === 0 ? '#f8fafc' : '#ffffff'
        return `
      <tr style="background:${rowBg}">
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:6px;font-size:14px">${task.isCritical ? '⚡' : '●'}</td>
            <td style="font-size:13px;font-weight:500;color:#1e293b"><span style="color:#94a3b8;font-weight:700;margin-right:4px">${esc(task.wbs)}</span>${esc(task.name)}</td>
          </tr></table>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px">${esc(task.responsible || '—')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;min-width:100px">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="background:#e2e8f0;border-radius:3px;height:8px;padding:0;width:70%">
              <div style="background:${barColor};width:${task.progress}%;height:8px;border-radius:3px"></div>
            </td>
            <td style="padding-left:8px;font-size:12px;font-weight:700;color:${barColor};white-space:nowrap">${task.progress}%</td>
          </tr></table>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${delayed ? '#ef4444' : '#64748b'};font-size:12px;white-space:nowrap">${fmtDate(task.plannedEnd)}</td>
      </tr>`
      }).join('')

    // ── Avanço por fase (grupos de topo) ─────────────────
    const phaseColor = (s: string) => s === 'COMPLETED' ? '#22c55e' : s === 'IN_PROGRESS' ? '#3b82f6' : s === 'DELAYED' ? '#ef4444' : '#94a3b8'
    const phasesHTML = phases.length === 0 ? '' : `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
        <tr>
          <td style="width:3px;background:#a855f7;border-radius:2px;padding:0">&nbsp;</td>
          <td style="padding-left:10px;font-size:14px;font-weight:700;color:#0f172a;padding-bottom:14px">
            ${isEN ? 'Phase Progress' : 'Avanço por Fase'}
          </td>
        </tr>
        ${phases.map(ph => {
          const c = phaseColor(ph.status)
          return `
        <tr>
          <td colspan="2" style="padding:0 0 10px 13px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#334155;font-weight:500"><span style="color:#94a3b8;font-weight:700;margin-right:4px">${esc(ph.wbs)}</span>${esc(ph.name)}</td>
                <td align="right">
                  <span style="font-size:12px;font-weight:700;color:${c};margin-right:8px">${ph.progress}%</span>
                  <span style="font-size:11px;color:${c};background:${c}18;padding:2px 8px;border-radius:4px">${statusLabel(ph.status)}</span>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:5px"><tr>
              <td style="background:#e2e8f0;border-radius:3px;height:6px;padding:0">
                <div style="background:${c};width:${ph.progress}%;height:6px;border-radius:3px;min-width:${ph.progress > 0 ? '4' : '0'}px"></div>
              </td>
            </tr></table>
          </td>
        </tr>`
        }).join('')}
      </table>`

    // ── Alertas ──────────────────────────────────────────
    const deviationAlert = curve.length === 0 ? '' : deviation < 0
      ? `<td style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;padding-right:8px">⚠️</td>
              <td style="font-size:12px;color:#dc2626;font-weight:500">
                ${isEN
                  ? `Project is ${Math.abs(deviation)}% behind schedule as of ${date}. Planned: ${planVal}% vs. Executed: ${execVal}%.`
                  : `Projeto com desvio de ${devText} em ${date}. Planejado: ${planVal}% vs. Executado: ${execVal}%.`}
              </td>
            </tr></table>
          </td>`
      : `<td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;padding-right:8px">✅</td>
              <td style="font-size:12px;color:#15803d;font-weight:500">
                ${isEN
                  ? `Project is on or ahead of schedule as of ${date}. Planned: ${planVal}% vs. Executed: ${execVal}%.`
                  : `Projeto dentro ou acima do planejado em ${date}. Planejado: ${planVal}% vs. Executado: ${execVal}%.`}
              </td>
            </tr></table>
          </td>`

    const attentionAlert = attention === 0 ? '' : `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
        <tr>
          <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;padding-right:8px">⚡</td>
              <td style="font-size:12px;color:#92400e;font-weight:500">
                ${isEN
                  ? `${attention} task(s) in progress are critical or overdue and require attention.`
                  : `${attention} tarefa(s) em andamento crítica(s) ou vencida(s) requerem atenção.`}
              </td>
            </tr></table>
          </td>
        </tr>
      </table>`

    const kpis: [string, string, string][] = [
      [isEN ? 'Tasks' : 'Tarefas', String(leaves.length), '#1e293b'],
      [isEN ? 'Done' : 'Concluídas', String(completedCount), '#22c55e'],
      [isEN ? 'Active' : 'Andamento', String(activeAll.length), '#3b82f6'],
      [isEN ? 'Deviation' : 'Desvio', devText, deviation < 0 ? '#ef4444' : '#22c55e'],
    ]

    const emailHtml = `
<!DOCTYPE html>
<html lang="${isEN ? 'en' : 'pt-BR'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(finalSubject)}</title>
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

      <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.7">
        ${isEN
          ? `Hello,<br><br>Find below the executive schedule report for project <strong>${projectName}</strong>, sent by <strong>${sender}</strong>.`
          : `Olá,<br><br>Segue o relatório executivo de cronograma do projeto <strong>${projectName}</strong>, enviado por <strong>${sender}</strong>.`}
      </p>

      <!-- Card projeto -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;border-left:4px solid #3b82f6;margin-bottom:24px">
        <tr><td style="padding:18px 22px">
          <div style="font-size:11px;color:#3b82f6;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${projectCode}</div>
          <div style="font-size:17px;font-weight:700;color:#0f172a;margin-bottom:14px">${projectName}</div>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><span style="font-size:12px;color:#64748b;font-weight:600">${isEN ? 'Physical Progress' : 'Avanço Físico'}</span></td>
            <td align="right"><span style="font-size:20px;font-weight:800;color:#22c55e">${progress}%</span></td>
          </tr></table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 14px"><tr>
            <td style="background:#e2e8f0;border-radius:4px;height:8px;padding:0">
              <div style="background:linear-gradient(90deg,#3b82f6,#22c55e);width:${progress}%;height:8px;border-radius:4px"></div>
            </td>
          </tr></table>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            ${[
              [isEN ? 'Manager' : 'Responsável', esc(project.responsible || '—'), '#334155'],
              ['Status', statusLabel(project.status), '#3b82f6'],
              [isEN ? 'Start' : 'Início', fmtDate(project.startDate), '#334155'],
              [isEN ? 'Planned End' : 'Término', fmtDate(project.endDate), '#334155'],
            ].map(([l, v, c], i) => `
            <td style="width:25%${i < 3 ? ';padding-right:8px' : ''}">
              <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${l}</div>
              <div style="font-size:13px;color:${c};font-weight:500;margin-top:2px">${v}</div>
            </td>`).join('')}
          </tr></table>
        </td></tr>
      </table>

      <!-- KPIs -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
        <tr>
          ${kpis.map(([l, v, c], i) => `
          <td style="padding:${i > 0 ? '0 0 0 10px' : '0'};width:25%">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center">
                <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
                <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${l}</div>
              </td>
            </tr></table>
          </td>`).join('')}
        </tr>
      </table>

      ${curve.length === 0 ? '' : `
      <!-- Curva S -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
        <tr>
          <td style="width:3px;background:#3b82f6;border-radius:2px;padding:0">&nbsp;</td>
          <td style="padding-left:10px;font-size:14px;font-weight:700;color:#0f172a">
            ${isEN ? 'S-Curve — Cumulative Physical Progress' : 'Curva S — Avanço Físico Acumulado'}
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>${deviationAlert}</tr></table>
      ${barChartHTML}
      <div style="margin-top:14px;margin-bottom:28px">${timelineHTML}</div>`}

      <!-- Atividades em andamento -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
        <tr>
          <td style="width:3px;background:#22c55e;border-radius:2px;padding:0">&nbsp;</td>
          <td style="padding-left:10px">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;font-weight:700;color:#0f172a;padding-right:10px">
                ${isEN ? 'Active Tasks' : 'Atividades em Andamento'}
              </td>
              <td style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px">
                ${activeAll.length} ${isEN ? 'tasks' : 'tarefas'}
              </td>
            </tr></table>
          </td>
        </tr>
      </table>
      ${attentionAlert}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:${activeAll.length > activeTasks.length ? '8' : '28'}px">
        <tr style="background:#f1f5f9">
          ${th(isEN ? 'Task' : 'Tarefa', '#64748b', 'left')}
          ${th(isEN ? 'Responsible' : 'Responsável', '#64748b', 'left')}
          ${th(isEN ? 'Progress' : 'Progresso', '#64748b', 'left')}
          ${th(isEN ? 'Due Date' : 'Término Plan.', '#64748b', 'left')}
        </tr>
        ${activeTasksHTML}
      </table>
      ${activeAll.length > activeTasks.length ? `
      <p style="font-size:11px;color:#94a3b8;margin:0 0 28px">
        ${isEN
          ? `+ ${activeAll.length - activeTasks.length} more task(s) in progress — see Chronos PM.`
          : `+ ${activeAll.length - activeTasks.length} tarefa(s) em andamento — veja no Chronos PM.`}
      </p>` : ''}

      ${phasesHTML}

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
          ? `Sent by Chronos PM · reference date ${date}.`
          : `Enviado pelo Chronos PM · data de referência ${date}.`}
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
          : 'Gestão profissional de cronograma · Manaus, Amazonas, Brasil'}
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
      to: recipients.join(', '),
      subject: finalSubject,
      html: emailHtml,
    })

    return NextResponse.json({ success: true, message: `Email enviado para ${recipients.join(', ')}` })
  } catch (error: any) {
    console.error('Erro ao enviar email:', error)
    return NextResponse.json(
      { error: 'Falha ao enviar email', detail: error.message },
      { status: 500 }
    )
  }
}
