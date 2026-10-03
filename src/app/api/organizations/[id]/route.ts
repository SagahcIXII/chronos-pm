// src/app/api/organizations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser, isAdmin, accessErrorResponse } from '@/lib/access'

type Params = { params: { id: string } }

const UpdateOrgSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  // Desativar corta o acesso de TODOS os usuários da empresa (dados ficam preservados).
  active: z.boolean().optional(),
})

// PATCH /api/organizations/[id] — renomeia / ativa / desativa (ADMIN).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    if (!isAdmin(user)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const parsed = UpdateOrgSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.errors }, { status: 422 })

    const org = await prisma.organization.findUnique({ where: { id: params.id } })
    if (!org) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

    if (parsed.data.name && parsed.data.name.toLowerCase() !== org.name.toLowerCase()) {
      const clash = await prisma.organization.findFirst({ where: { name: { equals: parsed.data.name, mode: 'insensitive' }, NOT: { id: org.id } } })
      if (clash) return NextResponse.json({ error: 'Já existe uma empresa com este nome' }, { status: 409 })
    }

    const updated = await prisma.organization.update({ where: { id: org.id }, data: parsed.data })
    return NextResponse.json({ data: updated })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
