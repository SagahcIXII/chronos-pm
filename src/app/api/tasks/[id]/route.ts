// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeWeightedProgress } from '@/lib/schedule'
import { requireUser, assertTaskAccess, accessErrorResponse } from '@/lib/access'

type Params = { params: { id: string } }

// GET /api/tasks/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    await assertTaskAccess(params.id, user)

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
    return NextResponse.json({ data: task })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// PATCH /api/tasks/[id] — atualização parcial com histórico automático (diff).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    const { task: current } = await assertTaskAccess(params.id, user, { write: true })

    const body = await req.json()
    const { predecessorIds, ...updates } = body

    // Normaliza datas.
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

    const historyEntries = buildHistoryEntries(current, normalizedUpdates, user.id, params.id)
    if (historyEntries.length > 0) {
      await prisma.taskHistory.createMany({ data: historyEntries })
    }

    await recalculateProjectProgress(current.projectId)
    return NextResponse.json({ data: task })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// PUT = alias de PATCH, para compatibilidade com chamadas existentes.
export const PUT = PATCH

// DELETE /api/tasks/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    const { task } = await assertTaskAccess(params.id, user, { write: true })

    await prisma.taskDependency.deleteMany({
      where: { OR: [{ successorId: params.id }, { predecessorId: params.id }] },
    })
    await prisma.task.delete({ where: { id: params.id } })
    await recalculateProjectProgress(task.projectId)

    return NextResponse.json({ message: 'Tarefa excluída' })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// ─── Helpers ──────────────────────────────────────────────

function buildHistoryEntries(current: any, updates: any, authorId: string, taskId: string) {
  const entries: any[] = []

  if (updates.progress !== undefined && updates.progress !== current.progress) {
    entries.push({
      taskId, authorId, changeType: 'PROGRESS_UPDATED', field: 'progress',
      oldValue: String(current.progress), newValue: String(updates.progress),
    })
  }
  if (updates.status !== undefined && updates.status !== current.status) {
    entries.push({
      taskId, authorId, changeType: 'STATUS_CHANGED', field: 'status',
      oldValue: current.status, newValue: updates.status,
    })
  }
  const dateChanged = ['plannedStart', 'plannedEnd', 'actualStart', 'actualEnd'].some(
    f => updates[f] !== undefined && String(updates[f]) !== String(current[f])
  )
  if (dateChanged) {
    entries.push({ taskId, authorId, changeType: 'DATES_CHANGED', note: 'Datas atualizadas' })
  }
  const otherKeys = Object.keys(updates).filter(
    k => !['progress', 'status', 'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd'].includes(k)
  )
  if (otherKeys.length > 0) {
    entries.push({ taskId, authorId, changeType: 'UPDATED', note: `Campos atualizados: ${otherKeys.join(', ')}` })
  }
  return entries
}

async function recalculateProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({ where: { projectId } })
  const progress = computeWeightedProgress(tasks)
  await prisma.project.update({ where: { id: projectId }, data: { progress } })
}
