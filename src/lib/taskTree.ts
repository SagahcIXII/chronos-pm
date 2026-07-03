// src/lib/taskTree.ts
// Ordena as tarefas cronologicamente (por início planejado) respeitando a
// hierarquia pai/filho e atribui a numeração WBS:
//   grupos/tarefas de topo → 1, 2, 3…
//   filhos de um grupo      → 1.1, 1.2, 1.3…
//   (recursivo para subníveis: 1.1.1, etc.)
//
// A ordem entre irmãos é: menor início planejado primeiro; tarefas sem data
// vão para o fim; empate desempata pelo campo `order` e depois pelo nome.

export interface TreeTaskBase {
  id: string
  parentId: string | null
  isGroup: boolean
  order: number
  name: string
  plannedStart?: string | null
}

export type OrderedTask<T> = T & { wbs: string; depth: number }

function startValue(s?: string | null): number {
  if (!s) return Number.MAX_SAFE_INTEGER
  const t = new Date(s.includes('T') ? s : s + 'T12:00:00').getTime()
  return isNaN(t) ? Number.MAX_SAFE_INTEGER : t
}

export function buildOrderedTasks<T extends TreeTaskBase>(tasks: T[]): OrderedTask<T>[] {
  const byParent = new Map<string | null, T[]>()
  for (const t of tasks) {
    const key = t.parentId ?? null
    const arr = byParent.get(key)
    if (arr) arr.push(t)
    else byParent.set(key, [t])
  }

  const sortSiblings = (arr: T[]) =>
    arr.sort((a, b) => {
      const sa = startValue(a.plannedStart), sb = startValue(b.plannedStart)
      if (sa !== sb) return sa - sb
      if (a.order !== b.order) return a.order - b.order
      return a.name.localeCompare(b.name)
    })

  const out: OrderedTask<T>[] = []
  const walk = (parentId: string | null, prefix: string, depth: number) => {
    const children = sortSiblings([...(byParent.get(parentId) ?? [])])
    children.forEach((t, i) => {
      const wbs = prefix ? `${prefix}.${i + 1}` : `${i + 1}`
      out.push({ ...t, wbs, depth })
      walk(t.id, wbs, depth + 1)
    })
  }
  walk(null, '', 0)
  return out
}
