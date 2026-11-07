import { CalendarDays, Clock } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { StudentRow } from '@/services/monitoring.service'
import type { ProcessOut } from '@/services/processes.service'
import type { WorkPlanOut } from '@/services/workplan.service'
import { formatDay, formatMomentDay } from '../monitoringUi'
import { daysUntil, dueLabel, dueUrgency } from '../monitoringHelpers'
import { DossierCard } from './dossierUi'

const URGENCY_TEXT = { vencida: 'text-red-700 dark:text-red-300', urgente: 'text-orange-600 dark:text-orange-300', pronto: 'text-amber-700 dark:text-amber-300', holgada: 'text-green-700 dark:text-green-300' } as const

function Row({ label, value, className, hint }: { label: string; value: string; className?: string; hint?: string }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2 text-[13px]">
      <span className="flex items-center gap-2 text-[var(--color-text)]"><Clock size={14} aria-hidden="true" className="text-[var(--color-text-muted)]" />{label}</span>
      <span className={cn('text-right font-bold text-[var(--color-secondary)]', className)} title={hint}>{value}</span>
    </li>
  )
}

/** Inicio y entrega final salen del plan de trabajo; si el plan no existe, el inicio usa la fecha de registro del proceso (se indica). */
export function KeyDatesCard({ student, plan, process }: { student: StudentRow; plan: WorkPlanOut | null; process: ProcessOut | null }) {
  const days = student.next_due ? daysUntil(student.next_due) : null
  const start = plan?.start_date ? formatDay(plan.start_date) : process ? `${formatMomentDay(process.created_at)} (registro)` : '—'
  return (
    <DossierCard title="Fechas clave" Icon={CalendarDays} titleId="exp-dates-title">
      <ul className="divide-y divide-[var(--color-border)]">
        <Row label="Inicio del proyecto" value={start} />
        <Row
          label="Próxima fecha límite"
          value={formatDay(student.next_due)}
          className={days === null ? undefined : URGENCY_TEXT[dueUrgency(days)]}
          hint={days === null ? undefined : dueLabel(days)}
        />
        <Row label="Entrega final" value={plan?.target_end_date ? formatDay(plan.target_end_date) : 'Sin definir'} />
      </ul>
    </DossierCard>
  )
}
