import { Card } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { MonitoringSummary, RiskLevel } from '@/services/monitoring.service'
import { RISK_META } from './monitoringUi.utils'
import { CIRCUMFERENCE, RADIUS, RISK_TONE, buildSlices } from './monitoringHelpers'

interface AlertDistributionChartProps {
  summary: MonitoringSummary
  level?: RiskLevel
  onSelectLevel: (level: RiskLevel | undefined) => void
}

export function AlertDistributionChart({ summary, level, onSelectLevel }: AlertDistributionChartProps) {
  const slices = buildSlices(summary)
  const toggle = (l: RiskLevel) => onSelectLevel(level === l ? undefined : l)
  return (
    <Card className="fu-rise p-5">
      <h2 className="font-display text-[16px] font-extrabold text-[var(--color-secondary)]">Distribución por nivel de alerta</h2>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:flex-nowrap">
        <div className="relative h-[120px] w-[120px] shrink-0">
          <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90" role="img" aria-label={`Distribución de ${summary.students} estudiantes por nivel de alerta`}>
            <circle cx="66" cy="66" r={RADIUS} fill="none" strokeWidth="14" className="stroke-slate-200 dark:stroke-white/10" />
            {slices.filter((s) => s.count > 0).map((s) => (
              <circle
                key={s.level}
                cx="66"
                cy="66"
                r={RADIUS}
                fill="none"
                strokeWidth={level === s.level ? 18 : 14}
                strokeLinecap="butt"
                stroke={RISK_TONE[s.level].solid}
                strokeDasharray={`${s.length} ${CIRCUMFERENCE - s.length}`}
                strokeDashoffset={-s.offset}
                opacity={level && level !== s.level ? 0.35 : 1}
                className="fu-donut-seg cursor-pointer transition-all duration-700 ease-out"
                onClick={() => toggle(s.level)}
              >
                <title>{`${RISK_META[s.level].label}: ${s.count} (${s.percent}%)`}</title>
              </circle>
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[28px] font-extrabold leading-none text-[var(--color-text)] lining-nums">{summary.students}</span>
            <span className="mt-1 text-[11.5px] font-semibold text-[var(--color-text-muted)]">{summary.students === 1 ? 'Estudiante' : 'Estudiantes'}</span>
          </div>
        </div>
        <ul className="min-w-[180px] flex-1 space-y-0.5" aria-label="Leyenda de niveles de alerta">
          {slices.map((s) => (
            <li key={s.level}>
              <button
                type="button"
                aria-pressed={level === s.level}
                title={level === s.level ? 'Quitar el filtro' : `Filtrar la tabla: ${RISK_META[s.level].label.toLowerCase()}`}
                onClick={() => toggle(s.level)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]',
                  level === s.level && 'bg-[var(--color-bg)] font-bold ring-1 ring-[var(--color-border)]',
                )}
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RISK_TONE[s.level].solid }} />
                <span className="flex-1 whitespace-nowrap text-[var(--color-text)]">{RISK_META[s.level].label}</span>
                <span className="whitespace-nowrap tabular-nums text-[var(--color-text-muted)]">{s.percent}% ({s.count})</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
