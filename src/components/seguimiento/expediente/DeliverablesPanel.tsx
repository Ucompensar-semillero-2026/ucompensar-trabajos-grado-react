import { Download, FileDown, ListChecks } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { WorkPlanOut } from '@/services/workplan.service'
import { formatDay, formatMoment } from '../monitoringUi'
import { DELIVERABLE_STATUS } from './dossierHelpers'
import { DossierCard, EmptyNote, SectionError } from './dossierUi'
import type { DossierSection } from './useStudentDossier'

const linkBtn = 'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-bold text-[var(--color-secondary)] transition-colors hover:border-[#1565C0] hover:text-[#1565C0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B1A]'

interface DeliverablesPanelProps {
  plan: DossierSection<WorkPlanOut>
  /** Abre el archivo pidiendo antes un enlace firmado fresco (los enlaces caducan). */
  onOpenFile: (deliverableId: string, kind: 'submission' | 'template') => void
}

export function DeliverablesPanel({ plan, onOpenFile }: DeliverablesPanelProps) {
  const deliverables = plan.data?.stages.filter((s) => s.active).flatMap((s) => s.deliverables.filter((d) => d.active && d.applicable).map((d) => ({ ...d, stage: s.name }))) ?? []
  return (
    <DossierCard title="Entregables" Icon={ListChecks} titleId="exp-deliverables-title">
      {plan.loading ? <p role="status" className="text-[13px] text-[var(--color-text-muted)]">Cargando entregables…</p>
        : plan.error ? <SectionError message={plan.error} />
          : deliverables.length === 0 ? <EmptyNote>El plan de trabajo no tiene entregables aplicables.</EmptyNote> : (
            <ul className="space-y-3">
              {deliverables.map((d) => {
                const st = DELIVERABLE_STATUS[d.status]
                const sub = d.current_submission
                return (
                  <li key={d.public_id} className={cn('rounded-2xl border-2 p-4', d.is_overdue ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10' : 'border-[var(--color-border)]')}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-extrabold text-[var(--color-secondary)]">{d.title}</p>
                        <p className="text-[12px] text-[var(--color-text-muted)]">{d.stage} · Fecha límite: <span className={d.is_overdue ? 'font-extrabold text-red-700 dark:text-red-300' : ''}>{formatDay(d.due_date)}</span>{d.is_overdue && ' · vencido'}</p>
                      </div>
                      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-bold leading-none', st.className)}><st.Icon size={12} aria-hidden="true" />{st.label}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] px-3 py-2 text-[12.5px]">
                      {sub ? (
                        <span>Última entrega del equipo: <strong>{sub.file_name}</strong> (v{sub.version}) · {sub.submitted_by.full_name} · {formatMoment(sub.submitted_at)}</span>
                      ) : <span className="text-[var(--color-text-muted)]">Sin entregas todavía.</span>}
                      <span className="flex gap-2">
                        {d.template_file_name && <button type="button" className={linkBtn} onClick={() => onOpenFile(d.public_id, 'template')}><FileDown size={13} aria-hidden="true" />Plantilla</button>}
                        {sub && <button type="button" className={linkBtn} onClick={() => onOpenFile(d.public_id, 'submission')}><Download size={13} aria-hidden="true" />Descargar entrega</button>}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
    </DossierCard>
  )
}
