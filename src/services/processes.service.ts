import { authHeaders, request } from './http'
import type { BackendUser, ModalityOut, PossibleStateOut } from '@/types/api'

export interface ProcessOut {
  public_id: string
  process_code: string
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

export const processesApi = {
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
    payload: { modality_public_id: string; academic_semester: string; requires_validation?: boolean; observations?: string }
  ) =>
    request<ProcessOut>('/processes', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    }),
}
