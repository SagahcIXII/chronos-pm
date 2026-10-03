// prisma/assign-organization.ts
// Vincula uma empresa a um usuário existente e a TODOS os projetos que ele
// criou (inclusive arquivados). Cria a empresa se ainda não existir.
//
// Por padrão só SIMULA. Para gravar, acrescente --apply:
//   npm run db:assign-org -- --org "BioAmazon" --owner abucker@gmail.com
//   npm run db:assign-org -- --org "BioAmazon" --owner abucker@gmail.com --apply
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const orgName = arg('org')?.trim()
  const ownerEmail = arg('owner')?.trim().toLowerCase()
  const apply = process.argv.includes('--apply')
  if (!orgName || !ownerEmail) {
    console.error('Uso: npm run db:assign-org -- --org "Nome da Empresa" --owner email@cliente.com [--apply]')
    process.exit(1)
  }

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } })
  if (!owner) throw new Error(`Usuário não encontrado: ${ownerEmail}`)
  if (owner.role === 'ADMIN') throw new Error('ADMIN não pertence a empresa — escolha um usuário MANAGER/CLIENT/VIEWER')

  const existing = await prisma.organization.findFirst({ where: { name: { equals: orgName, mode: 'insensitive' } } })
  const projects = await prisma.project.findMany({
    where: { ownerId: owner.id },
    select: { id: true, code: true, archived: true, organizationId: true },
    orderBy: { code: 'asc' },
  })
  const conflicting = projects.filter(p => p.organizationId && p.organizationId !== existing?.id)
  if (conflicting.length) {
    throw new Error(`Projetos já vinculados a OUTRA empresa: ${conflicting.map(p => p.code).join(', ')} — nada foi alterado`)
  }

  console.log(`${apply ? 'APLICANDO' : 'SIMULAÇÃO (use --apply para gravar)'}`)
  console.log(`Empresa : ${orgName} ${existing ? '(já existe)' : '(será criada)'}`)
  console.log(`Usuário : ${owner.name} <${owner.email}> [${owner.role}]`)
  console.log(`Projetos: ${projects.length}`)
  for (const p of projects) console.log(`  - ${p.code}${p.archived ? ' (arquivado)' : ''}`)
  if (!apply) return

  await prisma.$transaction(async tx => {
    const org = existing ?? await tx.organization.create({ data: { name: orgName } })
    await tx.user.update({ where: { id: owner.id }, data: { organizationId: org.id } })
    await tx.project.updateMany({ where: { ownerId: owner.id }, data: { organizationId: org.id } })
  })
  console.log('✔ Concluído.')
}

main()
  .catch(e => { console.error('✖', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
