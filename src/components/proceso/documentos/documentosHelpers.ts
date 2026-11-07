import type { DeliverableOut, ReviewDecision, StageOut, SubmissionOut, WorkPlanOut } from '@/services/workplan.service'
import { allDeliverables, stagesBySemester } from '../workPlanUi'

// Reglas de PRESENTACIÓN del centro de documentos. Los estados oficiales y los porcentajes los calcula el backend
// (`status`, `progress`); aquí solo se combinan datos que ya llegaron (nada se inventa ni se estima).

/** Historial oficial por entregable (`GET …/deliverables/{id}/submissions`), solo de entregables con entregas. */
export type HistoryMap = Record<string, SubmissionOut[]>
/** Entregables en los que el estudiante tiene un borrador privado vigente. */
export type DraftMap = Record<string, boolean>

// ── Estado visible de un entregable ──────────────────────────────────────────

export type DisplayStatus = 'aprobada' | 'con_correcciones' | 'en_revision' | 'borrador' | 'vencida' | 'disponible' | 'pendiente' | 'no_aplica'

export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  aprobada: 'Aprobado',
  con_correcciones: 'Con correcciones',
  en_revision: 'En revisión',
  borrador: 'Borrador guardado',
  vencida: 'Vencida',
  disponible: 'Disponible para entregar',
  pendiente: 'Pendiente',
  no_aplica: 'No aplica',
}

/** Estado que ve el estudiante. El borrador solo cuenta si todavía puede entregar: nunca se confunde con una entrega oficial. */
export function displayStatus(d: DeliverableOut, drafts: DraftMap): DisplayStatus {
  if (!d.applicable) return 'no_aplica'
  if (d.status === 'aprobado') return 'aprobada'
  if (d.status === 'requiere_correcciones') return 'con_correcciones'
  if (d.status === 'en_revision') return 'en_revision'
  if (d.can_submit && drafts[d.public_id]) return 'borrador'
  if (d.is_overdue) return 'vencida'
  if (d.status === 'disponible') return 'disponible'
  return 'pendiente'
}

export const STATUS_FILTER_OPTIONS: Array<{ value: DisplayStatus | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'disponible', label: DISPLAY_STATUS_LABEL.disponible },
  { value: 'borrador', label: DISPLAY_STATUS_LABEL.borrador },
  { value: 'en_revision', label: DISPLAY_STATUS_LABEL.en_revision },
  { value: 'con_correcciones', label: DISPLAY_STATUS_LABEL.con_correcciones },
  { value: 'aprobada', label: DISPLAY_STATUS_LABEL.aprobada },
  { value: 'vencida', label: DISPLAY_STATUS_LABEL.vencida },
  { value: 'pendiente', label: DISPLAY_STATUS_LABEL.pendiente },
]

// ── Fechas ───────────────────────────────────────────────────────────────────

const shortDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

/** `YYYY-MM-DD` del backend como fecha de calendario (sin desfase de zona horaria): «25 nov 2026». */
export function formatShortDate(value: string | null): string {
  if (!value) return 'Sin fecha'
  const [y, m, d] = value.split('-').map(Number)
  return shortDate.format(new Date(y, m - 1, d)).replace(/\./g, '')
}

