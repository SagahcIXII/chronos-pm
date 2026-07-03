// src/app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeDashboardKPIs, buildCurveS } from '@/lib/schedule'
import { requireUser, assertProjectAccess, accessErrorResponse } from '@/lib/access'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const projectId = new URL(req.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId obrigatório' }, { status: 400 })

    // Garante que o usuário pode ver este projeto.
    const project = await assertProjectAccess(projectId, user)

    const tasks = await prisma.task.findMany({ where: { projectId } })

    const kpis = computeDashboardKPIs(tasks, new Date(project.startDate), new Date(project.endDate))
    const curveS = buildCurveS(tasks, new Date(project.startDate), new Date(project.endDate))

    const today = new Date()
    const delayedTasks = tasks.filter(t =>
      !t.isGroup && t.status !== 'COMPLETED' && t.plannedEnd && new Date(t.plannedEnd) < today
    )

    const in30days = new Date(); in30days.setDate(in30days.getDate() + 30)
    const upcomingMilestones = tasks.filter(t =>
      t.isMilestone && t.plannedEnd &&
      new Date(t.plannedEnd) >= today && new Date(t.plannedEnd) <= in30days
    )

    return NextResponse.json({ data: { kpis, curveS, delayedTasks, upcomingMilestones } })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
