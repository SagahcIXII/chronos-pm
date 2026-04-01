import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  await prisma.taskDependency.deleteMany()
  await prisma.taskHistory.deleteMany()
  await prisma.taskComment.deleteMany()
  await prisma.taskAttachment.deleteMany()
  await prisma.task.deleteMany()
  await prisma.baseline.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  const admin = await prisma.user.create({
    data: { name: 'Administrador BD7D', email: 'admin@bd7d.com.br', password: await bcrypt.hash('chronos2025', 12), role: 'ADMIN' }
  })
  await prisma.user.create({
    data: { name: 'Eng. Carlos Souza', email: 'carlos@bd7d.com.br', password: await bcrypt.hash('manager123', 12), role: 'MANAGER' }
  })

  const project = await prisma.project.create({
    data: { code: 'BD7D-2025-001', name: 'Infraestrutura Industrial — Planta Norte', description: 'Implantação de infraestrutura elétrica, civil e automação.', responsible: 'Eng. Carlos Souza', ownerId: admin.id, startDate: new Date('2025-02-01'), endDate: new Date('2025-09-30'), status: 'IN_PROGRESS', progress: 42 }
  })

  const g1 = await prisma.task.create({ data: { projectId: project.id, order:10, level:0, isGroup:true, isCritical:true, weight:8, name:'1. PLANEJAMENTO', responsible:'Equipe BD7D', plannedStart:new Date('2025-02-01'), plannedEnd:new Date('2025-02-28'), actualStart:new Date('2025-02-01'), actualEnd:new Date('2025-02-26'), status:'COMPLETED', priority:'HIGH', progress:100 }})
  const t1a = await prisma.task.create({ data: { projectId:project.id, parentId:g1.id, order:11, level:1, weight:3, name:'1.1 Levantamento inicial', responsible:'Eng. Carlos Souza', plannedStart:new Date('2025-02-01'), plannedEnd:new Date('2025-02-10'), actualStart:new Date('2025-02-01'), actualEnd:new Date('2025-02-09'), status:'COMPLETED', priority:'HIGH', progress:100 }})
  const t1b = await prisma.task.create({ data: { projectId:project.id, parentId:g1.id, order:12, level:1, weight:3, isCritical:true, name:'1.2 Elaboração de projetos', responsible:'Eng. Ana Lima', plannedStart:new Date('2025-02-10'), plannedEnd:new Date('2025-02-20'), actualStart:new Date('2025-02-10'), actualEnd:new Date('2025-02-18'), status:'COMPLETED', priority:'HIGH', progress:100 }})
  const t1c = await prisma.task.create({ data: { projectId:project.id, parentId:g1.id, order:13, level:1, weight:2, isCritical:true, isMilestone:true, name:'1.3 Aprovações regulatórias', responsible:'Eng. Carlos Souza', plannedStart:new Date('2025-02-20'), plannedEnd:new Date('2025-02-28'), actualStart:new Date('2025-02-19'), actualEnd:new Date('2025-02-26'), status:'COMPLETED', priority:'CRITICAL', progress:100 }})

  const g2 = await prisma.task.create({ data: { projectId:project.id, order:20, level:0, isGroup:true, isCritical:true, weight:5, name:'2. MOBILIZAÇÃO', responsible:'Equipe BD7D', plannedStart:new Date('2025-03-01'), plannedEnd:new Date('2025-03-15'), actualStart:new Date('2025-03-01'), actualEnd:new Date('2025-03-17'), status:'COMPLETED', priority:'HIGH', progress:100 }})
  const t2a = await prisma.task.create({ data: { projectId:project.id, parentId:g2.id, order:21, level:1, weight:2, name:'2.1 Contratação de equipe', responsible:'RH', plannedStart:new Date('2025-03-01'), plannedEnd:new Date('2025-03-08'), actualStart:new Date('2025-03-01'), actualEnd:new Date('2025-03-08'), status:'COMPLETED', priority:'MEDIUM', progress:100 }})
  const t2b = await prisma.task.create({ data: { projectId:project.id, parentId:g2.id, order:22, level:1, weight:3, isCritical:true, name:'2.2 Montagem de canteiro', responsible:'Eng. Pedro Mota', plannedStart:new Date('2025-03-08'), plannedEnd:new Date('2025-03-15'), actualStart:new Date('2025-03-08'), actualEnd:new Date('2025-03-17'), status:'COMPLETED', priority:'HIGH', progress:100 }})

  const g3 = await prisma.task.create({ data: { projectId:project.id, order:30, level:0, isGroup:true, isCritical:true, weight:25, name:'3. INFRAESTRUTURA CIVIL', responsible:'Eng. Pedro Mota', plannedStart:new Date('2025-03-15'), plannedEnd:new Date('2025-06-30'), actualStart:new Date('2025-03-17'), status:'IN_PROGRESS', priority:'CRITICAL', progress:58 }})
  const t3a = await prisma.task.create({ data: { projectId:project.id, parentId:g3.id, order:31, level:1, weight:8, isCritical:true, name:'3.1 Fundações', responsible:'Eng. Pedro Mota', plannedStart:new Date('2025-03-15'), plannedEnd:new Date('2025-04-15'), actualStart:new Date('2025-03-17'), actualEnd:new Date('2025-04-12'), status:'COMPLETED', priority:'CRITICAL', progress:100 }})
  const t3b = await prisma.task.create({ data: { projectId:project.id, parentId:g3.id, order:32, level:1, weight:10, isCritical:true, name:'3.2 Estrutura metálica', responsible:'Metalcon LTDA', plannedStart:new Date('2025-04-15'), plannedEnd:new Date('2025-05-30'), actualStart:new Date('2025-04-12'), status:'IN_PROGRESS', priority:'CRITICAL', progress:70, observations:'Aguardando 2º lote de perfis.' }})
  const t3c = await prisma.task.create({ data: { projectId:project.id, parentId:g3.id, order:33, level:1, weight:7, isCritical:true, name:'3.3 Cobertura e fechamento', responsible:'Eng. Pedro Mota', plannedStart:new Date('2025-05-30'), plannedEnd:new Date('2025-06-30'), status:'NOT_STARTED', priority:'HIGH', progress:0 }})

  const g4 = await prisma.task.create({ data: { projectId:project.id, order:40, level:0, isGroup:true, isCritical:true, weight:22, name:'4. INFRAESTRUTURA ELÉTRICA', responsible:'Eng. Ana Lima', plannedStart:new Date('2025-04-01'), plannedEnd:new Date('2025-07-31'), actualStart:new Date('2025-04-01'), status:'IN_PROGRESS', priority:'CRITICAL', progress:35 }})
  const t4a = await prisma.task.create({ data: { projectId:project.id, parentId:g4.id, order:41, level:1, weight:8, isCritical:true, name:'4.1 Subestação MT/BT', responsible:'Eng. Ana Lima', plannedStart:new Date('2025-04-01'), plannedEnd:new Date('2025-05-01'), actualStart:new Date('2025-04-01'), actualEnd:new Date('2025-04-28'), status:'COMPLETED', priority:'CRITICAL', progress:100 }})
  const t4b = await prisma.task.create({ data: { projectId:project.id, parentId:g4.id, order:42, level:1, weight:9, isCritical:true, name:'4.2 Distribuição interna BT', responsible:'Elétrica Norte', plannedStart:new Date('2025-05-01'), plannedEnd:new Date('2025-06-30'), actualStart:new Date('2025-04-28'), status:'IN_PROGRESS', priority:'HIGH', progress:40 }})
  const t4c = await prisma.task.create({ data: { projectId:project.id, parentId:g4.id, order:43, level:1, weight:5, name:'4.3 Iluminação industrial', responsible:'Elétrica Norte', plannedStart:new Date('2025-06-30'), plannedEnd:new Date('2025-07-31'), status:'NOT_STARTED', priority:'MEDIUM', progress:0 }})

  const g5 = await prisma.task.create({ data: { projectId:project.id, order:50, level:0, isGroup:true, isCritical:true, weight:20, name:'5. AUTOMAÇÃO INDUSTRIAL', responsible:'BD7D Solutions', plannedStart:new Date('2025-07-01'), plannedEnd:new Date('2025-09-15'), status:'NOT_STARTED', priority:'CRITICAL', progress:0 }})
  const t5a = await prisma.task.create({ data: { projectId:project.id, parentId:g5.id, order:51, level:1, weight:7, isCritical:true, name:'5.1 SDCD — Arquitetura', responsible:'Eng. Rocha', plannedStart:new Date('2025-07-01'), plannedEnd:new Date('2025-07-31'), status:'NOT_STARTED', priority:'CRITICAL', progress:0 }})
  const t5b = await prisma.task.create({ data: { projectId:project.id, parentId:g5.id, order:52, level:1, weight:8, isCritical:true, name:'5.2 IHM e SCADA', responsible:'BD7D Solutions', plannedStart:new Date('2025-07-31'), plannedEnd:new Date('2025-08-31'), status:'NOT_STARTED', priority:'HIGH', progress:0 }})
  const t5c = await prisma.task.create({ data: { projectId:project.id, parentId:g5.id, order:53, level:1, weight:5, isCritical:true, isMilestone:true, name:'5.3 Comissionamento', responsible:'BD7D Solutions', plannedStart:new Date('2025-08-31'), plannedEnd:new Date('2025-09-15'), status:'NOT_STARTED', priority:'CRITICAL', progress:0 }})
  const t6 = await prisma.task.create({ data: { projectId:project.id, order:60, level:0, isCritical:true, isMilestone:true, weight:5, name:'6. ENTREGA E ACEITE FINAL', responsible:'Eng. Carlos Souza', plannedStart:new Date('2025-09-15'), plannedEnd:new Date('2025-09-30'), status:'NOT_STARTED', priority:'CRITICAL', progress:0 }})

  await prisma.taskDependency.createMany({ data: [
    { predecessorId:t1a.id, successorId:t1b.id, type:'FINISH_TO_START' },
    { predecessorId:t1b.id, successorId:t1c.id, type:'FINISH_TO_START' },
    { predecessorId:t1c.id, successorId:t2a.id, type:'FINISH_TO_START' },
    { predecessorId:t2a.id, successorId:t2b.id, type:'FINISH_TO_START' },
    { predecessorId:t2b.id, successorId:t3a.id, type:'FINISH_TO_START' },
    { predecessorId:t3a.id, successorId:t3b.id, type:'FINISH_TO_START' },
    { predecessorId:t3b.id, successorId:t3c.id, type:'FINISH_TO_START' },
    { predecessorId:t3a.id, successorId:t4a.id, type:'FINISH_TO_START' },
    { predecessorId:t4a.id, successorId:t4b.id, type:'FINISH_TO_START' },
    { predecessorId:t4b.id, successorId:t4c.id, type:'FINISH_TO_START' },
    { predecessorId:t4b.id, successorId:t5a.id, type:'FINISH_TO_START' },
    { predecessorId:t5a.id, successorId:t5b.id, type:'FINISH_TO_START' },
    { predecessorId:t5b.id, successorId:t5c.id, type:'FINISH_TO_START' },
    { predecessorId:t5c.id, successorId:t6.id,  type:'FINISH_TO_START' },
  ]})

  await prisma.taskComment.createMany({ data: [
    { taskId:t3b.id, authorId:admin.id, text:'Chegada do 2º lote de perfis confirmada para 15/05.' },
    { taskId:t4b.id, authorId:admin.id, text:'Aguardando disjuntores 250A — previsão 15/05.' },
  ]})

  await prisma.taskHistory.createMany({ data: [
    { taskId:t3b.id, authorId:admin.id, changeType:'CREATED', note:'Tarefa criada no cronograma inicial', createdAt:new Date('2025-04-12') },
    { taskId:t3b.id, authorId:admin.id, changeType:'PROGRESS_UPDATED', field:'progress', oldValue:'60', newValue:'70', note:'Atualizado após vistoria', createdAt:new Date('2025-05-02') },
  ]})

  const allTasks = await prisma.task.findMany({ where:{ projectId:project.id } })
  await prisma.baseline.create({ data:{ projectId:project.id, snapshot:JSON.stringify(allTasks), createdBy:admin.id } })

  console.log('✅ Seed concluído!')
  console.log('   admin@bd7d.com.br / chronos2025')
}

main().catch(e => { console.error('❌ Erro:', e); process.exit(1) }).finally(() => prisma.$disconnect())
