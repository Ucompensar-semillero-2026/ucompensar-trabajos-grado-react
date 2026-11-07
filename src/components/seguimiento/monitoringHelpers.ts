import type { LucideIcon } from 'lucide-react'
import { AlarmClock, AlertCircle, AlertTriangle, CalendarCheck, CheckCircle2, ClipboardList, Clock, Play, ShieldAlert, Users, UsersRound } from 'lucide-react'
import type { MonitoringSummary, RiskLevel, StudentRow } from '@/services/monitoring.service'

// Utilidades puras (sin JSX) de la pantalla de seguimiento: colores por nivel, fechas de Bogotá, motivos de alerta y CSV.

/**
 * Color de cada nivel en gráficos y filas. Paleta saturada: fondo claramente perceptible + borde lateral grueso + color sólido
 * (el mismo `solid` pinta el donut, su leyenda y los puntos), de modo que el estado se lea incluso desde lejos. Sirve en claro y oscuro.
 */
export const RISK_TONE: Record<RiskLevel, { row: string; rowHover: string; border: string; solid: string; text: string; edge: string; shadow: string }> = {
  al_dia: {
    row: 'bg-green-500/[0.15]', rowHover: 'group-hover:bg-green-500/[0.24]', border: 'border-green-600', solid: '#16A34A',
    text: 'text-green-800 dark:text-green-300', edge: '', shadow: 'group-hover:shadow-[0_8px_18px_-10px_rgba(22,163,74,0.65)]',
  },
  atencion: {
    row: 'bg-blue-500/[0.14]', rowHover: 'group-hover:bg-blue-500/[0.23]', border: 'border-blue-600', solid: '#2563EB',
    text: 'text-blue-800 dark:text-blue-300', edge: '', shadow: 'group-hover:shadow-[0_8px_18px_-10px_rgba(37,99,235,0.65)]',
  },
  moderado: {
    row: 'bg-[#F5B800]/[0.26]', rowHover: 'group-hover:bg-[#F5B800]/[0.38]', border: 'border-[#F5A300]', solid: '#F5B800',
    text: 'text-amber-900 dark:text-amber-200', edge: 'shadow-[inset_0_1px_0_rgba(245,163,0,0.45),inset_0_-1px_0_rgba(245,163,0,0.45)]',
    shadow: 'group-hover:shadow-[0_8px_18px_-10px_rgba(245,163,0,0.8),inset_0_1px_0_rgba(245,163,0,0.45),inset_0_-1px_0_rgba(245,163,0,0.45)]',
  },
  critico: {
    row: 'bg-red-500/[0.20]', rowHover: 'group-hover:bg-red-500/[0.30]', border: 'border-red-600', solid: '#DC2626',
    text: 'text-red-800 dark:text-red-300', edge: 'shadow-[inset_0_1px_0_rgba(220,38,38,0.5),inset_0_-1px_0_rgba(220,38,38,0.5)]',
    shadow: 'group-hover:shadow-[0_8px_18px_-10px_rgba(220,38,38,0.8),inset_0_1px_0_rgba(220,38,38,0.5),inset_0_-1px_0_rgba(220,38,38,0.5)]',
  },
}

const bogotaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Hoy como día de calendario de Bogotá (`YYYY-MM-DD`): las fechas límite vencen al terminar ese día. */
export function bogotaToday(now: Date = new Date()): string {
  return bogotaDay.format(now)
}

