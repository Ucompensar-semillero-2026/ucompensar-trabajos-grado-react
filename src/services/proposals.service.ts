import { authHeaders, request } from './http'

// Contrato de /api/proposals (backend: app/domains/proposals). Una propuesta NO es un proceso oficial.

export type ProposalStatus =
  | 'pendiente_revision'
  | 'en_evaluacion'
  | 'requiere_informacion'
  | 'aprobada'
  | 'pendiente_tutor'
  | 'tutor_asignado'
  | 'rechazada'
  | 'convertida'

export type SuggestedModality = 'semillero_investigacion' | 'proyecto_investigacion' | 'emprendimiento' | 'desarrollo_tecnologico' | 'por_definir'
export type ReviewAction = 'iniciar_evaluacion' | 'solicitar_informacion' | 'aprobar' | 'rechazar'

export const MODALITY_LABELS: Record<SuggestedModality, string> = {
  semillero_investigacion: 'Semillero de investigación',
  proyecto_investigacion: 'Proyecto de investigación',
  emprendimiento: 'Emprendimiento',
  desarrollo_tecnologico: 'Desarrollo tecnológico',
  por_definir: 'Por definir con Coordinación',
}

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  pendiente_revision: 'Pendiente de revisión',
  en_evaluacion: 'En evaluación',
  requiere_informacion: 'Requiere información',
  aprobada: 'Aprobada',
  pendiente_tutor: 'Pendiente de tutor',
  tutor_asignado: 'Tutor asignado',
  rechazada: 'Rechazada',
  convertida: 'Convertida en proceso',
}

/** Límites que el backend también valida (los repite para dar un mensaje inmediato). */
export const PROPOSAL_LIMITS = { title: 200, text: 4000, impact: 2000, email: 150, maxMembers: 5 } as const

export interface PersonRef {
  public_id: string
  full_name: string
}

export interface ProposalInput {
  title: string
  suggested_modality: SuggestedModality
  problem: string
  solution: string
  expected_impact: string | null
  member_emails: string[]
  suggested_tutor_email: string | null
  confirm_information: boolean
  accept_data_policy: boolean
}

export interface ProposalUpdateInput {
  title: string
  suggested_modality: SuggestedModality
  problem: string
  solution: string
  expected_impact: string | null
  suggested_tutor_email: string | null
  comment?: string | null
}

export interface ProposalMemberOut {
  email: string
  status: 'propuesto' | 'verificado'
  full_name: string | null
}

export interface ProposalEventOut {
  event_type: string
  from_status: string | null
  to_status: string | null
  comment: string | null
  actor: PersonRef
  created_at: string
}

export interface ProposalListItem {
  public_id: string
  code: string
  title: string
  suggested_modality: SuggestedModality
  status: ProposalStatus
  author: PersonRef
  member_count: number
  has_suggested_tutor: boolean
  assigned_tutor: PersonRef | null
  created_at: string
  updated_at: string | null
}

export interface ProposalPage {
  items: ProposalListItem[]
  total: number
  page: number
  page_size: number
}

export interface ProposalOut {
  public_id: string
  code: string
  title: string
  suggested_modality: SuggestedModality
  problem: string
  solution: string
  expected_impact: string | null
  status: ProposalStatus
  author: PersonRef
  members: ProposalMemberOut[]
  suggested_tutor_email: string | null
  suggested_tutor: PersonRef | null
  assigned_tutor: PersonRef | null
  decision_reason: string | null
  reviewed_by: PersonRef | null
  reviewed_at: string | null
  process_public_id: string | null
  created_at: string
  updated_at: string | null
  events: ProposalEventOut[]
  can_edit: boolean
  view: 'full' | 'member'
}

export interface InvitationOut {
  proposal_public_id: string
  code: string
  title: string
  author: PersonRef
  status: ProposalStatus
  member_status: 'propuesto' | 'verificado'
}

export interface ProposalSummary {
  total: number
  by_status: Record<ProposalStatus, number>
}

export interface ConvertOut {
  process_public_id: string
  process_code: string
  linked_members: string[]
  unlinked_members: string[]
}

export interface ProposalFilters {
  search?: string
  modality?: string
  status?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

const json = (body: unknown) => JSON.stringify(body)

export const proposalsApi = {
  // ── Estudiante ──
  create: (accessToken: string, body: ProposalInput) =>
    request<ProposalOut>('/proposals', { method: 'POST', headers: authHeaders(accessToken), body: json(body) }),
  mine: (accessToken: string) => request<ProposalListItem[]>('/proposals/mine', { headers: authHeaders(accessToken) }),
  invitations: (accessToken: string) => request<InvitationOut[]>('/proposals/invitations', { headers: authHeaders(accessToken) }),
  update: (accessToken: string, id: string, body: ProposalUpdateInput) =>
    request<ProposalOut>(`/proposals/${id}`, { method: 'PUT', headers: authHeaders(accessToken), body: json(body) }),
  confirmMembership: (accessToken: string, id: string) =>
    request<ProposalOut>(`/proposals/${id}/members/confirm`, { method: 'POST', headers: authHeaders(accessToken) }),

  // ── Lectura (autor, compañero verificado o Coordinación) ──
  get: (accessToken: string, id: string) => request<ProposalOut>(`/proposals/${id}`, { headers: authHeaders(accessToken) }),

  // ── Coordinación / Administración ──
  summary: (accessToken: string) => request<ProposalSummary>('/proposals/summary', { headers: authHeaders(accessToken) }),
  list: (accessToken: string, filters: ProposalFilters = {}) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && value !== null) params.set(key, String(value))
    }
    const query = params.toString()
    return request<ProposalPage>(`/proposals${query ? `?${query}` : ''}`, { headers: authHeaders(accessToken) })
  },
  transition: (accessToken: string, id: string, action: ReviewAction, comment?: string) =>
    request<ProposalOut>(`/proposals/${id}/transition`, { method: 'POST', headers: authHeaders(accessToken), body: json({ action, comment: comment || null }) }),
  assignTutor: (accessToken: string, id: string, userPublicId: string) =>
    request<ProposalOut>(`/proposals/${id}/tutor`, { method: 'POST', headers: authHeaders(accessToken), body: json({ user_public_id: userPublicId }) }),
  convert: (accessToken: string, id: string, modalityPublicId: string, academicSemester: string) =>
    request<ConvertOut>(`/proposals/${id}/convert`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: json({ modality_public_id: modalityPublicId, academic_semester: academicSemester }),
    }),
}
