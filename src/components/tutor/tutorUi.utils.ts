// Funciones y constantes de tutorUi.tsx que no son componentes (fast refresh de Vite).
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { tutorApi, type PlanStatus, type TutorOverviewOut } from '@/services/tutor.service'
import type { DeliverableOut, PlanEventOut, StageOut, WorkPlanOut } from '@/services/workplan.service'
import type { ProcessHistoryOut } from '@/services/processes.service'


/** Carga el panel del tutor (proyectos donde es tutor ACTIVO, según el backend). Permite reintentar. */
export function useTutorOverview() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [data, setData] = useState<TutorOverviewOut | null>(null)
  const [status, setStatus] = useState<OverviewStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setStatus('loading')
    try {
      setData(await tutorApi.overview(accessToken))
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu panel')
      setStatus('error')
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  return { data, status, error, reload: load }
}

export function projectTitle(p: { title: string | null; process_code: string }): string {
  return p.title?.trim() || `Sin título registrado · ${p.process_code}`
}

export const PLAN_STATUS_META: Record<PlanStatus, { label: string; variant: 'gray' | 'orange' | 'green' }> = {
  sin_plan: { label: 'Sin plan', variant: 'gray' },
  borrador: { label: 'Borrador', variant: 'orange' },
  publicado: { label: 'Publicado', variant: 'green' },
}

export type OverviewStatus = 'loading' | 'ready' | 'error'

// ── Resumen del proyecto (pestaña «Resumen» del expediente) ───────────────────

export const EVENT_LABELS: Record<string, string> = {
  plan_creado: 'Plan creado',
  fechas_del_plan: 'Fechas del plan modificadas',
  plan_publicado: 'Plan publicado',
  etapa_creada: 'Etapa creada',
  etapa_editada: 'Etapa editada',
  entregable_creado: 'Entregable creado',
  entregable_editado: 'Entregable editado',
  plantilla_subida: 'Plantilla subida',
  entrega_recibida: 'Entrega recibida',
  entrega_revisada: 'Entrega revisada',
}

export type SummaryTone = 'green' | 'blue' | 'orange' | 'red' | 'gray'

/** Color de la etiqueta del estado del proceso a partir de su nombre real (el texto mostrado es siempre el del sistema). */
export function stateTone(name: string): SummaryTone {
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/cancel|rechaz|desist|anulad/.test(n)) return 'red'
  if (/cerrad|finaliz|complet|aprobad|graduad|publicad/.test(n)) return 'green'
  if (/revis|pendient|correccion|espera/.test(n)) return 'orange'
  return 'blue'
}

const DAY_MS = 86_400_000
const localDay = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
const todayStart = (now: Date): number => new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

const monthShort = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })

export interface NextDelivery {
  deliverable: DeliverableOut
  stageName: string
  /** Días hasta la fecha límite (negativo si ya venció). */
  days: number
  overdue: boolean
  remaining: string
  shortDate: string
}

/**
 * Próxima entrega del plan: el entregable activo, aplicable y NO aprobado con la fecha límite más cercana que todavía no pasó.
 * Si solo quedan vencidos, se muestra el más atrasado (para no ocultar lo urgente). Sin fechas pendientes → null.
 */
export function nextDelivery(plan: WorkPlanOut | null, now: Date = new Date()): NextDelivery | null {
  if (!plan) return null
  const today = todayStart(now)
  const open = plan.stages
    .filter((s) => s.active)
    .flatMap((s) => s.deliverables.filter((d) => d.active && d.applicable && d.status !== 'aprobado' && d.due_date).map((d) => ({ d, stageName: s.name })))
    .map((x) => ({ ...x, days: Math.round((localDay(x.d.due_date as string) - today) / DAY_MS) }))
  const upcoming = open.filter((x) => x.days >= 0).sort((a, b) => a.days - b.days)
  const late = open.filter((x) => x.days < 0).sort((a, b) => a.days - b.days)
  const pick = upcoming[0] ?? late[0]
  if (!pick) return null
  const overdue = pick.days < 0
  const remaining = overdue
    ? `Vencido hace ${-pick.days} ${-pick.days === 1 ? 'día' : 'días'}`
    : pick.days === 0
      ? 'Vence hoy'
      : `Faltan ${pick.days} ${pick.days === 1 ? 'día' : 'días'}`
  const [y, m, d] = (pick.d.due_date as string).split('-').map(Number)
  return { deliverable: pick.d, stageName: pick.stageName, days: pick.days, overdue, remaining, shortDate: monthShort.format(new Date(y, m - 1, d)).replace(/\./g, '') }
}

