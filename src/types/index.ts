// src/types/index.ts
import type { Task, Project, TaskComment, TaskHistory, User, TaskDependency } from '@prisma/client'

// ─── Re-exports com extensões ─────────────────────────────

export type { Task, Project, TaskComment, TaskHistory, User, TaskDependency }

// Projeto com relações
export type ProjectWithTasks = Project & {
  tasks: TaskWithRelations[]
  owner: Pick<User, 'id' | 'name' | 'email'>
  _count?: { tasks: number }
}

// Tarefa com todas as relações carregadas
export type TaskWithRelations = Task & {
  children?: TaskWithRelations[]
  predecessors?: Array<TaskDependency & { predecessor: Task }>
  successors?: Array<TaskDependency & { successor: Task }>
  comments?: TaskComment[]
  history?: TaskHistory[]
  _count?: { comments: number; children: number }
}

// ─── Tipos de domínio do Gantt ────────────────────────────

export type GanttScale = 'days' | 'weeks' | 'months'

export type GanttBarData = {
  taskId: string
  name: string
  level: number
  isGroup: boolean
  isMilestone: boolean
  isCritical: boolean
  plannedStart: Date | null
  plannedEnd: Date | null
  actualStart: Date | null
  actualEnd: Date | null
  progress: number
  status: string
  predecessorIds: string[]
  rowIndex: number
}

// ─── Curva S ──────────────────────────────────────────────

export type CurveSDataPoint = {
  period: string          // "Jan/25", "Fev/25", etc.
  date: Date
  plannedCumulative: number   // % acumulado planejado
  executedCumulative: number | null  // null = futuro
  plannedPeriod: number
  executedPeriod: number | null
  deviation: number | null
}

// ─── Dashboard ────────────────────────────────────────────

export type DashboardKPIs = {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  notStartedTasks: number
  delayedTasks: number
  criticalTasks: number
  milestones: number
  completedMilestones: number
  overallProgress: number
  plannedProgress: number
  deviation: number
  trend: 'on_track' | 'delayed' | 'ahead'
  estimatedCompletion: Date | null
}

// ─── API Responses ────────────────────────────────────────

export type ApiResponse<T> = {
  data?: T
  error?: string
  message?: string
}

// ─── Forms ───────────────────────────────────────────────

export type ProjectFormData = {
  code: string
  name: string
  description?: string
  responsible: string
  startDate: string
  endDate: string
  status: string
  observations?: string
}

export type TaskFormData = {
  name: string
  description?: string
  responsible?: string
  priority: string
  status: string
  plannedStart?: string
  plannedEnd?: string
  actualStart?: string
  actualEnd?: string
  progress: number
  isMilestone: boolean
  isCritical: boolean
  observations?: string
  weight: number
  predecessorIds?: string[]
}

// ─── Filtros ──────────────────────────────────────────────

export type TaskFilters = {
  status?: string
  priority?: string
  responsible?: string
  search?: string
  isCritical?: boolean
  isDelayed?: boolean
}
