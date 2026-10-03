// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireUser, isAdmin, assertProjectAccess, resolveProjectOrganization, accessErrorResponse } from '@/lib/access'

type Params = { params: { id: string } }

// GET /api/projects/[id] — exige sessão E acesso ao projeto.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    await assertProjectAccess(params.id, user)

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
        baseline: true,
        tasks: {
          include: {
            predecessors: { include: { predecessor: true } },
            successors: { include: { successor: true } },
            _count: { select: { comments: true, children: true } },
          },
          orderBy: [{ level: 'asc' }, { order: 'asc' }],
        },
      },
    })
    return NextResponse.json({ data: project })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

const UpdateProjectSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  responsible: z.string().min(1).max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  observations: z.string().max(2000).nullable().optional(),
  organizationId: z.string().nullable().optional(),
})

// PUT /api/projects/[id] — atualização (ADMIN/MANAGER com acesso).
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    const existing = await assertProjectAccess(params.id, user, { write: true })

    const parsed = UpdateProjectSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.errors }, { status: 422 })
    }
    const d = parsed.data

    // Só o ADMIN move um projeto de empresa. Para os demais o campo é
    // ignorado se não mudar, e recusado se tentar mudar.
    const orgChanged = d.organizationId !== undefined && (d.organizationId || null) !== (existing.organizationId || null)
    if (orgChanged && !isAdmin(user)) {
      return NextResponse.json({ error: 'Apenas o administrador pode alterar a empresa do projeto' }, { status: 403 })
    }
    const organizationId = orgChanged ? await resolveProjectOrganization(user, d.organizationId) : undefined

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(d.name && { name: d.name }),
        ...(d.description !== undefined && { description: d.description }),
        ...(d.responsible && { responsible: d.responsible }),
        ...(d.startDate && { startDate: new Date(d.startDate) }),
        ...(d.endDate && { endDate: new Date(d.endDate) }),
        ...(d.status && { status: d.status }),
        ...(d.progress !== undefined && { progress: d.progress }),
        ...(d.observations !== undefined && { observations: d.observations }),
        ...(organizationId !== undefined && { organizationId }),
      },
    })
    return NextResponse.json({ data: project })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// DELETE /api/projects/[id] — arquivamento lógico (ADMIN/MANAGER com acesso).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    await assertProjectAccess(params.id, user, { write: true })

    await prisma.project.update({ where: { id: params.id }, data: { archived: true } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
