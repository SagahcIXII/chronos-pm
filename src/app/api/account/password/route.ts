// src/app/api/account/password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireUser, accessErrorResponse } from '@/lib/access'

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres').max(100),
})

// POST /api/account/password — o próprio usuário troca a sua senha.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()

    const parsed = ChangePasswordSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }, { status: 422 })
    }
    const { currentPassword, newPassword } = parsed.data

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const ok = await bcrypt.compare(currentPassword, dbUser.password)
    if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'A nova senha deve ser diferente da atual' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, 12) },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = accessErrorResponse(e)
    return NextResponse.json({ error }, { status })
  }
}
