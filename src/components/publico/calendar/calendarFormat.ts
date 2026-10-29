import type { CalendarEvent, DateKind, EventStatus, Timeline } from '@/services/calendar.service'

// Las fechas de la institución se presentan SIEMPRE en hora de Bogotá, sin importar la zona del navegador.
export const TIME_ZONE = 'America/Bogota'

export const TIMELINE_LABEL: Record<Timeline, string> = {
  proximo: 'Próximo',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  por_confirmar: 'Por confirmar',
}

export const DATE_KIND_LABEL: Record<DateKind, string> = { tentativa: 'Fecha tentativa', oficial: 'Fecha oficial' }

export const STATUS_LABEL: Record<EventStatus, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
}

export const TIMELINE_ORDER: Timeline[] = ['proximo', 'en_curso', 'finalizado', 'por_confirmar']

const dayParts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const dateLong = new Intl.DateTimeFormat('es-CO', { timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' })
const dateShort = new Intl.DateTimeFormat('es-CO', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' })
const timeOnly = new Intl.DateTimeFormat('es-CO', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true })
const monthTitle = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/** `YYYY-MM-DD` del día de Bogotá al que pertenece el instante. */
export function dayKey(iso: string): string {
  return dayParts.format(new Date(iso))
}

export const todayKey = (now: Date = new Date()): string => dayParts.format(now)

export interface MonthRef {
  year: number
  month: number // 1-12
}

export const monthOf = (key: string): MonthRef => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) })
export const shiftMonth = ({ year, month }: MonthRef, delta: number): MonthRef => {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}
export const sameMonth = (a: MonthRef, b: MonthRef) => a.year === b.year && a.month === b.month
export const monthLabel = ({ year, month }: MonthRef) => {
  const text = monthTitle.format(new Date(Date.UTC(year, month - 1, 1)))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const pad = (n: number) => String(n).padStart(2, '0')
export const keyOf = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`

/** Semanas (lunes a domingo) del mes; los días de otros meses van como `null`. */
export function monthGrid({ year, month }: MonthRef): Array<Array<string | null>> {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: Array<string | null> = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => keyOf(year, month, i + 1))]
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

/** Días (claves de Bogotá) que abarca un evento con fechas confirmadas; los eventos largos se acotan a 400 días. */
export function eventDays(event: CalendarEvent): string[] {
  if (!event.dates_confirmed || !event.starts_at) return []
  const start = dayKey(event.starts_at)
  const end = event.ends_at ? dayKey(event.ends_at) : start
  const days: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cursor <= last && days.length < 400) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

const longDay = (key: string) => dateLong.format(new Date(`${key}T12:00:00-05:00`))
const shortDay = (key: string) => dateShort.format(new Date(`${key}T12:00:00-05:00`))

/** Fecha o rango legible. Nunca inventa un día: sin fechas confirmadas devuelve «Fecha por confirmar». */
export function formatEventDates(event: CalendarEvent): string {
  if (!event.dates_confirmed || !event.starts_at) return event.date_note ? `Fecha por confirmar · ${event.date_note}` : 'Fecha por confirmar'
  const startKey = dayKey(event.starts_at)
  const endKey = event.ends_at ? dayKey(event.ends_at) : startKey
  if (startKey === endKey) {
    const time = event.all_day ? '' : ` · ${timeOnly.format(new Date(event.starts_at))}${event.ends_at ? ` – ${timeOnly.format(new Date(event.ends_at))}` : ''}`
    return `${longDay(startKey)}${time}`
  }
  const sameYear = startKey.slice(0, 4) === endKey.slice(0, 4)
  const from = sameYear ? shortDay(startKey) : longDay(startKey)
  const range = `${from} – ${longDay(endKey)}`
  return event.all_day ? range : `${range} (${timeOnly.format(new Date(event.starts_at))} – ${timeOnly.format(new Date(event.ends_at ?? event.starts_at))})`
}

export function modalitiesLabel(event: CalendarEvent): string {
  return event.applies_to_all_modalities ? 'Todas las modalidades' : event.modalities.map((m) => m.name).join(', ')
}

/** Mensaje accesible de la fecha: oficial vs. tentativa y, si falta, que está por confirmar. */
export function dateStatusText(event: CalendarEvent): string {
  if (!event.dates_confirmed) return 'Fecha por confirmar'
  return DATE_KIND_LABEL[event.date_kind]
}

/** Pasa una hora de Bogotá a lo que espera `<input type="datetime-local">` y viceversa. */
export function toInputValue(iso: string | null, allDay: boolean): string {
  if (!iso) return ''
  const key = dayKey(iso)
  if (allDay) return key
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
  return `${key}T${hm}`
}

export function fromInputValue(value: string, allDay: boolean): string | null {
  if (!value) return null
  return allDay ? `${value}T00:00:00-05:00` : `${value}:00-05:00`
}

export type CalendarErrorKind = 'offline' | 'server' | 'auth' | 'unknown'

/** Distingue un fallo de red real (status 0) de un error que SÍ respondió el servidor: no son lo mismo para el usuario. */
export function classifyCalendarError(error: unknown): CalendarErrorKind {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: unknown }).status) : NaN
  if (status === 0) return 'offline'
  if (status === 401 || status === 403) return 'auth'
  if (status >= 500) return 'server'
  return 'unknown'
}

export const CALENDAR_ERROR_COPY: Record<CalendarErrorKind, { title: string; message: string }> = {
  offline: { title: 'Sin conexión', message: 'Revisa tu conexión a internet e inténtalo de nuevo.' },
  server: { title: 'No se pudo cargar el calendario', message: 'Estamos teniendo un problema al consultar la información. Inténtalo nuevamente más tarde.' },
  auth: { title: 'No tienes acceso a esta información', message: 'El servidor rechazó la consulta. Si el problema continúa, avisa a Coordinación.' },
  unknown: { title: 'No se pudo cargar el calendario', message: 'Ocurrió un problema inesperado. Inténtalo de nuevo.' },
}
