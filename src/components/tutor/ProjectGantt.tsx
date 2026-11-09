import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { DeliverableOut, WorkPlanOut } from '@/services/workplan.service'
import { FILTER_LABELS, formatShort, isOverdueOpen, markerTone, positionPct, stageBar, stageTone, todayIso, type GanttRange, type MarkerTone, type SummaryTone } from './tutorUi.utils'

const LABEL_W = 210
const HEAD_H = 46
const ROW_H = 50

const BAR: Record<SummaryTone, string> = {
  orange: 'bg-orange-200/90 dark:bg-orange-400/40',
  blue: 'bg-sky-200/90 dark:bg-sky-400/40',
  green: 'bg-emerald-200/90 dark:bg-emerald-400/40',
  red: 'bg-red-200/90 dark:bg-red-400/40',
  gray: 'bg-slate-200/90 dark:bg-slate-400/40',
}

const MARKER: Record<MarkerTone, string> = {
  approved: 'border-emerald-600 bg-emerald-600 text-white',
  review: 'border-[#FF6500] bg-white',
  next: 'border-[#0876B9] bg-white',
  overdue: 'border-red-500 bg-red-500',
  pending: 'border-slate-400 bg-white',
}

const stateLabel = (d: DeliverableOut): string => (isOverdueOpen(d) ? 'Vencido' : FILTER_LABELS[d.status as keyof typeof FILTER_LABELS] ?? d.status)

/**
 * Cronograma tipo Gantt con las fechas REALES del plan: una fila por etapa (barra de su primera a su última fecha límite)
 * y un hito por entregable en su fecha límite. La columna de etapas queda fija al desplazar; la línea de «Hoy» se calcula
 * con la fecha del sistema y solo aparece si cae dentro del rango visible.
 */
export function ProjectGantt({
  plan, range, nextId, selectedStageId, selectedDeliverableId, onSelectStage, onSelectDeliverable, large = false,
}: {
  plan: WorkPlanOut
  range: GanttRange
  nextId: string | null
  selectedStageId: string | null
  selectedDeliverableId: string | null
  onSelectStage: (stageId: string | null) => void
  onSelectDeliverable: (deliverablePublicId: string) => void
  large?: boolean
}) {
  const stages = plan.stages.filter((s) => s.active)
  const monthW = large ? 112 : 78
  const width = range.months.length * monthW
  const today = positionPct(range, todayIso())
  const grid = { gridTemplateColumns: `repeat(${range.months.length}, minmax(0, 1fr))` }

  return (
    <div role="group" aria-label="Cronograma del proyecto" className="overflow-x-auto rounded-xl border border-[#DCE6F2] dark:border-[var(--color-border)]">
      <div className="flex" style={{ minWidth: LABEL_W + width }}>
        <div className="sticky left-0 z-20 shrink-0 border-r border-[#DCE6F2] bg-white dark:border-[var(--color-border)] dark:bg-[var(--color-surface)]" style={{ width: LABEL_W }}>
          <div className="flex items-center border-b border-[#DCE6F2] bg-slate-50 px-3 text-[12.5px] font-bold text-[var(--color-secondary)] dark:border-[var(--color-border)] dark:bg-white/5" style={{ height: HEAD_H }}>Etapa</div>
          {stages.map((s, i) => {
            const active = s.public_id === selectedStageId
            return (
              <button
                key={s.public_id}
                type="button"
                aria-pressed={active}
                aria-label={`Etapa ${i + 1}: ${s.name}`}
                onClick={() => onSelectStage(active ? null : s.public_id)}
                className={cn('flex w-full items-center gap-2 border-b border-[#DCE6F2] px-3 text-left transition last:border-b-0 dark:border-[var(--color-border)]', active ? 'bg-orange-50 dark:bg-orange-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/5')}
                style={{ height: ROW_H }}
              >
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white', active ? 'bg-[#FF6500]' : 'bg-slate-400')}>{i + 1}</span>
                <span className="min-w-0 break-words text-[13px] font-bold leading-tight text-[var(--color-secondary)]">{s.name}</span>
              </button>
            )
          })}
        </div>

        <div className="relative flex-1" style={{ minWidth: width }}>
          <div className="grid border-b border-[#DCE6F2] bg-slate-50 dark:border-[var(--color-border)] dark:bg-white/5" style={{ ...grid, height: HEAD_H }}>
            {range.months.map((m) => {
              const [mon, year] = m.label.split(' ')
              return (
                <div key={m.key} className="flex flex-col items-center justify-center border-l border-[#DCE6F2] text-[12px] leading-tight text-[var(--color-secondary)] first:border-l-0 dark:border-[var(--color-border)]">
                  <span className="font-bold">{mon}</span><span className="text-[11px] text-[var(--color-text-muted)]">{year}</span>
                </div>
              )
            })}
          </div>

          {stages.map((s, i) => {
            const bar = stageBar(range, s)
            const active = s.public_id === selectedStageId
            return (
              <div key={s.public_id} className={cn('relative border-b border-[#DCE6F2] last:border-b-0 dark:border-[var(--color-border)]', active && 'bg-orange-50/60 dark:bg-orange-500/5')} style={{ height: ROW_H }}>
                <div aria-hidden="true" className="absolute inset-0 grid" style={grid}>
                  {range.months.map((m) => <span key={m.key} className="border-l border-[#DCE6F2] first:border-l-0 dark:border-[var(--color-border)]" />)}
                </div>
                {bar && (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => onSelectStage(active ? null : s.public_id)}
                    className={cn('absolute top-1/2 h-6 -translate-y-1/2 rounded-full', BAR[stageTone(i)], active && 'ring-2 ring-[#FF6500]/60')}
                    style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                  />
                )}
                {s.deliverables.filter((d) => d.active && d.due_date).map((d) => {
                  const left = positionPct(range, d.due_date as string)
                  if (left === null) return null
                  const tone = markerTone(d, nextId)
                  const picked = d.public_id === selectedDeliverableId
                  return (
                    <button
                      key={d.public_id}
                      type="button"
                      title={`${d.title} · ${formatShort(d.due_date)} · ${stateLabel(d)}`}
                      aria-label={`${d.title}, ${formatShort(d.due_date)}, ${stateLabel(d)}`}
                      aria-pressed={picked}
                      onClick={() => onSelectDeliverable(d.public_id)}
                      className={cn('absolute top-1/2 z-10 flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition hover:scale-125', MARKER[tone], picked && 'scale-125 ring-2 ring-[var(--color-secondary)] ring-offset-1')}
                      style={{ left: `${left}%` }}
                    >
                      {tone === 'approved' && <Check size={11} aria-hidden="true" strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {today !== null && (
            <div aria-label="Hoy" role="img" className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-[#FF6500]" style={{ left: `${today}%` }}>
              <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded-md bg-[#FF6500] px-1.5 py-0.5 text-[11px] font-bold text-white">Hoy</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
