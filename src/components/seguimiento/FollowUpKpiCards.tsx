import { cn } from '@/utils/cn'
import type { MonitoringSummary, RiskLevel } from '@/services/monitoring.service'
import { TONES, buildKpis, type KpiDefinition } from './monitoringHelpers'

interface FollowUpKpiCardProps {
  kpi: KpiDefinition
  /** Porcentaje real sobre el total de estudiantes (solo en tarjetas por nivel). */
  percent?: number
  active: boolean
  index: number
  onSelectLevel: (level: RiskLevel | undefined) => void
}

export function FollowUpKpiCard({ kpi, percent, active, index, onSelectLevel }: FollowUpKpiCardProps) {
  const tone = TONES[kpi.tone]
  const critical = kpi.key === 'critico' && kpi.value > 0
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110', tone.icon, critical && 'fu-pulse')}>
          <kpi.Icon size={19} aria-hidden="true" />
        </span>
        <p className={cn('pt-0.5 text-left text-[13px] font-bold leading-tight text-[var(--color-secondary)]', critical && 'pr-4')}>{kpi.label}</p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className={cn('font-display text-[34px] font-extrabold leading-none tracking-tight lining-nums tabular-nums', kpi.value > 0 ? tone.value : 'text-[var(--color-text)]')}>{kpi.value}</span>
        {percent !== undefined && (
          <span className={cn('mb-0.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold ring-1 transition-colors', kpi.value > 0 ? cn(tone.pill, 'shadow-sm ring-black/10') : 'bg-white/70 text-[var(--color-text-muted)] ring-black/5 dark:bg-white/10')}>{percent}%</span>
        )}
      </div>
      <p className="mt-1.5 text-left text-[12px] font-medium text-[var(--color-text-muted)]">{kpi.sub}</p>
      {critical && <p className="mt-1 text-left text-[11.5px] font-extrabold text-red-700 dark:text-red-300">{kpi.value === 1 ? '1 estudiante necesita' : `${kpi.value} estudiantes necesitan`} intervención</p>}
    </>
  )
  const base = cn(
    'fu-rise group relative flex w-full flex-col items-stretch justify-start rounded-2xl border-2 p-4 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
    tone.card,
    kpi.value > 0 && tone.glow,
    tone.shadow,
    critical && 'fu-glow',
    active && 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-bg)]',
  )
  const style = { animationDelay: `${index * 45}ms` }
  if (!kpi.level) return <div className={base} style={style}>{body}</div>
  const level = kpi.level
  return (
    <button
      type="button"
      aria-pressed={active}
      title={active ? 'Quitar el filtro por este nivel' : `Ver estudiantes: ${kpi.label.toLowerCase()}`}
      className={cn(base, 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]')}
      style={style}
      onClick={() => onSelectLevel(active ? undefined : level)}
    >
      {critical && <span aria-hidden="true" className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-600 fu-pulse" />}
      {body}
    </button>
  )
}

export function FollowUpKpiGrid({ summary, level, onSelectLevel }: { summary: MonitoringSummary; level?: RiskLevel; onSelectLevel: (level: RiskLevel | undefined) => void }) {
  const total = summary.students
  return (
    <section aria-label="Indicadores de seguimiento" className="grid grid-cols-2 min-[940px]:grid-cols-4 min-[1500px]:grid-cols-7 gap-3">
      {buildKpis(summary).map((kpi, i) => (
        <FollowUpKpiCard
          key={kpi.key}
          kpi={kpi}
          index={i}
          percent={kpi.level && total > 0 ? Math.round((kpi.value / total) * 100) : undefined}
          active={kpi.level !== undefined && kpi.level === level}
          onSelectLevel={onSelectLevel}
        />
      ))}
    </section>
  )
}
