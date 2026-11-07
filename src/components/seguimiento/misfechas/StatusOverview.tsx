import type { ReactNode } from 'react'
import { AlertCircle, ArrowRight, CalendarDays, Info, PartyPopper, BarChart3 } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { WorkPlanOut } from '@/services/workplan.service'
import { formatShortDate } from '@/components/proceso/documentos/documentosHelpers'
import { BUCKET_COLOR, BUCKET_LABEL, BUCKET_TONE, DAYS_TONE_CLASS, bucketOf, summarize, type Bucket, type NextCommitment } from './misFechasHelpers'
import { BucketPill } from './misFechasUi'

const ORDER: Bucket[] = ['aprobado', 'revision', 'pendiente', 'vencido']

function Card({ title, Icon, children, className }: { title: string; Icon: typeof Info; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]', className)}>
      <h2 className="mb-3 flex items-center gap-2 font-display text-[16px] font-extrabold text-[var(--color-secondary)]">
        <Icon size={18} aria-hidden="true" className="text-[#0E6B9C]" />
        {title}
      </h2>
      {children}
    </section>
  )
}

// ── Tarjeta 1: estado de mis entregables ─────────────────────────────────────

function Donut({ counts, total, percent }: { counts: Record<Bucket, number>; total: number; percent: number }) {
  const r = 38
  const c = 2 * Math.PI * r
  const used = ORDER.filter((k) => counts[k] > 0)
  // Con una sola categoría el anillo es continuo (p. ej. todo azul); con varias se deja una pequeña separación entre segmentos.
  const gap = used.length > 1 ? 3 : 0
  let offset = 0
  return (
    <div className="relative h-[148px] w-[148px] shrink-0" role="img" aria-label={`Avance general: ${percent}%. ${ORDER.map((k) => `${counts[k]} ${BUCKET_LABEL[k].toLowerCase()}`).join(', ')}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="15" stroke="var(--color-border)" />
        {total > 0 &&
          ORDER.map((k) => {
            const len = (counts[k] / total) * c
            const el = counts[k] > 0 && (
              <circle key={k} cx="50" cy="50" r={r} fill="none" strokeWidth="15" stroke={BUCKET_COLOR[k]} strokeDasharray={`${Math.max(len - gap, 0.01)} ${c}`} strokeDashoffset={-(offset + gap / 2)} strokeLinecap="butt" />
            )
            offset += len
            return el
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[30px] font-extrabold leading-none text-[var(--color-secondary)]">{percent}%</span>
        <span className="mt-1 text-[11px] font-semibold leading-tight text-[var(--color-text-muted)]">Avance<br />general</span>
      </div>
    </div>
  )
}

export function ProgressDonutCard({ plan }: { plan: WorkPlanOut }) {
  const s = summarize(plan)
  const percent = Math.round(plan.progress.percent)
  return (
    <Card title="Estado de mis entregables" Icon={BarChart3}>
      {s.total === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">Tu plan todavía no tiene entregables.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
          <Donut counts={s.counts} total={s.total} percent={percent} />
          <ul className="min-w-[210px] flex-1 divide-y divide-[var(--color-border)]">
            {ORDER.map((b) => (
              <li key={b} className="flex items-center gap-3 py-2">
                <span aria-hidden="true" className={cn('h-4 w-4 shrink-0 rounded-full shadow-sm', BUCKET_TONE[b].dot)} />
                <span className={cn('w-10 text-right text-[30px] font-extrabold leading-none tabular-nums', BUCKET_TONE[b].text)}>{s.counts[b]}</span>
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-tight text-[var(--color-text)]">{BUCKET_LABEL[b]}</span>
                <span className={cn('min-w-[46px] rounded-full border-[1.5px] px-2 py-1 text-center text-[12.5px] font-extrabold tabular-nums', BUCKET_TONE[b].badge)}>{s.percent[b]}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.corrections > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-[12px] text-blue-900 dark:bg-blue-500/10 dark:text-blue-200">
          <AlertCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {s.corrections === 1 ? '1 de tus pendientes tiene correcciones solicitadas' : `${s.corrections} de tus pendientes tienen correcciones solicitadas`}: no se cuentan dos veces.
        </p>
      )}
      <p className="mt-auto pt-3 text-[11.5px] text-[var(--color-text-muted)]">
        Cada entregable cuenta una sola vez. El porcentaje central es el avance oficial del plan (entregables obligatorios aprobados).
      </p>
    </Card>
  )
}

// ── Tarjeta 2: leyenda de colores ────────────────────────────────────────────

const LEGEND: Array<{ bucket: Bucket; title: string; text: string }> = [
  { bucket: 'aprobado', title: 'Verde – Entregado / Aprobado', text: 'Tu tarea fue entregada y aprobada por el tutor.' },
  { bucket: 'revision', title: 'Naranja – En revisión', text: 'Tu entrega está siendo revisada por tu tutor.' },
  { bucket: 'pendiente', title: 'Azul – Pendiente / En curso', text: 'Aún tienes tiempo para realizar o formalizar esta actividad.' },
  { bucket: 'vencido', title: 'Rojo – Vencido', text: 'La fecha límite se cumplió y no existe una entrega formal válida.' },
]

export function StatusLegendCard() {
  return (
    <Card title="¿Qué significa cada color?" Icon={Info}>
      <ul className="space-y-2">
        {LEGEND.map(({ bucket, title, text }) => (
          <li key={bucket} className={cn('flex items-start gap-3 rounded-xl py-2.5 pl-3 pr-3', BUCKET_TONE[bucket].tint, BUCKET_TONE[bucket].edge)}>
            <span aria-hidden="true" className={cn('mt-0.5 flex h-[14px] w-[14px] shrink-0 rounded-full', BUCKET_TONE[bucket].dot)} />
            <p className="text-[12.5px] leading-snug text-[var(--color-text)]">
              <strong className={cn('font-extrabold', BUCKET_TONE[bucket].text)}>{title}:</strong> {text}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ── Tarjeta 3: próximo compromiso ────────────────────────────────────────────

function phrase(text: string): string {
  return /Vencido|hoy|^—|Sin fecha/.test(text) ? text : `Vence en ${text}`
}

export function NextCommitmentCard({ next, inReview, allApproved, extended, onOpen, onSeeCommitments }: {
  next: NextCommitment
  /** El plazo del entregable fue ampliado por el tutor (solo agrega una etiqueta; no cambia el color del estado). */
  extended: boolean
  inReview: number
  allApproved: boolean
  onOpen: (deliverableId: string) => void
  onSeeCommitments: () => void
}) {
  if (!next) {
    return (
      <Card title="Próximo compromiso" Icon={CalendarDays}>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-6 text-center dark:bg-emerald-500/10">
          <PartyPopper size={28} aria-hidden="true" className="text-emerald-600" />
          <p className="text-[15px] font-extrabold text-emerald-900 dark:text-emerald-200">{allApproved ? '¡Todo aprobado!' : '¡Estás al día!'}</p>
          <p className="text-[12.5px] text-emerald-900/80 dark:text-emerald-100/80">
            {inReview > 0 ? `No tienes entregas por hacer. ${inReview === 1 ? 'Una entrega está' : `${inReview} entregas están`} en revisión por tu tutor.` : 'No tienes compromisos pendientes por ahora.'}
          </p>
        </div>
      </Card>
    )
  }
  if (next.kind === 'compromiso') {
    const c = next.commitment
    const late = next.days < 0
    return (
      <Card title="Próximo compromiso" Icon={CalendarDays}>
        <div className="rounded-xl border border-[var(--color-border)] p-3.5">
          <p className="text-[14.5px] font-extrabold leading-snug text-[var(--color-secondary)]">{c.description}</p>
          <p className="text-[12px] text-[var(--color-text-muted)]">Compromiso acordado con tu tutor</p>
          <p className={cn('mt-1 text-[12.5px] font-semibold', late ? 'text-red-700 dark:text-red-300' : 'text-[var(--color-text)]')}>
            {late ? `Vencido hace ${-next.days} ${next.days === -1 ? 'día' : 'días'}` : next.days === 0 ? 'Vence hoy' : `Vence en ${next.days} ${next.days === 1 ? 'día' : 'días'}`}
          </p>
          <span className={cn('mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-bold', BUCKET_TONE[late ? 'vencido' : 'pendiente'].soft, BUCKET_TONE[late ? 'vencido' : 'pendiente'].text)}>
            <CalendarDays size={13} aria-hidden="true" />{formatShortDate(c.due_date)}
          </span>
        </div>
        <button type="button" onClick={onSeeCommitments} className="mt-3 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FF641D] px-4 text-[14px] font-extrabold text-white shadow-md shadow-orange-500/25 transition-colors hover:bg-[#E5530F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF641D]">
          Ver mis compromisos <ArrowRight size={16} aria-hidden="true" />
        </button>
      </Card>
    )
  }
  const { deliverable: d, stage } = next.action
  return (
    <Card title="Próximo compromiso" Icon={CalendarDays}>
      <div className="rounded-xl border border-[var(--color-border)] p-3.5">
        <p className="text-[14.5px] font-extrabold leading-snug text-[var(--color-secondary)]">{d.title}</p>
        <p className="text-[12px] text-[var(--color-text-muted)]">{stage.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center rounded-lg px-2.5 py-1 text-[12.5px] font-extrabold', DAYS_TONE_CLASS[next.days.tone])}>{phrase(next.days.text)}</span>
          {extended && <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10.5px] font-bold text-violet-800 dark:bg-violet-500/25 dark:text-violet-200">Plazo ampliado</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-bold', BUCKET_TONE[bucketOf(d)].soft, BUCKET_TONE[bucketOf(d)].text)}>
            <CalendarDays size={13} aria-hidden="true" />{formatShortDate(d.due_date)}
          </span>
          <BucketPill deliverable={d} hasDraft={next.action.status === 'borrador'} />
        </div>
      </div>
      <button type="button" onClick={() => onOpen(d.public_id)} className="mt-3 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FF641D] px-4 text-[14px] font-extrabold text-white shadow-md shadow-orange-500/25 transition-colors hover:bg-[#E5530F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF641D]">
        Ver detalle <ArrowRight size={16} aria-hidden="true" />
      </button>
    </Card>
  )
}
