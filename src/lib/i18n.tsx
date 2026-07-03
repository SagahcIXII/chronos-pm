'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

export type Lang = 'pt' | 'en'

export const translations = {
  pt: {
    // Navegação
    nav: {
      dashboard: 'Dashboard', gantt: 'Gantt', curves: 'Curva S',
      tasks: 'Tarefas', pdf: 'Relatório PDF', projectLabel: 'Projeto Atual',
    },
    // Topbar
    topbar: { inProgress: 'Em Andamento' },
    // Status
    status: {
      COMPLETED: 'Concluída', IN_PROGRESS: 'Em Andamento',
      NOT_STARTED: 'Não Iniciada', DELAYED: 'Atrasada', ON_HOLD: 'Pausada',
    },
    // Prioridade
    priority: { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' },
    // Dashboard
    dashboard: {
      title: 'Infraestrutura Industrial — Planta Norte',
      subtitle: 'BD7D-2025-001 · Eng. Carlos Souza · 01/02/2025 → 30/09/2025',
      alert: 'Projeto com desvio de 3% abaixo do planejado. Atenção ao caminho crítico.',
      kpi1Label: 'Total de Tarefas', kpi1Sub: 'concluídas · em andamento',
      kpi2Label: 'Avanço Físico', kpi2Sub: 'Planejado: 45% · Desvio: -3%',
      kpi3Label: 'Tarefas Atrasadas', kpi3Sub: 'tarefas críticas',
      kpi4Label: 'Marcos', kpi4Sub: 'concluído',
      curvaTitle: 'Curva S — Avanço Acumulado',
      fasesTitle: 'Avanço por Fase',
      resumoTitle: 'Resumo do Cronograma',
      colFase: 'Fase', colInicio: 'Início Plan.', colTermino: 'Término Plan.',
      colProgresso: 'Progresso', colStatus: 'Status',
    },
    // Gantt
    gantt: {
      days: 'Dias', weeks: 'Semanas', months: 'Meses',
      expandAll: 'Expandir Tudo', collapseAll: 'Recolher Tudo',
      search: 'Buscar tarefa...', allStatus: 'Todos os Status',
      legendPlanned: 'Planejado', legendExecuted: 'Executado',
      legendDelayed: 'Atrasado', legendCritical: 'Crítico',
      legendMilestone: 'Marco', legendToday: 'Hoje',
      colTask: 'Tarefa', colStart: 'Início', colEnd: 'Término',
      panelCritical: 'Crítica', panelMilestone: 'Marco', panelDelayed: 'Atrasada',
      panelProgress: 'Progresso', panelResp: 'Responsável',
      panelPlanStart: 'Início Planejado', panelPlanEnd: 'Término Planejado',
      panelActStart: 'Início Real', panelActEnd: 'Término Real',
      panelPredecessors: 'Predecessoras',
    },
    // Curva S
    curves: {
      title: 'Curva S — Avanço Físico',
      subtitle: 'Comparativo acumulado entre progresso planejado e executado',
      alert: 'Projeto com desvio de 2% abaixo do planejado a partir de maio/2025.',
      kpi1: 'Planejado Acumulado', kpi2: 'Executado Acumulado',
      kpi3: 'Desvio', kpi4: 'Tendência', trend: 'Atrasado',
      chartTitle: 'Curva S — Avanço Físico Acumulado (%)',
      barTitle: 'Avanço por Período (%)',
      tableTitle: 'Tabela Mensal Detalhada',
      colPeriod: 'Período', colPlanAcum: 'Plan. Acumulado',
      colExecAcum: 'Exec. Acumulado', colDesvio: 'Desvio', colStatus: 'Status',
      statusFuturo: 'Futuro', statusAtrasado: 'Atrasado',
      statusAdiantado: 'Adiantado', statusNoPrazo: 'No Prazo',
      planned: 'Planejado', executed: 'Executado',
    },
    // Tarefas
    tasks: {
      title: 'Estrutura de Tarefas',
      search: 'Buscar...', allStatus: 'Todos os Status',
      completed: 'Concluídas', inProgress: 'Em Andamento', notStarted: 'Não Iniciadas',
      expand: 'Expandir', collapse: 'Recolher',
      displayed: 'exibidas',
      colTask: 'Tarefa', colResp: 'Responsável', colPlanStart: 'Início Plan.',
      colPlanEnd: 'Término Plan.', colProgress: 'Progresso',
      colStatus: 'Status', colPriority: 'Prioridade',
      panelProgress: 'Progresso', panelResp: 'Responsável',
      panelStatus: 'Status', panelPriority: 'Prioridade',
      panelPlanStart: 'Início Plan.', panelPlanEnd: 'Término Plan.',
      panelActStart: 'Início Real', panelActEnd: 'Término Real',
    },
  },
  en: {
    nav: {
      dashboard: 'Dashboard', gantt: 'Gantt', curves: 'S-Curve',
      tasks: 'Tasks', pdf: 'PDF Report', projectLabel: 'Current Project',
    },
    topbar: { inProgress: 'In Progress' },
    status: {
      COMPLETED: 'Completed', IN_PROGRESS: 'In Progress',
      NOT_STARTED: 'Not Started', DELAYED: 'Delayed', ON_HOLD: 'On Hold',
    },
    priority: { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' },
    dashboard: {
      title: 'Industrial Infrastructure — North Plant',
      subtitle: 'BD7D-2025-001 · Eng. Carlos Souza · 02/01/2025 → 09/30/2025',
      alert: 'Project is 3% behind schedule. Monitor the critical path.',
      kpi1Label: 'Total Tasks', kpi1Sub: 'completed · in progress',
      kpi2Label: 'Physical Progress', kpi2Sub: 'Planned: 45% · Deviation: -3%',
      kpi3Label: 'Delayed Tasks', kpi3Sub: 'critical tasks',
      kpi4Label: 'Milestones', kpi4Sub: 'completed',
      curvaTitle: 'S-Curve — Cumulative Progress',
      fasesTitle: 'Phase Progress',
      resumoTitle: 'Schedule Summary',
      colFase: 'Phase', colInicio: 'Plan. Start', colTermino: 'Plan. End',
      colProgresso: 'Progress', colStatus: 'Status',
    },
    gantt: {
      days: 'Days', weeks: 'Weeks', months: 'Months',
      expandAll: 'Expand All', collapseAll: 'Collapse All',
      search: 'Search task...', allStatus: 'All Statuses',
      legendPlanned: 'Planned', legendExecuted: 'Executed',
      legendDelayed: 'Delayed', legendCritical: 'Critical',
      legendMilestone: 'Milestone', legendToday: 'Today',
      colTask: 'Task', colStart: 'Start', colEnd: 'End',
      panelCritical: 'Critical', panelMilestone: 'Milestone', panelDelayed: 'Delayed',
      panelProgress: 'Progress', panelResp: 'Responsible',
      panelPlanStart: 'Planned Start', panelPlanEnd: 'Planned End',
      panelActStart: 'Actual Start', panelActEnd: 'Actual End',
      panelPredecessors: 'Predecessors',
    },
    curves: {
      title: 'S-Curve — Physical Progress',
      subtitle: 'Cumulative comparison between planned and executed progress',
      alert: 'Project is 2% behind schedule from May/2025 onwards.',
      kpi1: 'Planned Cumulative', kpi2: 'Executed Cumulative',
      kpi3: 'Deviation', kpi4: 'Trend', trend: 'Delayed',
      chartTitle: 'S-Curve — Cumulative Physical Progress (%)',
      barTitle: 'Progress by Period (%)',
      tableTitle: 'Monthly Breakdown',
      colPeriod: 'Period', colPlanAcum: 'Plan. Cumulative',
      colExecAcum: 'Exec. Cumulative', colDesvio: 'Deviation', colStatus: 'Status',
      statusFuturo: 'Future', statusAtrasado: 'Delayed',
      statusAdiantado: 'Ahead', statusNoPrazo: 'On Track',
      planned: 'Planned', executed: 'Executed',
    },
    tasks: {
      title: 'Task Structure',
      search: 'Search...', allStatus: 'All Statuses',
      completed: 'Completed', inProgress: 'In Progress', notStarted: 'Not Started',
      expand: 'Expand', collapse: 'Collapse',
      displayed: 'displayed',
      colTask: 'Task', colResp: 'Responsible', colPlanStart: 'Plan. Start',
      colPlanEnd: 'Plan. End', colProgress: 'Progress',
      colStatus: 'Status', colPriority: 'Priority',
      panelProgress: 'Progress', panelResp: 'Responsible',
      panelStatus: 'Status', panelPriority: 'Priority',
      panelPlanStart: 'Plan. Start', panelPlanEnd: 'Plan. End',
      panelActStart: 'Actual Start', panelActEnd: 'Actual End',
    },
  }
}

// Context
interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: typeof translations['pt']
}

const LangContext = createContext<LangContextType>({
  lang: 'pt',
  setLang: () => {},
  t: translations.pt,
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('pt')
  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}

// Componente do seletor de idioma (reutilizável)
export function LangSwitcher() {
  const { lang, setLang } = useLang()
  return (
    <div style={{display:'flex',gap:2,background:'var(--surface2)',borderRadius:10,padding:3,border:'1px solid var(--border)',flexShrink:0}}>
      {(['pt','en'] as Lang[]).map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding:'5px 14px', borderRadius:8, border:'none', cursor:'pointer',
          fontWeight:600, fontSize:12, fontFamily:'DM Sans,sans-serif', transition:'all 0.15s',
          background: lang===l ? 'var(--accent)' : 'transparent',
          color: lang===l ? 'white' : 'var(--text2)',
        }}>
          {l==='pt' ? 'PT' : 'EN'}
        </button>
      ))}
    </div>
  )
}
