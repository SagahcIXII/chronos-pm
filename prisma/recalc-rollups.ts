// prisma/recalc-rollups.ts
// Recalcula progresso/status dos grupos e o progresso de TODOS os projetos
// com a fórmula oficial. Rodar uma vez após o deploy do roll-up automático:
//   npm run db:recalc
import { PrismaClient } from '@prisma/client'
import { projectProgress, computeGroupRollups } from '../src/lib/progress'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, code: true, progress: true } })
  for (const p of projects) {
    const tasks = await prisma.task.findMany({
      where: { projectId: p.id },
      select: { id: true, parentId: true, isGroup: true, weight: true, progress: true, status: true },
    })
    const byId = new Map(tasks.map(t => [t.id, t]))
    const changed = computeGroupRollups(tasks).filter(r => {
      const cur = byId.get(r.id)!
      return cur.progress !== r.progress || cur.status !== r.status
    })
    const progress = projectProgress(tasks)
    await prisma.$transaction([
      ...changed.map(r => prisma.task.update({ where: { id: r.id }, data: { progress: r.progress, status: r.status } })),
      prisma.project.update({ where: { id: p.id }, data: { progress } }),
    ])
    console.log(`${p.code}: ${changed.length} grupo(s) atualizado(s), projeto ${p.progress}% → ${progress}%`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
