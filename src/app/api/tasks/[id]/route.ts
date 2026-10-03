// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { recalculateProjectRollups } from '@/lib/rollup'
import { requireUser, assertTaskAccess, assertTaskRelations, accessErrorResponse } from '@/lib/access'

type Params = { params: { id: string } }

// Campos editáveis de uma tarefa. Qualquer outra chave (ex.: projectId, id,
// createdAt) é descartada pelo zod — impede mover a tarefa para outro projeto.
const optionalDate = z.string().nullable().optional()
const UpdateTaskSchema = z.object({
  parentId: z.string().nullable().optional(),
  name: z.string().min(2).max(300).optional(),
  description: z.string().max(5000).nullable().optional(),
  responsible: z.string().max(200).nullable().optional(),
  weight: z.number().min(0).max(100).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'DELAYED']).optional(),
  progress: z.number().min(0).max(100).optional(),
  plannedStart: optionalDate,
  plannedEnd: optionalDate,
  actualStart: optionalDate,
  actualEnd: optionalDate,
  isMilestone: z.boolean().optional(),
  isCritical: z.boolean().optional(),
  isGroup: z.boolean().optional(),
  level: z.number().int().min(0).optional(),
  order: z.number().int().optional(),
  observations: z.string().max(5000).nullable().optional(),
  predecessorIds: z.array(z.string()).optional(),
})

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

    const parsed = UpdateTaskSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.errors }, { status: 422 })
    }
    const { predecessorIds, ...updates } = parsed.data

    await assertTaskRelations(current.projectId, params.id, { parentId: updates.parentId, predecessorIds })

    // Normaliza datas ('' ou null → limpa o campo).
    const dateFields = ['plannedStart', 'plannedEnd', 'actualStart', 'actualEnd'] as const
    const normalizedUpdates: any = { ...updates }
    for (const field of dateFields) {
      const v = updates[field]
      if (v === undefined) continue
      if (!v) { normalizedUpdates[field] = null; continue }
      const d = new Date(v)
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: `Data inválida em ${field}` }, { status: 422 })
      }
      normalizedUpdates[field] = d
    }

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

    await recalculateProjectRollups(current.projectId)
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
    await recalculateProjectRollups(task.projectId)

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
