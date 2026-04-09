'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface Project {
  id: string
  code: string
  name: string
  nameEn: string
  client: string
  manager: string
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

export const PROJECTS: Project[] = [
  {
    id: 'bd7d-2025-001',
    code: 'BD7D-2025-001',
    name: 'Infraestrutura Industrial — Planta Norte',
    nameEn: 'Industrial Infrastructure — North Plant',
    client: 'Metalcon Indústria S.A.',
    manager: 'Eng. Carlos Souza',
    startDate: '2025-02-01',
    endDate: '2025-09-30',
    progress: 42,
    status: 'IN_PROGRESS',
    type: 'Engenharia Civil e Automação',
    typeEn: 'Civil Engineering & Automation',
    description: 'Implantação completa de infraestrutura industrial incluindo fundações, estrutura metálica, subestação elétrica e sistema de automação SDCD.',
    descriptionEn: 'Full industrial infrastructure implementation including foundations, steel structure, electrical substation, and DCS automation system.',
    totalTasks: 14,
    completedTasks: 6,
    inProgressTasks: 3,
    delayedTasks: 1,
    milestones: 3,
    deviation: -3,
    color: '#3b82f6',
  },
  {
    id: 'bd7d-2025-002',
    code: 'BD7D-2025-002',
    name: 'Sistema IoT — Monitoramento Ambiental',
    nameEn: 'IoT System — Environmental Monitoring',
    client: 'SecretAria do Meio Ambiente — AM',
    manager: 'Eng. Ana Lima',
    startDate: '2025-05-01',
    endDate: '2025-11-30',
    progress: 18,
    status: 'IN_PROGRESS',
    type: 'IoT e Tecnologia da Informação',
    typeEn: 'IoT & Information Technology',
    description: 'Desenvolvimento e implantação de rede de sensores IoT para monitoramento ambiental em tempo real na região metropolitana de Manaus.',
    descriptionEn: 'Development and deployment of IoT sensor network for real-time environmental monitoring in the Manaus metropolitan region.',
    totalTasks: 12,
    completedTasks: 2,
    inProgressTasks: 4,
    delayedTasks: 0,
    milestones: 4,
    deviation: 2,
    color: '#22c55e',
  },
  {
    id: 'bd7d-2025-003',
    code: 'BD7D-2025-003',
    name: 'Rede de Fibra Óptica — Campus Universitário',
    nameEn: 'Fiber Optic Network — University Campus',
    client: 'Universidade do Amazonas',
    manager: 'Eng. Pedro Rocha',
    startDate: '2025-08-01',
    endDate: '2026-02-28',
    progress: 0,
    status: 'NOT_STARTED',
    type: 'Infraestrutura de Redes',
    typeEn: 'Network Infrastructure',
    description: 'Implantação de rede de fibra óptica de alta velocidade interligando todos os blocos do campus universitário com capacidade de 10 Gbps.',
    descriptionEn: 'High-speed fiber optic network deployment connecting all university campus buildings with 10 Gbps capacity.',
    totalTasks: 10,
    completedTasks: 0,
    inProgressTasks: 0,
    delayedTasks: 0,
    milestones: 3,
    deviation: 0,
    color: '#a855f7',
  },
]

const STORAGE_KEY = 'chronos_active_project_id'

// Recupera o projeto salvo no localStorage, ou usa o primeiro como fallback
function getInitialProject(): Project {
  if (typeof window === 'undefined') return PROJECTS[0]
  try {
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (savedId) {
      const found = PROJECTS.find(p => p.id === savedId)
      if (found) return found
    }
  } catch {}
  return PROJECTS[0]
}

interface ProjectContextType {
  activeProject: Project
  setActiveProject: (p: Project) => void
}

const ProjectContext = createContext<ProjectContextType>({
  activeProject: PROJECTS[0],
  setActiveProject: () => {},
})

export function ProjectProvider({ children }: { children: ReactNode }) {
  // Inicia com PROJECTS[0] para SSR e corrige no cliente via useEffect
  const [activeProject, setActiveProjectState] = useState<Project>(PROJECTS[0])
  // Após hidratação, carrega o projeto salvo no localStorage
  useEffect(() => {
    const saved = getInitialProject()
    setActiveProjectState(saved)
  }, [])

  // Ao trocar projeto, persiste no localStorage
  const setActiveProject = (p: Project) => {
    setActiveProjectState(p)
    try {
      localStorage.setItem(STORAGE_KEY, p.id)
    } catch {}
  }

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  return useContext(ProjectContext)
}
