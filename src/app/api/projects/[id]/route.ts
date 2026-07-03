// src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireUser, canEdit, assertProjectAccess, accessErrorResponse } from '@/lib/access'

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
        client: { select: { id: true, name: true, email: true } },
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
  clientId: z.string().nullable().optional(),
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

    // Só valida/autoriza o clientId quando ele REALMENTE muda — assim um
    // MANAGER pode editar os demais campos sem esbarrar nesta regra.
    const clientChanged = d.clientId !== undefined && (d.clientId || null) !== (existing.clientId || null)
    if (clientChanged) {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Apenas o administrador pode alterar o cliente' }, { status: 403 })
      }
      if (d.clientId) {
        const client = await prisma.user.findUnique({ where: { id: d.clientId } })
        if (!client) return NextResponse.json({ error: 'Cliente informado não existe' }, { status: 400 })
      }
    }

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
        ...(d.clientId !== undefined && { clientId: d.clientId || null }),
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
