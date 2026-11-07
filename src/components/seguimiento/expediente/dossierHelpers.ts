import type { LucideIcon } from 'lucide-react'
import {
  Activity, AlertCircle, AlertTriangle, AlarmClock, CalendarClock, CheckCircle2, CircleMinus, Clock, FileText, FolderKanban, Hourglass, ListChecks, ListTree, UsersRound,
} from 'lucide-react'
import type { TaskState } from '@/services/monitoring.service'
import type { DeliverableStatus } from '@/services/workplan.service'
import type { DocumentStatus } from '@/services/documents.service'

// Utilidades puras del expediente (sin JSX): tonos por estado, etiquetas y rutas. Los estados vienen del backend; aquí solo se presentan.

/** Tono de cada tarjeta de la línea de tiempo según el estado REAL de la tarea (no se recalcula). */
export const TIMELINE_TONE: Record<TaskState, { card: string; dot: string; badge: string; icon: string }> = {
  entregada: { card: 'border-green-300 bg-green-50 dark:border-green-500/40 dark:bg-green-500/10', dot: 'bg-green-600', badge: 'border-green-800 bg-green-700 text-white', icon: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' },
  en_curso: { card: 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10', dot: 'bg-blue-600', badge: 'border-blue-700 bg-blue-600 text-white', icon: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  pendiente: { card: 'border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10', dot: 'bg-amber-400', badge: 'border-amber-500 bg-amber-400 text-amber-950', icon: 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300' },
  por_vencer: { card: 'border-orange-300 bg-orange-50 dark:border-orange-500/40 dark:bg-orange-500/10', dot: 'bg-orange-500', badge: 'border-orange-600 bg-orange-500 text-orange-950', icon: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' },
  vencida: { card: 'border-red-400 bg-red-50 shadow-[0_6px_18px_-12px_rgba(220,38,38,0.7)] dark:border-red-500/50 dark:bg-red-500/10', dot: 'bg-red-600', badge: 'border-red-800 bg-red-600 text-white', icon: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
  ampliada: { card: 'border-violet-300 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-500/10', dot: 'bg-violet-600', badge: 'border-violet-700 bg-violet-600 text-white', icon: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
  cancelada: { card: 'border-slate-200 bg-slate-50 opacity-80 dark:border-white/10 dark:bg-white/5', dot: 'bg-slate-400', badge: 'border-slate-400 bg-slate-200 text-slate-700 line-through', icon: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300' },
}

export const DELIVERABLE_STATUS: Record<DeliverableStatus, { label: string; className: string; Icon: LucideIcon }> = {
  pendiente: { label: 'Pendiente', className: 'border-slate-300 bg-slate-100 text-slate-700', Icon: CircleMinus },
  disponible: { label: 'Disponible para entregar', className: 'border-blue-700 bg-blue-600 text-white', Icon: Clock },
  en_revision: { label: 'En revisión', className: 'border-amber-500 bg-amber-400 text-amber-950', Icon: Hourglass },
  requiere_correcciones: { label: 'Requiere correcciones', className: 'border-orange-600 bg-orange-500 text-orange-950', Icon: AlarmClock },
  aprobado: { label: 'Aprobado', className: 'border-green-800 bg-green-700 text-white', Icon: CheckCircle2 },
}

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente de revisión', className: 'border-amber-500 bg-amber-400 text-amber-950' },
  aprobado: { label: 'Aprobado', className: 'border-green-800 bg-green-700 text-white' },
  rechazado: { label: 'Rechazado', className: 'border-red-800 bg-red-600 text-white' },
}

export const TEAM_ROLE_LABEL: Record<string, string> = { estudiante: 'Estudiante', tutor: 'Tutor', evaluador: 'Evaluador' }

export const OVERDUE_ICON = AlertCircle
export const EXTENSION_ICON = CalendarClock

/** Tipo de archivo a partir de la extensión, para el distintivo de documentos recientes. */
export function fileKind(fileName: string): { label: string; className: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return { label: 'PDF', className: 'bg-red-600 text-white' }
  if (ext === 'doc' || ext === 'docx') return { label: 'DOC', className: 'bg-blue-600 text-white' }
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return { label: 'XLS', className: 'bg-green-700 text-white' }
  if (ext === 'ppt' || ext === 'pptx') return { label: 'PPT', className: 'bg-orange-500 text-orange-950' }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { label: 'IMG', className: 'bg-violet-600 text-white' }
  return { label: ext ? ext.slice(0, 4).toUpperCase() : 'ARCH', className: 'bg-slate-600 text-white' }
}

export type DossierTab = 'historial' | 'plan' | 'entregables' | 'documentos' | 'intervenciones' | 'alertas' | 'equipo'

export const DOSSIER_TABS: Array<{ id: DossierTab; label: string; Icon: LucideIcon }> = [
  { id: 'historial', label: 'Historial de actividades', Icon: ListTree },
  { id: 'plan', label: 'Plan de trabajo', Icon: FolderKanban },
  { id: 'entregables', label: 'Entregables', Icon: ListChecks },
  { id: 'documentos', label: 'Documentos', Icon: FileText },
  { id: 'intervenciones', label: 'Intervenciones', Icon: Activity },
  { id: 'alertas', label: 'Alertas', Icon: AlertTriangle },
  { id: 'equipo', label: 'Equipo', Icon: UsersRound },
]

export const tabId = (id: DossierTab) => `exp-tab-${id}`
export const panelId = (id: DossierTab) => `exp-panel-${id}`

/** Ruta de la página con su propio encabezado (el layout no pinta el encabezado genérico de la sección). */
export const EXPEDIENTE_PATH = /^\/seguimiento\/(?!configuracion\/?$)[^/]+\/[^/]+\/?$/

export function slugify(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'estudiante'
}
