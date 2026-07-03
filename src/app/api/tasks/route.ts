// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { computeWeightedProgress } from '@/lib/schedule'
import { requireUser, assertProjectAccess, accessErrorResponse } from '@/lib/access'

const TaskSchema = z.object({
  projectId: z.string(),
  parentId: z.string().nullable().optional(),
  name: z.string().min(2).max(300),
  description: z.string().optional(),
  responsible: z.string().optional(),
  weight: z.number().min(0).max(100).default(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'DELAYED']).default('NOT_STARTED'),
  progress: z.number().min(0).max(100).default(0),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  actualStart: z.string().optional(),
  actualEnd: z.string().optional(),
  isMilestone: z.boolean().default(false),
  isCritical: z.boolean().default(false),
  isGroup: z.boolean().default(false),
  level: z.number().default(0),
  order: z.number().default(0),
  observations: z.string().optional(),
  predecessorIds: z.array(z.string()).optional(),
})

// GET /api/tasks?projectId=xxx — exige acesso ao projeto.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const projectId = new URL(req.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId obrigatório' }, { status: 400 })

    await assertProjectAccess(projectId, user)

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        predecessors: { include: { predecessor: { select: { id: true, name: true, status: true } } } },
        _count: { select: { comments: true, children: true, attachments: true } },
      },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    })
    return NextResponse.json({ data: tasks })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// POST /api/tasks — cria tarefa (exige acesso de escrita ao projeto).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = TaskSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.errors }, { status: 422 })
    }
    const { predecessorIds, plannedStart, plannedEnd, actualStart, actualEnd, ...data } = parsed.data

    await assertProjectAccess(data.projectId, user, { write: true })

    const task = await prisma.task.create({
      data: {
        ...data,
        ...(plannedStart && { plannedStart: new Date(plannedStart) }),
        ...(plannedEnd && { plannedEnd: new Date(plannedEnd) }),
        ...(actualStart && { actualStart: new Date(actualStart) }),
        ...(actualEnd && { actualEnd: new Date(actualEnd) }),
        ...(predecessorIds?.length && {
          predecessors: {
            create: predecessorIds.map(predId => ({ predecessorId: predId, type: 'FINISH_TO_START' })),
          },
        }),
      },
    })

    await prisma.taskHistory.create({
      data: { taskId: task.id, authorId: user.id, changeType: 'CREATED', note: 'Tarefa criada' },
    })

    await recalculateProjectProgress(data.projectId)
    return NextResponse.json({ data: task }, { status: 201 })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

async function recalculateProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({ where: { projectId } })
  const progress = computeWeightedProgress(tasks)
  await prisma.project.update({ where: { id: projectId }, data: { progress } })
}
