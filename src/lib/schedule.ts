// src/lib/schedule.ts
// Lógica de negócio do cronograma: CPM, Curva S, dias úteis

import {
  differenceInCalendarDays,
  addDays,
  isWeekend,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  format,
  isAfter,
  isBefore,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Task } from '@prisma/client'
import type { CurveSDataPoint, DashboardKPIs, GanttBarData, TaskWithRelations } from '@/types'

// ─── Dias úteis ───────────────────────────────────────────

const BR_HOLIDAYS_2025 = [
  '2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01',
  '2025-06-19', '2025-09-07', '2025-10-12', '2025-11-02',
  '2025-11-15', '2025-11-20', '2025-12-25',
]

export function isWorkingDay(date: Date, holidays: string[] = BR_HOLIDAYS_2025): boolean {
  if (isWeekend(date)) return false
  const str = format(date, 'yyyy-MM-dd')
  return !holidays.includes(str)
}

export function workingDaysBetween(start: Date, end: Date): number {
  let count = 0
  let cur = new Date(start)
  while (cur <= end) {
    if (isWorkingDay(cur)) count++
    cur = addDays(cur, 1)
  }
  return count
}

export function addWorkingDays(start: Date, days: number): Date {
  let remaining = days
  let cur = new Date(start)
  while (remaining > 0) {
    cur = addDays(cur, 1)
    if (isWorkingDay(cur)) remaining--
  }
  return cur
}

// ─── Progresso ponderado ──────────────────────────────────

export function computeWeightedProgress(tasks: Task[]): number {
  const leaves = tasks.filter(t => !t.isGroup)
  if (!leaves.length) return 0
  const totalWeight = leaves.reduce((s, t) => s + (t.weight || 1), 0)
  const done = leaves.reduce((s, t) => s + ((t.weight || 1) * t.progress) / 100, 0)
  return totalWeight ? Math.round((done / totalWeight) * 100) : 0
}

// ─── Detecção de atraso ───────────────────────────────────

export function isTaskDelayed(task: Task): boolean {
  if (task.status === 'COMPLETED') return false
  if (!task.plannedEnd) return false
  return isBefore(new Date(task.plannedEnd), new Date())
}

// ─── Curva S ──────────────────────────────────────────────

export function buildCurveS(
  tasks: Task[],
  projectStart: Date,
  projectEnd: Date
): CurveSDataPoint[] {
  const today = new Date()
  const months = eachMonthOfInterval({ start: projectStart, end: projectEnd })
  const totalWeight = tasks.filter(t => !t.isGroup).reduce((s, t) => s + (t.weight || 1), 0)

  let plannedAcc = 0
  let executedAcc = 0

  return months.map(monthStart => {
    const monthEnd = endOfMonth(monthStart)
    const isFuture = isAfter(monthStart, today)

    // Avanço planejado do período: peso das tarefas que deveriam estar concluídas até o fim do mês
    let plannedPeriod = 0
    let executedPeriod = 0

    tasks.filter(t => !t.isGroup).forEach(task => {
      const w = (task.weight || 1) / totalWeight * 100

      // Contribuição planejada — interpolação linear
      if (task.plannedStart && task.plannedEnd) {
        const pStart = new Date(task.plannedStart)
        const pEnd = new Date(task.plannedEnd)
        if (pStart <= monthEnd && pEnd >= monthStart) {
          const taskDuration = differenceInCalendarDays(pEnd, pStart) || 1
          const overlapStart = pStart > monthStart ? pStart : monthStart
          const overlapEnd = pEnd < monthEnd ? pEnd : monthEnd
          const overlap = differenceInCalendarDays(overlapEnd, overlapStart) + 1
          plannedPeriod += w * (overlap / taskDuration)
        }
      }

      // Contribuição executada — apenas se não for futuro
      if (!isFuture && task.actualStart) {
        const aStart = new Date(task.actualStart)
        const aEnd = task.actualEnd ? new Date(task.actualEnd) : today
        if (aStart <= monthEnd && aEnd >= monthStart) {
          const overlapStart = aStart > monthStart ? aStart : monthStart
          const overlapEnd = aEnd < monthEnd ? aEnd : monthEnd
          const taskDuration = differenceInCalendarDays(
            task.plannedEnd ? new Date(task.plannedEnd) : addDays(aStart, 30),
            aStart
          ) || 1
          const overlap = differenceInCalendarDays(overlapEnd, overlapStart) + 1
          executedPeriod += w * Math.min(1, (overlap / taskDuration)) * (task.progress / 100)
        }
      }
    })

    plannedAcc = Math.min(100, plannedAcc + plannedPeriod)
    if (!isFuture) {
      executedAcc = Math.min(100, executedAcc + executedPeriod)
    }

    return {
      period: format(monthStart, 'MMM/yy', { locale: ptBR }),
      date: monthStart,
      plannedCumulative: Math.round(plannedAcc * 10) / 10,
      executedCumulative: isFuture ? null : Math.round(executedAcc * 10) / 10,
      plannedPeriod: Math.round(plannedPeriod * 10) / 10,
      executedPeriod: isFuture ? null : Math.round(executedPeriod * 10) / 10,
      deviation: isFuture ? null : Math.round((executedAcc - plannedAcc) * 10) / 10,
    }
  })
}

// ─── Dashboard KPIs ───────────────────────────────────────

