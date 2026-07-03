// src/app/api/export/excel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatDateBR, statusLabel, priorityLabel, isTaskDelayed } from '@/lib/schedule'
import { requireUser, assertProjectAccess, accessErrorResponse } from '@/lib/access'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  let projectId: string | null = null
  let project
  try {
    const user = await requireUser()
    projectId = new URL(req.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId obrigatório' }, { status: 400 })
    // Garante que o usuário pode ver este projeto (bloqueia export de projeto alheio).
    project = await assertProjectAccess(projectId, user)
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }

  if (!projectId || !project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: [{ level: 'asc' }, { order: 'asc' }],
  })

  const wb = XLSX.utils.book_new()

  // ── Aba: Cronograma ──
  const cronRows = [
    ['CHRONOS PM — CRONOGRAMA DO PROJETO'],
    [project.name],
    [project.code, `Emitido em: ${formatDateBR(new Date())}`],
    [],
    ['Nível', 'WBS', 'Tarefa', 'Responsável', 'Início Plan.', 'Término Plan.',
     'Início Real', 'Término Real', 'Dur. Plan. (d)', 'Progresso (%)', 'Status', 'Prioridade',
     'Crítica', 'Marco', 'Atrasada'],
    ...tasks.map((t, i) => {
      const durationPlan = t.plannedStart && t.plannedEnd
        ? Math.round((new Date(t.plannedEnd).getTime() - new Date(t.plannedStart).getTime()) / 86400000)
        : ''
      return [
        t.level,
        `${i + 1}`,
        '  '.repeat(t.level) + t.name,
        t.responsible || '',
        formatDateBR(t.plannedStart),
        formatDateBR(t.plannedEnd),
        formatDateBR(t.actualStart),
        formatDateBR(t.actualEnd),
        durationPlan,
        t.progress,
        statusLabel(t.status),
        priorityLabel(t.priority),
        t.isCritical ? 'Sim' : 'Não',
        t.isMilestone ? 'Sim' : 'Não',
        isTaskDelayed(t) ? 'Sim' : 'Não',
      ]
    })
  ]

  const wsCron = XLSX.utils.aoa_to_sheet(cronRows)
  wsCron['!cols'] = [
    { wch: 6 }, { wch: 6 }, { wch: 45 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 },
    { wch: 8 }, { wch: 8 }, { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(wb, wsCron, 'Cronograma')

  // ── Aba: Resumo Executivo ──
  const resumoRows = [
    ['RESUMO EXECUTIVO'],
    [],
    ['Campo', 'Valor'],
    ['Projeto', project.name],
    ['Código', project.code],
    ['Responsável', project.responsible],
    ['Início Planejado', formatDateBR(project.startDate)],
    ['Término Planejado', formatDateBR(project.endDate)],
    ['Status', statusLabel(project.status)],
    ['Avanço Geral', `${project.progress}%`],
    ['Total de Tarefas', tasks.filter(t => !t.isGroup).length],
    ['Concluídas', tasks.filter(t => t.status === 'COMPLETED').length],
    ['Em Andamento', tasks.filter(t => t.status === 'IN_PROGRESS').length],
    ['Não Iniciadas', tasks.filter(t => t.status === 'NOT_STARTED').length],
    ['Atrasadas', tasks.filter(t => isTaskDelayed(t)).length],
    ['Tarefas Críticas', tasks.filter(t => t.isCritical).length],
    ['Marcos', tasks.filter(t => t.isMilestone).length],
  ]
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows)
  wsResumo['!cols'] = [{ wch: 22 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

  // ── Aba: Tarefas Atrasadas ──
  const delayed = tasks.filter(t => isTaskDelayed(t))
  const delayedRows = [
    ['TAREFAS ATRASADAS'],
    [],
    ['Tarefa', 'Responsável', 'Término Planejado', 'Progresso', 'Status', 'Observações'],
    ...delayed.map(t => [
      t.name, t.responsible || '',
      formatDateBR(t.plannedEnd), `${t.progress}%`,
      statusLabel(t.status), t.observations || '',
    ])
  ]
  const wsDelayed = XLSX.utils.aoa_to_sheet(delayedRows)
  XLSX.utils.book_append_sheet(wb, wsDelayed, 'Atrasadas')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Chronos-${project.code}-${new Date().toISOString().slice(0,10)}.xlsx"`,
    },
  })
}
