// Funciones y constantes de monitoringUi.tsx que no son componentes (fast refresh de Vite).
import { AlarmClock, AlertCircle, AlertTriangle, CalendarClock, CheckCircle2, CircleMinus, Clock, ShieldAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DeliveryNote, RiskLevel, TaskState } from '@/services/monitoring.service'


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

/** `YYYY-MM-DD` (día de calendario de Bogotá) sin desfase por zona horaria. */
export function formatDay(value: string | null | undefined): string {
  return value ? dayFormat.format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '—'
}

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

export const dayFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

export const dateTimeFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

export const shortMomentFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' })
