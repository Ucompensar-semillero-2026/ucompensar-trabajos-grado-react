import type { EvaluationConfigPayload, EvaluationOut } from '@/services/evaluation.service'

/**
 * Borrador local de la configuración mientras el tutor edita. Los porcentajes se guardan como TEXTO para que el campo se pueda
 * escribir con libertad («12,5»); al guardar se convierten. La validación que decide si se puede publicar es la del backend
 * (`config_problems`); aquí solo se muestran las sumas mientras se escribe.
 */

export interface DraftCriterion {
  key: string
  public_id: string | null
  name: string
  description: string
  weight: string
  deliverable_public_id: string
  /** Ya tiene una nota registrada (aunque sea borrador): no se puede eliminar. */
  graded: boolean
}

export interface DraftMoment {
  key: string
  public_id: string | null
  name: string
  description: string
  weight: string
  criteria: DraftCriterion[]
}

let counter = 0
export const newKey = (): string => `k${++counter}`

export function toDraft(report: EvaluationOut): DraftMoment[] {
  return report.moments.map((m) => ({
    key: newKey(),
    public_id: m.public_id,
    name: m.name,
    description: m.description ?? '',
    weight: String(m.weight_percentage),
    criteria: m.criteria.map((c) => ({
      key: newKey(),
      public_id: c.public_id,
      name: c.name,
      description: c.description ?? '',
      weight: String(c.weight_percentage),
      deliverable_public_id: c.deliverable_public_id ?? '',
      graded: c.status !== 'sin_calificar' && c.status !== 'pendiente',
    })),
  }))
}

/** «12,5» o «12.5» → 12.5. Vacío o inválido → NaN (no se guarda). */
export function parseWeight(text: string): number {
  const clean = text.trim().replace(',', '.')
  return clean === '' ? Number.NaN : Number(clean)
}

export const isValidWeight = (text: string): boolean => {
  const n = parseWeight(text)
  // Entre 0 y 100 y con a lo sumo 2 decimales (igual que el backend).
  return Number.isFinite(n) && n >= 0 && n <= 100 && Math.abs(Math.round(n * 100) - n * 100) < 1e-9
}

export function sumWeights(texts: string[]): number {
  return Math.round(texts.reduce((sum, t) => sum + (Number.isFinite(parseWeight(t)) ? parseWeight(t) : 0), 0) * 100) / 100
}

/** «Suma 90 %: faltan 10 %.» / «Suma 110 %: exceden en 10 %.» / null si suma exactamente 100 %. */
export function sumMessage(total: number): string | null {
  const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
  if (Math.abs(total - 100) < 0.005) return null
  return total < 100 ? `Suma ${fmt(total)} %: faltan ${fmt(100 - total)} %.` : `Suma ${fmt(total)} %: exceden en ${fmt(total - 100)} %.`
}

export function toPayload(draft: DraftMoment[]): EvaluationConfigPayload {
  return {
    moments: draft.map((m) => ({
      public_id: m.public_id,
      name: m.name.trim(),
      description: m.description.trim() || null,
      weight_percentage: parseWeight(m.weight),
      criteria: m.criteria.map((c) => ({
        public_id: c.public_id,
        name: c.name.trim(),
        description: c.description.trim() || null,
        weight_percentage: parseWeight(c.weight),
        deliverable_public_id: c.deliverable_public_id || null,
      })),
    })),
  }
}

/** Lo que importa para saber si hay cambios sin guardar (las claves internas no cuentan). */
const signature = (draft: DraftMoment[]): string =>
  JSON.stringify(draft.map((m) => [m.public_id, m.name, m.description, m.weight, m.criteria.map((c) => [c.public_id, c.name, c.description, c.weight, c.deliverable_public_id])]))

export const isDirty = (draft: DraftMoment[], saved: DraftMoment[]): boolean => signature(draft) !== signature(saved)

