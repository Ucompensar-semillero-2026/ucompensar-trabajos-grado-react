// Funciones y constantes de AcademicCalendar.tsx que no son componentes (fast refresh de Vite).
import { type CalendarEvent } from '@/services/calendar.service'


/** Próximos eventos: en curso y próximos por orden cronológico (los finalizados no cuentan); las fechas por confirmar van aparte. */
export function upcomingEvents(items: CalendarEvent[]): { dated: CalendarEvent[]; pending: CalendarEvent[] } {
  const dated = items
    .filter((e) => e.timeline === 'proximo' || e.timeline === 'en_curso')
    .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? '') || a.title.localeCompare(b.title))
  return { dated, pending: items.filter((e) => e.timeline === 'por_confirmar') }
}
