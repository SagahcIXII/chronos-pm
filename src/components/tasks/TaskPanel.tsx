'use client'
// src/components/tasks/TaskPanel.tsx
import { useState } from 'react'
import type { TaskWithRelations } from '@/types'
import { formatDateBR, statusLabel, priorityLabel, isTaskDelayed } from '@/lib/schedule'
import { differenceInCalendarDays } from 'date-fns'

interface Props {
  task: TaskWithRelations
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onProgressChange: (v: number) => void
  onStatusChange: (s: string) => void
  onAddComment: (text: string) => void
}

export function TaskPanel({ task, onClose, onEdit, onDelete, onProgressChange, onStatusChange, onAddComment }: Props) {
  const [tab, setTab] = useState<'info' | 'comments' | 'history'>('info')
  const [newComment, setNewComment] = useState('')
  const delayed = isTaskDelayed(task)

  const durationPlanned = task.plannedStart && task.plannedEnd
    ? differenceInCalendarDays(new Date(task.plannedEnd), new Date(task.plannedStart))
    : null
  const durationActual = task.actualStart && task.actualEnd
    ? differenceInCalendarDays(new Date(task.actualEnd), new Date(task.actualStart))
    : null

  const predecessors = (task.predecessors ?? []).map(d => d.predecessor)

  return (
    <div className="w-[360px] min-w-[360px] bg-[var(--surface)] border-l border-[var(--border)] flex flex-col animate-slide-in">

      {/* Header */}
      <div className="flex items-start gap-2 px-4 py-4 border-b border-[var(--border)]">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {task.isCritical && <span className="badge badge-yellow text-[10px]">⚡ Crítica</span>}
            {task.isMilestone && <span className="badge badge-purple text-[10px]">◆ Marco</span>}
            {delayed && <span className="badge badge-red text-[10px]">⏰ Atrasada</span>}
          </div>
          <h3 className="text-[13.5px] font-bold text-[var(--text)] leading-snug">{task.name}</h3>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button className="btn btn-ghost btn-icon" onClick={onEdit} title="Editar">
            <EditIcon />
          </button>
          <button className="btn btn-danger btn-icon" onClick={() => { if (confirm(`Excluir "${task.name}"?`)) onDelete() }} title="Excluir">
            <TrashIcon />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-[var(--border)]">
        {(['info','comments','history'] as const).map(t => (
          <button key={t} className={`tab py-1 px-3 text-xs ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ info: 'Detalhes', comments: `Comentários${(task.comments?.length ?? 0) > 0 ? ` (${task.comments!.length})` : ''}`, history: 'Histórico' }[t]}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── ABA: INFO ── */}
        {tab === 'info' && (
          <>
            {/* Progresso */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="form-label mb-0">Progresso</span>
                <span className={`text-display text-2xl font-black ${
                  task.progress === 100 ? 'text-green-400' :
                  delayed ? 'text-red-400' : 'text-[var(--text)]'
                }`}>{task.progress}%</span>
              </div>
              <div className="progress-bar h-2 mb-2">
                <div
                  className={`progress-fill ${task.progress === 100 ? 'progress-green' : delayed ? 'progress-red' : 'progress-blue'}`}
                  style={{ width: task.progress + '%' }}
                />
              </div>
              <input
                type="range" min={0} max={100} value={task.progress}
                onChange={e => onProgressChange(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <hr className="border-[var(--border)]" />

            {/* Status e prioridade */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="form-label">Status</p>
                <select
                  className="form-control h-8 text-xs"
                  value={task.status}
                  onChange={e => onStatusChange(e.target.value)}
                >
                  {['COMPLETED','IN_PROGRESS','NOT_STARTED','ON_HOLD','DELAYED'].map(s => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="form-label">Prioridade</p>
                <span className={`badge mt-1 ${
                  task.priority === 'CRITICAL' ? 'badge-red' :
                  task.priority === 'HIGH' ? 'badge-yellow' :
                  task.priority === 'MEDIUM' ? 'badge-blue' : 'badge-gray'
                }`}>{priorityLabel(task.priority)}</span>
              </div>
            </div>

            {/* Responsável */}
            {task.responsible && (
              <div>
                <p className="form-label">Responsável</p>
                <p className="text-sm text-[var(--text)]">{task.responsible}</p>
              </div>
            )}

            {/* Descrição */}
            {task.description && (
              <div>
                <p className="form-label">Descrição</p>
                <p className="text-sm text-[var(--text2)] leading-relaxed">{task.description}</p>
              </div>
            )}

            <hr className="border-[var(--border)]" />

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="form-label">Início Planejado</p>
                <p className="text-[var(--text)]">{formatDateBR(task.plannedStart)}</p>
              </div>
              <div>
                <p className="form-label">Término Planejado</p>
                <p className={delayed ? 'text-red-400' : 'text-[var(--text)]'}>{formatDateBR(task.plannedEnd)}</p>
              </div>
              <div>
                <p className="form-label">Início Real</p>
                <p className="text-green-400">{formatDateBR(task.actualStart)}</p>
              </div>
              <div>
                <p className="form-label">Término Real</p>
                <p className="text-green-400">{formatDateBR(task.actualEnd)}</p>
              </div>
              <div>
                <p className="form-label">Duração Planejada</p>
                <p className="text-[var(--text)]">{durationPlanned !== null ? `${durationPlanned} dias` : '—'}</p>
              </div>
              <div>
                <p className="form-label">Duração Real</p>
                <p className="text-[var(--text)]">{durationActual !== null ? `${durationActual} dias` : '—'}</p>
              </div>
            </div>

            {/* Predecessoras */}
            {predecessors.length > 0 && (
              <>
                <hr className="border-[var(--border)]" />
                <div>
                  <p className="form-label mb-2">Predecessoras ({predecessors.length})</p>
                  <div className="space-y-1.5">
                    {predecessors.map(p => (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-[var(--surface2)] rounded-lg border border-[var(--border)]">
                        <LinkIcon />
                        <span className="text-xs text-[var(--text2)] flex-1 truncate">{p.name}</span>
                        <span className={`badge text-[10px] ${
                          p.status === 'COMPLETED' ? 'badge-green' :
                          p.status === 'IN_PROGRESS' ? 'badge-blue' : 'badge-gray'
                        }`}>{statusLabel(p.status)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Observações */}
            {task.observations && (
              <>
                <hr className="border-[var(--border)]" />
                <div className="alert alert-warning text-xs">{task.observations}</div>
              </>
            )}
          </>
        )}

        {/* ── ABA: COMENTÁRIOS ── */}
        {tab === 'comments' && (
          <div className="space-y-3">
            {(task.comments ?? []).length === 0 && (
              <div className="empty-state py-8">
                <span className="text-3xl">💬</span>
                <span className="text-sm">Nenhum comentário ainda</span>
              </div>
            )}
            {(task.comments ?? []).map(c => (
              <div key={c.id} className="bg-[var(--surface2)] rounded-lg p-3 border border-[var(--border)]">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-semibold text-[var(--text)]">{(c as any).author?.name ?? 'Usuário'}</span>
                  <span className="text-[10px] text-[var(--text3)]">{formatDateBR(c.createdAt)}</span>
                </div>
                <p className="text-[13px] text-[var(--text2)] leading-relaxed">{c.text}</p>
              </div>
            ))}

            {/* Input */}
            <div className="flex gap-2 pt-2">
              <input
                className="form-control text-sm"
                placeholder="Adicionar comentário..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newComment.trim()) {
                    onAddComment(newComment.trim())
                    setNewComment('')
                  }
                }}
              />
              <button
                className="btn btn-primary btn-icon flex-shrink-0"
                onClick={() => { if (newComment.trim()) { onAddComment(newComment.trim()); setNewComment('') } }}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        )}

        {/* ── ABA: HISTÓRICO ── */}
        {tab === 'history' && (
          <div className="space-y-3">
            {(task.history ?? []).length === 0 && (
              <div className="empty-state py-8">
                <span className="text-3xl">📋</span>
                <span className="text-sm">Nenhum histórico</span>
              </div>
            )}
            {(task.history ?? []).map(h => (
              <div key={h.id} className="flex gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  h.changeType === 'CREATED' ? 'bg-green-500' :
                  h.changeType === 'PROGRESS_UPDATED' ? 'bg-blue-500' :
                  h.changeType === 'STATUS_CHANGED' ? 'bg-purple-500' :
                  h.changeType === 'DATES_CHANGED' ? 'bg-amber-500' : 'bg-[var(--border2)]'
                }`} />
                <div>
                  <p className="text-[12.5px] text-[var(--text2)]">
                    {h.note ?? `${h.field ?? 'Campo'}: ${h.oldValue ?? '—'} → ${h.newValue ?? '—'}`}
                  </p>
                  <p className="text-[10.5px] text-[var(--text3)] mt-0.5">
                    {formatDateBR(h.createdAt)} · {(h as any).author?.name ?? 'Sistema'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ícones inline ──────────────────────────────────────────
const CloseIcon = () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>
const EditIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const TrashIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
const LinkIcon = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
const SendIcon = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1={22} y1={2} x2={11} y2={13}/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
