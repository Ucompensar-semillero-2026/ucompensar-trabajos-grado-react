import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { DeliverableOut } from '@/services/workplan.service'
import { DeliverableStatusBadge } from '@/components/proceso/workPlanUi'
import { CARD, dayTone, monthGrid, type DayTone } from './tutorUi.utils'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTH_NAME = new Intl.DateTimeFormat('es-CO', { month: 'long' })
const DAY_NAME = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

const DAY_STYLE: Record<DayTone, string> = {
  overdue: 'bg-red-500 text-white',
  review: 'bg-[#FF6500] text-white',
  next: 'bg-[#0876B9] text-white',
  approved: 'bg-emerald-600 text-white',
  other: 'bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200',
}

const LEGEND: Array<[DayTone, string]> = [
  ['review', 'En revisión'],
  ['next', 'Próxima entrega'],
  ['approved', 'Aprobados'],
  ['other', 'Otras entregas'],
  ['overdue', 'Vencidas'],
]

const parts = (iso: string): [number, number] => {
  const [y, m] = iso.split('-').map(Number)
  return [y, m - 1]
}

/**
 * Calendario mensual con las fechas límite REALES de los entregables que recibe (los de la etapa seleccionada).
 * Cada día con entregas se pinta según su estado y, al elegirlo, lista esos entregables para abrirlos.
 */
export function DeliveryCalendar({
  deliverables,
  nextId,
  stageName,
  onOpen,
}: {
  deliverables: DeliverableOut[]
  nextId: string | null
  stageName: string
  onOpen: (deliverablePublicId: string) => void
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, DeliverableOut[]>()
    for (const d of deliverables) if (d.due_date) map.set(d.due_date, [...(map.get(d.due_date) ?? []), d])
    return map
  }, [deliverables])

  // Mes inicial: el de la próxima entrega de la etapa; si no hay, el primer vencimiento; si no, hoy.
  const initial = useMemo(() => {
    const next = deliverables.find((d) => d.public_id === nextId && d.due_date)?.due_date ?? [...byDate.keys()].sort()[0]
    if (next) return parts(next)
    const now = new Date()
    return [now.getFullYear(), now.getMonth()] as [number, number]
  }, [deliverables, nextId, byDate])
  const [[year, month], setMonth] = useState<[number, number]>(initial)
  const [selected, setSelected] = useState<string | null>(null)

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setMonth([d.getFullYear(), d.getMonth()])
    setSelected(null)
  }
  const title = `${MONTH_NAME.format(new Date(year, month, 1))} ${year}`.replace(/^./, (c) => c.toUpperCase())
  const picked = selected ? (byDate.get(selected) ?? []) : []

  return (
    <section aria-label="Calendario de entregas" className={cn(CARD, 'p-5')}>
      <h3 className="mb-3 flex items-center gap-2 font-display text-[18px] font-extrabold text-[var(--color-secondary)]">
        <CalendarDays size={18} aria-hidden="true" className="text-[#FF6500]" />Calendario de entregas
      </h3>
      <p className="mb-2 text-[12px] text-[var(--color-text-muted)]">Etapa: {stageName}</p>

      <div className="mb-2 flex items-center justify-between rounded-xl border border-[#DCE6F2] px-2 py-1 dark:border-[var(--color-border)]">
        <button type="button" aria-label="Mes anterior" onClick={() => shift(-1)} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-slate-100 dark:hover:bg-white/10"><ChevronLeft size={16} aria-hidden="true" /></button>
        <p aria-live="polite" className="text-[14px] font-bold text-[var(--color-secondary)]">{title}</p>
        <button type="button" aria-label="Mes siguiente" onClick={() => shift(1)} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-slate-100 dark:hover:bg-white/10"><ChevronRight size={16} aria-hidden="true" /></button>
      </div>

      <div role="grid" aria-label={title} className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => <span key={w} role="columnheader" className="py-1 text-[11px] font-bold text-[var(--color-text-muted)]">{w}</span>)}
        {monthGrid(year, month).map((cell, i) => {
          if (!cell.date) return <span key={i} role="gridcell" />
          const items = byDate.get(cell.date) ?? []
          const isSelected = selected === cell.date
          if (items.length === 0) return <span key={cell.date} role="gridcell" className="py-1.5 text-[13px] text-[var(--color-text)]">{cell.day}</span>
          return (
            <span key={cell.date} role="gridcell" className="flex justify-center py-0.5">
              <button
                type="button"
                aria-label={`${DAY_NAME.format(new Date(year, month, cell.day))}: ${items.length} ${items.length === 1 ? 'entregable' : 'entregables'}`}
                aria-pressed={isSelected}
                onClick={() => setSelected(isSelected ? null : (cell.date as string))}
                className={cn('flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition', DAY_STYLE[dayTone(items, nextId)], isSelected && 'ring-2 ring-[var(--color-secondary)] ring-offset-2')}
              >
                {cell.day}
              </button>
            </span>
          )
        })}
      </div>

      {selected && (
        <ul aria-label="Entregables de la fecha seleccionada" className="mt-3 flex flex-col gap-2 border-t border-[#DCE6F2] pt-3 dark:border-[var(--color-border)]">
          {picked.map((d) => (
            <li key={d.public_id} className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => onOpen(d.public_id)} className="min-w-0 break-words text-left text-[13px] font-bold text-[#0876B9] underline underline-offset-4">{d.title}</button>
              <DeliverableStatusBadge status={d.status} />
            </li>
          ))}
        </ul>
      )}

      <ul aria-label="Leyenda del calendario" className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        {LEGEND.map(([tone, label]) => (
          <li key={tone} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--color-text-muted)]">
            <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', DAY_STYLE[tone].split(' ')[0])} />{label}
          </li>
        ))}
      </ul>
    </section>
  )
}
