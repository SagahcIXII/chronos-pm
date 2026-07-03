// src/lib/access.ts
// ─────────────────────────────────────────────────────────────
// Controle de acesso central (multi-tenancy).
//
// Regras:
//   • ADMIN  → enxerga e edita TODOS os projetos (você / BD7D).
//   • MANAGER → edita projetos que possui ou que lhe foram atribuídos.
//   • CLIENT / VIEWER → SOMENTE LEITURA e SOMENTE dos projetos onde
//     ele é o dono (ownerId) ou o cliente (clientId).
//
// Um cliente NUNCA vê os projetos internos da BD7D: o filtro de
// visibilidade é aplicado em toda leitura no servidor.
// ─────────────────────────────────────────────────────────────
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export type Role = 'ADMIN' | 'MANAGER' | 'CLIENT' | 'VIEWER'

export interface SessionUser {
  id: string
  email: string
  role: Role
}

/** Erro de autorização com status HTTP embutido. */
export class AccessError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.status = status
    this.name = 'AccessError'
  }
}

/** Retorna o usuário logado ou lança 401. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new AccessError('Não autorizado', 401)
  return {
    id: session.user.id,
    email: session.user.email,
    role: (session.user.role as Role) ?? 'VIEWER',
  }
}

/** Admin enxerga tudo. */
export function isAdmin(user: SessionUser): boolean {
  return user.role === 'ADMIN'
}

/** Quem pode criar/editar/excluir (escrita). */
export function canEdit(user: SessionUser): boolean {
  return user.role === 'ADMIN' || user.role === 'MANAGER'
}

/**
 * Fragmento `where` do Prisma que restringe os projetos visíveis.
 *   • Admin → {} (sem restrição).
 *   • Demais → dono OU cliente do projeto.
 * Use em TODA listagem/leitura de projetos.
 */
export function projectVisibilityWhere(user: SessionUser): Prisma.ProjectWhereInput {
  if (isAdmin(user)) return {}
  return { OR: [{ ownerId: user.id }, { clientId: user.id }] }
}

/**
 * Garante que o usuário pode acessar um projeto específico.
 * @param opts.write exige permissão de escrita (ADMIN/MANAGER).
 * @returns o projeto (sem includes) quando autorizado.
 */
export async function assertProjectAccess(
  projectId: string,
  user: SessionUser,
  opts: { write?: boolean } = {}
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectVisibilityWhere(user) },
  })
  if (!project) throw new AccessError('Projeto não encontrado', 404)
  if (opts.write && !canEdit(user)) throw new AccessError('Sem permissão para editar', 403)
  return project
}

/**
 * Garante acesso a uma tarefa via o projeto ao qual ela pertence.
 * @returns { task, project }
 */
export async function assertTaskAccess(
  taskId: string,
  user: SessionUser,
  opts: { write?: boolean } = {}
) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw new AccessError('Tarefa não encontrada', 404)
  const project = await assertProjectAccess(task.projectId, user, opts)
  return { task, project }
}

/** Converte qualquer erro em NextResponse JSON com o status correto. */
export function accessErrorResponse(err: unknown) {
  if (err instanceof AccessError) {
    return { error: err.message, status: err.status }
  }
  return { error: 'Erro interno', status: 500 }
}
