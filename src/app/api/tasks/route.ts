// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { computeWeightedProgress } from '@/lib/schedule'

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

// GET /api/tasks?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const projectId = new URL(req.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId obrigatório' }, { status: 400 })

  try {
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        predecessors: { include: { predecessor: { select: { id: true, name: true, status: true } } } },
        _count: { select: { comments: true, children: true, attachments: true } },
      },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    })
    return NextResponse.json({ data: tasks })
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar tarefas' }, { status: 500 })
  }
}

// POST /api/tasks
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const body = await req.json()
    const { predecessorIds, plannedStart, plannedEnd, actualStart, actualEnd, ...data } =
      TaskSchema.parse(body)

    const task = await prisma.task.create({
      data: {
        ...data,
        ...(plannedStart && { plannedStart: new Date(plannedStart) }),
        ...(plannedEnd && { plannedEnd: new Date(plannedEnd) }),
        ...(actualStart && { actualStart: new Date(actualStart) }),
        ...(actualEnd && { actualEnd: new Date(actualEnd) }),
        ...(predecessorIds?.length && {
          predecessors: {
            create: predecessorIds.map(predId => ({
              predecessorId: predId,
              type: 'FINISH_TO_START',
            })),
          },
        }),
      },
    })

    // Registra histórico
    await prisma.taskHistory.create({
      data: {
        taskId: task.id,
        authorId: session.user.id,
        changeType: 'CREATED',
        note: 'Tarefa criada',
      },
    })

    // Recalcula progresso do projeto
    await recalculateProjectProgress(data.projectId)

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: err.errors }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro ao criar tarefa' }, { status: 500 })
  }
}

// Recalcula e persiste o progresso geral do projeto
async function recalculateProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({ where: { projectId } })
  const progress = computeWeightedProgress(tasks)
  await prisma.project.update({ where: { id: projectId }, data: { progress } })
}