export function computeDashboardKPIs(tasks: Task[], projectStart: Date, projectEnd: Date): DashboardKPIs {
  const leaves = tasks.filter(t => !t.isGroup)
  const today = new Date()

  const totalTasks = leaves.length
  const completedTasks = leaves.filter(t => t.status === 'COMPLETED').length
  const inProgressTasks = leaves.filter(t => t.status === 'IN_PROGRESS').length
  const notStartedTasks = leaves.filter(t => t.status === 'NOT_STARTED').length
  const delayedTasks = leaves.filter(t => isTaskDelayed(t)).length
  const criticalTasks = leaves.filter(t => t.isCritical).length
  const milestones = tasks.filter(t => t.isMilestone)
  const completedMilestones = milestones.filter(t => t.status === 'COMPLETED').length

  const overallProgress = computeWeightedProgress(tasks)

  // Progresso planejado: proporção de dias corridos
  const totalDays = differenceInCalendarDays(projectEnd, projectStart) || 1
  const elapsedDays = Math.min(totalDays, differenceInCalendarDays(today, projectStart))
  const plannedProgress = Math.round((elapsedDays / totalDays) * 100)

  const deviation = overallProgress - plannedProgress

  const trend: 'on_track' | 'delayed' | 'ahead' =
    deviation >= 3 ? 'ahead' : deviation <= -3 ? 'delayed' : 'on_track'

  // Estimativa de conclusão baseada em velocidade atual
  let estimatedCompletion: Date | null = null
  if (overallProgress > 0 && overallProgress < 100) {
    const velocity = overallProgress / elapsedDays // % por dia
    const remaining = 100 - overallProgress
    const daysToComplete = Math.ceil(remaining / velocity)
    estimatedCompletion = addDays(today, daysToComplete)
  }

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    notStartedTasks,
    delayedTasks,
    criticalTasks,
    milestones: milestones.length,
    completedMilestones,
    overallProgress,
    plannedProgress,
    deviation,
    trend,
    estimatedCompletion,
  }
}

// ─── Caminho crítico simplificado (CPM) ──────────────────

export type CPMResult = {
  criticalPath: string[]    // IDs das tarefas no caminho crítico
  totalFloat: Record<string, number>   // folga de cada tarefa
}

export function computeCriticalPath(
  tasks: Task[],
  dependencies: Array<{ predecessorId: string; successorId: string }>
): CPMResult {
  // Forward pass: earliest start/finish
  const es: Record<string, number> = {}
  const ef: Record<string, number> = {}
  const ls: Record<string, number> = {}
  const lf: Record<string, number> = {}

  const sorted = topologicalSort(tasks.map(t => t.id), dependencies)

  sorted.forEach(id => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const preds = dependencies.filter(d => d.successorId === id)
    const maxEF = preds.length > 0
      ? Math.max(...preds.map(d => ef[d.predecessorId] ?? 0))
      : 0
    const duration = task.plannedStart && task.plannedEnd
      ? differenceInCalendarDays(new Date(task.plannedEnd), new Date(task.plannedStart))
      : 0
    es[id] = maxEF
    ef[id] = maxEF + duration
  })

  // Project end = max EF
  const projectEnd = Math.max(...Object.values(ef))

  // Backward pass
  const reverseSorted = [...sorted].reverse()
  reverseSorted.forEach(id => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const succs = dependencies.filter(d => d.predecessorId === id)
    const minLS = succs.length > 0
      ? Math.min(...succs.map(d => ls[d.successorId] ?? projectEnd))
      : projectEnd
    const duration = task.plannedStart && task.plannedEnd
      ? differenceInCalendarDays(new Date(task.plannedEnd), new Date(task.plannedStart))
      : 0
    lf[id] = minLS
    ls[id] = minLS - duration
  })

  const totalFloat: Record<string, number> = {}
  const criticalPath: string[] = []

  tasks.forEach(task => {
    const float = (ls[task.id] ?? 0) - (es[task.id] ?? 0)
    totalFloat[task.id] = float
    if (float === 0) criticalPath.push(task.id)
  })

  return { criticalPath, totalFloat }
}

function topologicalSort(
  ids: string[],
  deps: Array<{ predecessorId: string; successorId: string }>
): string[] {
  const inDegree: Record<string, number> = {}
  const adj: Record<string, string[]> = {}

  ids.forEach(id => { inDegree[id] = 0; adj[id] = [] })
  deps.forEach(d => {
    if (adj[d.predecessorId]) adj[d.predecessorId].push(d.successorId)
    if (inDegree[d.successorId] !== undefined) inDegree[d.successorId]++
  })

  const queue = ids.filter(id => inDegree[id] === 0)
  const result: string[] = []

  while (queue.length) {
    const id = queue.shift()!
    result.push(id)
    ;(adj[id] || []).forEach(next => {
      inDegree[next]--
      if (inDegree[next] === 0) queue.push(next)
    })
  }

  return result
}

// ─── Formatadores ─────────────────────────────────────────

export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy')
}

export function formatDuration(start: Date | null, end: Date | null): string {
  if (!start || !end) return '—'
  const days = differenceInCalendarDays(end, start)
  return `${days} dias`
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: 'Concluída',
    IN_PROGRESS: 'Em Andamento',
    NOT_STARTED: 'Não Iniciada',
    DELAYED: 'Atrasada',
    ON_HOLD: 'Pausada',
    PLANNING: 'Planejamento',
    CANCELLED: 'Cancelado',
  }
  return map[status] ?? status
}

export function priorityLabel(priority: string): string {
  const map: Record<string, string> = {
    CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa',
  }
  return map[priority] ?? priority
}
