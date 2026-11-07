import type { DeliverableOut, DraftWorkspaceOut, SubmissionOut } from '@/services/workplan.service'
import { bogotaToday, daysUntil } from '@/components/seguimiento/monitoringHelpers'

// Reglas de PRESENTACIÓN del modal de entrega. La validación definitiva (tipo real por contenido, tamaño, elegibilidad,
// propiedad y fecha) la hace siempre el backend; esto solo evita cargas inútiles y explica el estado.

const MIME_BY_EXT: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
}

/** Formatos que el navegador puede mostrar sin descargar. */
export const PREVIEWABLE = ['.pdf', '.png', '.jpg', '.jpeg']

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const fmt = (n: number) => n.toFixed(1).replace(/\.0$/, '').replace('.', ',')
  if (bytes < 1024 * 1024) return `${fmt(bytes / 1024)} KB`
  return `${fmt(bytes / (1024 * 1024))} MB`
}

/** Devuelve el motivo de rechazo o null si el archivo puede intentarse. */
export function validateFile(file: File, accepted: string[], maxMb: number): string | null {
  const ext = extensionOf(file.name)
  if (!accepted.includes(ext)) return `Formato no permitido. Usa: ${accepted.join(', ')}`
  if (file.size === 0) return 'El archivo está vacío.'
  if (file.size > maxMb * 1024 * 1024) return `El archivo pesa ${formatBytes(file.size)} y el máximo permitido es ${maxMb} MB.`
  // El navegador informa un MIME según la extensión o el sistema; si lo informa y no coincide, se avisa antes de cargar.
  const expected = MIME_BY_EXT[ext]
  if (expected && file.type && file.type !== 'application/octet-stream' && !expected.includes(file.type)) {
    return 'El tipo del archivo no corresponde a su extensión.'
  }
  return null
}

export type AttemptState = 'sin_archivo' | 'borrador' | 'en_revision' | 'requiere_correcciones' | 'aprobada'

export function latestSubmission(ws: DraftWorkspaceOut | null): SubmissionOut | null {
  if (!ws?.submissions.length) return null
  return ws.submissions.reduce((a, b) => (b.version > a.version ? b : a))
}

/** Estado del intento que se muestra en el encabezado: el borrador vigente tiene prioridad sobre lo ya publicado. */
export function attemptState(ws: DraftWorkspaceOut | null): AttemptState {
  if (ws?.current_draft) return 'borrador'
  const last = latestSubmission(ws)
  if (!last) return 'sin_archivo'
  if (last.status === 'aprobado') return 'aprobada'
  return last.status === 'requiere_correcciones' ? 'requiere_correcciones' : 'en_revision'
}

export const ATTEMPT_LABEL: Record<AttemptState, string> = {
  sin_archivo: 'Sin archivo',
  borrador: 'Borrador guardado',
  en_revision: 'Entregada · en revisión',
  requiere_correcciones: 'Requiere correcciones',
  aprobada: 'Aprobada',
}

export function nextSubmissionVersion(ws: DraftWorkspaceOut | null): number {
  return (latestSubmission(ws)?.version ?? 0) + 1
}

export type DeadlineTone = 'verde' | 'azul' | 'naranja' | 'rojo' | 'gris'

/** Plazo de la tarea. «Vencida» es la del backend (`is_overdue`, calculada con la fecha de Bogotá). */
export function deadlineInfo(d: DeliverableOut, today: string = bogotaToday()): { tone: DeadlineTone; label: string } {
  if (d.status === 'aprobado') return { tone: 'verde', label: 'Aprobada por tu tutor' }
  if (d.status === 'en_revision') return { tone: 'verde', label: 'Entregada, en revisión' }
  if (!d.due_date) return { tone: 'gris', label: 'Sin fecha límite' }
  const days = daysUntil(d.due_date, today)
  if (d.is_overdue) return { tone: 'rojo', label: days < 0 ? `Vencida hace ${-days} ${days === -1 ? 'día' : 'días'}` : 'Vencida' }
  if (days === 0) return { tone: 'naranja', label: 'Vence hoy' }
  if (days <= 3) return { tone: 'naranja', label: days === 1 ? 'Vence mañana' : `Faltan ${days} días` }
  return { tone: 'azul', label: `Faltan ${days} días` }
}

export type TimelineKind = 'tarea' | 'borrador' | 'reemplazo' | 'eliminado' | 'publicada' | 'correcciones' | 'aprobada'

export interface TimelineEvent {
  key: string
  kind: TimelineKind
  title: string
  date: string
  detail?: string
}

/**
 * Historial del modal. Los borradores (privados del estudiante) muestran solo el evento, nunca el archivo anterior;
 * las versiones publicadas y las revisiones del tutor vienen del historial académico real.
 */
export function timelineEvents(ws: DraftWorkspaceOut, planPublishedAt: string | null): TimelineEvent[] {
  const events: TimelineEvent[] = []
  if (planPublishedAt) events.push({ key: 'plan', kind: 'tarea', title: 'Tarea publicada en el plan', date: planPublishedAt })
  for (const d of ws.drafts) {
    events.push({ key: `d${d.public_id}`, kind: 'borrador', title: `Borrador ${d.version} cargado`, date: d.created_at, detail: d.status === 'vigente' ? d.file_name : undefined })
    if (d.status === 'reemplazado' && d.closed_at) events.push({ key: `r${d.public_id}`, kind: 'reemplazo', title: `Borrador ${d.version} reemplazado`, date: d.closed_at })
    if (d.status === 'eliminado' && d.closed_at) events.push({ key: `e${d.public_id}`, kind: 'eliminado', title: `Borrador ${d.version} eliminado`, date: d.closed_at })
  }
  for (const s of ws.submissions) {
    events.push({ key: `s${s.public_id}`, kind: 'publicada', title: s.version === 1 ? 'Entrega publicada · versión 1' : `Nueva versión publicada · versión ${s.version}`, date: s.submitted_at, detail: s.submitted_by.full_name })
    for (const r of s.reviews) {
      events.push({
        key: `v${r.public_id}`,
        kind: r.decision === 'aprobado' ? 'aprobada' : 'correcciones',
        title: r.decision === 'aprobado' ? `Versión ${s.version} aprobada` : `Correcciones solicitadas · versión ${s.version}`,
        date: r.created_at,
        detail: r.reviewer.full_name,
      })
    }
  }
  return events.sort((a, b) => b.date.localeCompare(a.date))
}

/** Última actividad visible para el estudiante en esta tarea. */
export function lastUpdate(ws: DraftWorkspaceOut | null): string | null {
  if (!ws) return null
  const dates = [...ws.drafts.flatMap((d) => [d.created_at, d.closed_at]), ...ws.submissions.flatMap((s) => [s.submitted_at, ...s.reviews.map((r) => r.created_at)])]
  return dates.filter((x): x is string => Boolean(x)).sort().pop() ?? null
}
