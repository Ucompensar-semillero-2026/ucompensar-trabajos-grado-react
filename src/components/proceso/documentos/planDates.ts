import type { TaskOut } from '@/services/monitoring.service'
import type { WorkPlanOut } from '@/services/workplan.service'
import { bogotaTodayIso } from './documentosHelpers'

/**
 * FUENTE ÚNICA de fechas límite para el estudiante. El plan (`/work-plan`) informa la fecha límite ORIGINAL y calcula
 * `is_overdue` con ella; Seguimiento (`/monitoring/me`) informa la fecha EFECTIVA (con las ampliaciones autorizadas).
 * Para que «Documentos y entregables» y «Mis fechas y compromisos» nunca discrepen, el plan se normaliza una sola vez:
 * `due_date` pasa a ser la fecha efectiva y `is_overdue` se recalcula con ella, con la MISMA regla del backend
 * (vencido = pasó la fecha y la pelota está del lado del estudiante: disponible o con correcciones pendientes).
 * La fecha original se conserva aparte para mostrarla en el detalle.
 */
export interface DatedPlan {
  /** Plan con fechas efectivas: lo que consumen ambas páginas. */
  plan: WorkPlanOut
  /** Fecha límite original por entregable (la del plan), para mostrar «original» frente a «efectiva». */
  originalDue: Record<string, string | null>
  /** Tarea de seguimiento por entregable (ampliaciones, fecha de entrega real). */
  tasks: Record<string, TaskOut>
}

export function normalizePlanDates(plan: WorkPlanOut, tasks: TaskOut[], today: string = bogotaTodayIso()): DatedPlan {
  const byDeliverable: Record<string, TaskOut> = {}
  for (const t of tasks) if (t.state !== 'cancelada') byDeliverable[t.deliverable_id] = t
  const originalDue: Record<string, string | null> = {}
  const stages = plan.stages.map((stage) => ({
    ...stage,
    deliverables: stage.deliverables.map((d) => {
      originalDue[d.public_id] = d.due_date
      const task = byDeliverable[d.public_id]
      const due = task?.effective_due ?? d.due_date
      const overdue = due !== null && today > due && (d.status === 'disponible' || d.status === 'requiere_correcciones')
      return { ...d, due_date: due, is_overdue: overdue }
    }),
  }))
  return { plan: { ...plan, stages }, originalDue, tasks: byDeliverable }
}
