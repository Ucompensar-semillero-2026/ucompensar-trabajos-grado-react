import { ArrowRight, BarChart3, CheckCircle2, CircleDot, Clock3, FileCheck2, History, MessageSquareWarning, Send, Target } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatMoment } from '@/components/seguimiento/monitoringUi.utils'
import type { DeliverableOut, StageOut } from '@/services/workplan.service'
import {
  displayStatus,
  formatShortDate,
  type ActivityItem,
  type ActivityKind,
  type DraftMap,
  type NextAction,
  type ProcessSummary,
} from './documentosHelpers'
import { DeliverButton } from '../entrega/DeliverButton'
import { EmptyNote, Panel, StatusPill } from './documentosUi'

// ── Tarjeta 1: próxima acción / entregable seleccionado ──────────────────────

interface NextActionProps {
  /** Entregable elegido en la tabla; si no hay, se muestra la próxima acción calculada. */
  selected: { deliverable: DeliverableOut; stage: StageOut } | null
  next: NextAction | null
  drafts: DraftMap
  allApproved: boolean
  onOpen: (deliverableId: string) => void
  onClearSelection: () => void
}

export function NextActionCard({ selected, next, drafts, allApproved, onOpen, onClearSelection }: NextActionProps) {
  const target = selected ?? (next ? { deliverable: next.deliverable, stage: next.stage } : null)
  const title = selected ? 'Entregable seleccionado' : 'Próxima acción'
  if (!target) {
    return (
      <Panel title={title} Icon={Target}>
        <EmptyNote title={allApproved ? '¡Todo al día!' : 'Nada pendiente por ahora'}>
          {allApproved ? 'Tus entregables obligatorios están aprobados.' : 'Cuando se habilite un entregable, aquí verás qué hacer a continuación.'}
        </EmptyNote>
      </Panel>
    )
  }
  const d = target.deliverable
  const status = displayStatus(d, drafts)
  const message = selected ? messageFor(d, status) : next?.message
  const actionable = d.can_submit || d.submissions_count > 0 || Boolean(d.current_submission)
  return (
    <Panel title={title} Icon={Target} action={selected ? <button type="button" onClick={onClearSelection} className="cursor-pointer text-[12px] font-bold text-[#0E6B9C] hover:underline">Ver sugerida</button> : undefined}>
      <p className="text-[15px] font-extrabold leading-snug text-[var(--color-secondary)]">{d.title}</p>
      <p className="text-[12px] text-[var(--color-text-muted)]">{target.stage.name} · Fecha límite: {formatShortDate(d.due_date)}</p>
      <div className="mt-2"><StatusPill status={status} /></div>
      {message && <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">{message}</p>}
      {actionable && (d.can_submit ? (
        <DeliverButton size="md" className="mt-4 w-full" onClick={() => onOpen(d.public_id)}>Abrir entrega</DeliverButton>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(d.public_id)}
          className="mt-4 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FF641D] px-4 text-[14px] font-extrabold text-white shadow-md shadow-orange-500/25 transition-colors hover:bg-[#E5530F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF641D]"
        >
          Ver detalle de la entrega
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      ))}
    </Panel>
  )
}

function messageFor(d: DeliverableOut, status: ReturnType<typeof displayStatus>): string {
  switch (status) {
    case 'aprobada': return 'Tu tutor aprobó este entregable.'
    case 'en_revision': return 'Tu entrega está en revisión por el tutor.'
    case 'con_correcciones': return 'Tu tutor pidió correcciones. Prepara una nueva versión.'
    case 'borrador': return 'Tienes un borrador guardado que todavía no es una entrega.'
    case 'vencida': return 'La fecha límite ya pasó.'
    case 'disponible': return 'Ya puedes cargar y entregar este documento.'
    case 'no_aplica': return 'Este entregable no aplica a tu proyecto.'
    default: return d.depends_on_public_id ? 'Se habilita cuando se apruebe el entregable previo.' : 'Todavía no está habilitado.'
  }
}

// ── Tarjeta 2: resumen del proceso ───────────────────────────────────────────

