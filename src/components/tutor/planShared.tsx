import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock, Eye, FileText, Layers, MoreVertical, Pencil, type LucideIcon } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { cn } from '@/utils/cn'
import type { DeliverableOut, StageOut, WorkPlanOut } from '@/services/workplan.service'
import { DeliverableStatusBadge } from '@/components/proceso/workPlanUi'
import { formatCalendarDate } from '@/components/proceso/workPlanUi.utils'
import { DeliverableForm } from './PlanEditor'
import { DeliverableReviewCard } from './DeliverableReviewCard'
import { Pill, ProgressBar } from './tutorUi'
import { CARD, TONES, formatShort, isOverdueOpen, stageTone, type NextDelivery, type SummaryTone } from './tutorUi.utils'

// Piezas compartidas por «Plan de trabajo y entregables» y «Cronograma»: las dos pestañas muestran los mismos entregables.

export type DetailMode = 'ver' | 'editar'

export function Stat({ icon: Icon, tone, value, label }: { icon: LucideIcon; tone: SummaryTone; value: ReactNode; label: string }) {
  return (
    <div className={cn(CARD, 'flex min-w-0 items-center gap-3 p-3.5')}>
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', TONES[tone].tile)}><Icon size={20} aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="font-display text-[24px] font-extrabold leading-none text-[var(--color-secondary)]">{value}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-[var(--color-text-muted)]">{label}</p>
      </div>
    </div>
  )
}

/** Tarjeta de avance: porcentaje de entregables obligatorios aprobados (cálculo del backend) con su barra. */
export function ProgressStat({ title, percent, approved, total, className }: { title: string; percent: number | null; approved: number; total: number; className?: string }) {
  return (
    <div className={cn(CARD, 'flex min-w-0 items-center gap-4 p-4', className)}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-500/15"><Layers size={22} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-[var(--color-text)]">{title}</p>
        <p className="font-display text-[26px] font-extrabold leading-tight text-[var(--color-secondary)]">{percent === null ? '—' : `${percent} %`}</p>
        <ProgressBar percent={percent ?? 0} label={title} />
        <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">{percent === null ? 'Sin entregables obligatorios' : `${approved} de ${total} entregables aprobados`}</p>
      </div>
    </div>
  )
}

