// src/app/api/tasks/[id]/attachments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { requireUser, assertTaskAccess, accessErrorResponse } from '@/lib/access'

// Limite conservador: o corpo de requisição da função serverless na Vercel
// é ~4,5 MB. Para arquivos maiores, migrar para upload direto ao Blob (client upload).
const MAX_SIZE = 4 * 1024 * 1024 // 4 MB

// GET /api/tasks/[id]/attachments — lista anexos da tarefa.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    await assertTaskAccess(params.id, user)

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: attachments })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// POST /api/tasks/[id]/attachments — upload (multipart/form-data, campo "file").
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    await assertTaskAccess(params.id, user, { write: true })

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Armazenamento de arquivos não configurado (BLOB_READ_WRITE_TOKEN ausente).' },
        { status: 503 }
      )
    }

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Arquivo excede 4 MB' }, { status: 413 })

    // Sanitiza o nome e mantém unicidade por timestamp.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const blob = await put(`tasks/${params.id}/${Date.now()}-${safeName}`, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: params.id,
        name: file.name,
        url: blob.url,
        size: file.size,
        mimeType: file.type || null,
      },
    })

    await prisma.taskHistory.create({
      data: { taskId: params.id, authorId: user.id, changeType: 'ATTACHMENT_ADDED', note: `Anexo: ${file.name}` },
    })

    return NextResponse.json({ data: attachment }, { status: 201 })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}

// DELETE /api/tasks/[id]/attachments?attachmentId=xxx
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser()
    await assertTaskAccess(params.id, user, { write: true })

    const attachmentId = req.nextUrl.searchParams.get('attachmentId')
    if (!attachmentId) return NextResponse.json({ error: 'attachmentId obrigatório' }, { status: 400 })

    const att = await prisma.taskAttachment.findUnique({ where: { id: attachmentId } })
    if (!att || att.taskId !== params.id) return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 })

    // Remove do storage (ignora falha para não travar a remoção do registro).
    try { await del(att.url) } catch {}
    await prisma.taskAttachment.delete({ where: { id: attachmentId } })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
