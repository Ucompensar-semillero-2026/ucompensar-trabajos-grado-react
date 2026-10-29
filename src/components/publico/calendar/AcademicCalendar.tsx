import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CalendarClock, ChevronLeft, ChevronRight, CircleDashed, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'
import { calendarApi, type CalendarEvent } from '@/services/calendar.service'
import { EventBadges, EventSummary } from './CalendarParts'
import {
  CALENDAR_ERROR_COPY, classifyCalendarError, eventDays, formatEventDates, monthGrid, monthLabel, monthOf, sameMonth, shiftMonth, todayKey, type CalendarErrorKind,
} from './calendarFormat'

type Load = { phase: 'loading' } | { phase: 'error'; kind: CalendarErrorKind } | { phase: 'ready'; items: CalendarEvent[] }

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const UPCOMING_LIMIT = 6
const dayLabel = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const longDay = (key: string) => dayLabel.format(new Date(`${key}T12:00:00Z`))

/** Próximos eventos: en curso y próximos por orden cronológico (los finalizados no cuentan); las fechas por confirmar van aparte. */
export function upcomingEvents(items: CalendarEvent[]): { dated: CalendarEvent[]; pending: CalendarEvent[] } {
  const dated = items
    .filter((e) => e.timeline === 'proximo' || e.timeline === 'en_curso')
    .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? '') || a.title.localeCompare(b.title))
  return { dated, pending: items.filter((e) => e.timeline === 'por_confirmar') }
}

