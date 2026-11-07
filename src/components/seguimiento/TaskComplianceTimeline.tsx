import { CalendarClock, ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { TaskOut } from '@/services/monitoring.service'
import { TASK_STATE_META, TaskNotes, formatDay, formatMoment } from './monitoringUi'
import { TIMELINE_TONE } from './expediente/dossierHelpers'

/** Línea de tiempo de las tareas de UN integrante: fechas originales y efectivas, entrega, estado y ampliaciones. El estado es el del backend. */
export function TaskComplianceTimeline({ tasks }: { tasks: TaskOut[] }) {
  if (tasks.length === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-[13px] text-[var(--color-text-muted)]">Todavía no hay tareas asignadas: el plan de trabajo aún no está publicado.</p>
  }
  return (
    <ol className="relative space-y-3.5 pl-7 before:absolute before:bottom-3 before:left-[9px] before:top-3 before:w-[2px] before:bg-gradient-to-b before:from-[#1565C0]/40 before:to-[#1565C0]/10" aria-label="Historial de actividades">
      {tasks.map((task, i) => {
        const tone = TIMELINE_TONE[task.state]
        const { label, Icon } = TASK_STATE_META[task.state]
        const showDue = task.effective_due && task.state !== 'entregada' && task.state !== 'cancelada'
        return (
          <li key={task.assignment_id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }} className="fu-rise relative">
            <span aria-hidden="true" className={cn('absolute -left-[26px] top-6 h-3.5 w-3.5 rounded-full ring-4 ring-[var(--color-surface)]', tone.dot, task.state === 'vencida' && 'fu-pulse')} />
            <div className={cn('rounded-2xl border-2 p-4 transition-shadow duration-200 hover:shadow-md', tone.card)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span aria-hidden="true" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone.icon)}><FileText size={17} /></span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-extrabold text-[var(--color-secondary)]">{task.title}</p>
                    <p className="text-[12px] text-[var(--color-text-muted)]">{task.stage}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-bold leading-none shadow-sm', tone.badge)}>
                    <Icon size={14} aria-hidden="true" />{label}{showDue && <span className="font-semibold">· {formatDay(task.effective_due)}</span>}
                  </span>
                  <TaskNotes task={task} />
                </div>
              </div>
              <details className="group mt-2 pl-12 text-[12.5px]">
                <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-bold text-[#1565C0] dark:text-sky-300">
                  <ChevronRight size={14} aria-hidden="true" className="transition-transform group-open:rotate-90" />Ver detalle
                </summary>
                <dl className="mt-2 grid gap-x-4 gap-y-1.5 rounded-xl bg-white/70 p-3 sm:grid-cols-2 dark:bg-white/5">
                  <div><dt className="text-[var(--color-text-muted)]">Asignada</dt><dd>{formatMoment(task.assigned_at)}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Fecha límite original</dt><dd>{formatDay(task.original_due)}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Fecha límite efectiva</dt><dd className="font-bold">{formatDay(task.effective_due)}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Entrega real</dt><dd>{task.delivered_at ? formatMoment(task.delivered_at) : 'Sin entrega'}{task.late_delivery && ' · entrega tardía'}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Escalamiento grupal</dt><dd>{task.escalate_group ? 'Activado' : 'Desactivado'}</dd></div>
                </dl>
                {task.extensions.length > 0 && (
                  <div className="mt-2">
                    <p className="flex items-center gap-1.5 font-bold text-violet-900 dark:text-violet-200"><CalendarClock size={13} aria-hidden="true" />Ampliaciones concedidas</p>
                    <ul className="mt-1 space-y-1">
                      {task.extensions.map((e) => (
                        <li key={e.id} className="rounded-lg bg-violet-50 p-2 text-violet-950 dark:bg-violet-500/10 dark:text-violet-100">
                          {formatDay(e.previous_due_date)} → <strong>{formatDay(e.new_due_date)}</strong> (+{e.days_added} día{e.days_added === 1 ? '' : 's'}) · {e.reason}
                          <span className="block text-[11.5px] text-violet-800 dark:text-violet-300">Autorizó {e.authorized_by} · {formatMoment(e.authorized_at)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </details>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
