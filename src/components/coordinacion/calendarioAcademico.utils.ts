// Funciones y constantes de CalendarioAcademico.tsx que no son componentes (fast refresh de Vite).
import { type AdminCalendarEvent, type EventInput, type DateKind } from '@/services/calendar.service'
import { fromInputValue, toInputValue } from '@/components/publico/calendar/calendarFormat'

export function formFromEvent(event: AdminCalendarEvent): EventForm {
  return {
    title: event.title, description: event.description ?? '', event_type_id: event.event_type.id, academic_period_id: event.period?.id ?? '',
    modality_ids: event.modalities.map((m) => m.id), allDay: event.all_day, datesConfirmed: event.dates_confirmed, dateKind: event.date_kind,
    start: toInputValue(event.starts_at, event.all_day), end: toInputValue(event.ends_at, event.all_day), dateNote: event.date_note ?? '',
  }
}

/** Mismas reglas que valida FastAPI (que sigue siendo la autoridad). */
export function validateForm(form: EventForm): Partial<Record<'title' | 'type' | 'start' | 'end' | 'kind', string>> {
  const errors: Partial<Record<'title' | 'type' | 'start' | 'end' | 'kind', string>> = {}
  if (form.title.trim().length < 3) errors.title = 'Escribe un título de al menos 3 caracteres.'
  if (!form.event_type_id) errors.type = 'Selecciona el tipo de proceso.'
  if (form.datesConfirmed) {
    if (!form.start) errors.start = 'Indica la fecha de inicio o marca las fechas como por confirmar.'
    else if (form.end && form.end < form.start) errors.end = 'El cierre no puede ser anterior al inicio.'
  }
  if (form.dateKind === 'oficial' && !form.datesConfirmed) errors.kind = 'Una fecha oficial exige fechas confirmadas; mientras tanto déjala como tentativa.'
  return errors
}

export function toInput(form: EventForm): EventInput {
  return {
    title: form.title.trim(), description: form.description.trim() || null, event_type_id: form.event_type_id,
    academic_period_id: form.academic_period_id || null, modality_ids: form.modality_ids, all_day: form.allDay,
    dates_confirmed: form.datesConfirmed, date_kind: form.dateKind,
    starts_at: form.datesConfirmed ? fromInputValue(form.start, form.allDay) : null,
    ends_at: form.datesConfirmed ? fromInputValue(form.end, form.allDay) : null,
    date_note: form.dateNote.trim() || null,
  }
}

export interface EventForm {
  title: string
  description: string
  event_type_id: string
  academic_period_id: string
  modality_ids: string[]
  allDay: boolean
  datesConfirmed: boolean
  dateKind: DateKind
  start: string
  end: string
  dateNote: string
}
