import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projects = await prisma.project.findMany({
      where: { archived: false },
      include: {
        tasks: { where: { parentId: null } },
        _count: { select: { tasks: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const result = projects.map(p => {
      const allTasks = p.tasks
      const completed = allTasks.filter(t => t.status === 'COMPLETED').length
      const inProgress = allTasks.filter(t => t.status === 'IN_PROGRESS').length
      const totalProgress = allTasks.length > 0
        ? allTasks.reduce((sum, t) => sum + t.progress, 0) / allTasks.length
        : p.progress
      return {
        ...p,
        totalTasks: p._count.tasks,
        completedTasks: completed,
        inProgressTasks: inProgress,
        computedProgress: Math.round(totalProgress),
      }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { code, name, description, responsible, startDate, endDate, status, observations } = body

    if (!code || !name || !responsible || !startDate || !endDate) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const existing = await prisma.project.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: 'Código já existe' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { email: session.user?.email! } })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const project = await prisma.project.create({
      data: {
        code,
        name,
        description: description || null,
        responsible,
        ownerId: user.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || 'IN_PROGRESS',
        progress: 0,
        observations: observations || null,
      }
    })

    return NextResponse.json(project, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
