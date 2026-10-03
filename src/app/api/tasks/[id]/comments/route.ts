// src/app/api/tasks/[id]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, assertTaskAccess, accessErrorResponse } from '@/lib/access'

type Params = { params: { id: string } }

// GET /api/tasks/[id]/comments
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    await assertTaskAccess(params.id, user)

    const comments = await prisma.taskComment.findMany({
      where: { taskId: params.id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: comments })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// POST /api/tasks/[id]/comments — qualquer usuário que VÊ o projeto pode
// comentar (inclusive CLIENT/VIEWER); editar a tarefa continua restrito.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser()
    await assertTaskAccess(params.id, user)

    const body = await req.json().catch(() => ({}))
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 })
    if (text.length > 2000) return NextResponse.json({ error: 'Comentário excede 2000 caracteres' }, { status: 400 })

    const comment = await prisma.taskComment.create({
      data: { taskId: params.id, authorId: user.id, text: text.trim() },
      include: { author: { select: { id: true, name: true } } },
    })

    await prisma.taskHistory.create({
      data: { taskId: params.id, authorId: user.id, changeType: 'COMMENT_ADDED', note: 'Comentário adicionado' },
    })

    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
