import { FileText, type LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { EvaluationOut } from '@/services/evaluation.service'

export interface SummaryStat {
  Icon: LucideIcon
  value: string
  label: string
  tone: string
}

/** Tarjeta del proyecto (nombre, periodo y estudiante) con indicadores opcionales a la derecha. Todo viene de la evaluación real del proyecto. */
export function ProjectSummaryCard({ report, stats = [] }: { report: EvaluationOut; stats?: SummaryStat[] }) {
  return (
    <section aria-label="Resumen del proyecto" className="flex flex-wrap items-center gap-x-4 gap-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex min-w-[260px] flex-1 items-center gap-3">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF641D]/10 text-[#E5530F] dark:text-orange-300"><FileText size={24} /></span>
        <div className="min-w-0">
          <p className="truncate font-display text-[18px] font-extrabold text-[var(--color-secondary)]" title={report.process_title?.trim() || undefined}>{report.process_title?.trim() || 'Proyecto de grado'}</p>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Periodo académico {report.academic_semester}{report.student_name ? ` | Estudiante: ${report.student_name}` : ''}
          </p>
        </div>
      </div>
      {stats.length > 0 && (
        <div role="group" aria-label="Resumen de la configuración" className="flex flex-wrap items-center gap-y-3">
          {stats.map((s, i) => (
            <div key={s.label} className={cn('flex items-center gap-3 px-4', i > 0 && 'lg:border-l lg:border-[var(--color-border)]')}>
              <span aria-hidden="true" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', s.tone)}><s.Icon size={20} /></span>
              <div className="leading-tight">
                <p className="font-display text-[20px] font-extrabold text-[var(--color-secondary)]">{s.value}</p>
                <p className="text-[12.5px] text-[var(--color-text-muted)]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
