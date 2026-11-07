import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { StudentRow } from '@/services/monitoring.service'
import { DUE_META, dueLabel, dueUrgency, expedientePath, initials, pickUpcoming } from './monitoringHelpers'

export function UpcomingTasksPanel({ rows }: { rows: StudentRow[] }) {
  const items = useMemo(() => pickUpcoming(rows), [rows])
  return (
    <Card className="fu-rise fu-delay p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg)] text-[var(--color-secondary)] ring-1 ring-[var(--color-border)]"><CalendarClock size={16} aria-hidden="true" /></span>
        <h2 className="font-display text-[16px] font-extrabold text-[var(--color-secondary)]">Tareas próximas a vencer</h2>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-[var(--color-bg)] p-4 text-[12.5px] text-[var(--color-text-muted)]">No hay vencimientos pendientes entre los estudiantes que se muestran.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-border)]" aria-label="Próximos vencimientos">
          {items.map(({ row, days }) => {
            const urgency = dueUrgency(days)
            const { className, Icon } = DUE_META[urgency]
            return (
              <li key={`${row.process_id}:${row.student_id}`}>
                <Link
                  to={expedientePath(row)}
                  className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[12px] font-extrabold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">{initials(row.student_name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-[var(--color-secondary)]">{row.student_name}</span>
                    <span className="block truncate text-[11.5px] text-[var(--color-text-muted)]">{row.project_title ?? row.process_code}</span>
                  </span>
                  <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none', className)}>
                    <Icon size={12} aria-hidden="true" />{dueLabel(days)}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--color-text-dim)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
