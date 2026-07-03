// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireUser, isAdmin, canEdit, accessErrorResponse } from '@/lib/access'

// GET /api/users
//   • ?role=CLIENT → lista mínima (id, name, email) p/ seletor. Requer ADMIN/MANAGER.
//   • sem filtro   → lista completa de gestão. Requer ADMIN.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const role = req.nextUrl.searchParams.get('role')

    if (role) {
      if (!canEdit(user)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      const list = await prisma.user.findMany({
        where: { role, active: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json({ data: list })
    }

    if (!isAdmin(user)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, active: true, createdAt: true,
        _count: { select: { projects: true, clientProjects: true } },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    })
    return NextResponse.json({ data: users })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

const CreateUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['ADMIN', 'MANAGER', 'CLIENT', 'VIEWER']).default('CLIENT'),
})

// POST /api/users — cria usuário (ADMIN).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!isAdmin(user)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const parsed = CreateUserSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.errors }, { status: 422 })
    }
    const { name, email, password, role } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) return NextResponse.json({ error: 'Já existe um usuário com este e-mail' }, { status: 409 })

    const created = await prisma.user.create({
      data: { name, email: normalizedEmail, password: await bcrypt.hash(password, 12), role },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
