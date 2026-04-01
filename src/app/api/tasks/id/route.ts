// src/app/api/tasks/id/route.ts
// Em produção: src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeWeightedProgress } from '@/lib/schedule'

type Params = { params: { id: string } }

// GET /api/tasks/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      predecessors: { include: { predecessor: true } },
      successors: { include: { successor: true } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      history: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 30 },
      attachments: true,
    },
  })

  if (!task) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
  return NextResponse.json({ data: task })
}

// PATCH /api/tasks/[id] — atualização parcial com diff automático
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const body = await req.json()
    const { predecessorIds, ...updates } = body

    // Busca tarefa atual para diff
    const current = await prisma.task.findUnique({ where: { id: params.id } })
    if (!current) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })

    // Normaliza datas
    const dateFields = ['plannedStart', 'plannedEnd', 'actualStart', 'actualEnd']
    const normalizedUpdates: any = { ...updates }
    dateFields.forEach(field => {
      if (updates[field] !== undefined) {
        normalizedUpdates[field] = updates[field] ? new Date(updates[field]) : null
      }
    })

    const task = await prisma.task.update({
      where: { id: params.id },
      data: normalizedUpdates,
    })

    // Atualiza dependências se fornecidas
    if (predecessorIds !== undefined) {
      await prisma.taskDependency.deleteMany({ where: { successorId: params.id } })
      if (predecessorIds.length > 0) {
        await prisma.taskDependency.createMany({
          data: predecessorIds.map((predId: string) => ({
            predecessorId: predId,
            successorId: params.id,
            type: 'FINISH_TO_START',
          })),
        })
      }
    }

    // Gera histórico automático baseado em diff
    const historyEntries = buildHistoryEntries(current, normalizedUpdates, session.user.id, params.id)
    if (historyEntries.length > 0) {
      await prisma.taskHistory.createMany({ data: historyEntries })
    }

    // Recalcula progresso do projeto
    await recalculateProjectProgress(current.projectId)

    return NextResponse.json({ data: task })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao atualizar tarefa' }, { status: 500 })
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const task = await prisma.task.findUnique({ where: { id: params.id } })
  if (!task) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })

  // Exclui task e todos os filhos em cascata (configurado no schema)
  await prisma.task.delete({ where: { id: params.id } })
  await recalculateProjectProgress(task.projectId)

  return NextResponse.json({ message: 'Tarefa excluída' })
}

// ─── Helpers ──────────────────────────────────────────────

function buildHistoryEntries(
  current: any,
  updates: any,
  authorId: string,
  taskId: string
) {
  const entries = []

  if (updates.progress !== undefined && updates.progress !== current.progress) {
    entries.push({
      taskId, authorId,
      changeType: 'PROGRESS_UPDATED' as const,
      field: 'progress',
      oldValue: String(current.progress),
      newValue: String(updates.progress),
    })
  }

  if (updates.status !== undefined && updates.status !== current.status) {
    entries.push({
      taskId, authorId,
      changeType: 'STATUS_CHANGED' as const,
      field: 'status',
      oldValue: current.status,
      newValue: updates.status,
    })
  }

  const dateChanged = ['plannedStart', 'plannedEnd', 'actualStart', 'actualEnd'].some(
    f => updates[f] !== undefined && String(updates[f]) !== String(current[f])
  )
  if (dateChanged) {
    entries.push({
      taskId, authorId,
      changeType: 'DATES_CHANGED' as const,
      note: 'Datas atualizadas',
    })
  }

  if (Object.keys(updates).some(k => !['progress', 'status', ...['plannedStart','plannedEnd','actualStart','actualEnd']].includes(k))) {
    entries.push({
      taskId, authorId,
      changeType: 'UPDATED' as const,
      note: `Campos atualizados: ${Object.keys(updates).join(', ')}`,
    })
  }

  return entries
}

async function recalculateProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({ where: { projectId } })
  const progress = computeWeightedProgress(tasks)
  await prisma.project.update({ where: { id: projectId }, data: { progress } })
}
