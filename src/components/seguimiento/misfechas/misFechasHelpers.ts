import type { CommitmentOut, TaskOut } from '@/services/monitoring.service'
import type { DeliverableOut, StageOut, WorkPlanOut } from '@/services/workplan.service'
import {
  nextAction,
  type DraftMap,
  type HistoryMap,
  type NextAction,
  instantMs,
} from '@/components/proceso/documentos/documentosHelpers'
import { bogotaToday, daysUntil } from '../monitoringHelpers'

// Reglas de PRESENTACIÓN de «Mis fechas y compromisos». El plan que reciben ya viene normalizado con las fechas EFECTIVAS
// (`normalizePlanDates`), la misma fuente que «Documentos y entregables»: aquí no se recalcula ningún estado oficial.

/** Las cuatro categorías de la leyenda. Cada entregable cae en UNA sola. */
export type Bucket = 'aprobado' | 'revision' | 'pendiente' | 'vencido'

export const BUCKET_LABEL: Record<Bucket, string> = {
  aprobado: 'Entregados / aprobados',
  revision: 'En revisión',
  pendiente: 'Pendientes / en curso',
  vencido: 'Vencidos',
}

/**
 * Color principal de cada categoría (donut, puntos): el mismo hex en toda la página. Verde #16A34A, naranja #F97316,
 * azul #2563EB, rojo #DC2626.
 */
export const BUCKET_COLOR: Record<Bucket, string> = { aprobado: '#16A34A', revision: '#F97316', pendiente: '#2563EB', vencido: '#DC2626' }

export interface BucketToneClasses {
  /**
   * Fila de la tabla: fondo BLANCO en aprobado y pendiente (el color vive en el icono, la insignia y las acciones); fondo
   * tintado con borde fino solo en revisión (naranja) y vencido (rojo), que son los que piden atención. El hover es propio de
   * cada estado y nunca un azul general.
   */
  row: string
  /** Caja del icono de documento, de la familia cromática del estado. */
  iconBox: string
  /** Fondo tintado más marcado (leyenda, calendario). */
  tint: string
  /** Fondo suave (chips, insignias de porcentaje). */
  soft: string
  /** Insignia de estado: borde, fondo perceptible y texto con contraste. */
  badge: string
  /** Texto del color de la categoría (números, títulos). */
  text: string
  /** Punto sólido. */
  dot: string
  /** Borde lateral solo (3 px) para la leyenda. */
  edge: string
}

