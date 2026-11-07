import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { cn } from '@/utils/cn'
import { bogotaToday } from '../monitoringHelpers'
import { BUCKET_LABEL, BUCKET_TONE, CALENDAR_KIND_LABEL, monthGrid, type CalendarEvent } from './misFechasHelpers'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const monthName = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const longDate = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }

type Selection = { type: 'event'; key: string } | { type: 'day'; date: string } | null

/** Calendario mensual de los compromisos: cada evento es un dato real del sistema y lleva el color de la leyenda. */
export function DeliverablesCalendar({ events, onOpenDeliverable }: { events: CalendarEvent[]; onOpenDeliverable: (deliverableId: string) => void }) {
  const today = bogotaToday()
  const [cursor, setCursor] = useState(() => { const [y, m] = today.split('-').map(Number); return { year: y, month: m - 1 } })
  const [selection, setSelection] = useState<Selection>(null)

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [events])
  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const label = monthName.format(new Date(cursor.year, cursor.month, 1))
  const move = (delta: number) => { setSelection(null); setCursor(({ year, month }) => { const d = new Date(year, month + delta, 1); return { year: d.getFullYear(), month: d.getMonth() } }) }
  const goToday = () => { setSelection(null); const [y, m] = today.split('-').map(Number); setCursor({ year: y, month: m - 1 }) }

  const selectedEvent = selection?.type === 'event' ? events.find((e) => e.key === selection.key) ?? null : null
  const dayEvents = selection?.type === 'day' ? byDate.get(selection.date) ?? [] : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[17px] font-extrabold capitalize text-[var(--color-secondary)]" aria-live="polite">{label}</h3>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => move(-1)} aria-label="Mes anterior" className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border)] hover:border-[#0E6B9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]"><ChevronLeft size={17} aria-hidden="true" /></button>
          <button type="button" onClick={goToday} className="h-9 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 text-[12.5px] font-bold text-[#0E6B9C] hover:border-[#0E6B9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]">Hoy</button>
          <button type="button" onClick={() => move(1)} aria-label="Mes siguiente" className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border)] hover:border-[#0E6B9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]"><ChevronRight size={17} aria-hidden="true" /></button>
        </div>
      </div>

      <div role="grid" aria-label={`Calendario de ${label}`} className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <div role="row" className="grid grid-cols-7 bg-[var(--color-bg)] text-center text-[11.5px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          {WEEKDAYS.map((w) => <div key={w} role="columnheader" className="py-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const list = byDate.get(cell.date) ?? []
            const isToday = cell.date === today
            const chosen = selection?.type === 'day' && selection.date === cell.date
            return (
              <div
                key={cell.date}
                role="gridcell"
                aria-label={`${longDate.format(parse(cell.date))}${list.length ? `: ${list.length} ${list.length === 1 ? 'evento' : 'eventos'}` : ''}`}
                onClick={() => list.length && setSelection({ type: 'day', date: cell.date })}
                className={cn('min-h-[64px] border-l border-t border-[var(--color-border)] p-1 sm:min-h-[92px] sm:p-1.5', !cell.inMonth && 'bg-[var(--color-bg)]/60 text-[var(--color-text-dim)]', chosen && 'bg-[#0E6B9C]/5', list.length > 0 && 'cursor-pointer')}
              >
                <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold', isToday ? 'bg-[#FF641D] text-white' : cell.inMonth ? 'text-[var(--color-text)]' : 'text-[var(--color-text-dim)]')}>{cell.day}</span>
                <div className="mt-0.5 flex flex-wrap gap-1 sm:flex-col sm:flex-nowrap">
                  {list.slice(0, 3).map((e) => (
                    <button
                      key={e.key}
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); setSelection({ type: 'event', key: e.key }) }}
                      title={`${CALENDAR_KIND_LABEL[e.kind]}: ${e.title}`}
                      aria-label={`${CALENDAR_KIND_LABEL[e.kind]}: ${e.title}`}
                      className={cn('flex min-w-0 cursor-pointer items-center gap-1 rounded-md text-left text-[11px] font-semibold leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C] sm:w-full sm:px-1.5 sm:py-0.5', BUCKET_TONE[e.bucket].soft, BUCKET_TONE[e.bucket].text)}
                    >
                      <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-full', BUCKET_TONE[e.bucket].dot)} />
                      <span className="hidden truncate sm:inline">{e.title}</span>
                    </button>
                  ))}
                  {list.length > 3 && <span className="hidden px-1 text-[11px] font-bold text-[var(--color-text-muted)] sm:inline">+{list.length - 3} más</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedEvent && (
        <div role="region" aria-label="Detalle del evento" className={cn('rounded-xl border p-4', BUCKET_TONE[selectedEvent.bucket].badge)}>
          <p className="text-[11.5px] font-bold uppercase tracking-wide">{CALENDAR_KIND_LABEL[selectedEvent.kind]} · {BUCKET_LABEL[selectedEvent.bucket]}</p>
          <p className="mt-0.5 text-[15px] font-extrabold text-[var(--color-secondary)]">{selectedEvent.title}</p>
          <p className="text-[12.5px] text-[var(--color-text)]">{longDate.format(parse(selectedEvent.date))}</p>
          {selectedEvent.detail && <p className="text-[12.5px] text-[var(--color-text-muted)]">{selectedEvent.detail}</p>}
          {selectedEvent.deliverableId && (
            <button type="button" onClick={() => onOpenDeliverable(selectedEvent.deliverableId!)} className="mt-2.5 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#FF641D] px-3 text-[12.5px] font-extrabold text-white hover:bg-[#E5530F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF641D]">
              <Eye size={14} aria-hidden="true" />Ver detalle
            </button>
          )}
        </div>
      )}
      {selection?.type === 'day' && dayEvents.length > 0 && (
        <div role="region" aria-label="Eventos del día" className="rounded-xl border border-[var(--color-border)] p-3">
          <p className="mb-2 text-[13px] font-extrabold capitalize text-[var(--color-secondary)]">{longDate.format(parse(selection.date))}</p>
          <ul className="space-y-1.5">
            {dayEvents.map((e) => (
              <li key={e.key}>
                <button type="button" onClick={() => setSelection({ type: 'event', key: e.key })} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-[var(--color-bg)]">
                  <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-full', BUCKET_TONE[e.bucket].dot)} />
                  <span className="font-bold text-[var(--color-text)]">{e.title}</span>
                  <span className="text-[var(--color-text-muted)]">· {CALENDAR_KIND_LABEL[e.kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {events.length === 0 && <p className="text-[13px] text-[var(--color-text-muted)]">Todavía no hay fechas registradas para mostrar.</p>}
      <p className="text-[12px] text-[var(--color-text-muted)]">Solo se muestran fechas registradas en el sistema. Los colores son los de la leyenda; la fecha límite usa el plazo efectivo (con ampliaciones).</p>
    </div>
  )
}
