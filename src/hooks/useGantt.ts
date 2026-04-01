// src/hooks/useGantt.ts
import { useMemo } from 'react'
import { differenceInCalendarDays, startOfMonth, addMonths, addWeeks, addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { GanttScale, TaskWithRelations } from '@/types'

export const ROW_H = 44
export const HEADER_H = 48
export const TASK_LIST_W = 400

interface GanttColumn {
  key: string
  label: string
  x: number
  w: number
  isWeekend?: boolean
}

interface GanttLayout {
  columns: GanttColumn[]
  totalWidth: number
  timelineStart: Date
  todayX: number
  dateToX: (d: Date | string | null | undefined) => number
  durationToW: (start: Date | string | null, end: Date | string | null) => number
}

export function useGanttLayout(
  tasks: TaskWithRelations[],
  scale: GanttScale
): GanttLayout {
  return useMemo(() => {
    // ── 1. Determina intervalo do projeto ─────────────────
    const allDates = tasks.flatMap(t =>
      [t.plannedStart, t.plannedEnd, t.actualStart, t.actualEnd].filter(Boolean)
    ).map(d => new Date(d!))

    if (!allDates.length) {
      const now = new Date()
      allDates.push(now, addMonths(now, 6))
    }

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))

    // Padding: 1 mês antes e depois
    const timelineStart = startOfMonth(addMonths(minDate, -1))
    const timelineEnd = startOfMonth(addMonths(maxDate, 2))

    // ── 2. Largura por unidade de escala ─────────────────
    const COL_W = scale === 'days' ? 32 : scale === 'weeks' ? 72 : 110

    // ── 3. Função de conversão data → x ─────────────────
    const daysDiff = (d: Date) =>
      differenceInCalendarDays(d, timelineStart)

    const PX_PER_DAY =
      scale === 'days' ? COL_W :
      scale === 'weeks' ? COL_W / 7 :
      COL_W / 30.44

    const dateToX = (d: Date | string | null | undefined): number => {
      if (!d) return 0
      const date = typeof d === 'string' ? new Date(d) : d
      return Math.round(daysDiff(date) * PX_PER_DAY)
    }

    const durationToW = (
      start: Date | string | null,
      end: Date | string | null
    ): number => {
      if (!start || !end) return 0
      const s = typeof start === 'string' ? new Date(start) : start
      const e = typeof end === 'string' ? new Date(end) : end
      return Math.max(6, Math.round(differenceInCalendarDays(e, s) * PX_PER_DAY))
    }

    // ── 4. Colunas do cabeçalho ───────────────────────────
    const columns: GanttColumn[] = []
    let cur = new Date(timelineStart)

    while (cur < timelineEnd) {
      const x = dateToX(cur)

      if (scale === 'days') {
        const isWknd = cur.getDay() === 0 || cur.getDay() === 6
        columns.push({
          key: format(cur, 'yyyy-MM-dd'),
          label: format(cur, 'd'),
          x,
          w: COL_W,
          isWeekend: isWknd,
        })
        cur = addDays(cur, 1)

      } else if (scale === 'weeks') {
        const next = addWeeks(cur, 1)
        columns.push({
          key: format(cur, 'yyyy-MM-dd'),
          label: format(cur, 'dd/MM', { locale: ptBR }),
          x,
          w: dateToX(next) - x,
        })
        cur = next

      } else {
        const next = addMonths(cur, 1)
        columns.push({
          key: format(cur, 'yyyy-MM'),
          label: format(cur, 'MMM/yy', { locale: ptBR }),
          x,
          w: dateToX(next) - x,
        })
        cur = next
      }
    }

    const totalWidth = Math.max(900, dateToX(timelineEnd) + 60)
    const todayX = dateToX(new Date())

    return { columns, totalWidth, timelineStart, todayX, dateToX, durationToW }
  }, [tasks, scale])
}

// ── Calcula posição Y de cada task ────────────────────────
export function taskY(rowIndex: number): number {
  return rowIndex * ROW_H
}

// ── Cor da barra planejada ────────────────────────────────
export function plannedBarColor(task: TaskWithRelations): string {
  if (task.isCritical) return 'var(--gantt-critical)'
  if (isDelayedTask(task)) return 'var(--gantt-delayed)'
  return 'var(--gantt-planned)'
}

export function isDelayedTask(task: TaskWithRelations): boolean {
  if (task.status === 'COMPLETED') return false
  if (!task.plannedEnd) return false
  return new Date(task.plannedEnd) < new Date()
}
