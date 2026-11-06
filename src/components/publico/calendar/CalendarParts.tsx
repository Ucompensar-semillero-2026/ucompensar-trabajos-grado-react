import { CalendarClock, CheckCircle2, CircleDashed, Clock3, Hourglass, PlayCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CalendarEvent, Timeline } from '@/services/calendar.service'
import { cn } from '@/utils/cn'
import { DATE_KIND_LABEL, TIMELINE_LABEL, formatEventDates, modalitiesLabel } from './calendarFormat'

// Cada estado lleva icono + texto: nunca se comunica solo con color.
const TIMELINE_STYLE: Record<Timeline, { Icon: LucideIcon; className: string }> = {
  proximo: { Icon: CalendarClock, className: 'border-[#0876B9]/30 bg-[#E8F3FA] text-[#05527F]' },
  en_curso: { Icon: PlayCircle, className: 'border-[#15804B]/30 bg-[#EAF7F1] text-[#116A3E]' },
  finalizado: { Icon: CheckCircle2, className: 'border-[#C9D6DF] bg-[#F1F4F6] text-[#4A5C68]' },
  por_confirmar: { Icon: Hourglass, className: 'border-[#F4511E]/30 bg-[#FFF1E8] text-[#B4400F]' },
}

const chip = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none'

export function TimelineBadge({ timeline }: { timeline: Timeline }) {
  const { Icon, className } = TIMELINE_STYLE[timeline]
  return <span className={cn(chip, className)}><Icon size={13} aria-hidden="true" />{TIMELINE_LABEL[timeline]}</span>
}

/** Oficial (borde sólido, icono lleno) frente a tentativa (borde punteado): se distinguen por texto, icono y trazo. */
export function DateKindBadge({ event }: { event: CalendarEvent }) {
  if (!event.dates_confirmed) {
    return <span className={cn(chip, 'border-dashed border-[#F4511E]/50 bg-white text-[#B4400F]')}><CircleDashed size={13} aria-hidden="true" />Fecha por confirmar</span>
  }
  const official = event.date_kind === 'oficial'
  return (
    <span className={cn(chip, official ? 'border-[#073B57]/40 bg-[#073B57] text-white' : 'border-dashed border-[#073B57]/50 bg-white text-[#073B57]')}>
      {official ? <CheckCircle2 size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}
      {DATE_KIND_LABEL[event.date_kind]}
    </span>
  )
}

export function EventBadges({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TimelineBadge timeline={event.timeline} />
      <DateKindBadge event={event} />
      {event.status === 'cerrado' && <span className={cn(chip, 'border-[#C9D6DF] bg-[#F1F4F6] text-[#4A5C68]')}>Cerrado por Coordinación</span>}
    </div>
  )
}

/** Resumen de un evento, igual para la vista pública y para la previsualización de Coordinación. */
export function EventSummary({ event, headingLevel = 3 }: { event: CalendarEvent; headingLevel?: 2 | 3 | 4 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  return (
    <article className="rounded-2xl border border-[#DCE5E9] bg-white p-5 shadow-[0_8px_26px_rgba(7,59,87,0.07)] sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#F4511E]">{event.event_type.name}{event.period ? ` · ${event.period.name}` : ''}</p>
      <Heading className="mt-2 text-xl font-bold leading-snug text-[#073B57]">{event.title}</Heading>
      <p className="mt-2 flex items-start gap-2 text-[15px] font-semibold text-[#172B3A]"><CalendarClock size={18} className="mt-0.5 shrink-0 text-[#F4511E]" aria-hidden="true" />{formatEventDates(event)}</p>
      <div className="mt-3"><EventBadges event={event} /></div>
      {event.description && <p className="mt-3 text-sm leading-relaxed text-[#526575]">{event.description}</p>}
      <p className="mt-3 text-xs text-[#60727F]"><strong className="text-[#073B57]">Aplica a:</strong> {modalitiesLabel(event)}</p>
      {!event.dates_confirmed && <p className="mt-2 rounded-xl bg-[#FFF5EF] p-3 text-xs leading-relaxed text-[#8A3A12]">Esta fecha aún no está confirmada. Coordinación la actualizará cuando se defina; no la tomes como definitiva.</p>}
      {event.dates_confirmed && event.date_kind === 'tentativa' && <p className="mt-2 rounded-xl bg-[#F4F8FA] p-3 text-xs leading-relaxed text-[#435A69]">Fecha tentativa: puede cambiar. Consulta de nuevo antes de planear.</p>}
    </article>
  )
}