/** Avance de una etapa: solo cuentan los entregables obligatorios, activos y aplicables (igual que el avance oficial del plan). */
export function stageSummary(stage: StageOut): { total: number; required: number; approved: number; percent: number; state: { label: string; tone: SummaryTone } } {
  const live = stage.deliverables.filter((d) => d.active && d.applicable)
  const required = live.filter((d) => d.mandatory)
  const approved = required.filter((d) => d.status === 'aprobado').length
  const percent = required.length ? Math.round((approved / required.length) * 1000) / 10 : 0
  const started = live.some((d) => d.status !== 'pendiente' && d.status !== 'disponible')
  let state: { label: string; tone: SummaryTone }
  if (!stage.active) state = { label: 'Inactiva', tone: 'gray' }
  else if (required.length === 0) state = { label: 'Sin obligatorios', tone: 'gray' }
  else if (approved === required.length) state = { label: 'Completada', tone: 'green' }
  else if (started) state = { label: 'En desarrollo', tone: 'green' }
  else state = { label: 'Pendiente', tone: 'gray' }
  return { total: live.length, required: required.length, approved, percent, state }
}

export interface FeedItem {
  key: string
  kind: 'entrega' | 'aprobado' | 'correcciones' | 'plan' | 'estado'
  title: string
  detail: string | null
  at: string
  chip: string
  tone: SummaryTone
}