/** Calendario académico general, integrado en /proyectos-de-grado. Todo sale de la API; nada está escrito en el código. */
export function AcademicCalendar() {
  const today = todayKey()
  const [load, setLoad] = useState<Load>({ phase: 'loading' })
  const [month, setMonth] = useState(() => monthOf(today))
  const [selected, setSelected] = useState<string>(today)

  const fetchEvents = useCallback(() => {
    setLoad({ phase: 'loading' })
    calendarApi
      .events()
      .then((data) => setLoad({ phase: 'ready', items: data.items }))
      .catch((error) => setLoad({ phase: 'error', kind: classifyCalendarError(error) }))
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const items = useMemo(() => (load.phase === 'ready' ? load.items : []), [load])
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of items) for (const day of eventDays(event)) map.set(day, [...(map.get(day) ?? []), event])
    return map
  }, [items])
  const weeks = useMemo(() => monthGrid(month), [month])
  const { dated, pending } = useMemo(() => upcomingEvents(items), [items])
  const dayEvents = byDay.get(selected) ?? []

  const goTo = (next: ReturnType<typeof monthOf>) => {
    setMonth(next)
    // Al cambiar de mes la selección sigue al mes visible (hoy en el mes actual, el día 1 en los demás).
    setSelected(sameMonth(next, monthOf(today)) ? today : `${next.year}-${String(next.month).padStart(2, '0')}-01`)
  }

  return (
    <section id="calendario" aria-labelledby="calendar-title" className="px-5 py-10 sm:px-8 sm:py-12">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-3xl border border-[#145B78]/30 bg-[radial-gradient(ellipse_at_88%_12%,rgba(255,107,53,0.24),transparent_34%),linear-gradient(110deg,#073B57_0%,#0B4865_58%,#124D64_100%)] px-4 py-8 text-white shadow-[0_18px_42px_rgba(7,59,87,0.16)] sm:px-9 sm:py-10 lg:px-12 2xl:max-w-screen-2xl">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10 sm:-right-8 sm:-top-32 sm:h-96 sm:w-96" />
        <div className="relative z-10 max-w-3xl">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[#FF9A68]"><CalendarDays size={15} aria-hidden="true" /> UCompensar · Ingeniería</p>
          <h2 id="calendar-title" className="mt-3 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">Calendario académico</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">Consulta las fechas importantes de convocatorias, proyectos de grado y actividades académicas de tu programa</p>
        </div>

        <div className="relative z-10 mt-7" aria-live="polite" aria-busy={load.phase === 'loading'}>
          {load.phase === 'loading' && (
            <div role="status" aria-label="Cargando el calendario" className="grid animate-pulse gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="h-80 rounded-2xl bg-white/90" /><div className="h-80 rounded-2xl bg-white/90" />
            </div>
          )}

          {load.phase === 'error' && (
            <div role="alert" className="rounded-2xl bg-white p-5 text-[#172B3A] shadow-lg">
              <p className="flex items-center gap-2 font-bold text-[#073B57]">{load.kind === 'offline' ? <WifiOff size={18} aria-hidden="true" /> : <CalendarClock size={18} aria-hidden="true" />}{CALENDAR_ERROR_COPY[load.kind].title}</p>
              <p className="mt-1 text-sm text-[#526575]">{CALENDAR_ERROR_COPY[load.kind].message}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3 gap-2 border-[#073B57]/25 text-[#073B57]" onClick={fetchEvents}><RefreshCw size={14} aria-hidden="true" />Reintentar</Button>
            </div>
          )}

          {load.phase === 'ready' && items.length === 0 && (
            <div className="rounded-2xl bg-white p-6 text-center text-[#172B3A] shadow-lg">
              <CalendarDays size={28} className="mx-auto text-[#F4511E]" aria-hidden="true" />
              <p className="mt-2 text-lg font-bold text-[#073B57]">Todavía no hay fechas académicas publicadas para este periodo</p>
              <p className="mt-1 text-sm text-[#526575]">Cuando Coordinación publique el calendario, las fechas aparecerán aquí.</p>
            </div>
          )}

          {load.phase === 'ready' && items.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div className="rounded-2xl bg-white p-3 text-[#172B3A] shadow-lg sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-[#073B57]">{monthLabel(month)}</h3>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" aria-label="Mes anterior" onClick={() => goTo(shiftMonth(month, -1))}><ChevronLeft size={16} aria-hidden="true" /></Button>
                    <Button type="button" variant="outline" size="sm" disabled={sameMonth(month, monthOf(today)) && selected === today} onClick={() => goTo(monthOf(today))}>Mes actual</Button>
                    <Button type="button" variant="outline" size="sm" aria-label="Mes siguiente" onClick={() => goTo(shiftMonth(month, 1))}><ChevronRight size={16} aria-hidden="true" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase text-[#526575]" aria-hidden="true">{WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}</div>
                <div className="grid grid-cols-7 gap-1" role="group" aria-label={`Días de ${monthLabel(month)}`}>
                  {weeks.flat().map((day, i) => {
                    if (!day) return <div key={i} aria-hidden="true" />
                    const events = byDay.get(day) ?? []
                    const isToday = day === today
                    const label = `${longDay(day)}${isToday ? ' (hoy)' : ''}${events.length ? `, ${events.length} ${events.length === 1 ? 'evento' : 'eventos'}` : ''}`
                    return (
                      <button key={day} type="button" onClick={() => setSelected(day)} aria-label={label} aria-pressed={selected === day} aria-current={isToday ? 'date' : undefined}
                        className={cn('relative flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35] sm:min-h-14',
                          selected === day ? 'border-[#073B57] bg-[#073B57] text-white' : isToday ? 'border-[#F4511E] bg-[#FFF1E8] text-[#B4400F]' : 'border-transparent hover:border-[#C9D6DF] hover:bg-[#F4F8FA]')}>
                        {Number(day.slice(8))}
                        {events.length > 0 && (
                          <span aria-hidden="true" className={cn('mt-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-4', selected === day ? 'bg-[#FF6B35] text-white' : 'bg-[#F4511E] text-white')}>{events.length}</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5 border-t border-[#E5E9EC] pt-4">
                  <h3 className="font-bold capitalize text-[#073B57]">{longDay(selected)}</h3>
                  {dayEvents.length === 0
                    ? <p className="mt-2 text-sm text-[#526575]">No hay eventos este día.</p>
                    : <ul className="mt-3 space-y-3">{dayEvents.map((event) => <li key={event.id}><EventSummary event={event} headingLevel={4} /></li>)}</ul>}
                </div>
              </div>

              <aside aria-labelledby="upcoming-title" className="rounded-2xl bg-white p-4 text-[#172B3A] shadow-lg sm:p-5">
                <h3 id="upcoming-title" className="text-lg font-bold text-[#073B57]">Próximos eventos</h3>
                {dated.length === 0 && pending.length === 0 && <p className="mt-2 text-sm text-[#526575]">No hay eventos próximos.</p>}
                {dated.length > 0 && (
                  <ol className="mt-3 space-y-2">
                    {dated.slice(0, UPCOMING_LIMIT).map((event) => (
                      <li key={event.id}>
                        <button type="button" className="w-full rounded-xl border border-[#DCE5E9] p-3 text-left transition hover:border-[#FF6B35]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35]"
                          onClick={() => { const first = eventDays(event)[0]; if (first) { setMonth(monthOf(first)); setSelected(first) } }}>
                          <span className="block text-sm font-bold text-[#073B57]">{event.title}</span>
                          <span className="mt-0.5 block text-xs text-[#526575]">{formatEventDates(event)}</span>
                          <span className="mt-2 block"><EventBadges event={event} /></span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                {pending.length > 0 && (
                  <section aria-labelledby="pending-title" className="mt-4 rounded-xl border border-dashed border-[#F4511E]/50 bg-[#FFF8F3] p-3">
                    <h4 id="pending-title" className="flex items-center gap-2 text-sm font-bold text-[#8A3A12]"><CircleDashed size={15} aria-hidden="true" />Fechas por confirmar</h4>
                    <ul className="mt-2 space-y-1.5">{pending.map((event) => <li key={event.id} className="text-sm"><strong className="text-[#073B57]">{event.title}</strong><span className="block text-xs text-[#8A3A12]">{formatEventDates(event)}</span></li>)}</ul>
                  </section>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
