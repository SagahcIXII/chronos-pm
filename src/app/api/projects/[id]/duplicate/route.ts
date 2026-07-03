// src/app/api/projects/[id]/duplicate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, assertProjectAccess, accessErrorResponse } from '@/lib/access'

type Params = { params: { id: string } }

// POST /api/projects/[id]/duplicate — duplica projeto e tarefas (ADMIN/MANAGER com acesso).
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    await assertProjectAccess(params.id, user, { write: true })

    const original = await prisma.project.findUnique({
      where: { id: params.id },
      include: { tasks: true },
    })
    if (!original) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const newProject = await prisma.project.create({
      data: {
        code: `${original.code}-COPIA-${Date.now().toString().slice(-4)}`,
        name: `${original.name} (Cópia)`,
        description: original.description ?? undefined,
        responsible: original.responsible,
        ownerId: user.id,
        clientId: original.clientId ?? undefined,
        startDate: original.startDate,
        endDate: original.endDate,
        status: 'NOT_STARTED',
        observations: original.observations ?? undefined,
      },
    })

    // Mapeia IDs antigos → novos para preservar hierarquia pai/filho.
    const idMap: Record<string, string> = {}
    const sortedTasks = [...original.tasks].sort((a, b) => a.level - b.level || a.order - b.order)

    for (const task of sortedTasks) {
      const newTask = await prisma.task.create({
        data: {
          projectId: newProject.id,
          parentId: task.parentId ? idMap[task.parentId] : null,
          order: task.order,
          level: task.level,
          isGroup: task.isGroup,
          name: task.name,
          description: task.description ?? undefined,
          responsible: task.responsible ?? undefined,
          weight: task.weight,
          plannedStart: task.plannedStart ?? undefined,
          plannedEnd: task.plannedEnd ?? undefined,
          status: 'NOT_STARTED',
          priority: task.priority,
          progress: 0,
          isMilestone: task.isMilestone,
          isCritical: task.isCritical,
          observations: task.observations ?? undefined,
        },
      })
      idMap[task.id] = newTask.id
    }

    // Recria as dependências entre as novas tarefas.
    const deps = await prisma.taskDependency.findMany({
      where: { predecessorId: { in: original.tasks.map(t => t.id) } },
    })
    if (deps.length > 0) {
      await prisma.taskDependency.createMany({
        data: deps
          .filter(d => idMap[d.predecessorId] && idMap[d.successorId])
          .map(d => ({
            predecessorId: idMap[d.predecessorId],
            successorId: idMap[d.successorId],
            type: d.type,
            lag: d.lag,
          })),
      })
    }

    return NextResponse.json({ data: newProject }, { status: 201 })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
