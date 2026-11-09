import { authHeaders, request } from './http'

/**
 * Evaluación por momentos de un proceso de grado (GET/PUT /processes/{id}/evaluation…).
 * TODOS los cálculos (aportes, nota acumulada, porcentaje evaluado, nota del momento) los hace el backend y llegan ya resueltos:
 * la pantalla solo los muestra. Quien califica ve también los borradores; el estudiante, únicamente lo publicado.
 */

// Quien califica: sin_calificar | borrador | publicada. El estudiante: publicada | pendiente (nunca ve borradores).
export type CriterionStatus = 'sin_calificar' | 'borrador' | 'publicada' | 'pendiente'
export type EvaluationStatus = 'sin_configurar' | 'borrador' | 'publicada'

export type GradingMode = 'grupal' | 'individual'

export interface StudentGrade {
  student_public_id: string
  student_name: string
  grade: number | null
  feedback: string | null
  status: 'sin_calificar' | 'borrador' | 'publicada'
  published_at: string | null
}

export interface GroupGrade {
  grade: number | null
  feedback: string | null
  status: 'sin_calificar' | 'borrador' | 'publicada'
  published_at: string | null
}

export interface EvaluationStudent {
  public_id: string
  full_name: string
}

export interface EvaluationCriterion {
  public_id: string
  name: string
  description: string | null
  weight_percentage: number
  sort_order: number
  deliverable_public_id: string | null
  status: CriterionStatus
  /** grupal: una nota para todos los integrantes; individual: una nota por estudiante (`grade` es entonces el promedio de lo calificado). */
  grading_mode: GradingMode
  /** Solo quien califica: la nota de cada estudiante (se conservan aunque el criterio hoy sea grupal). */
  student_grades: StudentGrade[]
  /** Solo quien califica: la nota grupal guardada (se conserva aunque el criterio hoy sea individual). */
  group_grade: GroupGrade | null
  grade: number | null
  percent_obtained: number | null
  feedback: string | null
  published_at: string | null
  contribution_to_moment: number | null
  contribution_to_total: number | null
  evaluated_percent: number | null
}

export interface EvaluationMoment {
  public_id: string
  name: string
  description: string | null
  weight_percentage: number
  sort_order: number
  criteria: EvaluationCriterion[]
  criteria_weight_total: number
  evaluated_weight: number
  /** Solo cuando todos sus criterios tienen nota. */
  moment_grade: number | null
  /** Promedio de lo ya calificado mientras falten criterios (referencia, no es la nota del momento). */
  partial_average: number | null
  contribution_to_total: number
  evaluated_percent: number
  graded_count: number
  pending_count: number
  closed: boolean
}

export interface EvaluationTotals {
  /** Puntos sobre 5.0 ya ganados. NO es la nota final. */
  accumulated: number
  /** Porcentaje del proceso que ya tiene nota. */
  evaluated_percent: number
  graded_criteria: number
  pending_criteria: number
  total_criteria: number
  complete: boolean
  /** Solo si todo está calificado y los porcentajes suman 100 %. Tampoco es la nota oficial. */
  calculated_final: number | null
}

export interface OfficialFinalGrade {
  final_grade: number
  passed: boolean
  registered_at: string
}

export interface EvaluationOut {
  process_public_id: string
  process_title: string | null
  academic_semester: string
  student_name: string | null
  status: EvaluationStatus
  published_at: string | null
  viewer: 'manager' | 'student'
  can_configure: boolean
  can_grade: boolean
  moments: EvaluationMoment[]
  /** Integrantes estudiantes del proyecto (solo para quien califica). */
  students: EvaluationStudent[]
  totals: EvaluationTotals
  /** Solo para quien califica: exactamente lo que ve el estudiante. */
  published_totals: EvaluationTotals | null
  /** Por qué no se puede publicar (solo quien configura). */
  config_problems: string[]
  /** Con notas publicadas, la estructura y los porcentajes quedan bloqueados. */
  has_published_grades: boolean
  /** La registra Coordinación; null = «Aún no registrada». */
  official_final_grade: OfficialFinalGrade | null
}

export interface CriterionPayload {
  public_id?: string | null
  name: string
  description?: string | null
  weight_percentage: number
  deliverable_public_id?: string | null
}

export interface MomentPayload {
  public_id?: string | null
  name: string
  description?: string | null
  weight_percentage: number
  criteria: CriterionPayload[]
}

export interface EvaluationConfigPayload {
  moments: MomentPayload[]
}

export interface GradePayload {
  grade: number | null
  feedback?: string | null
  publish: boolean
  /** Modalidad con la que se califica; sin ella se conserva la actual del criterio. */
  mode?: GradingMode
  /** En modo individual: el estudiante al que corresponde la nota. */
  student_public_id?: string | null
  /** Cambiar de modalidad con notas guardadas exige confirmarlo. */
  confirm_mode_change?: boolean
}

export interface GradeEvent {
  action: 'guardada' | 'publicada' | 'modificada' | 'retirada' | string
  actor_name: string | null
  previous_grade: number | null
  new_grade: number | null
  previous_status: string | null
  new_status: string | null
  created_at: string
}

const base = (processId: string) => `/processes/${processId}/evaluation`

export const evaluationApi = {
  get: (accessToken: string, processId: string) => request<EvaluationOut>(base(processId), { headers: authHeaders(accessToken) }),

  saveConfig: (accessToken: string, processId: string, payload: EvaluationConfigPayload) =>
    request<EvaluationOut>(`${base(processId)}/config`, { method: 'PUT', headers: authHeaders(accessToken), body: JSON.stringify(payload) }),

  publish: (accessToken: string, processId: string) =>
    request<EvaluationOut>(`${base(processId)}/config/publish`, { method: 'POST', headers: authHeaders(accessToken) }),

  unpublish: (accessToken: string, processId: string) =>
    request<EvaluationOut>(`${base(processId)}/config/unpublish`, { method: 'POST', headers: authHeaders(accessToken) }),

  saveGrade: (accessToken: string, processId: string, criterionId: string, payload: GradePayload) =>
    request<EvaluationOut>(`${base(processId)}/criteria/${criterionId}/grade`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    }),

  history: (accessToken: string, processId: string, criterionId: string) =>
    request<GradeEvent[]>(`${base(processId)}/criteria/${criterionId}/history`, { headers: authHeaders(accessToken) }),
}
