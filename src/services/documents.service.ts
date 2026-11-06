import { authHeaders, request } from './http'
import type { BackendUser } from '@/types/api'

export interface DocumentTypeOut {
  public_id: string
  code: string
  name: string
  description: string | null
}

export type DocumentStatus = 'pendiente' | 'aprobado' | 'rechazado'

export interface ProcessDocumentOut {
  public_id: string
  document_type: DocumentTypeOut
  file_name: string
  version: number
  status: DocumentStatus
  download_url: string
  uploaded_by: BackendUser
  reviewed_by: BackendUser | null
  uploaded_at: string
  reviewed_at: string | null
  comment: string | null
}

export interface ChecklistItemOut {
  document_type: DocumentTypeOut
  mandatory: boolean
  note: string | null
  document: ProcessDocumentOut | null
  checklist_status: 'faltante' | DocumentStatus
}

export const documentsApi = {
  checklist: (accessToken: string, processPublicId: string) =>
    request<ChecklistItemOut[]>(`/processes/${processPublicId}/checklist`, {
      headers: authHeaders(accessToken),
    }),

  listForProcess: (accessToken: string, processPublicId: string, includeHistory = false) =>
    request<ProcessDocumentOut[]>(`/processes/${processPublicId}/documents${includeHistory ? '?include_history=true' : ''}`, {
      headers: authHeaders(accessToken),
    }),

  upload: (accessToken: string, processPublicId: string, documentTypePublicId: string, file: File, comment?: string) => {
    const form = new FormData()
    form.append('document_type_public_id', documentTypePublicId)
    if (comment) form.append('comment', comment)
    form.append('file', file)
    return request<ProcessDocumentOut>(`/processes/${processPublicId}/documents`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: form,
    })
  },

  // El backend autoriza al tutor activo asignado al trámite o a Coordinación/administración.
  review: (accessToken: string, documentPublicId: string, status: 'aprobado' | 'rechazado', comment?: string) =>
    request<ProcessDocumentOut>(`/documents/${documentPublicId}/review`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ status, comment: comment || null }),
    }),
}