// Clases literales (Tailwind no detecta nombres armados dinámicamente). Los textos usan tonos 700-800 sobre fondos claros y
// 200-300 sobre fondos translúcidos en modo oscuro, para mantener el contraste en ambos temas.
export const BUCKET_TONE: Record<Bucket, BucketToneClasses> = {
  aprobado: {
    // Fila blanca con un acento verde discreto de 2 px (no una franja gruesa).
    row: 'border-l-2 border-l-[#22C55E] bg-[var(--color-surface)] hover:bg-[#F0FDF4] dark:hover:bg-emerald-500/10',
    iconBox: 'bg-[#CBF5D8] text-[#16A34A] ring-1 ring-inset ring-[#22C55E]/40 dark:bg-emerald-500/25 dark:text-emerald-300 dark:ring-emerald-400/40',
    tint: 'bg-[#CBF5D8] dark:bg-emerald-500/20',
    soft: 'bg-[#CBF5D8] dark:bg-emerald-500/20',
    badge: 'border-[#16A34A] bg-[#CBF5D8] text-[#14532D] dark:border-emerald-400/70 dark:bg-emerald-500/25 dark:text-emerald-100',
    text: 'text-[#15803D] dark:text-emerald-300',
    dot: 'bg-[#16A34A]',
    edge: 'border-l-[3px] border-l-[#16A34A]',
  },
  revision: {
    row: 'bg-[#FFF4E8] ring-1 ring-inset ring-[#FB923C] hover:bg-[#FFEBD6] dark:bg-orange-500/10 dark:ring-orange-400/50 dark:hover:bg-orange-500/20',
    iconBox: 'bg-[#FFDDB8] text-[#F97316] ring-1 ring-inset ring-[#FB923C]/50 dark:bg-orange-500/25 dark:text-orange-300 dark:ring-orange-400/40',
    tint: 'bg-[#FFE0C2] dark:bg-orange-500/20',
    soft: 'bg-[#FFE0C2] dark:bg-orange-500/20',
    badge: 'border-[#F97316] bg-[#FFE0C2] text-[#7C2D12] dark:border-orange-400/70 dark:bg-orange-500/25 dark:text-orange-100',
    text: 'text-[#C2410C] dark:text-orange-300',
    dot: 'bg-[#F97316]',
    edge: 'border-l-[3px] border-l-[#F97316]',
  },
  pendiente: {
    // Fila blanca: el azul vive en el icono, la insignia y el botón «Entregar».
    row: 'bg-[var(--color-surface)] hover:bg-[#F1F5F9] dark:hover:bg-white/5',
    iconBox: 'bg-[#D3E3FF] text-[#2563EB] ring-1 ring-inset ring-[#60A5FA]/50 dark:bg-blue-500/25 dark:text-blue-300 dark:ring-blue-400/40',
    tint: 'bg-[#CFE1FF] dark:bg-blue-500/20',
    soft: 'bg-[#CFE1FF] dark:bg-blue-500/20',
    badge: 'border-[#2563EB] bg-[#D3E3FF] text-[#1E3A8A] dark:border-blue-400/70 dark:bg-blue-500/25 dark:text-blue-100',
    text: 'text-[#1D4ED8] dark:text-blue-300',
    dot: 'bg-[#2563EB]',
    edge: 'border-l-[3px] border-l-[#2563EB]',
  },
  vencido: {
    row: 'bg-[#FEF2F2] ring-1 ring-inset ring-[#EF4444] hover:bg-[#FDE8E8] dark:bg-red-500/10 dark:ring-red-400/50 dark:hover:bg-red-500/15',
    iconBox: 'bg-[#FECACA] text-[#DC2626] ring-1 ring-inset ring-[#EF4444]/50 dark:bg-red-500/25 dark:text-red-300 dark:ring-red-400/40',
    tint: 'bg-[#FECACA] dark:bg-red-500/20',
    soft: 'bg-[#FECACA] dark:bg-red-500/20',
    badge: 'border-[#DC2626] bg-[#FECACA] text-[#7F1D1D] dark:border-red-400/70 dark:bg-red-500/25 dark:text-red-100',
    text: 'text-[#B91C1C] dark:text-red-300',
    dot: 'bg-[#DC2626]',
    edge: 'border-l-[3px] border-l-[#DC2626]',
  },
}

// ── Estado general del PROYECTO (no del entregable) ──────────────────────────

export type StateTone = Bucket | 'neutro'

/**
 * Clasificación explícita por código del catálogo `possible_states`; ningún estado queda en verde por defecto.
 * Negativos → rojo; cierres exitosos → verde; en marcha → azul; con acción pendiente (correcciones, prórroga) → naranja;
 * el resto (trámites previos y de cierre) → neutro, porque no tiene una clasificación definida.
 */
const STATE_TONE: Record<string, StateTone> = {
  CANCELADO: 'vencido',
  REPROBADO: 'vencido',
  CERRADO: 'aprobado',
  HOMOLOGADO: 'aprobado',
  MENCION_CONFIRMADA: 'aprobado',
  EN_EJECUCION: 'pendiente',
  AVANCES_EN_REVISION: 'pendiente',
  ANTEPROYECTO_EN_REVISION: 'pendiente',
  CORRECCIONES_SOLICITADAS: 'revision',
  PRORROGA_SOLICITADA: 'revision',
}

export function projectStateTone(code: string): StateTone {
  return STATE_TONE[code] ?? 'neutro'
}

/** Entregables que cuentan para el estudiante: activos, aplicables y de una etapa activa. */
export function countableDeliverables(plan: WorkPlanOut): Array<{ deliverable: DeliverableOut; stage: StageOut }> {
  return plan.stages.filter((s) => s.active).flatMap((stage) => stage.deliverables.filter((d) => d.active && d.applicable).map((deliverable) => ({ deliverable, stage })))
}

/**
 * Categoría única de un entregable, sobre el estado oficial del backend:
 * aprobado → verde; en revisión → naranja (NUNCA pendiente ni vencido, aunque la fecha haya pasado);
 * con correcciones o disponible → vencido si pasó la fecha EFECTIVA, si no pendiente; aún no habilitado → pendiente.
 */
export function bucketOf(d: DeliverableOut): Bucket {
  if (d.status === 'aprobado') return 'aprobado'
  if (d.status === 'en_revision') return 'revision'
  return d.is_overdue ? 'vencido' : 'pendiente'
}

