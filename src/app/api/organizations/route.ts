// src/app/api/organizations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser, isAdmin, accessErrorResponse } from '@/lib/access'

// GET /api/organizations — lista empresas com contagens (ADMIN).
export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser()
    if (!isAdmin(user)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const orgs = await prisma.organization.findMany({
      select: {
        id: true, name: true, active: true, createdAt: true,
        _count: { select: { users: true, projects: { where: { archived: false } } } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ data: orgs })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

const CreateOrgSchema = z.object({ name: z.string().trim().min(2).max(120) })

// POST /api/organizations — cria empresa (ADMIN).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!isAdmin(user)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const parsed = CreateOrgSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Informe o nome da empresa (mín. 2 caracteres)' }, { status: 422 })

    const exists = await prisma.organization.findFirst({ where: { name: { equals: parsed.data.name, mode: 'insensitive' } } })
    if (exists) return NextResponse.json({ error: 'Já existe uma empresa com este nome' }, { status: 409 })

    const org = await prisma.organization.create({ data: { name: parsed.data.name } })
    return NextResponse.json({ data: org }, { status: 201 })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
