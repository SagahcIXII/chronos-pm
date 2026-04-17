import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/snapshots?projectId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/snapshots
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { projectId, date, executed, note } = await req.json()
    if (!projectId || !date || executed === undefined) {
      return NextResponse.json({ error: 'projectId, date e executed são obrigatórios' }, { status: 400 })
    }

    const dateObj = new Date(date + 'T12:00:00Z')

    // Upsert: atualiza se já existe snapshot para este projeto+data
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/snapshots?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await prisma.projectSnapshot.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
