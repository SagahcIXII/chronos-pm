'use client'
// src/components/tasks/TaskModal.tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { TaskWithRelations } from '@/types'
import { formatDateBR } from '@/lib/schedule'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  responsible: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),
  status: z.enum(['NOT_STARTED','IN_PROGRESS','COMPLETED','ON_HOLD','DELAYED']),
  progress: z.coerce.number().min(0).max(100),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  actualStart: z.string().optional(),
  actualEnd: z.string().optional(),
  isCritical: z.boolean(),
  isMilestone: z.boolean(),
  weight: z.coerce.number().min(0.1).max(100),
  observations: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  task?: TaskWithRelations | null
  allTasks: TaskWithRelations[]
  projectId: string
  parentId?: string | null
  onClose: () => void
  onSave: (data: FormData & { predecessorIds?: string[] }) => Promise<void>
}

const toInputDate = (d: Date | string | null | undefined) => {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export function TaskModal({ task, allTasks, projectId, parentId, onClose, onSave }: Props) {
  const isEditing = !!task

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: task?.name ?? '',
      responsible: task?.responsible ?? '',
      description: task?.description ?? '',
      priority: (task?.priority as any) ?? 'MEDIUM',
      status: (task?.status as any) ?? 'NOT_STARTED',
      progress: task?.progress ?? 0,
      plannedStart: toInputDate(task?.plannedStart),
      plannedEnd: toInputDate(task?.plannedEnd),
      actualStart: toInputDate(task?.actualStart),
      actualEnd: toInputDate(task?.actualEnd),
      isCritical: task?.isCritical ?? false,
      isMilestone: task?.isMilestone ?? false,
      weight: task?.weight ?? 1,
      observations: task?.observations ?? '',
    },
  })

  const progress = watch('progress')
  const status = watch('status')

  // Auto-set progress quando status muda
  useEffect(() => {
    if (status === 'COMPLETED') setValue('progress', 100)
    if (status === 'NOT_STARTED') setValue('progress', 0)
  }, [status, setValue])

  const onSubmit = async (data: FormData) => {
    await onSave({ ...data, predecessorIds: [] })
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.currentTarget === e.target) onClose() }}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><CloseIcon /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body space-y-4">

            {/* Nome */}
            <div>
              <label className="form-label">Nome da Tarefa *</label>
              <input className="form-control" {...register('name')} placeholder="Ex: Instalação de fundações" />
              {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
            </div>

            {/* Responsável + Prioridade + Status */}
            <div className="form-row-3">
              <div>
                <label className="form-label">Responsável</label>
                <input className="form-control" {...register('responsible')} placeholder="Nome ou equipe" />
              </div>
              <div>
                <label className="form-label">Prioridade</label>
                <select className="form-control" {...register('priority')}>
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-control" {...register('status')}>
                  <option value="NOT_STARTED">Não Iniciada</option>
                  <option value="IN_PROGRESS">Em Andamento</option>
                  <option value="COMPLETED">Concluída</option>
                  <option value="ON_HOLD">Pausada</option>
                  <option value="DELAYED">Atrasada</option>
                </select>
              </div>
            </div>

            {/* Progresso */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="form-label mb-0">Progresso</label>
                <span className="text-sm font-bold text-[var(--text)]">{progress}%</span>
              </div>
              <input type="range" min={0} max={100} {...register('progress')} className="w-full accent-blue-500" />
            </div>

            {/* Datas planejadas */}
            <div className="form-row">
              <div>
                <label className="form-label">Início Planejado</label>
                <input type="date" className="form-control" {...register('plannedStart')} />
              </div>
              <div>
                <label className="form-label">Término Planejado</label>
                <input type="date" className="form-control" {...register('plannedEnd')} />
              </div>
            </div>

            {/* Datas reais */}
            <div className="form-row">
              <div>
                <label className="form-label">Início Real</label>
                <input type="date" className="form-control" {...register('actualStart')} />
              </div>
              <div>
                <label className="form-label">Término Real</label>
                <input type="date" className="form-control" {...register('actualEnd')} />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="form-label">Descrição</label>
              <textarea className="form-control" rows={3} {...register('description')} placeholder="Detalhamento da atividade..." />
            </div>

            {/* Observações */}
            <div>
              <label className="form-label">Observações / Alertas</label>
              <textarea className="form-control" rows={2} {...register('observations')} placeholder="Avisos, dependências externas..." />
            </div>

            {/* Peso + flags */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="form-label mb-0">Peso:</label>
                <input type="number" step={0.1} min={0.1} max={100} className="form-control w-20" {...register('weight')} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-amber-500 w-3.5 h-3.5" {...register('isCritical')} />
                <span className="text-sm text-[var(--text2)]">Tarefa Crítica</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-purple-500 w-3.5 h-3.5" {...register('isMilestone')} />
                <span className="text-sm text-[var(--text2)]">É Marco</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Salvando...' : isEditing ? '✓ Salvar Alterações' : '+ Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const CloseIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/>
  </svg>
)
