// src/app/api/projects/id/route.ts
// Em produção: src/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

type Params = { params: { id: string } }

// GET /api/projects/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
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

    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    return NextResponse.json({ data: project })
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar projeto' }, { status: 500 })
  }
}

// PUT /api/projects/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'VIEWER') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const body = await req.json()
    const { startDate, endDate, ...rest } = body

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
    })
    return NextResponse.json({ data: project })
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar projeto' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Apenas administradores podem excluir' }, { status: 403 })

  try {
    await prisma.project.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Projeto excluído com sucesso' })
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir projeto' }, { status: 500 })
  }
}