function Donut({ percent }: { percent: number }) {
  const r = 38
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-[104px] w-[104px] shrink-0" role="img" aria-label={`Avance general: ${percent}%`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" stroke="var(--color-border)" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" strokeLinecap="round" stroke="#10B981" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, percent)) / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-extrabold leading-none text-[var(--color-secondary)]">{percent}%</span>
        <span className="mt-0.5 text-[10.5px] font-semibold text-[var(--color-text-muted)]">Avance general</span>
      </div>
    </div>
  )
}

export function ProgressSummaryCard({ summary }: { summary: ProcessSummary }) {
  const rows: Array<{ label: string; value: number; dot: string; Icon: typeof CheckCircle2 }> = [
    { label: 'Entregas aprobadas', value: summary.approved, dot: 'text-emerald-600', Icon: CheckCircle2 },
    { label: 'En revisión', value: summary.inReview, dot: 'text-[#FF641D]', Icon: Clock3 },
    { label: 'Con correcciones', value: summary.corrections, dot: 'text-red-600', Icon: MessageSquareWarning },
    { label: 'Pendientes', value: summary.pending, dot: 'text-slate-400', Icon: CircleDot },
  ]
  return (
    <Panel title="Resumen del proceso" Icon={BarChart3}>
      <div className="flex items-center justify-between gap-3">
        <ul className="min-w-0 flex-1 space-y-2">
          {rows.map(({ label, value, dot, Icon }) => (
            <li key={label} className="flex items-center gap-2 text-[13px] text-[var(--color-text)]">
              <Icon size={15} aria-hidden="true" className={cn('shrink-0', dot)} />
              <span className="font-extrabold">{value}</span>
              <span className="truncate text-[var(--color-text-muted)]">{label}</span>
            </li>
          ))}
        </ul>
        <Donut percent={summary.percent} />
      </div>
      <p className="mt-3 text-[11.5px] text-[var(--color-text-muted)]">Se cuentan los entregables obligatorios. Un borrador guardado no es una entrega.</p>
    </Panel>
  )
}

// ── Tarjeta 3: actividad reciente ────────────────────────────────────────────

const KIND: Record<ActivityKind, { Icon: typeof Send; dot: string }> = {
  entrega: { Icon: Send, dot: 'bg-[#0E6B9C]' },
  aprobada: { Icon: CheckCircle2, dot: 'bg-emerald-500' },
  correccion: { Icon: MessageSquareWarning, dot: 'bg-red-500' },
  plan: { Icon: FileCheck2, dot: 'bg-slate-400' },
}

export function RecentActivityCard({ items, loading, partial, onSeeAll }: { items: ActivityItem[]; loading: boolean; partial: boolean; onSeeAll: () => void }) {
  return (
    <Panel title="Actividad reciente" Icon={History} action={<button type="button" onClick={onSeeAll} className="cursor-pointer text-[12px] font-bold text-[#0E6B9C] hover:underline">Ver historial completo</button>}>
      {loading && items.length === 0 ? (
        <p role="status" className="text-[13px] text-[var(--color-text-muted)]">Cargando actividad…</p>
      ) : items.length === 0 ? (
        <EmptyNote title="Sin actividad todavía">Aquí verás tus entregas y las revisiones de tu tutor.</EmptyNote>
      ) : (
        <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-[var(--color-border)]">
          {items.slice(0, 5).map((it) => (
            <li key={it.key} className="relative pl-6">
              <span aria-hidden="true" className={cn('absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full ring-4 ring-[var(--color-surface)]', KIND[it.kind].dot)} />
              <p className="text-[13px] font-bold leading-snug text-[var(--color-text)]">{it.title}</p>
              <p className="truncate text-[12px] text-[var(--color-text-muted)]" title={it.detail}>{it.detail}</p>
              <p className="text-[11.5px] text-[var(--color-text-dim)]">{formatMoment(it.at)}</p>
            </li>
          ))}
        </ol>
      )}
      {partial && <p className="mt-3 text-[11.5px] text-amber-700 dark:text-amber-300">No se pudo cargar todo el historial; la actividad puede estar incompleta.</p>}
    </Panel>
  )
}
