'use client'
// src/components/gantt/GanttChart.tsx
import { useRef, useCallback } from 'react'
import type { TaskWithRelations, GanttScale } from '@/types'
import { useGanttLayout, ROW_H, HEADER_H, taskY, plannedBarColor, isDelayedTask } from '@/hooks/useGantt'
import { formatDateBR } from '@/lib/schedule'

interface Props {
  tasks: TaskWithRelations[]          // tarefas visíveis (já filtradas)
  allTasks: TaskWithRelations[]       // todas as tarefas (para deps)
  scale: GanttScale
  selectedId: string | null
  expandedGroups: Set<string>
  onSelectTask: (id: string) => void
  onToggleGroup: (id: string) => void
  onScaleChange: (s: GanttScale) => void
}

export function GanttChart({
  tasks, allTasks, scale, selectedId,
  expandedGroups, onSelectTask, onToggleGroup, onScaleChange,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const layout = useGanttLayout(allTasks, scale)
  const { columns, totalWidth, todayX, dateToX, durationToW } = layout

  const svgH = Math.max(tasks.length * ROW_H, 300)

  // Sincroniza scroll vertical entre lista e SVG
  const handleListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const chart = chartRef.current
    if (chart) chart.scrollTop = (e.target as HTMLDivElement).scrollTop
  }, [])

  return (
    <div className="flex flex-col h-full bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0 flex-wrap">
        {/* Escala */}
        <div className="scale-group">
          {(['days','weeks','months'] as GanttScale[]).map(s => (
            <button key={s} className={`scale-btn ${scale === s ? 'active' : ''}`} onClick={() => onScaleChange(s)}>
              {{ days: 'Dias', weeks: 'Semanas', months: 'Meses' }[s]}
            </button>
          ))}
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 ml-auto text-xs text-[var(--text3)]">
          {[
            { color: 'var(--gantt-planned)', label: 'Planejado' },
            { color: 'var(--gantt-executed)', label: 'Executado' },
            { color: 'var(--gantt-delayed)', label: 'Atrasado' },
            { color: 'var(--gantt-critical)', label: 'Crítico' },
            { color: 'var(--gantt-milestone)', label: 'Marco' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-2.5 w-5 rounded-sm" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="h-4 border-l-2 border-dashed border-red-500" />
            <span>Hoje</span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Lista de tarefas (esquerda) */}
        <div
          className="w-[400px] min-w-[400px] border-r border-[var(--border)] overflow-y-auto overflow-x-hidden"
          onScroll={handleListScroll}
        >
          {/* Header da lista */}
          <div
            className="grid border-b border-[var(--border)] bg-[var(--surface2)] sticky top-0 z-10"
            style={{ gridTemplateColumns: '32px 1fr 80px 80px 48px', height: HEADER_H }}
          >
            {['', 'Tarefa', 'Início', 'Término', '%'].map(h => (
              <div key={h} className="flex items-center px-2 text-[10.5px] font-semibold text-[var(--text3)] uppercase tracking-wide">
                {h}
              </div>
            ))}
          </div>

          {/* Linhas de tarefas */}
          {tasks.map(task => {
            const hasChildren = allTasks.some(t => t.parentId === task.id)
            const isSelected = task.id === selectedId
            const delayed = isDelayedTask(task)

            return (
              <div
                key={task.id}
                className={`gantt-task-row ${isSelected ? 'selected' : ''} ${task.isGroup ? 'group' : ''}`}
                style={{ paddingLeft: 8 + task.level * 16, gridTemplateColumns: '32px 1fr 80px 80px 48px', display: 'grid' }}
                onClick={() => onSelectTask(task.id)}
              >
                {/* Expand btn */}
                <div className="flex items-center">
                  {hasChildren ? (
                    <button
                      className="w-5 h-5 flex items-center justify-center text-[var(--text3)] hover:text-[var(--text)]"
                      onClick={e => { e.stopPropagation(); onToggleGroup(task.id) }}
                    >
                      {expandedGroups.has(task.id) ? <ChevDown /> : <ChevRight />}
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}
                </div>

                {/* Nome */}
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  {task.isMilestone && <DiamondIcon />}
                  {task.isCritical && !task.isMilestone && <FlagIcon />}
                  <span className={`text-[12.5px] truncate ${
                    task.isGroup ? 'font-semibold' :
                    task.isMilestone ? 'text-purple-400 font-semibold' : ''
                  }`}>
                    {task.name}
                  </span>
                </div>

                {/* Datas */}
                <div className="text-[11px] text-[var(--text3)] flex items-center">
                  {task.plannedStart ? formatDateBR(task.plannedStart).slice(0,5) : '—'}
                </div>
                <div className={`text-[11px] flex items-center ${delayed ? 'text-red-400' : 'text-[var(--text3)]'}`}>
                  {task.plannedEnd ? formatDateBR(task.plannedEnd).slice(0,5) : '—'}
                </div>

                {/* Progresso */}
                <div className={`text-[11px] font-medium flex items-center ${
                  task.progress === 100 ? 'text-green-400' :
                  delayed ? 'text-red-400' : 'text-[var(--text3)]'
                }`}>
                  {task.progress}%
                </div>
              </div>
            )
          })}
        </div>

        {/* Área do gráfico (direita) */}
        <div ref={chartRef} className="flex-1 overflow-x-auto overflow-y-auto">
          <div style={{ minWidth: totalWidth, position: 'relative' }}>

            {/* Cabeçalho fixo */}
            <svg
              width={totalWidth}
              height={HEADER_H}
              style={{ display: 'block', position: 'sticky', top: 0, zIndex: 4, background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}
            >
              {columns.map(col => (
                <g key={col.key}>
                  {col.isWeekend && (
                    <rect x={col.x} y={0} width={col.w} height={HEADER_H} fill="rgba(255,255,255,0.02)" />
                  )}
                  <line x1={col.x} y1={0} x2={col.x} y2={HEADER_H} stroke="var(--border)" strokeWidth={1} />
                  <text
                    x={col.x + col.w / 2} y={HEADER_H / 2 + 4}
                    textAnchor="middle"
                    fill={col.isWeekend ? 'var(--text3)' : 'var(--text3)'}
                    fontSize={11}
                    fontFamily="DM Sans, sans-serif"
                  >
                    {col.label}
                  </text>
                </g>
              ))}
              {/* Hoje no header */}
              <rect x={todayX - 1} y={0} width={2} height={HEADER_H} fill="var(--red)" opacity={0.9} />
            </svg>

            {/* SVG principal com barras */}
            <svg width={totalWidth} height={svgH} style={{ display: 'block' }}>
              <defs>
                <marker id="dep-arrow" viewBox="0 0 8 8" refX={7} refY={4}
                  markerWidth={5} markerHeight={5} orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--text3)" />
                </marker>
              </defs>

              {/* Grid de fundo */}
              {columns.map(col => (
                <g key={col.key}>
                  {col.isWeekend && (
                    <rect x={col.x} y={0} width={col.w} height={svgH} fill="rgba(255,255,255,0.015)" />
                  )}
                  <line x1={col.x} y1={0} x2={col.x} y2={svgH}
                    stroke="var(--border)" strokeWidth={0.5} strokeDasharray="2,3" />
                </g>
              ))}

              {/* Fundo de linhas alternado */}
              {tasks.map((_, i) => i % 2 === 1 && (
                <rect key={i} x={0} y={i * ROW_H} width={totalWidth} height={ROW_H}
                  fill="rgba(255,255,255,0.012)" />
              ))}

              {/* Highlight da linha selecionada */}
              {tasks.map((task, i) => task.id === selectedId && (
                <rect key={task.id + 'sel'} x={0} y={i * ROW_H} width={totalWidth} height={ROW_H}
                  fill="rgba(59,130,246,0.08)" />
              ))}

              {/* ── Linhas de dependência ── */}
              {tasks.map((task, i) => {
                const preds = task.predecessors ?? []
                return preds.map(dep => {
                  const predTask = dep.predecessor
                  const predIdx = tasks.findIndex(t => t.id === predTask.id)
                  if (predIdx < 0) return null

                  const x1 = dateToX(predTask.plannedEnd)
                  const y1 = predIdx * ROW_H + ROW_H / 2
                  const x2 = dateToX(task.plannedStart)
                  const y2 = i * ROW_H + ROW_H / 2

                  return (
                    <path
                      key={`dep-${predTask.id}-${task.id}`}
                      d={`M${x1},${y1} C${x1 + 24},${y1} ${x2 - 24},${y2} ${x2},${y2}`}
                      fill="none"
                      stroke="var(--text3)"
                      strokeWidth={1}
                      strokeDasharray="4,3"
                      markerEnd="url(#dep-arrow)"
                      opacity={0.5}
                    />
                  )
                })
              })}

              {/* ── Barras de tarefas ── */}
              {tasks.map((task, i) => {
                const y = taskY(i)
                const delayed = isDelayedTask(task)

                // Marco
                if (task.isMilestone) {
                  const mx = dateToX(task.plannedEnd)
                  const my = y + ROW_H / 2
                  const size = 10
                  return (
                    <g key={task.id + 'bar'} style={{ cursor: 'pointer' }} onClick={() => onSelectTask(task.id)}>
                      <polygon
                        points={`${mx},${my - size} ${mx + size},${my} ${mx},${my + size} ${mx - size},${my}`}
                        fill="var(--gantt-milestone)" opacity={0.9}
                      />
                      {task.actualEnd && (
                        <polygon
                          points={`${dateToX(task.actualEnd)},${my - size * 0.7} ${dateToX(task.actualEnd) + size * 0.7},${my} ${dateToX(task.actualEnd)},${my + size * 0.7} ${dateToX(task.actualEnd) - size * 0.7},${my}`}
                          fill="var(--gantt-executed)" opacity={0.7}
                        />
                      )}
                    </g>
                  )
                }

                const px = dateToX(task.plannedStart)
                const pw = durationToW(task.plannedStart, task.plannedEnd)
                const barColor = plannedBarColor(task)

                // Barra do executado
                const ax = task.actualStart ? dateToX(task.actualStart) : null
                const aw = ax !== null
                  ? task.actualEnd
                    ? durationToW(task.actualStart, task.actualEnd)
                    : Math.max(4, (pw * task.progress) / 100)
                  : null

                const PLAN_Y = task.isGroup ? y + ROW_H * 0.2 : y + ROW_H * 0.18
                const PLAN_H = task.isGroup ? ROW_H * 0.42 : ROW_H * 0.35
                const EXEC_Y = y + ROW_H * 0.58
                const EXEC_H = task.isGroup ? ROW_H * 0.2 : ROW_H * 0.25

                return (
                  <g key={task.id + 'bar'} style={{ cursor: 'pointer' }} onClick={() => onSelectTask(task.id)}>
                    {/* Barra planejada */}
                    <rect
                      x={px} y={PLAN_Y} width={pw} height={PLAN_H} rx={3}
                      fill={barColor}
                      opacity={task.isGroup ? 0.5 : 0.85}
                    />

                    {/* Barra executada */}
                    {ax !== null && aw !== null && (
                      <rect
                        x={ax} y={EXEC_Y} width={aw} height={EXEC_H} rx={2}
                        fill="var(--gantt-executed)"
                        opacity={0.9}
                      />
                    )}

                    {/* Progresso dentro da barra (se espaço suficiente) */}
                    {pw > 36 && task.progress > 0 && (
                      <text
                        x={px + 5} y={PLAN_Y + PLAN_H * 0.75}
                        fill="white" fontSize={9.5}
                        fontFamily="DM Sans, sans-serif"
                        opacity={0.95}
                      >
                        {task.progress}%
                      </text>
                    )}

                    {/* Indicador de caminho crítico */}
                    {task.isCritical && !task.isGroup && (
                      <rect x={px} y={y + ROW_H - 3} width={pw} height={2}
                        fill="var(--gantt-critical)" opacity={0.7} />
                    )}

                    {/* Tooltip invisível para acessibilidade */}
                    <title>{task.name} — {task.progress}%</title>
                  </g>
                )
              })}

              {/* ── Linha de hoje ── */}
              <line
                x1={todayX} y1={0} x2={todayX} y2={svgH}
                stroke="var(--red)" strokeWidth={1.5}
                strokeDasharray="6,4" opacity={0.9}
              />
              {/* Label "Hoje" */}
              <rect x={todayX - 18} y={4} width={36} height={16} rx={4} fill="var(--red)" opacity={0.85} />
              <text x={todayX} y={16} textAnchor="middle" fill="white" fontSize={9} fontFamily="DM Sans, sans-serif" fontWeight={600}>
                Hoje
              </text>

              {/* Separadores de linhas */}
              {tasks.map((_, i) => (
                <line key={i + 'sep'} x1={0} y1={(i + 1) * ROW_H} x2={totalWidth} y2={(i + 1) * ROW_H}
                  stroke="var(--border)" strokeWidth={0.5} />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mini ícones ───────────────────────────────────────────
const ChevDown = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
)
const ChevRight = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
)
const DiamondIcon = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="var(--gantt-milestone)" stroke="none">
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
)
const FlagIcon = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="var(--gantt-critical)" strokeWidth={2}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1={4} y1={22} x2={4} y2={15} />
  </svg>
)
