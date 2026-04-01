// src/stores/projectStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ProjectWithTasks, TaskWithRelations, TaskFilters, GanttScale } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface ProjectStore {
  // Estado
  project: ProjectWithTasks | null
  tasks: TaskWithRelations[]
  selectedTaskId: string | null
  expandedGroups: Set<string>
  ganttScale: GanttScale
  filters: TaskFilters
  loading: boolean
  error: string | null

  // Actions — projeto
  setProject: (p: ProjectWithTasks) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void

  // Actions — tarefas
  setTasks: (tasks: TaskWithRelations[]) => void
  updateTaskLocal: (id: string, updates: Partial<TaskWithRelations>) => void
  removeTaskLocal: (id: string) => void
  addTaskLocal: (task: TaskWithRelations) => void

  // Actions — UI
  selectTask: (id: string | null) => void
  toggleGroup: (id: string) => void
  expandAll: () => void
  collapseAll: () => void
  setGanttScale: (scale: GanttScale) => void
  setFilters: (f: Partial<TaskFilters>) => void
  clearFilters: () => void

  // Selectors computados
  selectedTask: () => TaskWithRelations | null
  visibleTasks: () => TaskWithRelations[]
  delayedTasks: () => TaskWithRelations[]
  criticalTasks: () => TaskWithRelations[]
  milestones: () => TaskWithRelations[]
}

// ─── Helpers ──────────────────────────────────────────────

function isDelayed(task: TaskWithRelations): boolean {
  if (task.status === 'COMPLETED') return false
  if (!task.plannedEnd) return false
  return new Date(task.plannedEnd) < new Date()
}

function matchesFilters(task: TaskWithRelations, filters: TaskFilters): boolean {
  if (filters.status && task.status !== filters.status) return false
  if (filters.priority && task.priority !== filters.priority) return false
  if (filters.responsible && !task.responsible?.toLowerCase().includes(filters.responsible.toLowerCase())) return false
  if (filters.search && !task.name.toLowerCase().includes(filters.search.toLowerCase())) return false
  if (filters.isCritical !== undefined && task.isCritical !== filters.isCritical) return false
  if (filters.isDelayed && !isDelayed(task)) return false
  return true
}

// ─── Store ────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      project: null,
      tasks: [],
      selectedTaskId: null,
      expandedGroups: new Set(),
      ganttScale: 'weeks',
      filters: {},
      loading: false,
      error: null,

      setProject: (p) => set({ project: p }),
      setLoading: (v) => set({ loading: v }),
      setError: (e) => set({ error: e }),

      setTasks: (tasks) => {
        // Auto-expande todos os grupos na carga inicial
        const groupIds = tasks.filter(t => t.isGroup).map(t => t.id)
        set({ tasks, expandedGroups: new Set(groupIds) })
      },

      updateTaskLocal: (id, updates) =>
        set(state => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
        })),

      removeTaskLocal: (id) =>
        set(state => ({
          tasks: state.tasks.filter(t => t.id !== id && t.parentId !== id),
          selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
        })),

      addTaskLocal: (task) =>
        set(state => ({ tasks: [...state.tasks, task] })),

      selectTask: (id) => set({ selectedTaskId: id }),

      toggleGroup: (id) =>
        set(state => {
          const next = new Set(state.expandedGroups)
          next.has(id) ? next.delete(id) : next.add(id)
          return { expandedGroups: next }
        }),

      expandAll: () =>
        set(state => ({
          expandedGroups: new Set(state.tasks.filter(t => t.isGroup).map(t => t.id)),
        })),

      collapseAll: () => set({ expandedGroups: new Set() }),

      setGanttScale: (scale) => set({ ganttScale: scale }),

      setFilters: (f) =>
        set(state => ({ filters: { ...state.filters, ...f } })),

      clearFilters: () => set({ filters: {} }),

      // Computed selectors
      selectedTask: () => {
        const { tasks, selectedTaskId } = get()
        return tasks.find(t => t.id === selectedTaskId) ?? null
      },

      visibleTasks: () => {
        const { tasks, expandedGroups, filters } = get()
        return tasks.filter(task => {
          // Visibilidade hierárquica
          if (task.parentId && !expandedGroups.has(task.parentId)) return false
          // Filtros
          if (Object.keys(filters).length > 0 && !matchesFilters(task, filters)) return false
          return true
        })
      },

      delayedTasks: () => get().tasks.filter(t => !t.isGroup && isDelayed(t)),
      criticalTasks: () => get().tasks.filter(t => !t.isGroup && t.isCritical),
      milestones: () => get().tasks.filter(t => t.isMilestone),
    }),
    { name: 'chronos-project-store' }
  )
)

// ─── API hooks (fetch + store sync) ──────────────────────

export async function loadProject(projectId: string) {
  const store = useProjectStore.getState()
  store.setLoading(true)
  store.setError(null)
  try {
    const res = await fetch(`/api/projects/${projectId}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    store.setProject(json.data)
    store.setTasks(json.data.tasks ?? [])
  } catch (e: any) {
    store.setError(e.message)
  } finally {
    store.setLoading(false)
  }
}

export async function updateTask(id: string, updates: Record<string, any>) {
  const store = useProjectStore.getState()
  // Optimistic update
  store.updateTaskLocal(id, updates)
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
    store.updateTaskLocal(id, json.data)
  } catch (e: any) {
    store.setError(e.message)
    // Em produção: reverter o optimistic update com o valor original
  }
}

export async function deleteTask(id: string) {
  const store = useProjectStore.getState()
  store.removeTaskLocal(id)
  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error)
    }
  } catch (e: any) {
    store.setError(e.message)
  }
}
