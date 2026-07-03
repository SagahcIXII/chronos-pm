// src/app/api/snapshots/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, assertProjectAccess, accessErrorResponse } from '@/lib/access'

// GET /api/snapshots?projectId=xxx
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    await assertProjectAccess(projectId, user)

    const snapshots = await prisma.projectSnapshot.findMany({
      where: { projectId },
      orderBy: { date: 'asc' },
    })
    return NextResponse.json(snapshots.map(s => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      executed: s.executed,
      note: s.note ?? '',
    })))
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// POST /api/snapshots — exige acesso de escrita ao projeto.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const { projectId, date, executed, note } = await req.json()
    if (!projectId || !date || executed === undefined) {
      return NextResponse.json({ error: 'projectId, date e executed são obrigatórios' }, { status: 400 })
    }

    await assertProjectAccess(projectId, user, { write: true })

    const dateObj = new Date(date + 'T12:00:00Z')
    const snapshot = await prisma.projectSnapshot.upsert({
      where: { projectId_date: { projectId, date: dateObj } },
      update: { executed: Number(executed), note: note || null },
      create: { projectId, date: dateObj, executed: Number(executed), note: note || null },
    })

    return NextResponse.json({
      id: snapshot.id,
      date: snapshot.date.toISOString().slice(0, 10),
      executed: snapshot.executed,
      note: snapshot.note ?? '',
    })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// DELETE /api/snapshots?id=xxx — exige acesso de escrita ao projeto do snapshot.
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const snap = await prisma.projectSnapshot.findUnique({ where: { id } })
    if (!snap) return NextResponse.json({ error: 'Snapshot não encontrado' }, { status: 404 })
    await assertProjectAccess(snap.projectId, user, { write: true })

    await prisma.projectSnapshot.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
