import { authHeaders, request } from './http'

// Contrato de /api/calendar/* (público, sin sesión) y /api/coordination/calendar/* (Coordinación/Administración).
// Backend: app/domains/calendar. Las fechas llegan en hora de Bogotá con desfase explícito (-05:00).

export type EventStatus = 'borrador' | 'publicado' | 'cerrado' | 'cancelado'
export type DateKind = 'tentativa' | 'oficial'
export type Timeline = 'proximo' | 'en_curso' | 'finalizado' | 'por_confirmar'
export type EventAction = 'publicar' | 'retirar' | 'cerrar' | 'cancelar'

export interface CatalogRef {
  id: string
  code: string
  name: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  event_type: CatalogRef
  period: CatalogRef | null
  modalities: CatalogRef[]
  applies_to_all_modalities: boolean
  starts_at: string | null
  ends_at: string | null
  all_day: boolean
  dates_confirmed: boolean
  date_kind: DateKind
  date_note: string | null
  status: EventStatus
  timeline: Timeline
}

export interface AdminCalendarEvent extends CalendarEvent {
  published_at: string | null
  created_at: string
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

export interface CalendarFacets {
  periods: CatalogRef[]
  modalities: CatalogRef[]
  types: CatalogRef[]
}

export interface PublicCalendar {
  items: CalendarEvent[]
  facets: CalendarFacets
}

export interface NextMilestone {
  event: CalendarEvent | null
  only_pending_dates: boolean
  published_total: number
}

export interface PublicCalendarFilters {
  period?: string
  modality?: string
  type?: string
  timeline?: Timeline
}

export interface AdminEventPage {
  items: AdminCalendarEvent[]
  total: number
  page: number
  page_size: number
}

export interface AdminEventFilters {
  status?: EventStatus
  search?: string
  page?: number
  page_size?: number
}

export interface EventInput {
  title: string
  description: string | null
  event_type_id: string
  academic_period_id: string | null
  modality_ids: string[]
  starts_at: string | null
  ends_at: string | null
  all_day: boolean
  dates_confirmed: boolean
  date_kind: DateKind
  date_note: string | null
}

export interface PeriodOut extends CatalogRef {
  starts_on: string | null
  ends_on: string | null
  active: boolean
}

export interface EventTypeOut extends CatalogRef {
  description: string | null
  sort_order: number
  active: boolean
}

export interface EventHistoryEntry {
  action: string
  from_status: string | null
  to_status: string | null
  comment: string | null
  actor: string
  created_at: string
}

const json = (body: unknown) => JSON.stringify(body)

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const calendarApi = {
  events: (filters: PublicCalendarFilters = {}) => request<PublicCalendar>(`/calendar/events${query({ ...filters })}`),
  next: () => request<NextMilestone>('/calendar/next'),
}

const base = '/coordination/calendar'

export const calendarAdminApi = {
  list: (accessToken: string, filters: AdminEventFilters = {}) =>
    request<AdminEventPage>(`${base}/events${query({ ...filters })}`, { headers: authHeaders(accessToken) }),
  create: (accessToken: string, body: EventInput) =>
    request<AdminCalendarEvent>(`${base}/events`, { method: 'POST', headers: authHeaders(accessToken), body: json(body) }),
  update: (accessToken: string, id: string, body: EventInput) =>
    request<AdminCalendarEvent>(`${base}/events/${id}`, { method: 'PUT', headers: authHeaders(accessToken), body: json(body) }),
  transition: (accessToken: string, id: string, action: EventAction, comment?: string) =>
    request<AdminCalendarEvent>(`${base}/events/${id}/transition`, {
      method: 'POST', headers: authHeaders(accessToken), body: json({ action, comment: comment?.trim() || null }),
    }),
  history: (accessToken: string, id: string) =>
    request<EventHistoryEntry[]>(`${base}/events/${id}/history`, { headers: authHeaders(accessToken) }),
  periods: (accessToken: string) => request<PeriodOut[]>(`${base}/periods`, { headers: authHeaders(accessToken) }),
  createPeriod: (accessToken: string, body: { code: string; name: string }) =>
    request<PeriodOut>(`${base}/periods`, { method: 'POST', headers: authHeaders(accessToken), body: json(body) }),
  types: (accessToken: string) => request<EventTypeOut[]>(`${base}/types`, { headers: authHeaders(accessToken) }),
  // Catálogo real de modalidades (mismo endpoint que el resto del portal); se usa para seleccionar a cuáles aplica un evento.
  modalities: async (accessToken: string): Promise<CatalogRef[]> => {
    const rows = await request<Array<{ public_id: string; code: string; name: string; active: boolean }>>('/modalities', { headers: authHeaders(accessToken) })
    return rows.filter((m) => m.active).map((m) => ({ id: m.public_id, code: m.code, name: m.name }))
  },
}