/** Texto de la insignia: el estado oficial del entregable, con el color de la leyenda. El borrador solo cambia el texto, nunca el color. */
export function bucketLabel(d: DeliverableOut, hasDraft: boolean): string {
  if (d.status === 'aprobado') return 'Aprobado'
  if (d.status === 'en_revision') return 'En revisión'
  if (d.status === 'requiere_correcciones') return d.is_overdue ? 'Correcciones · vencido' : 'Con correcciones'
  if (d.is_overdue) return 'Vencido'
  if (hasDraft && d.can_submit) return 'Borrador guardado'
  return 'Pendiente'
}

export interface BucketSummary {
  counts: Record<Bucket, number>
  total: number
  /** De los pendientes, los que tienen correcciones solicitadas (siguen contando una sola vez). */
  corrections: number
  /** Proporción de cada categoría sobre el total (0–100, entera). */
  percent: Record<Bucket, number>
}

export function summarize(plan: WorkPlanOut): BucketSummary {
  const counts: Record<Bucket, number> = { aprobado: 0, revision: 0, pendiente: 0, vencido: 0 }
  let corrections = 0
  const items = countableDeliverables(plan)
  for (const { deliverable: d } of items) {
    counts[bucketOf(d)] += 1
    if (d.status === 'requiere_correcciones' && bucketOf(d) === 'pendiente') corrections += 1
  }
  const total = items.length
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  return { counts, total, corrections, percent: { aprobado: pct(counts.aprobado), revision: pct(counts.revision), pendiente: pct(counts.pendiente), vencido: pct(counts.vencido) } }
}

// ── Días restantes ───────────────────────────────────────────────────────────

export type DaysTone = 'none' | 'aprobado' | 'revision' | 'ok' | 'soon' | 'today' | 'late'

/**
 * Colores de la urgencia de la fecha (una sola definición para la tabla y la tarjeta de próximo compromiso): aprobado verde;
 * en revisión naranja; pendiente azul (>7 días), naranja (≤7 días), naranja intenso (hoy) o rojo (vencido).
 */
export const DAYS_TONE_CLASS: Record<DaysTone, string> = {
  none: 'text-[var(--color-text-muted)]',
  aprobado: 'bg-[#CBF5D8] text-[#14532D] dark:bg-emerald-500/25 dark:text-emerald-100',
  revision: 'bg-[#FFE0C2] text-[#7C2D12] dark:bg-orange-500/25 dark:text-orange-100',
  ok: 'bg-[#D3E3FF] text-[#1E3A8A] dark:bg-blue-500/25 dark:text-blue-100',
  soon: 'bg-[#FFE0C2] text-[#7C2D12] dark:bg-orange-500/25 dark:text-orange-100',
  today: 'bg-[#C2410C] text-white shadow-sm',
  late: 'bg-[#DC2626] text-white shadow-sm',
}

export interface DaysInfo {
  text: string
  tone: DaysTone
}

