// src/lib/i18n.ts
// Provider central de idioma — expandir conforme necessário
export type Lang = 'pt' | 'en'

export const labels = {
  pt: {
    dashboard: 'Dashboard', gantt: 'Gantt', curves: 'Curva S',
    tasks: 'Tarefas', pdf: 'Relatório PDF',
    inProgress: 'Em Andamento', completed: 'Concluída',
    notStarted: 'Não Iniciada', delayed: 'Atrasada',
    critical: 'Crítica', milestone: 'Marco',
    project: 'Projeto Atual',
  },
  en: {
    dashboard: 'Dashboard', gantt: 'Gantt', curves: 'S-Curve',
    tasks: 'Tasks', pdf: 'PDF Report',
    inProgress: 'In Progress', completed: 'Completed',
    notStarted: 'Not Started', delayed: 'Delayed',
    critical: 'Critical', milestone: 'Milestone',
    project: 'Current Project',
  }
}
