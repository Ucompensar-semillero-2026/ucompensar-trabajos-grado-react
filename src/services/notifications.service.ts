import { authHeaders, request } from './http'

export interface NotificationOut {
  public_id: string
  subject: string | null
  body: string | null
  sent: boolean
  sent_at: string | null
  send_error: string | null
  created_at?: string | null
  /** null = no leída */
  read_at?: string | null
  /** Ruta interna a la que lleva el aviso (p. ej. /documentos). */
  link?: string | null
  /** 'general' | 'alerta' (vencimientos y seguimiento) */
  category?: string
}

export interface NotificationSummary {
  unread: number
  latest_unread: NotificationOut[]
}

/** Avisa a la campana que algo cambió (p. ej. se marcó como leída desde otra pantalla). */
export const NOTIFICATIONS_CHANGED = 'ucomp:notifications-changed'
export const notifyNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))

// list_for_process reutiliza la visibilidad del trámite (ProcessService.get_detail); el resto filtra por el usuario
// del token: nadie ve ni marca avisos de otra persona.
export const notificationsApi = {
  listMine: (accessToken: string, limit?: number) =>
    request<NotificationOut[]>(`/notifications/me${limit ? `?limit=${limit}` : ''}`, { headers: authHeaders(accessToken) }),

  listForProcess: (accessToken: string, processPublicId: string) =>
    request<NotificationOut[]>(`/processes/${processPublicId}/notifications`, {
      headers: authHeaders(accessToken),
    }),

  /** Campana: no leídas y las 5 más recientes. */
  summary: (accessToken: string) => request<NotificationSummary>('/notifications/me/summary', { headers: authHeaders(accessToken) }),

  markRead: (accessToken: string, publicId: string) =>
    request<NotificationOut>(`/notifications/${publicId}/read`, { method: 'POST', headers: authHeaders(accessToken) }),

  markAllRead: (accessToken: string) =>
    request<{ marked: number }>('/notifications/me/read-all', { method: 'POST', headers: authHeaders(accessToken) }),
}