/** Menú de acciones de un entregable: cada opción abre el detalle (que ya contiene la revisión, el archivo y las versiones). */
function RowMenu({ d, canManage, onOpen }: { d: DeliverableOut; canManage: boolean; onOpen: (mode: DetailMode) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  const awaiting = d.current_submission?.status === 'en_revision'
  const items: Array<[string, DetailMode]> = [['Ver detalle', 'ver']]
  if (canManage) items.push(['Editar entregable', 'editar'])
  if (canManage && awaiting) items.push(['Revisar entrega (calificar o pedir correcciones)', 'ver'])
  if (d.submissions_count > 0) items.push(['Ver archivo, versiones y decisiones', 'ver'])
  return (
    <div ref={ref} className="relative">
      <button type="button" title="Más acciones" aria-label={`Más acciones de ${d.title}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-slate-100 dark:hover:bg-white/10">
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul role="menu" aria-label={`Acciones de ${d.title}`} className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg">
          {items.map(([label, mode]) => (
            <li key={label} role="none">
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpen(mode) }} className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[var(--color-text)] hover:bg-slate-100 dark:hover:bg-white/10">{label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Fila (o tarjeta) de un entregable. Con `stage` agrega la columna de etapa (vista de todo el proyecto). */
export function DeliverableItem({
  d, layout, canManage, onOpen, stage, selected,
}: {
  d: DeliverableOut
  layout: 'fila' | 'tarjeta'
  canManage: boolean
  onOpen: (mode: DetailMode) => void
  stage?: { name: string; index: number }
  selected?: boolean
}) {
  const overdue = isOverdueOpen(d)
  const title = (
    <div className="flex min-w-0 items-center gap-2.5">
      <FileText size={17} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" />
      <div className="min-w-0">
        <button type="button" onClick={() => onOpen('ver')} className="break-words text-left text-[13.5px] font-bold text-[var(--color-secondary)] hover:underline">{d.title}</button>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {d.mandatory ? <Badge variant="blue">Obligatorio</Badge> : <Badge variant="gray">Opcional</Badge>}
          {!d.applicable && <Badge variant="gray">No aplica</Badge>}
          {!d.active && <Badge variant="gray">Desactivado</Badge>}
        </div>
      </div>
    </div>
  )
  const stageChip = stage ? <span><Pill tone={stageTone(stage.index)}>{stage.name}</Pill></span> : null
  const date = <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text)]"><CalendarDays size={14} aria-hidden="true" className="text-[var(--color-text-muted)]" />{formatShort(d.due_date)}</span>
  const status = <span className="flex flex-wrap items-center gap-1"><DeliverableStatusBadge status={d.status} />{overdue && <Badge variant="red">Vencido</Badge>}</span>
  const actions = (
    <span className="flex items-center justify-end gap-0.5">
      <button type="button" title="Ver entregable" aria-label={`Ver ${d.title}`} onClick={() => onOpen('ver')} className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-slate-100 hover:text-[#0876B9] dark:hover:bg-white/10"><Eye size={16} aria-hidden="true" /></button>
      {canManage && <button type="button" title="Editar entregable" aria-label={`Editar ${d.title}`} onClick={() => onOpen('editar')} className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-slate-100 hover:text-[#FF6500] dark:hover:bg-white/10"><Pencil size={16} aria-hidden="true" /></button>}
      <RowMenu d={d} canManage={canManage} onOpen={onOpen} />
    </span>
  )
  if (layout === 'tarjeta') {
    return (
      <li className={cn('flex flex-col gap-3 rounded-xl border p-4', selected ? 'border-[#FF6500] bg-orange-50/60 dark:bg-orange-500/10' : 'border-[#DCE6F2] dark:border-[var(--color-border)]')}>
        {title}
        {stageChip}
        <div className="flex flex-wrap items-center justify-between gap-2">{date}{status}</div>
        <div className="flex justify-end">{actions}</div>
      </li>
    )
  }
  return (
    <li className={cn('grid gap-2 px-3 py-3 md:items-center md:gap-3', stage ? 'md:grid-cols-[minmax(0,1fr)_170px_130px_150px_110px]' : 'md:grid-cols-[minmax(0,1fr)_120px_150px_110px]', selected && 'bg-orange-50/60 dark:bg-orange-500/10')}>
      {title}
      {stageChip}
      {date}
      {status}
      {actions}
    </li>
  )
}

/** «Próxima entrega»: la más cercana sin aprobar, o el mensaje que corresponda (cerrado, todo aprobado, sin entregables). */
export function NextDeliveryCard({
  next, closedState, allApproved, hasDeliverables, scopeLabel, onOpen,
}: {
  next: NextDelivery | null
  /** Nombre del estado cuando el proyecto está cancelado o cerrado (no hay entregas por cumplir). */
  closedState: string | null
  allApproved: boolean
  hasDeliverables: boolean
  scopeLabel?: string
  onOpen: (id: string) => void
}) {
  return (
    <section aria-label="Próxima entrega" className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5 shadow-[0_2px_10px_rgba(255,101,0,0.08)] dark:border-orange-400/30 dark:bg-orange-500/10 lg:self-start">
      <h3 className="mb-1 flex items-center gap-2 font-display text-[18px] font-extrabold text-[var(--color-secondary)]"><CalendarDays size={18} aria-hidden="true" className="text-[#FF6500]" />Próxima entrega</h3>
      {scopeLabel && <p className="mb-2 text-[12px] text-[var(--color-text-muted)]">{scopeLabel}</p>}
      {next ? (
        <div className="flex flex-col gap-2">
          <p className="break-words text-[16px] font-extrabold text-[var(--color-secondary)]">{next.deliverable.title}</p>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">Etapa: {next.stageName}</p>
          <p className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text)]"><CalendarDays size={14} aria-hidden="true" />{formatCalendarDate(next.deliverable.due_date)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <DeliverableStatusBadge status={next.deliverable.status} />
            <Pill tone={next.overdue ? 'red' : next.days <= 7 ? 'orange' : 'blue'} icon={next.overdue ? AlertTriangle : Clock}>{next.remaining}</Pill>
          </div>
          <div className="mt-1">
            <Button type="button" size="sm" onClick={() => onOpen(next.deliverable.public_id)}>Ver entregable <ChevronRight size={14} aria-hidden="true" /></Button>
          </div>
        </div>
      ) : closedState ? (
        <p role="status" className="rounded-xl border border-dashed border-orange-200 px-3 py-4 text-center text-[13px] text-[var(--color-text-muted)]">El proyecto está «{closedState}»: ya no hay entregas por cumplir.</p>
      ) : allApproved ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-[13px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 size={18} aria-hidden="true" />Todos los entregables del plan están aprobados.</p>
      ) : (
        <p className="rounded-xl border border-dashed border-orange-200 px-3 py-4 text-center text-[13px] text-[var(--color-text-muted)]">{hasDeliverables ? 'No hay entregables pendientes con fecha límite.' : 'El plan todavía no tiene entregables.'}</p>
      )}
    </section>
  )
}

/** Detalle de un entregable (revisión, archivo, versiones) o su edición, en un diálogo. */
export function DeliverableDialog({
  deliverable, mode, processId, stages, all, canManage, onPlan, reload, onMode, onClose, onSaved, onReview,
}: {
  deliverable: DeliverableOut
  mode: DetailMode
  processId: string
  stages: StageOut[]
  all: DeliverableOut[]
  canManage: boolean
  onPlan: (p: WorkPlanOut) => void
  reload: () => Promise<void>
  onMode: (mode: DetailMode) => void
  onClose: () => void
  onSaved: () => void
  /** «Revisar entrega»: abre la revisión de la entrega en la ventana modal. */
  onReview: (submissionPublicId: string) => void
}) {
  const stageName = stages.find((s) => s.deliverables.some((d) => d.public_id === deliverable.public_id))?.name ?? ''
  return (
    <ModalDialog title={mode === 'editar' ? `Editar entregable · ${deliverable.title}` : deliverable.title} onClose={onClose}>
      {mode === 'editar' && canManage ? (
        <DeliverableForm deliverable={deliverable} siblings={all} processId={processId} onPlan={onPlan} onDone={() => { onMode('ver'); onSaved() }} />
      ) : (
        <div className="flex flex-col gap-3">
          <DeliverableReviewCard deliverable={deliverable} processId={processId} stageName={stageName} canManage={canManage} onChanged={reload} onReview={onReview} />
          {canManage && <div><Button type="button" variant="outline" size="sm" onClick={() => onMode('editar')}><Pencil size={13} aria-hidden="true" /> Editar entregable</Button></div>}
        </div>
      )}
    </ModalDialog>
  )
}
