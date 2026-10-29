import { authHeaders, request } from './http'

// Contrato de /api/processes/{id}/work-plan (backend: app/domains/workplan, fase A).
// Los estados de los entregables los DERIVA el backend; la interfaz solo los muestra.

export type DeliverableStatus = 'pendiente' | 'disponible' | 'en_revision' | 'requiere_correcciones' | 'aprobado'
export type SubmissionStatus = 'en_revision' | 'requiere_correcciones' | 'aprobado'
export type ReviewDecision = 'aprobado' | 'requiere_correcciones'

export interface PersonOut {
  public_id: string
  full_name: string
}

export interface ReviewOut {
  public_id: string
  decision: ReviewDecision
  comment: string | null
  reviewer: PersonOut
  created_at: string
}

export interface SubmissionOut {
  public_id: string
  version: number
  file_name: string
  status: SubmissionStatus
  student_comment: string | null
  submitted_by: PersonOut
  submitted_at: string
  download_url: string
  reviews: ReviewOut[]
}

export interface DeliverableOut {
  public_id: string
  stage_public_id: string
  title: string
  instructions: string | null
  mandatory: boolean
  applicable: boolean
  active: boolean
  sort_order: number
  due_date: string | null
  depends_on_public_id: string | null
  accepted_extensions: string[] | null
  template_file_name: string | null
  template_download_url: string | null
  status: DeliverableStatus
  is_overdue: boolean
  can_submit: boolean
  submissions_count: number
  current_submission: SubmissionOut | null
}

export interface StageOut {
  public_id: string
  name: string
  description: string | null
  semester: number
  sort_order: number
  active: boolean
  deliverables: DeliverableOut[]
}

export interface ProgressOut {
  total_required: number
  approved: number
  pending_review: number
  needs_corrections: number
  overdue: number
  percent: number
}

export interface WorkPlanOut {
  public_id: string
  process_public_id: string
  process_title: string | null
  status: 'borrador' | 'publicado'
  start_date: string | null
  target_end_date: string | null
  template_code: string | null
  published_at: string | null
  stages: StageOut[]
  progress: ProgressOut
  process_state_code: string
  process_state_name: string
  official_completion: boolean
  can_manage: boolean
}

export interface StageInput {
  name: string
  description?: string | null
  semester: number
  sort_order?: number
  active?: boolean
}

export interface DeliverableInput {
  title: string
  instructions?: string | null
  mandatory?: boolean
  applicable?: boolean
  active?: boolean
  sort_order?: number
  due_date?: string | null
  depends_on_public_id?: string | null
  accepted_extensions?: string[] | null
}

export interface PlanEventOut {
  public_id: string
  event_type: string
  subject: string | null
  detail: string | null
  actor: PersonOut
  created_at: string
}

const base = (processPublicId: string) => `/processes/${processPublicId}/work-plan`

export const workPlanApi = {
  // 404 = el proceso no tiene plan o aún no está publicado (no es un fallo del servidor).
  get: (accessToken: string, processPublicId: string) =>
    request<WorkPlanOut>(base(processPublicId), { headers: authHeaders(accessToken) }),

  listSubmissions: (accessToken: string, processPublicId: string, deliverablePublicId: string) =>
    request<SubmissionOut[]>(`${base(processPublicId)}/deliverables/${deliverablePublicId}/submissions`, {
      headers: authHeaders(accessToken),
    }),

  // ── Gestión (tutor asignado o coordinación; el backend lo verifica en cada llamada) ──
  create: (accessToken: string, processPublicId: string, body: { start_date?: string | null; target_end_date?: string | null; template?: 'semillero_investigacion_dos_semestres' | null }) =>
    request<WorkPlanOut>(base(processPublicId), { method: 'POST', headers: authHeaders(accessToken), body: JSON.stringify(body) }),

  updateDates: (accessToken: string, processPublicId: string, body: { start_date?: string | null; target_end_date?: string | null }) =>
    request<WorkPlanOut>(base(processPublicId), { method: 'PATCH', headers: authHeaders(accessToken), body: JSON.stringify(body) }),

  publish: (accessToken: string, processPublicId: string) =>
    request<WorkPlanOut>(`${base(processPublicId)}/publish`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ confirm_dates: true }),
    }),

  createStage: (accessToken: string, processPublicId: string, body: StageInput) =>
    request<WorkPlanOut>(`${base(processPublicId)}/stages`, { method: 'POST', headers: authHeaders(accessToken), body: JSON.stringify(body) }),

  updateStage: (accessToken: string, processPublicId: string, stagePublicId: string, body: Partial<StageInput>) =>
    request<WorkPlanOut>(`${base(processPublicId)}/stages/${stagePublicId}`, { method: 'PATCH', headers: authHeaders(accessToken), body: JSON.stringify(body) }),

  createDeliverable: (accessToken: string, processPublicId: string, stagePublicId: string, body: DeliverableInput) =>
    request<WorkPlanOut>(`${base(processPublicId)}/stages/${stagePublicId}/deliverables`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(body),
    }),

  updateDeliverable: (accessToken: string, processPublicId: string, deliverablePublicId: string, body: Partial<DeliverableInput>) =>
    request<WorkPlanOut>(`${base(processPublicId)}/deliverables/${deliverablePublicId}`, {
      method: 'PATCH',
      headers: authHeaders(accessToken),
      body: JSON.stringify(body),
    }),

  uploadTemplate: (accessToken: string, processPublicId: string, deliverablePublicId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<WorkPlanOut>(`${base(processPublicId)}/deliverables/${deliverablePublicId}/template`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: form,
    })
  },

  review: (accessToken: string, processPublicId: string, submissionPublicId: string, decision: ReviewDecision, comment?: string) =>
    request<SubmissionOut>(`${base(processPublicId)}/submissions/${submissionPublicId}/review`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ decision, comment: comment || null }),
    }),

  activity: (accessToken: string, processPublicId: string) =>
    request<PlanEventOut[]>(`${base(processPublicId)}/activity`, { headers: authHeaders(accessToken) }),

  // El backend valida tipo real, tamaño, habilitación, dependencias y que seas el estudiante del proceso.
  submit: (accessToken: string, processPublicId: string, deliverablePublicId: string, file: File, comment?: string) => {
    const form = new FormData()
    if (comment) form.append('comment', comment)
    form.append('file', file)
    return request<SubmissionOut>(`${base(processPublicId)}/deliverables/${deliverablePublicId}/submissions`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: form,
    })
  },
}

/** Formatos que acepta el backend para cualquier archivo (lista blanca de app/domains/documents). */
export const DEFAULT_ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.pptx', '.png', '.jpg', '.jpeg']
