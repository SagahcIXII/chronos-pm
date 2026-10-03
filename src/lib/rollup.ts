// src/lib/rollup.ts
// ─────────────────────────────────────────────────────────────
// Consolidação automática (roll-up) após qualquer mudança em tarefas:
//
//   • Grupo: progresso = fórmula oficial (média ponderada pelo peso) das
//     tarefas folha DESCENDENTES (todos os níveis); status derivado:
//       todas concluídas → COMPLETED
//       alguma com avanço ou em andamento → IN_PROGRESS
//       caso contrário → NOT_STARTED
//     Grupo sem nenhuma tarefa folha abaixo mantém os valores manuais.
//   • Projeto: progresso = fórmula oficial sobre todas as folhas.
// ─────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'
import { projectProgress, computeGroupRollups } from '@/lib/progress'

/** Recalcula e grava os grupos e o progresso do projeto. */
export async function recalculateProjectRollups(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { id: true, parentId: true, isGroup: true, weight: true, progress: true, status: true },
  })
  const byId = new Map(tasks.map(t => [t.id, t]))
  const changed = computeGroupRollups(tasks).filter(r => {
    const cur = byId.get(r.id)!
    return cur.progress !== r.progress || cur.status !== r.status
  })

  await prisma.$transaction([
    ...changed.map(r =>
      prisma.task.update({ where: { id: r.id }, data: { progress: r.progress, status: r.status } })
    ),
    prisma.project.update({ where: { id: projectId }, data: { progress: projectProgress(tasks) } }),
  ])
}
