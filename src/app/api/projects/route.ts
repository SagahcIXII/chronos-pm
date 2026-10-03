import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { projectProgress, workItems } from '@/lib/progress'
import {
  requireUser,
  canEdit,
  projectVisibilityWhere,
  resolveProjectOrganization,
  accessErrorResponse,
} from '@/lib/access'

// GET /api/projects — lista apenas os projetos visíveis ao usuário.
export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser()

    const projects = await prisma.project.findMany({
      where: { archived: false, ...projectVisibilityWhere(user) },
      include: {
        tasks: { select: { id: true, parentId: true, isGroup: true, weight: true, progress: true, status: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = projects.map(({ tasks, ...p }) => {
      const leaves = workItems(tasks)
      return {
        ...p,
        totalTasks: leaves.length,
        completedTasks: leaves.filter(t => t.status === 'COMPLETED').length,
        inProgressTasks: leaves.filter(t => t.status === 'IN_PROGRESS').length,
        computedProgress: leaves.length > 0 ? projectProgress(tasks) : p.progress,
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
  // Empresa do projeto — só o ADMIN escolhe; os demais usam a própria empresa.
  organizationId: z.string().optional().nullable(),
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
    const { code, name, description, responsible, startDate, endDate, status, observations } = parsed.data
    const organizationId = await resolveProjectOrganization(user, parsed.data.organizationId)

    const existing = await prisma.project.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: 'Código já existe' }, { status: 409 })

    const project = await prisma.project.create({
      data: {
        code,
        name,
        description: description || null,
        responsible,
        ownerId: user.id,
        organizationId,
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
