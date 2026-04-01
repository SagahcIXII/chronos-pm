// src/app/api/tasks/id/comments/route.ts
// Em produção: src/app/api/tasks/[id]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

// GET /api/tasks/[id]/comments
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const comments = await prisma.taskComment.findMany({
    where: { taskId: params.id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ data: comments })
}

// POST /api/tasks/[id]/comments
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 })

  const comment = await prisma.taskComment.create({
    data: { taskId: params.id, authorId: session.user.id, text: text.trim() },
    include: { author: { select: { id: true, name: true } } },
  })

  // Registra no histórico
  await prisma.taskHistory.create({
    data: {
      taskId: params.id,
      authorId: session.user.id,
      changeType: 'COMMENT_ADDED',
      note: 'Comentário adicionado',
    },
  })

  return NextResponse.json({ data: comment }, { status: 201 })
}
