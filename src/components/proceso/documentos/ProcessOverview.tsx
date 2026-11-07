import { Fragment } from 'react'
import { AlertTriangle, Check, CircleDashed, ClipboardList, FileText } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ProcessOut } from '@/services/processes.service'
import type { StageOut, WorkPlanOut } from '@/services/workplan.service'
import { processLabel } from '../workPlanUi'
import { processSummary, stageState, stageStateLabel, type StageState } from './documentosHelpers'

interface OverviewProps {
  processes: ProcessOut[]
  selected: ProcessOut | null
  selectedId: string | null
  onSelectProcess: (id: string) => void
  plan: WorkPlanOut
}

/** Tarjeta con los cuatro bloques: proyecto (con selector si hay varios), modalidad, estado y avance. Todo viene del backend. */
export function ProcessOverview({ processes, selected, selectedId, onSelectProcess, plan }: OverviewProps) {
  const summary = processSummary(plan)
  const name = plan.process_title?.trim() || (selected ? processLabel(selected) : 'Mi proyecto de grado')
  return (
    <section aria-label="Resumen del proyecto" className="grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.5fr)] xl:items-center xl:gap-0 xl:divide-x xl:divide-[var(--color-border)]">
      <div className="flex min-w-0 items-center gap-3 xl:pr-5">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0E6B9C]/10 text-[#0E6B9C] dark:bg-sky-400/15 dark:text-sky-300">
          <ClipboardList size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">Mi proyecto de grado</p>
          {processes.length > 1 ? (
            <>
              <label htmlFor="process-selector" className="sr-only">Proceso de grado</label>
              <select
                id="process-selector"
                value={selectedId ?? ''}
                onChange={(e) => onSelectProcess(e.target.value)}
                className="mt-0.5 w-full min-w-0 cursor-pointer truncate rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[14px] font-extrabold text-[var(--color-secondary)] outline-none focus:border-[#0E6B9C]"
              >
                {processes.map((p) => <option key={p.public_id} value={p.public_id}>{processLabel(p)}</option>)}
              </select>
            </>
          ) : (
            <p className="truncate text-[15px] font-extrabold text-[var(--color-secondary)]" title={name}>{name}</p>
          )}
        </div>
      </div>

      <div className="xl:px-5">
        <p className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">Modalidad</p>
        <p className="text-[14px] font-bold text-[var(--color-text)]">{selected?.modality.name ?? '—'}</p>
      </div>

      <div className="xl:px-5">
        <p className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">Estado general</p>
        <span className="mt-1 inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[12.5px] font-bold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
          {plan.process_state_name}
        </span>
      </div>

      <div className="md:col-span-2 xl:col-span-1 xl:pl-5">
        <p className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">Progreso del plan de trabajo</p>
        {summary.total > 0 ? (
          <>
            <p className="text-[14px] font-bold text-[var(--color-text)]">
              {summary.approved} de {summary.total} entregables ({summary.percent}%)
            </p>
            <div
              role="progressbar"
              aria-label="Progreso del plan de trabajo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={summary.percent}
              className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--color-border)]"
            >
              <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${summary.percent}%` }} />
            </div>
          </>
        ) : (
          <p className="text-[13px] text-[var(--color-text-muted)]">Tu plan no tiene entregables obligatorios todavía.</p>
        )}
      </div>
    </section>
  )
}

const NODE: Record<StageState, { cls: string; Icon: typeof Check }> = {
  completada: { cls: 'border-emerald-500 bg-emerald-500 text-white', Icon: Check },
  en_curso: { cls: 'border-[#FF641D] bg-[#FF641D]/10 text-[#FF641D] ring-4 ring-[#FF641D]/15', Icon: FileText },
  pendiente: { cls: 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-dim)]', Icon: CircleDashed },
  atencion: { cls: 'border-red-500 bg-red-50 text-red-600 ring-4 ring-red-500/15 dark:bg-red-500/10', Icon: AlertTriangle },
}

const LABEL_TONE: Record<StageState, string> = {
  completada: 'text-emerald-700 dark:text-emerald-300',
  en_curso: 'text-[#C2410C] dark:text-orange-300',
  pendiente: 'text-[var(--color-text-muted)]',
  atencion: 'text-red-700 dark:text-red-300',
}

/** Etapas REALES del plan (no se inventan), con el estado derivado de sus entregables y un conector hacia la siguiente. */
export function AcademicProgressTimeline({ stages }: { stages: StageOut[] }) {
  const active = stages.filter((s) => s.active).sort((a, b) => a.semester - b.semester || a.sort_order - b.sort_order)
  if (active.length === 0) return null
  return (
    <nav aria-label="Etapas del plan de trabajo" className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-sm)]">
      <ol className="mx-auto flex min-w-max items-start justify-between gap-0">
        {active.map((stage, i) => {
          const state = stageState(stage)
          const { cls, Icon } = NODE[state]
          const nextDone = i < active.length - 1 && stageState(stage) === 'completada'
          return (
            <Fragment key={stage.public_id}>
              <li className="flex w-[150px] shrink-0 items-start gap-2.5 sm:w-[170px]" aria-label={`${stage.name}: ${stageStateLabel(stage)}`}>
                <span aria-hidden="true" className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2', cls)}>
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold leading-tight text-[var(--color-secondary)]">{stage.name}</span>
                  <span className={cn('block text-[12px] font-bold', LABEL_TONE[state])}>{stageStateLabel(stage)}</span>
                </span>
              </li>
              {i < active.length - 1 && (
                <li aria-hidden="true" className="mt-[18px] h-0.5 min-w-6 flex-1 rounded-full" style={{ background: nextDone ? '#10B981' : 'var(--color-border)' }} />
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
