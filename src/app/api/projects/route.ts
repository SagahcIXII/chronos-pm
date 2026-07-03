import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  requireUser,
  canEdit,
  isAdmin,
  projectVisibilityWhere,
  accessErrorResponse,
} from '@/lib/access'

// GET /api/projects — lista apenas os projetos visíveis ao usuário.
export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser()

    const projects = await prisma.project.findMany({
      where: { archived: false, ...projectVisibilityWhere(user) },
      include: {
        tasks: { where: { parentId: null } },
        client: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = projects.map(p => {
      const allTasks = p.tasks
      const completed = allTasks.filter(t => t.status === 'COMPLETED').length
      const inProgress = allTasks.filter(t => t.status === 'IN_PROGRESS').length
      const totalProgress = allTasks.length > 0
        ? allTasks.reduce((sum, t) => sum + t.progress, 0) / allTasks.length
        : p.progress
      return {
        ...p,
        totalTasks: p._count.tasks,
        completedTasks: completed,
        inProgressTasks: inProgress,
        computedProgress: Math.round(totalProgress),
      }
    })

    return NextResponse.json(result)
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

const CreateProjectSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  responsible: z.string().min(1).max(200),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.string().optional(),
  observations: z.string().max(2000).optional().nullable(),
  // Cliente que poderá visualizar o projeto (opcional).
  clientId: z.string().optional().nullable(),
})

// POST /api/projects — cria projeto (ADMIN/MANAGER).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!canEdit(user)) {
      return NextResponse.json({ error: 'Sem permissão para criar projetos' }, { status: 403 })
    }

    const parsed = CreateProjectSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.errors },
        { status: 422 }
      )
    }
    const { code, name, description, responsible, startDate, endDate, status, observations, clientId } =
      parsed.data

    // Apenas ADMIN pode atribuir um cliente ao projeto. Para os demais
    // (ex.: MANAGER criando o próprio projeto), o clientId é ignorado.
    const effectiveClientId = isAdmin(user) ? (clientId || null) : null

    const existing = await prisma.project.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: 'Código já existe' }, { status: 409 })

    // Se informado por um admin, valida que o clientId é um usuário existente.
    if (effectiveClientId) {
      const client = await prisma.user.findUnique({ where: { id: effectiveClientId } })
      if (!client) return NextResponse.json({ error: 'Cliente informado não existe' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        code,
        name,
        description: description || null,
        responsible,
        ownerId: user.id,
        clientId: effectiveClientId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || 'IN_PROGRESS',
        progress: 0,
        observations: observations || null,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
