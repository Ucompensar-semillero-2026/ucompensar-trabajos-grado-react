import { authHeaders, request } from './http'
import type { BackendUser, ModalityOut, PossibleStateOut } from '@/types/api'

export interface ProcessOut {
  public_id: string
  process_code: string
  title?: string | null
  student: BackendUser
  modality: ModalityOut
  state: PossibleStateOut
  academic_semester: string
  created_at: string
  updated_at: string | null
  closed_at: string | null
  observations?: string | null
}

export interface ProcessHistoryOut {
  public_id: string
  previous_state: PossibleStateOut | null
  new_state: PossibleStateOut
  user: BackendUser
  event_date: string
  comment: string | null
}

export interface TutorCandidate extends BackendUser {
  /** Procesos que tiene hoy a su cargo como tutor activo. */
  active_projects: number
}

export interface TeamMemberOut {
  public_id: string
  user: BackendUser
  process_role: string
  assigned_at: string
  active: boolean
}

export const processesApi = {
  team: (accessToken: string, processPublicId: string) =>
    request<TeamMemberOut[]>(`/processes/${processPublicId}/team`, { headers: authHeaders(accessToken) }),

  // Solo coordinación y administración (el backend responde 403 al resto).
  teamCandidates: (accessToken: string) =>
    request<TutorCandidate[]>('/processes/team-candidates', { headers: authHeaders(accessToken) }),

  // Reemplaza al tutor activo en una sola transacción; la asignación anterior se desactiva (no se borra).
  changeTutor: (accessToken: string, processPublicId: string, userPublicId: string) =>
    request<TeamMemberOut>(`/processes/${processPublicId}/tutor`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ user_public_id: userPublicId }),
    }),

  addTeamMember: (accessToken: string, processPublicId: string, userPublicId: string, processRole: 'tutor' | 'evaluador') =>
    request<TeamMemberOut>(`/processes/${processPublicId}/team`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ user_public_id: userPublicId, process_role: processRole }),
    }),

  removeTeamMember: (accessToken: string, processPublicId: string, memberPublicId: string) =>
    request<void>(`/processes/${processPublicId}/team/${memberPublicId}`, { method: 'DELETE', headers: authHeaders(accessToken) }),


  list: (accessToken: string) =>
    request<ProcessOut[]>('/processes', { headers: authHeaders(accessToken) }),

  get: (accessToken: string, processPublicId: string) =>
    request<ProcessOut>(`/processes/${processPublicId}`, { headers: authHeaders(accessToken) }),

  history: (accessToken: string, processPublicId: string) =>
    request<ProcessHistoryOut[]>(`/processes/${processPublicId}/history`, {
      headers: authHeaders(accessToken),
    }),

  changeState: (accessToken: string, processPublicId: string, targetStatePublicId: string, comment?: string) =>
    request<ProcessOut>(`/processes/${processPublicId}/state`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ target_state_public_id: targetStatePublicId, comment: comment || null }),
    }),

  create: (
    accessToken: string,
    payload: {
      modality_public_id: string
      academic_semester: string
      requires_validation?: boolean
      observations?: string
      title?: string
    }
  ) =>
    request<ProcessOut>('/processes', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    }),
}