/** Días de calendario (Bogotá) hasta la fecha efectiva. Nunca se muestran negativos como «restantes». */
export function daysInfo(d: DeliverableOut, today: string = bogotaToday()): DaysInfo {
  if (d.status === 'aprobado') return { text: '—', tone: 'aprobado' }
  if (!d.due_date) return { text: 'Sin fecha', tone: 'none' }
  const days = daysUntil(d.due_date, today)
  const plural = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`
  // En revisión: la pelota está del lado del tutor; se informa el plazo restante sin tratarlo como pendiente del estudiante.
  if (d.status === 'en_revision') return { text: days >= 0 ? (days === 0 ? 'Vence hoy' : plural(days)) : '—', tone: 'revision' }
  if (days < 0) return { text: `Vencido hace ${plural(-days)}`, tone: 'late' }
  if (days === 0) return { text: 'Vence hoy', tone: 'today' }
  return { text: plural(days), tone: days <= 7 ? 'soon' : 'ok' }
}

// ── Próximo compromiso ───────────────────────────────────────────────────────

export type NextCommitment =
  | { kind: 'entregable'; action: NextAction; days: DaysInfo }
  | { kind: 'compromiso'; commitment: CommitmentOut; days: number }
  | null

/**
 * 1) correcciones, 2) vencidos / borradores por entregar / disponibles por fecha, 3) compromisos abiertos con el tutor.
 * Una entrega en revisión NO es un compromiso pendiente del estudiante (no se vuelve a pedir el archivo).
 */
export function nextCommitment(plan: WorkPlanOut, drafts: DraftMap, commitments: CommitmentOut[], today: string = bogotaToday()): NextCommitment {
  const action = nextAction(plan, drafts, { includeInReview: false })
  if (action) return { kind: 'entregable', action, days: daysInfo(action.deliverable, today) }
  const open = commitments.filter((c) => c.status === 'pendiente' || c.status === 'en_seguimiento').sort((a, b) => a.due_date.localeCompare(b.due_date))
  return open[0] ? { kind: 'compromiso', commitment: open[0], days: daysUntil(open[0].due_date, today) } : null
}

// ── Calendario ───────────────────────────────────────────────────────────────

export type CalendarKind = 'limite' | 'entrega' | 'ampliacion' | 'revision' | 'compromiso' | 'hito'

export interface CalendarEvent {
  key: string
  /** `YYYY-MM-DD` (día de calendario en Bogotá). */
  date: string
  kind: CalendarKind
  /** Color de la leyenda. */
  bucket: Bucket
  title: string
  detail: string
  deliverableId: string | null
}

const bogotaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' })
const dayOfInstant = (value: string) => bogotaDay.format(new Date(instantMs(value)))

export const CALENDAR_KIND_LABEL: Record<CalendarKind, string> = {
  limite: 'Fecha límite',
  entrega: 'Entrega realizada',
  ampliacion: 'Ampliación autorizada',
  revision: 'Respuesta del tutor',
  compromiso: 'Compromiso con el tutor',
  hito: 'Hito del plan',
}

/** Solo fechas que existen en el sistema: límites efectivos, entregas, ampliaciones, respuestas del tutor, compromisos e hitos del plan. */
export function buildCalendarEvents(
  plan: WorkPlanOut,
  history: HistoryMap,
  tasks: Record<string, TaskOut>,
  commitments: CommitmentOut[],
  originalDue: Record<string, string | null>
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const { deliverable: d, stage } of countableDeliverables(plan)) {
    if (d.due_date) {
      const extended = originalDue[d.public_id] && originalDue[d.public_id] !== d.due_date
      events.push({ key: `due-${d.public_id}`, date: d.due_date, kind: 'limite', bucket: bucketOf(d), title: d.title, detail: `${stage.name}${extended ? ' · fecha ampliada' : ''}`, deliverableId: d.public_id })
    }
    for (const e of tasks[d.public_id]?.extensions ?? []) {
      events.push({ key: `ext-${e.id}`, date: dayOfInstant(e.authorized_at), kind: 'ampliacion', bucket: 'pendiente', title: d.title, detail: `+${e.days_added} ${e.days_added === 1 ? 'día' : 'días'}: nuevo plazo ${e.new_due_date}`, deliverableId: d.public_id })
    }
    const subs = history[d.public_id] ?? (d.current_submission ? [d.current_submission] : [])
    for (const s of subs) {
      events.push({ key: `sub-${s.public_id}`, date: dayOfInstant(s.submitted_at), kind: 'entrega', bucket: s.status === 'aprobado' ? 'aprobado' : s.status === 'en_revision' ? 'revision' : 'pendiente', title: d.title, detail: `Versión ${s.version}`, deliverableId: d.public_id })
      for (const r of s.reviews) {
        events.push({ key: `rev-${r.public_id}`, date: dayOfInstant(r.created_at), kind: 'revision', bucket: r.decision === 'aprobado' ? 'aprobado' : 'pendiente', title: d.title, detail: `${r.decision === 'aprobado' ? 'Aprobado' : 'Correcciones solicitadas'} · versión ${s.version}`, deliverableId: d.public_id })
      }
    }
  }
  for (const c of commitments) {
    events.push({ key: `com-${c.id}`, date: c.due_date, kind: 'compromiso', bucket: c.status === 'cumplido' ? 'aprobado' : c.is_overdue || c.status === 'incumplido' ? 'vencido' : 'pendiente', title: c.description, detail: 'Compromiso con tu tutor', deliverableId: null })
  }
  if (plan.start_date) events.push({ key: 'plan-start', date: plan.start_date, kind: 'hito', bucket: 'pendiente', title: 'Inicio del plan de trabajo', detail: plan.process_title ?? '', deliverableId: null })
  if (plan.target_end_date) events.push({ key: 'plan-end', date: plan.target_end_date, kind: 'hito', bucket: 'pendiente', title: 'Fecha objetivo de finalización', detail: plan.process_title ?? '', deliverableId: null })
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
}

/** Rejilla de un mes (semanas de lunes a domingo); los días de relleno llevan `inMonth: false`. */
export function monthGrid(year: number, month: number): Array<{ date: string; day: number; inMonth: boolean }> {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const cells = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7) * 7
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return Array.from({ length: cells }, (_, i) => {
    const d = new Date(year, month, 1 - lead + i)
    return { date: iso(d), day: d.getDate(), inMonth: d.getMonth() === month }
  })
}
