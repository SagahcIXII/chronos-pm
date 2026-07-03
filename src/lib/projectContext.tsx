'use client'
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────
// Contexto de projeto conectado à API REAL (/api/projects).
// A API já aplica o filtro de multi-tenancy no servidor, então o
// cliente recebe SOMENTE os projetos que pode ver.
//
// A lista estática que existia aqui foi removida — era a causa de o
// seletor mostrar projetos fixos independentemente do banco/usuário.
// ─────────────────────────────────────────────────────────────

export interface Project {
  id: string
  code: string
  name: string
  nameEn: string
  client: string
  manager: string
  responsible: string
  startDate: string
  endDate: string
  progress: number
  status: 'IN_PROGRESS' | 'COMPLETED' | 'NOT_STARTED' | 'ON_HOLD'
  type: string
  typeEn: string
  description: string
  descriptionEn: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  delayedTasks: number
  milestones: number
  deviation: number
  color: string
}

const PALETTE = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

/** Cor determinística a partir do id, para manter estabilidade visual. */
function colorFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

/** Mapeia o payload da API para o shape usado pela UI, com fallbacks seguros. */
function mapApiProject(p: any): Project {
  return {
    id: p.id,
    code: p.code ?? '',
    name: p.name ?? '',
    nameEn: p.name ?? '',
    client: p.client?.name ?? p.responsible ?? '',
    manager: p.responsible ?? '',
    responsible: p.responsible ?? '',
    startDate: typeof p.startDate === 'string' ? p.startDate : new Date(p.startDate).toISOString(),
    endDate: typeof p.endDate === 'string' ? p.endDate : new Date(p.endDate).toISOString(),
    progress: Math.round(p.computedProgress ?? p.progress ?? 0),
    status: (p.status as Project['status']) ?? 'IN_PROGRESS',
    type: p.type ?? '',
    typeEn: p.type ?? '',
    description: p.description ?? '',
    descriptionEn: p.description ?? '',
    totalTasks: p.totalTasks ?? 0,
    completedTasks: p.completedTasks ?? 0,
    inProgressTasks: p.inProgressTasks ?? 0,
    delayedTasks: p.delayedTasks ?? 0,
    milestones: p.milestones ?? 0,
    deviation: p.deviation ?? 0,
    color: p.color ?? colorFor(p.id),
  }
}

const STORAGE_KEY = 'chronos_active_project_id'

interface ProjectContextType {
  activeProject: Project | null
  projects: Project[]
  loading: boolean
  error: string | null
  setActiveProject: (p: Project) => void
  reload: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType>({
  activeProject: null,
  projects: [],
  loading: true,
  error: null,
  setActiveProject: () => {},
  reload: async () => {},
})

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProjectState] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Falha ao carregar projetos')
      const raw = await res.json()
      const list: Project[] = Array.isArray(raw) ? raw.map(mapApiProject) : []
      setProjects(list)

      // Restaura o projeto salvo, se ainda visível; senão usa o primeiro.
      let savedId: string | null = null
      try { savedId = localStorage.getItem(STORAGE_KEY) } catch {}
      const next = list.find(p => p.id === savedId) ?? list[0] ?? null
      setActiveProjectState(next)
    } catch (e: any) {
      setError(e.message ?? 'Erro desconhecido')
      setProjects([])
      setActiveProjectState(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const setActiveProject = (p: Project) => {
    setActiveProjectState(p)
    try { localStorage.setItem(STORAGE_KEY, p.id) } catch {}
  }

  return (
    <ProjectContext.Provider
      value={{ activeProject, projects, loading, error, setActiveProject, reload: load }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  return useContext(ProjectContext)
}
