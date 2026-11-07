import { AlertTriangle, CheckCircle2, ClipboardList, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Expediente } from '@/services/monitoring.service'

interface Metric {
  label: string
  value: number
  Icon: LucideIcon
  card: string
  icon: string
  number: string
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 17
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, percent))
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="6" className="stroke-violet-200 dark:stroke-violet-500/25" />
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="6" strokeLinecap="round" stroke="#7C3AED" strokeDasharray={`${(p / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700 motion-reduce:transition-none" />
    </svg>
  )
}

/** Cinco indicadores del expediente; las cifras son las del backend (no se recalculan). */
export function ProjectMetrics({ expediente }: { expediente: Expediente }) {
  const s = expediente.student
  const metrics: Metric[] = [
    { label: 'Actividades asignadas', value: s.assigned, Icon: ClipboardList, card: 'border-indigo-300 bg-gradient-to-br from-indigo-100 to-white dark:border-indigo-400/40 dark:from-indigo-500/20 dark:to-transparent', icon: 'bg-indigo-600 text-white shadow-indigo-600/30', number: 'text-indigo-950 dark:text-indigo-100' },
    { label: 'Entregadas', value: s.delivered, Icon: CheckCircle2, card: 'border-green-400 bg-gradient-to-br from-green-100 to-white dark:border-green-400/40 dark:from-green-500/20 dark:to-transparent', icon: 'bg-green-600 text-white shadow-green-600/30', number: 'text-green-800 dark:text-green-200' },
    { label: 'Pendientes', value: s.pending, Icon: Clock, card: 'border-blue-400 bg-gradient-to-br from-blue-100 to-white dark:border-blue-400/40 dark:from-blue-500/20 dark:to-transparent', icon: 'bg-blue-600 text-white shadow-blue-600/30', number: 'text-blue-800 dark:text-blue-200' },
    {
      label: 'Vencidas', value: s.overdue, Icon: AlertTriangle,
      card: s.overdue > 0 ? 'border-red-500 bg-gradient-to-br from-red-100 to-white shadow-[0_8px_22px_-10px_rgba(220,38,38,0.65)] dark:border-red-400/60 dark:from-red-500/25 dark:to-transparent' : 'border-red-200 bg-gradient-to-br from-red-50 to-white dark:border-red-400/30 dark:from-red-500/10 dark:to-transparent',
      icon: cn('bg-red-600 text-white shadow-red-600/40', s.overdue > 0 && 'fu-pulse'), number: s.overdue > 0 ? 'text-red-700 dark:text-red-300' : 'text-[var(--color-text)]',
    },
  ]
  return (
    <section aria-label="Resumen de cumplimiento" className="grid grid-cols-2 gap-3 md:grid-cols-3 min-[1400px]:grid-cols-5">
      {metrics.map((m, i) => (
        <div key={m.label} style={{ animationDelay: `${i * 45}ms` }} className={cn('fu-rise flex items-center gap-3 rounded-2xl border-2 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg', m.card)}>
          <span aria-hidden="true" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-md', m.icon)}><m.Icon size={20} /></span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold leading-tight text-[var(--color-secondary)]">{m.label}</p>
            <p className={cn('font-display text-[28px] font-extrabold leading-none lining-nums tabular-nums', m.number)}>{m.value}</p>
          </div>
        </div>
      ))}
      <div style={{ animationDelay: '180ms' }} className="fu-rise flex items-center gap-3 rounded-2xl border-2 border-violet-400 bg-gradient-to-br from-[#EDE3FF] to-white p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-violet-400/40 dark:from-violet-500/20 dark:to-transparent">
        <ProgressRing percent={expediente.completion_pct} />
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold leading-tight text-violet-800 dark:text-violet-200">Cumplimiento</p>
          <p className="font-display text-[28px] font-extrabold leading-none text-violet-800 lining-nums tabular-nums dark:text-violet-200">{expediente.completion_pct}%</p>
        </div>
      </div>
    </section>
  )
}
