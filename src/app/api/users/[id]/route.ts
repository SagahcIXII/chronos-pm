// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireUser, isAdmin, accessErrorResponse } from '@/lib/access'

type Params = { params: { id: string } }

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'CLIENT', 'VIEWER']).optional(),
  active: z.boolean().optional(),
  // Reset de senha opcional.
  password: z.string().min(6).max(100).optional(),
})

// PATCH /api/users/[id] — edita nome/papel/ativo/senha (ADMIN).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireUser()
    if (!isAdmin(admin)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const parsed = UpdateUserSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.errors }, { status: 422 })
    }
    const { name, role, active, password } = parsed.data

    const target = await prisma.user.findUnique({ where: { id: params.id } })
    if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Proteções: o admin não pode se auto-rebaixar nem se auto-desativar
    // (evita perder o último acesso administrativo).
    if (target.id === admin.id) {
      if (active === false) return NextResponse.json({ error: 'Você não pode desativar a própria conta' }, { status: 400 })
      if (role && role !== 'ADMIN') return NextResponse.json({ error: 'Você não pode rebaixar a própria conta' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(role && { role }),
        ...(active !== undefined && { active }),
        ...(password && { password: await bcrypt.hash(password, 12) }),
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    })
    return NextResponse.json({ data: updated })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
