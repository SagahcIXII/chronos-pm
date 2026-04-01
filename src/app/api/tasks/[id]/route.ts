// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { computeWeightedProgress } from '@/lib/schedule'

const UpdateSchema = z.object({
  name: z.string().min(2).max(300).optional(),
  description: z.string().optional(),
  responsible: z.string().optional(),
  weight: z.number().min(0).max(100).optional(),
  priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  status: z.enum(['NOT_STARTED','IN_PROGRESS','COMPLETED','ON_HOLD','DELAYED']).optional(),
  progress: z.number().min(0).max(100).optional(),
  plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(),
  actualStart: z.string().nullable().optional(),
  actualEnd: z.string().nullable().optional(),
  isMilestone: z.boolean().optional(),
  isCritical: z.boolean().optional(),
  isGroup: z.boolean().optional(),
  observations: z.string().optional(),
  predecessorIds: z.array(z.string()).optional(),
})

async function recalculateProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({ where: { projectId } })
  const progress = computeWeightedProgress(tasks)
  await prisma.project.update({ where: { id: projectId }, data: { progress } })
}

// GET /api/tasks/[id]
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { predecessors: { include: { predecessor: { select: { id: true, name: true } } } } },
  })
  if (!task) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json({ data: task })
}

// PUT /api/tasks/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const body = await req.json()
    const { predecessorIds, plannedStart, plannedEnd, actualStart, actualEnd, ...data } =
      UpdateSchema.parse(body)

    const existing = await prisma.task.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

    // Remove predecessoras antigas e recria
    if (predecessorIds !== undefined) {
      await prisma.taskDependency.deleteMany({ where: { successorId: params.id } })
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...data,
        plannedStart: plannedStart ? new Date(plannedStart) : plannedStart === null ? null : undefined,
        plannedEnd:   plannedEnd   ? new Date(plannedEnd)   : plannedEnd   === null ? null : undefined,
        actualStart:  actualStart  ? new Date(actualStart)  : actualStart  === null ? null : undefined,
        actualEnd:    actualEnd    ? new Date(actualEnd)    : actualEnd    === null ? null : undefined,
        ...(predecessorIds !== undefined && predecessorIds.length > 0 && {
          predecessors: {
            create: predecessorIds.map(predId => ({ predecessorId: predId, type: 'FINISH_TO_START' })),
          },
        }),
      },
    })

    await prisma.taskHistory.create({
      data: { taskId: task.id, authorId: session.user.id, changeType: 'UPDATED', note: 'Tarefa atualizada' },
    })

    await recalculateProjectProgress(existing.projectId)
    return NextResponse.json({ data: task })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: 'Dados inválidos', details: err.errors }, { status: 422 })
    return NextResponse.json({ error: 'Erro ao atualizar tarefa' }, { status: 500 })
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const existing = await prisma.task.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  await prisma.taskDependency.deleteMany({ where: { OR: [{ successorId: params.id }, { predecessorId: params.id }] } })
  await prisma.task.delete({ where: { id: params.id } })
  await recalculateProjectProgress(existing.projectId)

  return NextResponse.json({ success: true })
}