/** Días de calendario que faltan para `date` (negativo = ya venció). */
export function daysUntil(date: string, today: string = bogotaToday()): number {
  return Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

export type DueUrgency = 'vencida' | 'urgente' | 'pronto' | 'holgada'

export const DUE_META: Record<DueUrgency, { className: string; Icon: LucideIcon }> = {
  vencida: { className: 'border-red-700 bg-red-600 text-white shadow-sm shadow-red-600/30', Icon: AlertCircle },
  urgente: { className: 'border-orange-600 bg-orange-500 text-orange-950 shadow-sm shadow-orange-500/30', Icon: AlarmClock },
  pronto: { className: 'border-amber-500 bg-[#F5B800] text-amber-950 shadow-sm shadow-amber-400/40', Icon: Clock },
  holgada: { className: 'border-green-800 bg-green-700 text-white shadow-sm shadow-green-700/30', Icon: CheckCircle2 },
}

export function dueUrgency(days: number): DueUrgency {
  if (days < 0) return 'vencida'
  if (days <= 3) return 'urgente'
  if (days <= 7) return 'pronto'
  return 'holgada'
}

export function dueLabel(days: number): string {
  if (days < 0) return `Vencida hace ${-days} ${days === -1 ? 'día' : 'días'}`
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  return `Vence en ${days} días`
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
}

export function expedientePath(row: Pick<StudentRow, 'process_id' | 'student_id'>) {
  return `/seguimiento/${row.process_id}/${row.student_id}`
}

/** Motivos de la alerta, solo con campos reales de la fila (nada se infiere ni se inventa). */
export function alertReasons(row: StudentRow): string[] {
  const reasons: string[] = []
  if (row.overdue > 0) reasons.push(row.overdue === 1 ? '1 tarea vencida' : `${row.overdue} tareas vencidas`)
  if (row.overdue_commitments > 0) reasons.push(row.overdue_commitments === 1 ? '1 compromiso vencido' : `${row.overdue_commitments} compromisos vencidos`)
  if (row.group_alert) reasons.push('Alerta grupal')
  return reasons
}

const CSV_HEADERS = ['Estudiante', 'Correo', 'Proyecto', 'Modalidad', 'Tutor', 'Asignadas', 'Entregadas', 'Pendientes', 'Vencidas', 'Próximo vencimiento', 'Nivel', 'Última intervención']
const LEVEL_TEXT: Record<RiskLevel, string> = { al_dia: 'Al día', atencion: 'Atención inicial', moderado: 'Riesgo moderado', critico: 'Riesgo crítico' }

/** CSV (UTF-8 con BOM para Excel) de las filas que se están viendo. */
export function rowsToCsv(rows: StudentRow[]): string {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map((r) => [r.student_name, r.student_email, r.project_title ?? r.process_code, r.modality_name, r.tutor_name, r.assigned, r.delivered, r.pending, r.overdue, r.next_due, LEVEL_TEXT[r.level], r.last_intervention_at].map(esc).join(','))
  return String.fromCharCode(0xfeff) + [CSV_HEADERS.map(esc).join(','), ...lines].join('\r\n')
}

const ORDER: RiskLevel[] = ['al_dia', 'atencion', 'moderado', 'critico']
export const RADIUS = 52
export const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 1.5 // separación visual entre segmentos, en unidades de la circunferencia

export interface Slice {
  level: RiskLevel
  count: number
  percent: number
  length: number
  offset: number
}

/** Reparte la circunferencia entre los niveles según los conteos reales del backend. */
export function buildSlices(summary: Pick<MonitoringSummary, 'students' | 'al_dia' | 'atencion' | 'moderado' | 'critico'>): Slice[] {
  const total = summary.students
  let consumed = 0
  return ORDER.map((level) => {
    const count = summary[level]
    const share = total > 0 ? count / total : 0
    const length = Math.max(0, share * CIRCUMFERENCE - (count > 0 && share < 1 ? GAP : 0))
    const slice = { level, count, percent: total > 0 ? Math.round(share * 100) : 0, length, offset: consumed }
    consumed += share * CIRCUMFERENCE
    return slice
  })
}

const MAX_ITEMS = 5

/** Vencimientos más próximos entre los estudiantes que ven la tabla: cada uno es el `next_due` real que calcula el backend. */
export function pickUpcoming(rows: StudentRow[], today: string = bogotaToday()) {
  return rows
    .filter((r): r is StudentRow & { next_due: string } => r.next_due !== null && r.pending > 0)
    .map((r) => ({ row: r, days: daysUntil(r.next_due, today) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, MAX_ITEMS)
}

export type Tone = 'blue' | 'green' | 'sky' | 'amber' | 'red' | 'violet' | 'slate'

// Cada tono: fondo suave con gradiente, borde, círculo del icono y color del icono.
export const TONES: Record<Tone, { card: string; icon: string; value: string; glow: string; shadow: string; pill: string }> = {
  blue: {
    card: 'border-blue-500 bg-gradient-to-br from-blue-100 via-blue-50 to-white dark:border-blue-400/60 dark:from-blue-500/25 dark:via-blue-500/10 dark:to-transparent',
    icon: 'bg-blue-600 text-white shadow-md shadow-blue-600/30', value: 'text-blue-700 dark:text-blue-300',
    glow: 'shadow-[0_6px_18px_-8px_rgba(37,99,235,0.55)]', shadow: 'hover:shadow-blue-500/40', pill: 'bg-blue-600 text-white',
  },
  green: {
    card: 'border-green-500 bg-gradient-to-br from-green-100 via-green-50 to-white dark:border-green-400/60 dark:from-green-500/25 dark:via-green-500/10 dark:to-transparent',
    icon: 'bg-green-600 text-white shadow-md shadow-green-600/30', value: 'text-green-700 dark:text-green-300',
    glow: 'shadow-[0_6px_18px_-8px_rgba(22,163,74,0.55)]', shadow: 'hover:shadow-green-500/40', pill: 'bg-green-700 text-white',
  },
  sky: {
    card: 'border-sky-500 bg-gradient-to-br from-sky-100 via-sky-50 to-white dark:border-sky-400/60 dark:from-sky-500/25 dark:via-sky-500/10 dark:to-transparent',
    icon: 'bg-sky-600 text-white shadow-md shadow-sky-600/30', value: 'text-sky-700 dark:text-sky-300',
    glow: 'shadow-[0_6px_18px_-8px_rgba(2,132,199,0.55)]', shadow: 'hover:shadow-sky-500/40', pill: 'bg-sky-600 text-white',
  },
  amber: {
    card: 'border-[#F5B800] bg-gradient-to-br from-[#FFF0B3] via-amber-50 to-white dark:border-amber-400/70 dark:from-amber-400/25 dark:via-amber-400/10 dark:to-transparent',
    icon: 'bg-[#F5B800] text-amber-950 shadow-md shadow-amber-500/40', value: 'text-amber-800 dark:text-amber-300',
    glow: 'shadow-[0_6px_18px_-8px_rgba(245,184,0,0.75)]', shadow: 'hover:shadow-amber-400/50', pill: 'bg-[#F5B800] text-amber-950',
  },
  red: {
    card: 'border-red-600 bg-gradient-to-br from-red-100 via-red-50 to-white dark:border-red-400/70 dark:from-red-500/25 dark:via-red-500/10 dark:to-transparent',
    icon: 'bg-red-600 text-white shadow-md shadow-red-600/40', value: 'text-red-700 dark:text-red-300',
    glow: 'shadow-[0_8px_22px_-8px_rgba(220,38,38,0.65)]', shadow: 'hover:shadow-red-500/50', pill: 'bg-red-600 text-white',
  },
  violet: {
    card: 'border-violet-500 bg-gradient-to-br from-[#EDE3FF] via-violet-50 to-white dark:border-violet-400/60 dark:from-violet-500/25 dark:via-violet-500/10 dark:to-transparent',
    icon: 'bg-violet-600 text-white shadow-md shadow-violet-600/30', value: 'text-violet-700 dark:text-violet-300',
    glow: 'shadow-[0_6px_18px_-8px_rgba(124,58,237,0.55)]', shadow: 'hover:shadow-violet-500/40', pill: 'bg-violet-600 text-white',
  },
  slate: {
    card: 'border-slate-500 bg-gradient-to-br from-slate-200 via-slate-100 to-white dark:border-slate-400/50 dark:from-white/15 dark:via-white/5 dark:to-transparent',
    icon: 'bg-slate-600 text-white shadow-md shadow-slate-600/30', value: 'text-slate-800 dark:text-slate-200',
    glow: 'shadow-[0_6px_18px_-8px_rgba(100,116,139,0.6)]', shadow: 'hover:shadow-slate-500/40', pill: 'bg-slate-600 text-white',
  },
}

export interface KpiDefinition {
  key: string
  label: string
  value: number
  sub: string
  tone: Tone
  Icon: LucideIcon
  /** Si se indica, la tarjeta filtra la lista por ese nivel de alerta. */
  level?: RiskLevel
}

export function buildKpis(summary: MonitoringSummary): KpiDefinition[] {
  return [
    { key: 'students', label: 'Estudiantes asignados', value: summary.students, sub: 'Con plan de trabajo', tone: 'sky', Icon: Users },
    { key: 'al_dia', label: 'Al día', value: summary.al_dia, sub: 'Sin tareas vencidas', tone: 'green', Icon: CalendarCheck, level: 'al_dia' },
    { key: 'atencion', label: 'Atención inicial', value: summary.atencion, sub: 'Nivel azul', tone: 'blue', Icon: Play, level: 'atencion' },
    { key: 'moderado', label: 'Riesgo moderado', value: summary.moderado, sub: 'Nivel amarillo', tone: 'amber', Icon: AlertTriangle, level: 'moderado' },
    { key: 'critico', label: 'Riesgo crítico', value: summary.critico, sub: 'Nivel rojo', tone: 'red', Icon: ShieldAlert, level: 'critico' },
    { key: 'groups', label: 'Equipos con alerta grupal', value: summary.groups_with_alert, sub: 'Escalamiento activo', tone: 'violet', Icon: UsersRound },
    { key: 'commitments', label: 'Compromisos pendientes', value: summary.open_commitments, sub: `${summary.overdue_commitments} vencidos`, tone: 'slate', Icon: ClipboardList },
  ]
}
