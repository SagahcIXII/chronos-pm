// src/app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeDashboardKPIs, buildCurveS } from '@/lib/schedule'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const projectId = new URL(req.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId obrigatório' }, { status: 400 })

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const tasks = await prisma.task.findMany({ where: { projectId } })

    const kpis = computeDashboardKPIs(tasks, new Date(project.startDate), new Date(project.endDate))
    const curveS = buildCurveS(tasks, new Date(project.startDate), new Date(project.endDate))

    // Tarefas atrasadas
    const today = new Date()
    const delayedTasks = tasks.filter(t =>
      !t.isGroup && t.status !== 'COMPLETED' && t.plannedEnd && new Date(t.plannedEnd) < today
    )

    // Próximos marcos (próximos 30 dias)
    const in30days = new Date(); in30days.setDate(in30days.getDate() + 30)
    const upcomingMilestones = tasks.filter(t =>
      t.isMilestone && t.plannedEnd &&
      new Date(t.plannedEnd) >= today &&
      new Date(t.plannedEnd) <= in30days
    )

    return NextResponse.json({
      data: { kpis, curveS, delayedTasks, upcomingMilestones }
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao calcular dashboard' }, { status: 500 })
  }
}