/** Instante UTC sin zona que entrega el backend → milisegundos. */
export function instantMs(value: string): number {
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`
  return new Date(iso).getTime()
}

const dueMs = (d: DeliverableOut) => (d.due_date ? new Date(`${d.due_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY)

// ── Línea de progreso por etapa ──────────────────────────────────────────────

export type StageState = 'completada' | 'en_curso' | 'pendiente' | 'atencion'

function stageDeliverables(stage: StageOut): DeliverableOut[] {
  return stage.deliverables.filter((d) => d.active && d.applicable)
}

/** Estado de una etapa derivado de los estados reales de sus entregables (rojo solo si hay uno vencido sin resolver). */
export function stageState(stage: StageOut): StageState {
  const items = stageDeliverables(stage)
  if (items.length === 0) return 'pendiente'
  if (items.every((d) => d.status === 'aprobado')) return 'completada'
  if (items.some((d) => d.is_overdue && d.status !== 'aprobado')) return 'atencion'
  if (items.some((d) => d.status !== 'pendiente')) return 'en_curso'
  return 'pendiente'
}

export function stageStateLabel(stage: StageOut): string {
  const state = stageState(stage)
  if (state === 'completada') return 'Completada'
  if (state === 'atencion') return 'Con retraso'
  if (state === 'pendiente') return 'Pendiente'
  const items = stageDeliverables(stage)
  if (items.some((d) => d.status === 'requiere_correcciones')) return 'Con correcciones'
  if (items.some((d) => d.status === 'en_revision')) return 'En revisión'
  return 'En curso'
}

// ── Semestres (acordeón) ─────────────────────────────────────────────────────

export interface SemesterGroup {
  semester: number
  title: string
  rows: Array<{ deliverable: DeliverableOut; stage: StageOut }>
  /** Avance del semestre con la regla del backend por entregable: aprobados / aplicables. */
  approved: number
  total: number
}

export function semesterGroups(plan: WorkPlanOut): SemesterGroup[] {
  return stagesBySemester(plan).map(({ semester, stages }) => {
    const rows = stages.flatMap((stage) => stage.deliverables.filter((d) => d.active).map((deliverable) => ({ deliverable, stage })))
    const counted = rows.filter((r) => r.deliverable.applicable)
    return {
      semester,
      title: stages.map((s) => s.name).join(' · '),
      rows,
      approved: counted.filter((r) => r.deliverable.status === 'aprobado').length,
      total: counted.length,
    }
  })
}

export interface Filters {
  search: string
  status: DisplayStatus | 'todos'
  semester: number | 'todos'
}

export const NO_FILTERS: Filters = { search: '', status: 'todos', semester: 'todos' }

export function filtersActive(f: Filters): boolean {
  return f.search.trim() !== '' || f.status !== 'todos' || f.semester !== 'todos'
}

/** Texto sin tildes ni mayúsculas, para buscar. */
export const normText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const norm = normText

export function applyFilters(groups: SemesterGroup[], filters: Filters, drafts: DraftMap): SemesterGroup[] {
  const query = norm(filters.search.trim())
  return groups
    .filter((g) => filters.semester === 'todos' || g.semester === filters.semester)
    .map((g) => ({
      ...g,
      rows: g.rows.filter(({ deliverable: d, stage }) => {
        if (filters.status !== 'todos' && displayStatus(d, drafts) !== filters.status) return false
        return query === '' || norm(d.title).includes(query) || norm(stage.name).includes(query)
      }),
    }))
    .filter((g) => g.rows.length > 0)
}

// ── Próxima acción ───────────────────────────────────────────────────────────

export interface NextAction {
  deliverable: DeliverableOut
  stage: StageOut
  status: DisplayStatus
  message: string
}

const PRIORITY: Partial<Record<DisplayStatus, number>> = { con_correcciones: 0, vencida: 1, borrador: 2, disponible: 3, en_revision: 4 }

const NEXT_MESSAGE: Partial<Record<DisplayStatus, string>> = {
  con_correcciones: 'Tu tutor pidió correcciones. Revisa sus observaciones y prepara una nueva versión.',
  vencida: 'La fecha límite ya pasó. Entrega este documento lo antes posible.',
  borrador: 'Tienes un borrador guardado que todavía no es una entrega. Revísalo y pulsa «Entregar».',
  disponible: 'Ya puedes cargar y entregar este documento.',
  en_revision: 'Tu entrega está en revisión por el tutor.',
}

/**
 * Entregable que más atención requiere: correcciones, vencidos, borradores por entregar, disponibles y, al final, en revisión
 * (esto último solo con `includeInReview`: una entrega esperando al tutor no le pide nada nuevo al estudiante).
 */
export function nextAction(plan: WorkPlanOut, drafts: DraftMap, options: { includeInReview?: boolean } = {}): NextAction | null {
  const { includeInReview = true } = options
  const candidates = plan.stages.flatMap((stage) =>
    stage.deliverables
      .filter((d) => d.active)
      .map((deliverable) => ({ deliverable, stage, status: displayStatus(deliverable, drafts) }))
      .filter((c) => PRIORITY[c.status] !== undefined && (includeInReview || c.status !== 'en_revision'))
  )
  candidates.sort((a, b) => PRIORITY[a.status]! - PRIORITY[b.status]! || dueMs(a.deliverable) - dueMs(b.deliverable))
  const first = candidates[0]
  return first ? { ...first, message: NEXT_MESSAGE[first.status] ?? '' } : null
}

// ── Resumen del proceso ──────────────────────────────────────────────────────

export interface ProcessSummary {
  approved: number
  inReview: number
  corrections: number
  /** Obligatorios sin entregar todavía (total − aprobados − en revisión − con correcciones). */
  pending: number
  total: number
  percent: number
}

/** Usa EXACTAMENTE `plan.progress` (regla del backend: entregables obligatorios). Un borrador no cuenta como entrega. */
export function processSummary(plan: WorkPlanOut): ProcessSummary {
  const p = plan.progress
  return {
    approved: p.approved,
    inReview: p.pending_review,
    corrections: p.needs_corrections,
    pending: Math.max(0, p.total_required - p.approved - p.pending_review - p.needs_corrections),
    total: p.total_required,
    percent: Math.round(p.percent),
  }
}

// ── Línea de tiempo: actividad reciente (solo hechos que el estudiante puede ver) ─

export type ActivityKind = 'entrega' | 'aprobada' | 'correccion' | 'plan'

export interface ActivityItem {
  key: string
  kind: ActivityKind
  title: string
  detail: string
  at: string
}

const DECISION_TITLE: Record<ReviewDecision, { kind: ActivityKind; title: string }> = {
  aprobado: { kind: 'aprobada', title: 'Documento aprobado' },
  requiere_correcciones: { kind: 'correccion', title: 'Corrección solicitada' },
}

/**
 * Eventos reales: entregas oficiales y revisiones de las que el estudiante es parte. `/work-plan/activity` es solo para
 * gestores, por eso no se usa aquí. Los borradores privados no generan eventos.
 */
export function buildActivity(plan: WorkPlanOut, history: HistoryMap): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const d of allDeliverables(plan)) {
    const subs = history[d.public_id] ?? (d.current_submission ? [d.current_submission] : [])
    for (const s of subs) {
      items.push({ key: `s-${s.public_id}`, kind: 'entrega', title: s.version > 1 ? `Nueva versión entregada (v${s.version})` : 'Tu entrega se envió a revisión', detail: d.title, at: s.submitted_at })
      for (const r of s.reviews) {
        const meta = DECISION_TITLE[r.decision]
        items.push({ key: `r-${r.public_id}`, kind: meta.kind, title: meta.title, detail: `${d.title} · v${s.version}`, at: r.created_at })
      }
    }
  }
  if (plan.published_at) items.push({ key: 'plan', kind: 'plan', title: 'Se publicó tu plan de trabajo', detail: 'Ya puedes ver tus entregables', at: plan.published_at })
  return items.sort((a, b) => instantMs(b.at) - instantMs(a.at))
}

