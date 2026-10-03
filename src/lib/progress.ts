// src/lib/progress.ts
// ─────────────────────────────────────────────────────────────
// Fórmula OFICIAL de avanço físico — única fonte de verdade.
// Usada pela API (barra lateral / lista de projetos / banco), Dashboard,
// Curva S, Relatório PDF e Excel. Não duplique esta lógica nas páginas.
//
//   • Avanço do projeto = Σ(peso × progresso) ÷ Σ(peso), sobre as tarefas
//     de execução (ver workItems): tarefas comuns + grupos SEM subtarefas
//     (ex.: "Meta 1" lançada como grupo e preenchida à mão). Grupos com
//     subtarefas não entram — o avanço deles já vem das filhas.
//   • Peso ausente ou 0 conta como 1.
//
//   • Executado na Curva S em uma data X = Σ(peso × progresso em X) ÷ Σ(peso
//     de TODAS as tarefas) — sempre relativo ao escopo total do projeto.
//     Tarefa não iniciada conta 0% (e o desvio cresce porque o planejado sobe).
//     Como o banco não guarda o progresso histórico de cada tarefa, o
//     progresso em X é estimado de forma linear:
//       – concluída: de 0% no início até 100% no término (real ou planejado);
//       – em andamento: de 0% no início até o progresso atual em "hoje".
//     Início = início real, ou planejado se não houver. Resultado: curva
//     crescente que, em "hoje", é igual ao avanço do projeto.
// ─────────────────────────────────────────────────────────────

type DateLike = string | Date | null | undefined

export interface ProgressTask {
  id?: string
  parentId?: string | null
  isGroup: boolean
  weight?: number | null
  progress: number
  status?: string
  plannedStart?: DateLike
  plannedEnd?: DateLike
  actualStart?: DateLike
  actualEnd?: DateLike
}

const weightOf = (t: ProgressTask) => t.weight || 1

/** Normaliza para 'YYYY-MM-DD' (comparação de datas sem efeito de horário). */
function dayISO(d: DateLike): string | null {
  if (!d) return null
  if (typeof d === 'string') return d.slice(0, 10)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function weightedAverage(items: { w: number; p: number }[]): number {
  const totalW = items.reduce((s, i) => s + i.w, 0)
  if (!totalW) return 0
  return Math.round(items.reduce((s, i) => s + i.w * i.p, 0) / totalW)
}

/**
 * Tarefas que medem execução: as que não têm subtarefas na lista.
 * Um grupo vazio conta como tarefa (com o progresso preenchido nele).
 * Sem id/parentId na lista, cai no critério antigo (tudo que não é grupo).
 */
export function workItems<T extends ProgressTask>(tasks: T[]): T[] {
  if (tasks.some(t => t.id === undefined)) return tasks.filter(t => !t.isGroup)
  const parents = new Set(tasks.map(t => t.parentId).filter(Boolean))
  return tasks.filter(t => !parents.has(t.id!))
}

/** Avanço físico atual do projeto (%), inteiro de 0 a 100. */
export function projectProgress(tasks: ProgressTask[]): number {
  return weightedAverage(workItems(tasks).map(t => ({ w: weightOf(t), p: t.progress })))
}

/**
 * Planejado acumulado (%) na data — metodologia linear:
 * diasDecorridos ÷ diasTotais do projeto, limitado a 0–100.
 */
export function plannedLinearAt(pointISO: string, projectStartISO: string, projectEndISO: string): number {
  const day = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  const total = day(projectEndISO) - day(projectStartISO)
  if (!(total > 0)) return 0
  const elapsed = day(pointISO) - day(projectStartISO)
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}

export interface MonthlyCurveRow {
  period: string                    // rótulo do mês (ex.: "mar. de 25" / "Mar 25")
  plannedCumulative: number
  executedCumulative: number | null // null = mês futuro
  deviation: number | null
  isCurrent: boolean                // mês que contém a data de referência
  isFuture: boolean
}

/**
 * Curva S mensal (Relatório PDF e e-mail). Cada mês é avaliado no seu último
 * dia — ou na data de referência, no mês corrente. Datas tratadas em UTC
 * para dar o mesmo resultado no navegador e no servidor.
 */
export function buildMonthlyCurve(
  tasks: ProgressTask[],
  projectStartISO: string,
  projectEndISO: string,
  refISO: string,
  lang: string
): MonthlyCurveRow[] {
  const leaves = workItems(tasks)
  if (!leaves.length || !projectStartISO || !projectEndISO) return []

  const ref = refISO.slice(0, 10)
  const [sy, sm] = projectStartISO.slice(0, 7).split('-').map(Number)
  const [ey, em] = projectEndISO.slice(0, 7).split('-').map(Number)
  const lastMonthIdx = ey * 12 + (em - 1) + 1 // inclui um mês após o término
  const rows: MonthlyCurveRow[] = []

  for (let idx = sy * 12 + (sm - 1); idx <= lastMonthIdx; idx++) {
    const y = Math.floor(idx / 12), m = idx % 12
    const firstISO = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
    const lastISO = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10)
    const isFuture = firstISO > ref
    const isCurrent = !isFuture && lastISO >= ref
    const pointISO = isCurrent ? ref : lastISO

    const plannedCumulative = plannedLinearAt(pointISO, projectStartISO, projectEndISO)
    const executedCumulative = isFuture ? null : executedAt(leaves, pointISO)
    rows.push({
      period: new Date(Date.UTC(y, m, 1)).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      plannedCumulative,
      executedCumulative,
      deviation: executedCumulative === null ? null : executedCumulative - plannedCumulative,
      isCurrent,
      isFuture,
    })
  }
  return rows
}

/** Data de hoje no fuso local ('YYYY-MM-DD'). */
export function localTodayISO(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

const dayNum = (iso: string) => Date.parse(iso + 'T00:00:00Z') / 86400000

/** Progresso estimado (%) de uma tarefa na data `point` (ver cabeçalho). */
function progressAt(t: ProgressTask, point: string, asOf: string): number {
  const done = t.status === 'COMPLETED' || t.progress >= 100
  const target = done ? 100 : t.progress
  if (target <= 0) return 0
  const start = dayISO(t.actualStart) ?? dayISO(t.plannedStart)
  let end = done ? (dayISO(t.actualEnd) ?? dayISO(t.plannedEnd) ?? asOf) : asOf
  if (end > asOf) end = asOf // o que está feito hoje já está feito em "hoje"
  if (point >= end) return target
  if (!start || point < start) return 0
  const span = dayNum(end) - dayNum(start)
  if (span <= 0) return target
  return target * (dayNum(point) - dayNum(start)) / span
}

/**
 * Executado acumulado (%) na data `pointISO` ('YYYY-MM-DD') — ponto da Curva S.
 * @param asOfISO data a que o progresso atual das tarefas se refere (hoje).
 */
export function executedAt(tasks: ProgressTask[], pointISO: string, asOfISO: string = localTodayISO()): number {
  const point = pointISO.slice(0, 10)
  const asOf = asOfISO.slice(0, 10)
  return weightedAverage(workItems(tasks).map(t => ({ w: weightOf(t), p: progressAt(t, point, asOf) })))
}