/** Problemas que se pueden detectar sin el servidor (entregables sin asociar, campos vacíos o porcentajes ilegibles). */
export function fieldProblems(draft: DraftMoment[]): string[] {
  const problems: string[] = []
  draft.forEach((m, i) => {
    if (!m.name.trim()) problems.push(`El momento ${i + 1} no tiene nombre.`)
    if (!isValidWeight(m.weight)) problems.push(`El porcentaje del momento «${m.name.trim() || i + 1}» debe estar entre 0 y 100 (hasta 2 decimales).`)
    m.criteria.forEach((c, j) => {
      if (!c.deliverable_public_id) problems.push(`La fila ${j + 1} del momento «${m.name.trim() || i + 1}» no tiene un entregable del plan de trabajo asociado.`)
      else if (!c.name.trim()) problems.push(`El entregable ${j + 1} del momento «${m.name.trim() || i + 1}» no tiene nombre.`)
      if (!isValidWeight(c.weight)) problems.push(`El porcentaje del criterio «${c.name.trim() || j + 1}» debe estar entre 0 y 100 (hasta 2 decimales).`)
    })
  })
  return problems
}

// ── Plantilla inicial ─────────────────────────────────────────────────────────

/** Color de acento de cada momento (tarjeta y barra de distribución): azul institucional, naranja y tonos de apoyo. */
export const MOMENT_COLORS = ['var(--color-secondary)', 'var(--color-primary)', '#0E6B9C', 'var(--color-teal)', 'var(--color-amber)', '#6B7280']

/**
 * Distribución predeterminada que se le sugiere al docente la primera vez (20 % + 35 % + 45 % = 100 %). Es una plantilla de ESTA
 * plataforma, no una configuración oficial: los tres momentos se pueden renombrar, cambiar, quitar o ampliar. No trae criterios
 * (esos los define el docente; no se inventan) ni se guarda nada hasta que él pulsa «Guardar configuración».
 */
export const DEFAULT_MOMENTS = [
  { name: 'Contextualización', weight: '20', description: 'Corresponde a la formulación del proyecto y definición del problema.' },
  { name: 'Profundización', weight: '35', description: 'Desarrollo del marco teórico, metodología y plan de trabajo.' },
  { name: 'Transferencia y cierre', weight: '45', description: 'Resultados, documento final y sustentación del proyecto.' },
] as const

export function defaultDraft(): DraftMoment[] {
  return DEFAULT_MOMENTS.map((m) => ({ key: newKey(), public_id: null, name: m.name, description: m.description, weight: m.weight, criteria: [] }))
}

/** Borrador con el que se abre el editor: lo guardado o, si todavía no hay nada, la plantilla (sin guardarla). */
export function initialDraft(report: EvaluationOut, deliverables: DeliverableOption[] = []): DraftMoment[] {
  return report.moments.length === 0 && report.status !== 'publicada' ? suggestedDraft(deliverables) : syncNames(toDraft(report), deliverables)
}

/** Entregable ACTIVO del plan de trabajo que se ofrece para vincular a un criterio (`detail`: etapa y fecha límite). */
export interface DeliverableOption {
  value: string
  label: string
  detail?: string
}

const normalize = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Palabras clave (sin tildes) de los entregables habituales → momento sugerido (0, 1 o 2). Es solo una propuesta editable.
const SUGGESTED_MOMENT: Array<[string, number]> = [
  ['propuesta inicial', 0],
  ['problema', 0],
  ['antecedentes', 0],
  ['estado del arte', 0],
  ['metodolog', 1],
  ['plan de trabajo', 1],
  ['primer informe', 1],
  ['ejecucion', 1],
  ['evidencias', 2],
  ['segundo informe', 2],
  ['documento final', 2],
  ['aval', 2],
  ['correcciones', 2],
  ['sustentacion', 2],
]

const evenSplit = (parts: number): string[] => Array.from({ length: parts }, (_, i) => String(Math.floor(100 / parts) + (i < 100 % parts ? 1 : 0)))

/**
 * Plantilla 20/35/45 con un criterio por cada entregable REAL del plan cuyo nombre corresponde a un momento (reparto parejo
 * dentro del momento). Lo que no se reconoce queda sin asociar para que el tutor decida; no se inventa ningún entregable.
 * No se guarda nada hasta que el tutor pulse «Guardar configuración».
 */
export function suggestedDraft(deliverables: DeliverableOption[]): DraftMoment[] {
  const draft = defaultDraft()
  const byMoment: DeliverableOption[][] = draft.map(() => [])
  for (const d of deliverables) {
    const title = normalize(d.label)
    const hit = SUGGESTED_MOMENT.find(([keyword]) => title.includes(keyword))
    if (hit) byMoment[hit[1]].push(d)
  }
  draft.forEach((moment, i) => {
    const weights = evenSplit(byMoment[i].length)
    moment.criteria = byMoment[i].map((d, order) => ({
      key: newKey(),
      public_id: null,
      name: d.label.slice(0, 150),
      description: '',
      weight: weights[order],
      deliverable_public_id: d.value,
      graded: false,
    }))
  })
  return draft
}

