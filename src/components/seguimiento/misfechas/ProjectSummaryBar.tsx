import { ClipboardList } from 'lucide-react'
import type { ProcessOut } from '@/services/processes.service'
import type { WorkPlanOut } from '@/services/workplan.service'
import { AcademicProgressTimeline } from '@/components/proceso/documentos/ProcessOverview'
import { processLabel } from '@/components/proceso/workPlanUi.utils'
import { cn } from '@/utils/cn'
import { BUCKET_TONE, projectStateTone } from './misFechasHelpers'

interface Props {
  processes: ProcessOut[]
  selected: ProcessOut | null
  selectedId: string | null
  onSelectProcess: (id: string) => void
  plan: WorkPlanOut
}

const STATE_NEUTRAL = 'border-slate-300 bg-slate-100 text-slate-800 dark:border-white/25 dark:bg-white/10 dark:text-slate-200'

/** Proyecto (con selector si hay varios procesos), modalidad y estado general, junto a la línea de etapas REALES del plan. */
export function ProjectSummaryBar({ processes, selected, selectedId, onSelectProcess, plan }: Props) {
  // Color según el estado REAL del proyecto (catálogo de estados); sin clasificación definida queda neutro, nunca verde por defecto.
  const tone = projectStateTone(plan.process_state_code)
  const name = plan.process_title?.trim() || (selected ? processLabel(selected) : 'Mi proyecto de grado')
  return (
    <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]">
      <section aria-label="Mi proyecto de grado" className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0E6B9C]/10 text-[#0E6B9C] dark:bg-sky-400/15 dark:text-sky-300">
          <ClipboardList size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">Mi proyecto de grado</p>
          {processes.length > 1 ? (
            <>
              <label htmlFor="process-selector" className="sr-only">Proceso de grado</label>
              <select id="process-selector" value={selectedId ?? ''} onChange={(e) => onSelectProcess(e.target.value)} className="mt-0.5 w-full min-w-0 cursor-pointer truncate rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[14px] font-extrabold text-[var(--color-secondary)] outline-none focus:border-[#0E6B9C]">
                {processes.map((p) => <option key={p.public_id} value={p.public_id}>{processLabel(p)}</option>)}
              </select>
            </>
          ) : (
            <p className="truncate text-[15.5px] font-extrabold text-[var(--color-secondary)]" title={name}>{name}</p>
          )}
          <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
            Modalidad: <span className="font-semibold text-[var(--color-text)]">{selected?.modality.name ?? '—'}</span>
          </p>
          <span className={cn('mt-1.5 inline-flex rounded-full border-[1.5px] px-3 py-1 text-[12px] font-bold shadow-sm', tone === 'neutro' ? STATE_NEUTRAL : BUCKET_TONE[tone].badge)} title="Estado general del proyecto">
            {plan.process_state_name}
          </span>
        </div>
      </section>
      <AcademicProgressTimeline stages={plan.stages} />
    </div>
  )
}
