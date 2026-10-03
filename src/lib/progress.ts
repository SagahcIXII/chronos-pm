// src/lib/progress.ts
// ─────────────────────────────────────────────────────────────
// Fórmula OFICIAL de avanço físico — única fonte de verdade.
// Usada pela API (barra lateral / lista de projetos / banco), Dashboard,
// Curva S, Relatório PDF e Excel. Não duplique esta lógica nas páginas.
//
//   • Avanço do projeto = Σ(peso × progresso) ÷ Σ(peso), sobre todas as
//     tarefas que não são grupo (grupos não entram — evitam contagem dupla).
//   • Peso ausente ou 0 conta como 1.
//
//   • Executado na Curva S em uma data X = mesma média ponderada, mas só
//     com as tarefas cujo INÍCIO PLANEJADO já chegou (≤ X). Uma tarefa com
//     0% cujo início já passou entra e puxa a curva para baixo — mostra o
//     descumprimento do plano. Tarefas que ainda não deveriam ter começado
//     ficam de fora.
//     Tarefa concluída até X (término real, ou término planejado se status
//     COMPLETED sem término real) conta 100%; as demais contam o progresso atual.
// ─────────────────────────────────────────────────────────────

type DateLike = string | Date | null | undefined

export interface ProgressTask {
  isGroup: boolean
  weight?: number | null
  progress: number
  status?: string
  plannedStart?: DateLike
  plannedEnd?: DateLike
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

/** Avanço físico atual do projeto (%), inteiro de 0 a 100. */
export function projectProgress(tasks: ProgressTask[]): number {
  return weightedAverage(
    tasks.filter(t => !t.isGroup).map(t => ({ w: weightOf(t), p: t.progress }))
  )
}

/** Executado acumulado (%) na data `pointISO` ('YYYY-MM-DD') — ponto da Curva S. */
export function executedAt(tasks: ProgressTask[], pointISO: string): number {
  const point = pointISO.slice(0, 10)
  const items: { w: number; p: number }[] = []
  for (const t of tasks) {
    if (t.isGroup) continue
    const start = dayISO(t.plannedStart)
    if (!start || start > point) continue
    const doneOn = dayISO(t.actualEnd) ?? (t.status === 'COMPLETED' ? dayISO(t.plannedEnd) : null)
    items.push({ w: weightOf(t), p: doneOn && doneOn <= point ? 100 : t.progress })
  }
  return weightedAverage(items)
}