/** Copia de un criterio SIN identidad ni vínculo con entregable (un entregable solo puede tener un criterio) y sin notas. */
export function duplicateCriterion(c: DraftCriterion): DraftCriterion {
  return { ...c, key: newKey(), public_id: null, name: `${c.name.trim() || 'Criterio'} (copia)`.slice(0, 150), deliverable_public_id: '', graded: false }
}

/** Copia de un momento con sus criterios (nuevos, sin notas ni vínculos). Su porcentaje queda en 0 para no pasar de 100 sin querer. */
export function duplicateMoment(m: DraftMoment): DraftMoment {
  return { ...m, key: newKey(), public_id: null, name: `${m.name.trim() || 'Momento'} (copia)`.slice(0, 150), weight: '0', criteria: m.criteria.map(duplicateCriterion) }
}

/** Ponderación efectiva = % del momento × % del criterio / 100 (qué parte de la nota final pesa ese criterio). null si no se puede leer. */
export function effectiveWeight(momentWeight: string, criterionWeight: string): number | null {
  const m = parseWeight(momentWeight)
  const c = parseWeight(criterionWeight)
  return Number.isFinite(m) && Number.isFinite(c) ? Math.round(m * c) / 100 : null
}

export const criteriaCount = (draft: DraftMoment[]): number => draft.reduce((n, m) => n + m.criteria.length, 0)

// ── Mensajes para el docente ─────────────────────────────────────────────────

const fmt = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',')

/** Estado de la suma de los momentos. `ok` = exactamente 100 %. */
export function momentsStatus(total: number): { ok: boolean; text: string } {
  if (Math.abs(total - 100) < 0.005) return { ok: true, text: 'Los momentos suman 100 %. Puedes guardar la configuración.' }
  return total < 100
    ? { ok: false, text: `Los momentos suman ${fmt(total)} %. Faltan ${fmt(100 - total)} % para completar la evaluación.` }
    : { ok: false, text: `Los momentos suman ${fmt(total)} %. Exceden en ${fmt(total - 100)} % el total permitido.` }
}

/** Qué le falta a UN momento (`index` desde 1). null = completo: tiene criterios y suman 100 %. */
export function momentProblem(index: number, m: DraftMoment): string | null {
  if (m.criteria.length === 0) return `El momento ${index} no tiene criterios.`
  const total = sumWeights(m.criteria.map((c) => c.weight))
  if (Math.abs(total - 100) < 0.005) return null
  return total < 100
    ? `El momento ${index} tiene criterios que suman ${fmt(total)} %. Falta ${fmt(100 - total)} %.`
    : `El momento ${index} tiene criterios que suman ${fmt(total)} %. Excede en ${fmt(total - 100)} %.`
}

/** Todo lo que impide publicar (el servidor vuelve a validarlo): sin momentos, momentos ≠ 100 %, momentos sin criterios o ≠ 100 %. */
export function publishProblems(draft: DraftMoment[]): string[] {
  if (draft.length === 0) return ['Agrega al menos un momento evaluativo.']
  const problems: string[] = []
  const status = momentsStatus(sumWeights(draft.map((m) => m.weight)))
  if (!status.ok) problems.push(status.text)
  draft.forEach((m, i) => {
    const p = momentProblem(i + 1, m)
    if (p) problems.push(p)
  })
  return problems
}

/**
 * El nombre de cada fila es el del entregable del plan de trabajo al que está asociada (la fuente de los títulos es el plan): si el
 * entregable se renombró allí, la configuración lo recoge al abrirla. Las filas sin entregable conservan el nombre que tenían.
 */
export function syncNames(draft: DraftMoment[], deliverables: DeliverableOption[]): DraftMoment[] {
  const title = new Map(deliverables.map((d) => [d.value, d.label]))
  return draft.map((m) => ({ ...m, criteria: m.criteria.map((c) => (c.deliverable_public_id && title.has(c.deliverable_public_id) ? { ...c, name: (title.get(c.deliverable_public_id) as string).slice(0, 150) } : c)) }))
}
