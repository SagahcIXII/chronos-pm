// src/lib/schedule.ts
// Utilitários de cronograma: dias úteis (feriados nacionais), atraso e
// formatação. Fórmulas de avanço/Curva S ficam em '@/lib/progress'.

import type { Task } from '@prisma/client'

// ─── Feriados nacionais e dias úteis ─────────────────────
// Calculados para QUALQUER ano: datas fixas + móveis (a partir da Páscoa).
// Para feriados estaduais/municipais (ex.: Amazonas 05/09, Manaus 24/10),
// passe-os em `extraHolidays` ('YYYY-MM-DD').

const pad = (n: number) => String(n).padStart(2, '0')
const isoUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
/** Dia do calendário local de uma data ('YYYY-MM-DD'). */
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

const holidayCache = new Map<number, Set<string>>()

/** Feriados nacionais do ano ('YYYY-MM-DD'), incluindo Sexta-feira Santa e Corpus Christi. */
export function brNationalHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const fixed = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25']
  if (year >= 2024) fixed.push('11-20') // Consciência Negra — nacional desde 2024 (Lei 14.759/2023)
  const easter = easterSunday(year)
  const shift = (days: number) => isoUTC(new Date(easter.getTime() + days * 86400000))
  const set = new Set([
    ...fixed.map(md => `${year}-${md}`),
    shift(-2), // Sexta-feira Santa
    shift(60), // Corpus Christi
  ])
  holidayCache.set(year, set)
  return set
}

/** Dia útil = seg–sex e não feriado (nacional ou em `extraHolidays`). Usa o calendário local. */
export function isWorkingDay(date: Date, extraHolidays: string[] = []): boolean {
  const dow = date.getDay()
  if (dow === 0 || dow === 6) return false
  const iso = isoLocal(date)
  return !brNationalHolidays(date.getFullYear()).has(iso) && !extraHolidays.includes(iso)
}

/** Dias úteis entre duas datas, inclusive as duas pontas. */
export function workingDaysBetween(start: Date, end: Date, extraHolidays: string[] = []): number {
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    if (isWorkingDay(cur, extraHolidays)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/** Data após somar `days` dias úteis a `start` (o próprio `start` não conta). */
export function addWorkingDays(start: Date, days: number, extraHolidays: string[] = []): Date {
  let remaining = days
  const cur = new Date(start)
  while (remaining > 0) {
    cur.setDate(cur.getDate() + 1)
    if (isWorkingDay(cur, extraHolidays)) remaining--
  }
  return cur
}

// ─── Atraso ──────────────────────────────────────────────

export function isTaskDelayed(task: Pick<Task, 'status' | 'plannedEnd'>): boolean {
  if (task.status === 'COMPLETED') return false
  if (!task.plannedEnd) return false
  return new Date(task.plannedEnd) < new Date()
}

// ─── Formatadores ─────────────────────────────────────────

// Datas do banco são gravadas à meia-noite UTC: formata pelo dia em UTC para
// não "voltar um dia" em fusos negativos (ex.: Manaus, UTC−4).
export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const iso = typeof date === 'string' ? date.slice(0, 10) : isoUTC(date)
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : '—'
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
