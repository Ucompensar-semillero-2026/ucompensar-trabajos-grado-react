import { Users } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { GroupAlert, RiskLevel, TaskOut, TaskState } from '@/services/monitoring.service'
import { DELIVERY_NOTE_TEXT, RISK_META, TASK_STATE_META, formatDay } from './monitoringUi.utils'

const chip = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-bold leading-none'

export function TaskStatusBadge({ state, dueDate }: { state: TaskState; dueDate?: string | null }) {
  const { label, Icon, className } = TASK_STATE_META[state]
  return (
    <span className={cn(chip, className)}>
      <Icon size={13} aria-hidden="true" />
      {label}
      {dueDate && state !== 'entregada' && state !== 'cancelada' && <span className="font-medium">· {formatDay(dueDate)}</span>}
    </span>
  )
}

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  const { label, Icon, className } = RISK_META[level]
  return <span className={cn(chip, 'px-3 py-1.5 font-semibold shadow-sm transition-transform duration-200 hover:scale-[1.04]', className)}><Icon size={14} aria-hidden="true" />{label}</span>
}

/** Aviso grupal. Para el equipo es genérico (sin nombres ni datos del compañero); el tutor ve además quiénes la explican. */
export function GroupRiskBanner({ alert, culprits }: { alert: Pick<GroupAlert, 'active' | 'message'>; culprits?: string[] }) {
  if (!alert.active) return null
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-[0_8px_22px_-14px_rgba(220,38,38,0.8)] dark:bg-red-500/10 dark:text-red-100">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"><Users size={18} /></span>
      <div>
        <p className="text-[14px] font-extrabold text-red-700 dark:text-red-200">Riesgo grupal crítico</p>
        <p className="text-[13px]">{alert.message ?? 'El equipo tiene un incumplimiento pendiente de atención'}</p>
        {culprits && culprits.length > 0 && <p className="mt-1 text-[12.5px]">Origen: tareas vencidas con escalamiento grupal de {culprits.join(', ')}. Los registros individuales de los demás integrantes no cambian.</p>}
      </div>
    </div>
  )
}

/** Explicación de la entrega o de la prórroga de una tarea, para mostrar bajo el estado. */
export function TaskNotes({ task }: { task: TaskOut }) {
  const notes: string[] = []
  if (task.state === 'entregada' && task.delivery_note) notes.push(DELIVERY_NOTE_TEXT[task.delivery_note])
  if (task.state === 'ampliada' && task.effective_due) notes.push(`Nueva fecha límite: ${formatDay(task.effective_due)}`)
  if (task.state === 'vencida' && task.extensions.length > 0) notes.push('Venció de nuevo después de una ampliación')
  if (notes.length === 0) return null
  return <>{notes.map((n) => <p key={n} className="mt-0.5 text-[11.5px] font-medium text-[var(--color-text-muted)]">{n}</p>)}</>
}