// ── Versiones y observaciones ────────────────────────────────────────────────

export interface VersionRow {
  deliverable: DeliverableOut
  stage: StageOut
  submission: SubmissionOut
}

/** Todas las versiones oficiales, la más reciente primero. */
export function versionRows(plan: WorkPlanOut, history: HistoryMap): VersionRow[] {
  const rows: VersionRow[] = []
  for (const stage of plan.stages) {
    for (const deliverable of stage.deliverables) {
      const subs = history[deliverable.public_id] ?? (deliverable.current_submission ? [deliverable.current_submission] : [])
      for (const submission of subs) rows.push({ deliverable, stage, submission })
    }
  }
  return rows.sort((a, b) => instantMs(b.submission.submitted_at) - instantMs(a.submission.submitted_at))
}

// ── Calendario y hitos ───────────────────────────────────────────────────────

export type MilestoneKind = 'plan' | 'limite' | 'entrega' | 'revision' | 'correccion'

export interface Milestone {
  key: string
  kind: MilestoneKind
  label: string
  detail: string
  /** `YYYY-MM-DD` (fecha de calendario en hora de Bogotá). */
  date: string
}

const bogotaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' })
const dayOfInstant = (value: string) => bogotaDay.format(new Date(instantMs(value)))

/** Solo fechas que existen en el sistema. No hay «apertura» por entregable: el backend no la expone. */
export function buildMilestones(plan: WorkPlanOut, history: HistoryMap): Milestone[] {
  const out: Milestone[] = []
  if (plan.start_date) out.push({ key: 'plan-start', kind: 'plan', label: 'Inicio del plan de trabajo', detail: plan.process_title ?? '', date: plan.start_date })
  if (plan.published_at) out.push({ key: 'plan-pub', kind: 'plan', label: 'Plan de trabajo publicado', detail: 'Se habilitaron tus entregables', date: dayOfInstant(plan.published_at) })
  if (plan.target_end_date) out.push({ key: 'plan-end', kind: 'plan', label: 'Fecha objetivo de finalización', detail: plan.process_title ?? '', date: plan.target_end_date })
  for (const d of allDeliverables(plan)) {
    if (!d.active || !d.applicable) continue
    if (d.due_date) out.push({ key: `due-${d.public_id}`, kind: 'limite', label: 'Fecha límite', detail: d.title, date: d.due_date })
    const subs = history[d.public_id] ?? (d.current_submission ? [d.current_submission] : [])
    for (const s of subs) {
      out.push({ key: `sub-${s.public_id}`, kind: 'entrega', label: `Entrega realizada (v${s.version})`, detail: d.title, date: dayOfInstant(s.submitted_at) })
      for (const r of s.reviews) {
        out.push({
          key: `rev-${r.public_id}`,
          kind: r.decision === 'aprobado' ? 'revision' : 'correccion',
          label: r.decision === 'aprobado' ? 'Revisión: aprobado' : 'Corrección solicitada',
          detail: `${d.title} · v${s.version}`,
          date: dayOfInstant(r.created_at),
        })
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Hoy en hora de Bogotá (`YYYY-MM-DD`), para separar hitos pasados y próximos. */
export function bogotaTodayIso(): string {
  return bogotaDay.format(new Date())
}
