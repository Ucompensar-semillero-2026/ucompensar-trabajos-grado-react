import { CalendarRange, FolderKanban } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { WorkPlanOut } from '@/services/workplan.service'
import { formatDay } from '../monitoringUi.utils'
import { DELIVERABLE_STATUS } from './dossierHelpers'
import { DossierCard, EmptyNote, SectionError } from './dossierUi'
import type { DossierSection } from './useStudentDossier'

export function WorkPlanPanel({ plan }: { plan: DossierSection<WorkPlanOut> }) {
  return (
    <DossierCard title="Plan de trabajo" Icon={FolderKanban} titleId="exp-plan-title">
      {plan.loading ? <p role="status" className="text-[13px] text-[var(--color-text-muted)]">Cargando plan de trabajo…</p>
        : plan.error ? <SectionError message={plan.error} />
          : plan.data && <PlanBody plan={plan.data} />}
    </DossierCard>
  )
}

function PlanBody({ plan }: { plan: WorkPlanOut }) {
  const stages = plan.stages.filter((s) => s.active)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Info label="Estado del plan"><span className={cn('rounded-full px-2.5 py-1 text-[12px] font-bold', plan.status === 'publicado' ? 'bg-green-700 text-white' : 'bg-amber-400 text-amber-950')}>{plan.status === 'publicado' ? 'Publicado' : 'Borrador'}</span></Info>
        <Info label="Inicio"><CalendarRange size={14} aria-hidden="true" className="text-[#1565C0]" />{formatDay(plan.start_date)}</Info>
        <Info label="Entrega final"><CalendarRange size={14} aria-hidden="true" className="text-[#FF6B1A]" />{formatDay(plan.target_end_date)}</Info>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[12px] font-bold text-[var(--color-secondary)]">
          <span>Avance del plan (entregables obligatorios aprobados)</span>
          <span>{plan.progress.approved} de {plan.progress.total_required} · {plan.progress.percent}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuenow={plan.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del plan">
          <div className="h-full rounded-full bg-gradient-to-r from-[#1565C0] to-[#FF6B1A] transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${plan.progress.percent}%` }} />
        </div>
      </div>
      {stages.length === 0 ? <EmptyNote>El plan todavía no tiene etapas.</EmptyNote> : (
        <ol className="space-y-3">
          {stages.map((stage) => (
            <li key={stage.public_id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <p className="text-[14px] font-extrabold text-[var(--color-secondary)]">{stage.name} <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">· Semestre {stage.semester}</span></p>
              {stage.description && <p className="text-[12.5px] text-[var(--color-text-muted)]">{stage.description}</p>}
              <ul className="mt-2 divide-y divide-[var(--color-border)]">
                {stage.deliverables.filter((d) => d.active).map((d) => {
                  const st = DELIVERABLE_STATUS[d.status]
                  return (
                    <li key={d.public_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                      <span className="min-w-0 font-semibold text-[var(--color-text)]">{d.title}{!d.mandatory && <span className="ml-1 text-[11.5px] font-medium text-[var(--color-text-muted)]">(opcional)</span>}</span>
                      <span className="flex items-center gap-2">
                        <span className={cn('text-[12px]', d.is_overdue ? 'font-extrabold text-red-700 dark:text-red-300' : 'text-[var(--color-text-muted)]')}>{formatDay(d.due_date)}</span>
                        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-bold leading-none', st.className)}><st.Icon size={12} aria-hidden="true" />{st.label}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg)] p-3 ring-1 ring-[var(--color-border)]">
      <p className="text-[11.5px] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--color-secondary)]">{children}</p>
    </div>
  )
}
