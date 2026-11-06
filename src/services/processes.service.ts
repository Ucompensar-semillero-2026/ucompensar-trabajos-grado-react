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

/** GET /processes/{id}: el trámite y lo que quien consulta puede hacer en él (contrato 6.1). */
export interface ProcessDetailOut extends ProcessOut {
  my_process_roles: string[]
  allowed_actions: string[]
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
  /** Nombre del rol en la modalidad (ej. "Tutor de semillero"). */
  role_label?: string | null
  assigned_at: string
  /** Solo llega si quien consulta puede gestionar el equipo (manage_team). */
  assigned_by?: BackendUser | null
  unassigned_at?: string | null
  active: boolean
}

export type TeamRole = 'tutor' | 'evaluador'

/** GET /processes/{id}/eligible-members?role=...: personas asignables y cupo de la modalidad. */
export interface EligibleMembersOut {
  role: TeamRole
  role_label: string
  max_count: number
  assigned_count: number
  users: BackendUser[]
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
    request<ProcessDetailOut>(`/processes/${processPublicId}`, { headers: authHeaders(accessToken) }),

  /** Estados a los que quien consulta puede mover el trámite ahora (mismas reglas que PUT /state). */
  availableTransitions: (accessToken: string, processPublicId: string) =>
    request<PossibleStateOut[]>(`/processes/${processPublicId}/available-transitions`, { headers: authHeaders(accessToken) }),

  /** Solo coordinación: quiénes se pueden asignar con ese rol y el cupo de la modalidad. */
  eligibleMembers: (accessToken: string, processPublicId: string, role: TeamRole) =>
    request<EligibleMembersOut>(`/processes/${processPublicId}/eligible-members?role=${role}`, { headers: authHeaders(accessToken) }),

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
