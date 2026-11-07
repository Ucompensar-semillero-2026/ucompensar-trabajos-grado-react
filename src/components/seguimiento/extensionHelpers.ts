import type { LucideIcon } from 'lucide-react'
import { AlarmClock, AlertCircle, Ban, CalendarDays, CheckCircle2 } from 'lucide-react'
import type { TaskOut } from '@/services/monitoring.service'

// Clasificación visual del modal «Ampliar plazo». Se deriva SOLO del estado y de `days_to_due` que calcula el backend
// (fecha de Bogotá, ampliaciones previas y entrega). No se recalculan fechas en el navegador.

export type ExtensionCategory = 'vencida' | 'proxima' | 'en_plazo' | 'entregada' | 'no_elegible'

export const EXTENSION_META: Record<ExtensionCategory, { label: string; Icon: LucideIcon; row: string; badge: string; text: string }> = {
  vencida: { label: 'Vencida', Icon: AlertCircle, row: 'border-l-[#DC2626] bg-[#FEE2E2] dark:bg-red-500/15', badge: 'bg-[#DC2626] text-white', text: 'text-red-700 dark:text-red-300' },
  proxima: { label: 'Próxima a vencer', Icon: AlarmClock, row: 'border-l-[#F97316] bg-[#FFEDD5] dark:bg-orange-500/15', badge: 'bg-[#F97316] text-orange-950', text: 'text-orange-700 dark:text-orange-300' },
  en_plazo: { label: 'En plazo', Icon: CalendarDays, row: 'border-l-[#2563EB] bg-[#DBEAFE] dark:bg-blue-500/15', badge: 'bg-[#2563EB] text-white', text: 'text-blue-700 dark:text-blue-300' },
  entregada: { label: 'Entregada', Icon: CheckCircle2, row: 'border-l-[#16A34A] bg-[#DCFCE7] dark:bg-green-500/15', badge: 'bg-green-700 text-white', text: 'text-green-700 dark:text-green-300' },
  no_elegible: { label: 'No elegible', Icon: Ban, row: 'border-l-slate-400 bg-slate-100 dark:bg-white/5', badge: 'bg-slate-500 text-white', text: 'text-slate-600 dark:text-slate-300' },
}

/** Elegibilidad = la misma regla que aplica el backend al autorizar (cancelada, entregada o sin fecha límite → no se amplía). */
export function extensionCategory(task: TaskOut): { category: ExtensionCategory; eligible: boolean; blockedReason?: string } {
  if (task.state === 'cancelada') return { category: 'no_elegible', eligible: false, blockedReason: 'Tarea cancelada: no se puede ampliar.' }
  if (task.state === 'entregada') return { category: 'entregada', eligible: false, blockedReason: 'Ya se entregó: no se puede ampliar.' }
  if (!task.effective_due) return { category: 'no_elegible', eligible: false, blockedReason: 'No tiene fecha límite que ampliar.' }
  if (task.state === 'vencida') return { category: 'vencida', eligible: true }
  if (task.state === 'por_vencer') return { category: 'proxima', eligible: true }
  return { category: 'en_plazo', eligible: true }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Días de retraso o restantes, solo si el backend los informa. */
export function dueDistance(task: TaskOut): string | null {
  const d = task.days_to_due
  if (d === null || task.state === 'entregada' || task.state === 'cancelada') return null
  if (d < 0) return `Vencida hace ${plural(-d, 'día', 'días')}`
  if (d === 0) return 'Vence hoy'
  if (d === 1) return 'Vence mañana'
  return `Faltan ${plural(d, 'día', 'días')}`
}

/** Tareas que, con los días indicados, seguirían vencidas (el backend las rechazaría) y días mínimos necesarios. */
export function stillOverdue(tasks: TaskOut[], days: number): { tasks: TaskOut[]; minimumDays: number } {
  const late = tasks.filter((t) => t.days_to_due !== null && t.days_to_due + days < 0)
  return { tasks: late, minimumDays: late.reduce((max, t) => Math.max(max, -(t.days_to_due ?? 0)), 0) }
}

export function countByCategory(tasks: TaskOut[]): Record<'vencida' | 'proxima' | 'en_plazo', number> {
  const counts = { vencida: 0, proxima: 0, en_plazo: 0 }
  for (const t of tasks) {
    const { category } = extensionCategory(t)
    if (category === 'vencida' || category === 'proxima' || category === 'en_plazo') counts[category] += 1
  }
  return counts
}
