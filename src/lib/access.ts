// src/lib/access.ts
// ─────────────────────────────────────────────────────────────
// Controle de acesso central (multi-tenancy).
//
// Regras (isolamento por EMPRESA):
//   • ADMIN (BD7D) → enxerga e edita TODOS os projetos de todas as empresas.
//   • Usuário de uma empresa → enxerga SOMENTE os projetos da sua empresa.
//       – MANAGER edita todos os projetos da empresa.
//       – CLIENT / VIEWER: somente leitura (podem comentar).
//   • Usuário sem empresa (interno BD7D, não-admin) → só os projetos que
//     criou e que não pertencem a nenhuma empresa.
//
// Uma empresa NUNCA vê projetos de outra nem os internos da BD7D: o filtro
// é aplicado em toda leitura no servidor. Usuário ou empresa inativos perdem
// o acesso na próxima requisição (não esperam a sessão expirar).
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
  organizationId: string | null
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

/**
 * Retorna o usuário logado ou lança 401. Papel e empresa vêm do BANCO (não do
 * token), então mudanças feitas pelo admin valem na hora.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new AccessError('Não autorizado', 401)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, active: true, organizationId: true, organization: { select: { active: true } } },
  })
  if (!user || !user.active) throw new AccessError('Usuário inativo', 401)
  if (user.organization && !user.organization.active) throw new AccessError('Empresa inativa', 401)
  return {
    id: user.id,
    email: user.email,
    role: (user.role as Role) ?? 'VIEWER',
    organizationId: user.organizationId,
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
 *   • Usuário de empresa → projetos da empresa.
 *   • Usuário sem empresa → projetos internos que ele criou.
 * Use em TODA listagem/leitura de projetos.
 */
export function projectVisibilityWhere(user: SessionUser): Prisma.ProjectWhereInput {
  if (isAdmin(user)) return {}
  if (user.organizationId) return { organizationId: user.organizationId }
  return { ownerId: user.id, organizationId: null }
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

/**
 * Valida as referências de uma tarefa a outras tarefas (pai e predecessoras):
 * todas devem pertencer ao MESMO projeto, e a hierarquia não pode formar ciclo.
 * Impede vincular tarefas a projetos de outro cliente.
 * @param taskId id da tarefa sendo editada (null na criação).
 */
export async function assertTaskRelations(
  projectId: string,
  taskId: string | null,
  rel: { parentId?: string | null; predecessorIds?: string[] }
) {
  const needsParent = !!rel.parentId
  const preds = rel.predecessorIds ?? []
  if (!needsParent && preds.length === 0) return

  const projectTasks = await prisma.task.findMany({
    where: { projectId },
    select: { id: true, parentId: true },
  })
  const byId = new Map(projectTasks.map(t => [t.id, t]))

  if (rel.parentId) {
    if (rel.parentId === taskId) throw new AccessError('Uma tarefa não pode ser pai de si mesma', 400)
    if (!byId.has(rel.parentId)) throw new AccessError('Tarefa pai não pertence a este projeto', 400)
    // Sobe a partir do novo pai: se encontrar a própria tarefa, haveria ciclo.
    let cur: string | null = rel.parentId
    while (cur) {
      if (cur === taskId) throw new AccessError('Hierarquia inválida: a tarefa pai é descendente desta tarefa', 400)
      cur = byId.get(cur)?.parentId ?? null
    }
  }

  for (const predId of preds) {
    if (predId === taskId) throw new AccessError('Uma tarefa não pode ser predecessora de si mesma', 400)
    if (!byId.has(predId)) throw new AccessError('Predecessora não pertence a este projeto', 400)
  }
}

/**
 * Valida o par papel/empresa de um usuário e devolve o organizationId a gravar.
 * ADMIN nunca pertence a empresa (enxerga todas).
 */
export async function resolveUserOrganization(role: string, organizationId: string | null | undefined) {
  if (role === 'ADMIN' || !organizationId) return null
  const org = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!org) throw new AccessError('Empresa informada não existe', 400)
  return org.id
}

/**
 * Empresa de um projeto novo/editado: ADMIN escolhe (ou deixa interno);
 * demais usuários sempre gravam na própria empresa.
 */
export async function resolveProjectOrganization(user: SessionUser, requested: string | null | undefined) {
  if (!isAdmin(user)) return user.organizationId
  if (!requested) return null
  const org = await prisma.organization.findUnique({ where: { id: requested } })
  if (!org) throw new AccessError('Empresa informada não existe', 400)
  return org.id
}

/** Converte qualquer erro em NextResponse JSON com o status correto. */
export function accessErrorResponse(err: unknown) {
  if (err instanceof AccessError) {
    return { error: err.message, status: err.status }
  }
  return { error: 'Erro interno', status: 500 }
}
