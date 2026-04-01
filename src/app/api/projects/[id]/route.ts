import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        tasks: {
          include: {
            children: true,
            predecessors: { include: { predecessor: true } },
            successors: { include: { successor: true } },
          },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
        }
      }
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(project)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, description, responsible, startDate, endDate, status, progress, observations } = body

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(responsible && { responsible }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status }),
        ...(progress !== undefined && { progress }),
        ...(observations !== undefined && { observations }),
      }
    })
    return NextResponse.json(project)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.project.update({
      where: { id: params.id },
      data: { archived: true }
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