/** Actividad reciente: cambios del plan y entregas + cambios de estado del proceso, del más nuevo al más antiguo. */
export function buildFeed(activity: PlanEventOut[], history: ProcessHistoryOut[]): FeedItem[] {
  const items: FeedItem[] = []
  for (const e of activity) {
    const label = EVENT_LABELS[e.event_type] ?? e.event_type
    let kind: FeedItem['kind'] = 'plan'
    let chip = 'Plan'
    let tone: SummaryTone = 'blue'
    if (e.event_type === 'entrega_recibida') {
      kind = 'entrega'
      chip = 'En revisión'
      tone = 'orange'
    } else if (e.event_type === 'entrega_revisada') {
      const approved = (e.detail ?? '').includes('aprobado')
      kind = approved ? 'aprobado' : 'correcciones'
      chip = approved ? 'Aprobado' : 'Correcciones'
      tone = approved ? 'green' : 'orange'
    }
    items.push({ key: `p-${e.public_id}`, kind, title: e.subject ? `${label} · ${e.subject}` : label, detail: e.actor.full_name, at: e.created_at, chip, tone })
  }
  for (const h of history) {
    items.push({
      key: `h-${h.public_id}`,
      kind: 'estado',
      title: `${h.previous_state ? `${h.previous_state.name} → ` : ''}${h.new_state.name}`,
      detail: 'Cambio de estado',
      at: h.event_date,
      chip: h.new_state.name,
      tone: stateTone(h.new_state.name),
    })
  }
  const time = (iso: string) => Date.parse(/[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`)
  return items.sort((a, b) => time(b.at) - time(a.at))
}

// Estilos compartidos de las tarjetas de los tableros del expediente.
export const CARD = 'rounded-2xl border border-[#DCE6F2] bg-white shadow-[0_2px_10px_rgba(36,52,85,0.05)] dark:border-[var(--color-border)] dark:bg-[var(--color-surface)]'

export const TONES = {
  green: { tile: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  blue: { tile: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  orange: { tile: 'bg-orange-50 text-[#FF6500] dark:bg-orange-500/15 dark:text-orange-300', pill: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
  red: { tile: 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300', pill: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  gray: { tile: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300', pill: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300' },
} as const

// ── Plan de trabajo y entregables (pestaña unificada) ─────────────────────────

export type DeliverableFilter = 'todos' | 'pendiente' | 'disponible' | 'en_revision' | 'requiere_correcciones' | 'aprobado' | 'vencido'

export const FILTER_LABELS: Record<DeliverableFilter, string> = {
  todos: 'Todos los estados',
  pendiente: 'Pendiente',
  disponible: 'Disponible para entregar',
  en_revision: 'En revisión',
  requiere_correcciones: 'Con correcciones',
  aprobado: 'Aprobado',
  vencido: 'Vencido',
}

const plain = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Vencido = la fecha pasó (regla del backend: `is_overdue`) y todavía no está aprobado. */
export const isOverdueOpen = (d: DeliverableOut): boolean => d.is_overdue && d.status !== 'aprobado'

/** ¿Pasa el entregable la búsqueda por nombre y los filtros de la tabla? */
export function matchesDeliverable(d: DeliverableOut, query: string, filter: DeliverableFilter, onlyMandatory: boolean): boolean {
  if (query.trim() && !plain(d.title).includes(plain(query.trim()))) return false
  if (onlyMandatory && !d.mandatory) return false
  if (filter === 'todos') return true
  if (filter === 'vencido') return isOverdueOpen(d)
  return d.status === filter
}

/** Entregables vigentes del plan: activos y aplicables, de etapas activas. */
export function liveDeliverables(plan: WorkPlanOut | null): DeliverableOut[] {
  return (plan?.stages ?? []).filter((s) => s.active).flatMap((s) => s.deliverables.filter((d) => d.active && d.applicable))
}

export interface PlanCounts {
  stages: number
  deliverables: number
  approved: number
  inReview: number
  overdue: number
}

export function planCounts(plan: WorkPlanOut | null): PlanCounts {
  const live = liveDeliverables(plan)
  return {
    stages: (plan?.stages ?? []).filter((s) => s.active).length,
    deliverables: live.length,
    approved: live.filter((d) => d.status === 'aprobado').length,
    inReview: live.filter((d) => d.status === 'en_revision').length,
    overdue: live.filter(isOverdueOpen).length,
  }
}

/** Primera y última fecha límite de una etapa (las etapas no guardan fechas propias; se derivan de sus entregables). */
export function stageDateRange(stage: StageOut): { first: string | null; last: string | null } {
  const dates = stage.deliverables.filter((d) => d.active && d.due_date).map((d) => d.due_date as string).sort()
  return { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null }
}

export interface CalendarCell {
  /** `YYYY-MM-DD` o null en los huecos de la primera/última semana. */
  date: string | null
  day: number
}

/** Cuadrícula del mes (semanas de lunes a domingo, completas con huecos). `month` va de 0 a 11. */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const cells: CalendarCell[] = Array.from({ length: lead }, () => ({ date: null, day: 0 }))
  for (let day = 1; day <= days; day++) cells.push({ date: `${year}-${pad(month + 1)}-${pad(day)}`, day })
  while (cells.length % 7 !== 0) cells.push({ date: null, day: 0 })
  return cells
}

export type DayTone = 'overdue' | 'review' | 'next' | 'approved' | 'other'

/** Color del día según sus entregables: vencido > en revisión > próxima entrega > todos aprobados > otros. */
export function dayTone(items: DeliverableOut[], nextId: string | null): DayTone {
  if (items.some(isOverdueOpen)) return 'overdue'
  if (items.some((d) => d.status === 'en_revision')) return 'review'
  if (nextId && items.some((d) => d.public_id === nextId)) return 'next'
  if (items.length > 0 && items.every((d) => d.status === 'aprobado')) return 'approved'
  return 'other'
}

// ── Cronograma (Gantt) ────────────────────────────────────────────────────────

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** `YYYY-MM-DD` → «31 oct 2026» (fecha de calendario; formato fijo, no depende del ICU del equipo). */
export function formatShort(value: string | null): string {
  if (!value) return 'Sin fecha definida'
  const [y, m, d] = value.split('-')
  return `${d} ${MONTHS_ES[Number(m) - 1]} ${y}`
}

/** Color de cada etapa (por su posición en el plan): naranja, azul, verde y gris, en ciclo. */
const STAGE_TONES: SummaryTone[] = ['orange', 'blue', 'green', 'gray']
export const stageTone = (index: number): SummaryTone => STAGE_TONES[Math.max(0, index) % STAGE_TONES.length]

export type GanttMode = 'todo' | 'hoy' | number

export interface GanttMonth {
  key: string
  label: string
}

export interface GanttRange {
  /** Primer instante del rango (día 1 del primer mes) y primer instante DESPUÉS del último mes. */
  start: number
  end: number
  months: GanttMonth[]
}

const MONTH_SHORT = new Intl.DateTimeFormat('es-CO', { month: 'short' })

function buildRange(first: Date, monthsCount: number): GanttRange {
  const months: GanttMonth[] = []
  for (let i = 0; i < monthsCount; i++) {
    const m = new Date(first.getFullYear(), first.getMonth() + i, 1)
    months.push({ key: `${m.getFullYear()}-${m.getMonth() + 1}`, label: `${MONTH_SHORT.format(m).replace(/\./g, '').replace(/^./, (c) => c.toUpperCase())} ${m.getFullYear()}` })
  }
  return { start: first.getTime(), end: new Date(first.getFullYear(), first.getMonth() + monthsCount, 1).getTime(), months }
}

/** Fechas reales del plan (inicio, fecha objetivo y fechas límite de los entregables activos), ordenadas. */
export function planDates(plan: WorkPlanOut | null): string[] {
  if (!plan) return []
  const dates = plan.stages.filter((s) => s.active).flatMap((s) => s.deliverables.filter((d) => d.active && d.due_date).map((d) => d.due_date as string))
  if (plan.start_date) dates.push(plan.start_date)
  if (plan.target_end_date) dates.push(plan.target_end_date)
  return dates.sort()
}

/** Años que cubre el plan (para el selector de rango). */
export function planYears(plan: WorkPlanOut | null): number[] {
  return [...new Set(planDates(plan).map((d) => Number(d.slice(0, 4))))]
}

/**
 * Rango de meses del cronograma. `todo`: del mes de la primera fecha real al de la última (mínimo 6 meses);
 * `hoy`: 6 meses desde el mes actual; un año: de enero a diciembre. Sin fechas reales → null.
 */
export function ganttRange(plan: WorkPlanOut | null, mode: GanttMode, now: Date = new Date()): GanttRange | null {
  const dates = planDates(plan)
  if (dates.length === 0) return null
  if (typeof mode === 'number') return buildRange(new Date(mode, 0, 1), 12)
  if (mode === 'hoy') return buildRange(new Date(now.getFullYear(), now.getMonth(), 1), 6)
  const [fy, fm] = dates[0].split('-').map(Number)
  const [ly, lm] = dates[dates.length - 1].split('-').map(Number)
  const count = Math.max(6, (ly - fy) * 12 + (lm - fm) + 1)
  return buildRange(new Date(fy, fm - 1, 1), count)
}

/** Posición horizontal (0-100) de una fecha `YYYY-MM-DD` dentro del rango; null si cae fuera. */
export function positionPct(range: GanttRange, iso: string): number | null {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(y, m - 1, d).getTime()
  if (t < range.start || t >= range.end) return null
  return ((t - range.start) / (range.end - range.start)) * 100
}

/** Barra de una etapa: de su primera a su última fecha límite, recortada al rango visible. null si no cae en él. */
export function stageBar(range: GanttRange, stage: StageOut): { left: number; width: number } | null {
  const { first, last } = stageDateRange(stage)
  if (!first || !last) return null
  const toT = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).getTime()
  }
  const a = Math.max(toT(first), range.start)
  const b = Math.min(toT(last) + 86_400_000, range.end)
  if (b <= a) return null
  const span = range.end - range.start
  return { left: ((a - range.start) / span) * 100, width: Math.max(((b - a) / span) * 100, 1.2) }
}

/** `YYYY-MM-DD` de hoy según la hora local. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export type MarkerTone = 'approved' | 'review' | 'next' | 'overdue' | 'pending'

/** Color del hito de un entregable en el cronograma. */
export function markerTone(d: DeliverableOut, nextId: string | null): MarkerTone {
  if (d.status === 'aprobado') return 'approved'
  if (isOverdueOpen(d)) return 'overdue'
  if (d.status === 'en_revision') return 'review'
  if (nextId && d.public_id === nextId) return 'next'
  return 'pending'
}
