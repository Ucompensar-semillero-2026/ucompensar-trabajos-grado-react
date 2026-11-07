import { AlarmClock, AlertCircle, AlertTriangle, CalendarClock, CheckCircle2, CircleMinus, Clock, ShieldAlert, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { DeliveryNote, GroupAlert, RiskLevel, TaskOut, TaskState } from '@/services/monitoring.service'

// Paleta semántica única del módulo. Cada estado lleva color + icono + texto: nunca se comunica solo con color.
export const TASK_STATE_META: Record<TaskState, { label: string; Icon: LucideIcon; className: string }> = {
  pendiente: { label: 'Pendiente', Icon: CircleMinus, className: 'border-slate-300 bg-slate-100 text-slate-700' },
  en_curso: { label: 'En curso', Icon: Clock, className: 'border-blue-200 bg-blue-50 text-blue-800' },
  entregada: { label: 'Entregada', Icon: CheckCircle2, className: 'border-green-200 bg-green-50 text-green-800' },
  por_vencer: { label: 'Por vencer', Icon: AlarmClock, className: 'border-amber-300 bg-amber-50 text-amber-900' },
  vencida: { label: 'Vencida', Icon: AlertCircle, className: 'border-orange-300 bg-orange-50 text-orange-900' },
  ampliada: { label: 'Plazo ampliado', Icon: CalendarClock, className: 'border-violet-300 bg-violet-50 text-violet-900' },
  cancelada: { label: 'Cancelada', Icon: CircleMinus, className: 'border-slate-200 bg-white text-slate-500 line-through' },
}

export const RISK_META: Record<RiskLevel, { label: string; Icon: LucideIcon; className: string }> = {
  al_dia: { label: 'Al día', Icon: CheckCircle2, className: 'border-green-800 bg-green-700 text-white shadow-green-700/30' },
  atencion: { label: 'Atención inicial', Icon: Clock, className: 'border-blue-700 bg-blue-600 text-white shadow-blue-600/30' },
  moderado: { label: 'Riesgo moderado', Icon: AlertTriangle, className: 'border-amber-500 bg-amber-400 text-amber-950 shadow-amber-500/40' },
  critico: { label: 'Riesgo crítico', Icon: ShieldAlert, className: 'border-red-800 bg-red-600 text-white shadow-red-600/40' },
}

export const DELIVERY_NOTE_TEXT: Record<DeliveryNote, string> = {
  fuera_plazo_original: 'Entregada fuera del plazo original',
  dentro_plazo_ampliado: 'Entregada dentro del plazo ampliado',
}

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

const dayFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

/** `YYYY-MM-DD` (día de calendario de Bogotá) sin desfase por zona horaria. */
export function formatDay(value: string | null | undefined): string {
  return value ? dayFormat.format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '—'
}

const shortMomentFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' })

/** Igual que `formatMoment` pero solo el día (para tablas angostas; la hora completa va en el atributo title). */
export function formatMomentDay(value: string | null | undefined): string {
  if (!value) return '—'
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`
  return shortMomentFormat.format(new Date(iso))
}

/** Instantes UTC sin zona que entrega el backend → hora de Bogotá. */
export function formatMoment(value: string | null | undefined): string {
  if (!value) return '—'
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`
  return dateTimeFormat.format(new Date(iso))
}
