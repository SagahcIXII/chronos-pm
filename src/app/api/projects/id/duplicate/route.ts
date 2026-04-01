// src/app/api/projects/id/duplicate/route.ts
// Em produção: src/app/api/projects/[id]/duplicate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

// POST /api/projects/[id]/duplicate
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const original = await prisma.project.findUnique({
      where: { id: params.id },
      include: { tasks: true },
    })
    if (!original) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    // Cria cópia do projeto
    const newProject = await prisma.project.create({
      data: {
        code: `${original.code}-COPIA-${Date.now().toString().slice(-4)}`,
        name: `${original.name} (Cópia)`,
        description: original.description ?? undefined,
        responsible: original.responsible,
        ownerId: session.user.id,
        startDate: original.startDate,
        endDate: original.endDate,
        status: 'PLANNING',
        observations: original.observations ?? undefined,
      },
    })

    // Mapeia IDs antigos → novos para preservar relações
    const idMap: Record<string, string> = {}

    // Cria tarefas sem dependências primeiro
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

    return NextResponse.json({ data: newProject }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao duplicar projeto' }, { status: 500 })
  }
}
