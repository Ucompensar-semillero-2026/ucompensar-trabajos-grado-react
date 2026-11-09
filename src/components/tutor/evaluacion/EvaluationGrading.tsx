import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, Info, ListChecks, Percent, Trophy } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Badge } from '@/components/ui'
import type { EvaluationOut } from '@/services/evaluation.service'
import { GRADE_MAX, formatGrade, formatGradeOfScale, formatPercent, formatPoints } from '@/components/proceso/documentos/gradeReport.utils'

const CARD = 'rounded-2xl border border-[#DCE6F2] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] dark:border-[var(--color-border)]'
const dash = '—'
const points = (n: number | null): string => (n === null ? dash : formatPoints(n))

/**
 * Resumen de calificación: nota publicada (lo que ve el estudiante), nota con borradores, actividades calificadas y avance. Todo sale
 * de los totales que calcula el backend; aquí solo se presentan. La configuración de entregables y fechas vive en «Plan de trabajo y entregables».
 */
export function EvaluationSummaryCard({ processId, report }: { processId: string; report: EvaluationOut }) {
  const published = report.published_totals ?? report.totals
  const total = report.totals.total_criteria
  const graded = report.totals.graded_criteria
  const progress = total > 0 ? Math.round((graded / total) * 1000) / 10 : null
  const item = (Icon: typeof Trophy, tone: string, label: string, value: string, hint?: string) => (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', tone)}><Icon size={20} /></span>
      <div className="min-w-0 leading-tight">
        <p className="text-[12px] text-[var(--color-text-muted)]">{label}</p>
        <p className="font-display text-[20px] font-extrabold text-[var(--color-secondary)]">{value}</p>
        {hint && <p className="text-[11.5px] text-[var(--color-text-muted)]">{hint}</p>}
      </div>
    </div>
  )
  return (
    <section aria-label="Resumen de calificación" className={cn(CARD, 'flex flex-col gap-4 p-4')}>
      <h3 className="font-display text-[18px] font-extrabold text-[var(--color-secondary)]">Resumen de calificación</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {item(Trophy, 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', 'Nota publicada', `${formatPoints(published.accumulated)} / ${GRADE_MAX.toFixed(1)}`, 'La que ve el estudiante')}
        {item(ClipboardCheck, 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', 'Nota con borradores', `${formatPoints(report.totals.accumulated)} / ${GRADE_MAX.toFixed(1)}`, 'Incluye lo guardado sin publicar')}
        {item(ListChecks, 'bg-orange-50 text-[#FF6500] dark:bg-orange-500/15 dark:text-orange-300', 'Actividades calificadas', `${graded} / ${total}`)}
        {item(Percent, 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', 'Avance', progress === null ? dash : formatPercent(progress), 'Actividades con nota')}
      </div>
      <p role="note" className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-[13px] text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          La configuración de entregables, fechas y actividades se administra en{' '}
          <Link to={`/tutor/proyectos/${processId}?tab=plan`} className="font-bold underline underline-offset-4">Plan de trabajo y entregables</Link>.
        </span>
      </p>
    </section>
  )
}

/**
 * Libro de calificaciones del proyecto: momentos, actividades (los entregables asociados), ponderación, nota, rango, porcentaje,
 * retroalimentación y aporte al total. Solo lectura: la nota de cada actividad se pone en la ventana «Revisión de entrega» y los cálculos
 * (promedio ponderado del momento, aportes y nota final) los hace el backend; una actividad sin nota no cuenta como cero.
 */
export function EvaluationGradebook({ report }: { report: EvaluationOut }) {
  const published = report.published_totals ?? report.totals
  const final = published.calculated_final
  const withDrafts = report.totals.calculated_final

  if (report.moments.length === 0) {
    return <p role="status" className={cn(CARD, 'px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]')}>Todavía no hay momentos evaluativos configurados: carga la distribución sugerida arriba.</p>
  }

  return (
    <section aria-label="Libro de calificaciones" className={cn(CARD, 'overflow-hidden')}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-[var(--color-bg)] text-[12px] font-bold text-[var(--color-secondary)]">
              <th scope="col" className="px-4 py-2.5">Ítem de calificación</th>
              <th scope="col" className="px-3 py-2.5 text-center">Ponderación</th>
              <th scope="col" className="px-3 py-2.5 text-center">Calificación (0–5)</th>
              <th scope="col" className="px-3 py-2.5 text-center">Rango</th>
              <th scope="col" className="px-3 py-2.5 text-center">Porcentaje</th>
              <th scope="col" className="px-3 py-2.5">Retroalimentación</th>
              <th scope="col" className="px-3 py-2.5 text-center">Aporte al total del proyecto</th>
            </tr>
          </thead>
          {report.moments.map((m) => {
            const count = m.graded_count + m.pending_count
            const momentGrade = m.moment_grade ?? m.partial_average
            const performance = momentGrade === null ? null : (momentGrade / GRADE_MAX) * 100
            const pending = m.graded_count === 0
            return (
              <tbody key={m.public_id} aria-label={m.name}>
                <tr className="bg-sky-50 font-bold text-[var(--color-secondary)] dark:bg-sky-500/10">
                  <th scope="row" className="px-4 py-2.5 text-left">
                    {m.name} <span className="font-semibold text-[var(--color-text-muted)]">— {formatPercent(m.weight_percentage)} del proyecto</span>
                    {pending ? <span className="ml-2 align-middle"><Badge variant="gray">Pendiente</Badge></span> : m.moment_grade === null ? <span className="ml-2 align-middle"><Badge variant="orange">Parcial</Badge></span> : null}
                  </th>
                  <td className="px-3 py-2.5 text-center">{formatPercent(m.weight_percentage)}</td>
                  <td className="px-3 py-2.5 text-center">{pending ? dash : points(momentGrade)}</td>
                  <td className="px-3 py-2.5 text-center">0–5</td>
                  <td className="px-3 py-2.5 text-center">{performance === null || pending ? dash : formatPercent(performance)}</td>
                  <td className="px-3 py-2.5 text-[12px] font-normal text-[var(--color-text-muted)]">{m.graded_count} de {count} actividades calificadas</td>
                  <td className="px-3 py-2.5 text-center">{pending ? dash : formatPoints(m.contribution_to_total)}</td>
                </tr>
                {m.criteria.map((c) => {
                  const graded = c.grade !== null
                  return (
                    <tr key={c.public_id} className="border-t border-[#E6EDF7] align-top dark:border-[var(--color-border)]">
                      <th scope="row" className="px-4 py-2.5 pl-8 text-left font-semibold text-[var(--color-text)]">{c.name}</th>
                      <td className="px-3 py-2.5 text-center">{formatPercent(c.weight_percentage)}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-[var(--color-text)]">
                        {graded ? <span className="inline-flex flex-wrap items-center justify-center gap-1.5">{formatGrade(c.grade as number)}{c.status === 'borrador' && <Badge variant="orange">Borrador</Badge>}</span> : <span className="font-normal text-[var(--color-text-muted)]" title="Sin calificar: no cuenta como cero">{dash}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center text-[var(--color-text-muted)]">0–5</td>
                      <td className="px-3 py-2.5 text-center">{c.percent_obtained !== null ? formatPercent(c.percent_obtained) : dash}</td>
                      <td className="px-3 py-2.5 text-[12.5px] text-[var(--color-text-muted)]">{c.feedback ? c.feedback : dash}</td>
                      <td className="px-3 py-2.5 text-center">{c.contribution_to_total !== null && graded ? formatPoints(c.contribution_to_total) : dash}</td>
                    </tr>
                  )
                })}
                <tr className="border-t border-[#E6EDF7] bg-amber-50/70 font-bold text-[var(--color-secondary)] dark:border-[var(--color-border)] dark:bg-amber-400/10">
                  <th scope="row" className="px-4 py-2.5 pl-8 text-left">Total del momento</th>
                  <td className="px-3 py-2.5 text-center">{formatPercent(m.criteria_weight_total)}</td>
                  <td className="px-3 py-2.5 text-center">{pending ? dash : points(momentGrade)}</td>
                  <td className="px-3 py-2.5 text-center">0–5</td>
                  <td className="px-3 py-2.5 text-center">{performance === null || pending ? dash : formatPercent(performance)}</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-center">{pending ? dash : formatPoints(m.contribution_to_total)}</td>
                </tr>
              </tbody>
            )
          })}
        </table>
      </div>

      <div role="status" aria-label="Nota final del proyecto" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE6F2] bg-sky-50 px-4 py-4 dark:border-[var(--color-border)] dark:bg-sky-500/10">
        <div>
          <p className="font-display text-[18px] font-extrabold text-[var(--color-secondary)]">Nota final del proyecto</p>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            {final !== null ? 'Suma de los aportes de los momentos evaluativos (notas publicadas).' : `Parcial: faltan actividades por calificar o publicar (${formatPoints(published.accumulated)} de ${GRADE_MAX.toFixed(1)} acumulados, ${formatPercent(published.evaluated_percent)} evaluado).`}
            {withDrafts !== null && final === null ? ` Con borradores sería ${formatPoints(withDrafts)}.` : ''}
          </p>
        </div>
        <span className={cn('inline-flex items-center gap-2 rounded-full px-5 py-2 font-display text-[22px] font-extrabold', final !== null ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300')}>
          {final !== null && <CheckCircle2 size={20} aria-hidden="true" />}
          {final !== null ? `${formatPoints(final)} / ${GRADE_MAX.toFixed(1)}` : dash}
        </span>
      </div>
      {report.official_final_grade && <p className="border-t border-[#DCE6F2] px-4 py-2.5 text-[12.5px] text-[var(--color-text-muted)] dark:border-[var(--color-border)]">Nota final oficial registrada por Coordinación: <strong className="text-[var(--color-text)]">{formatGradeOfScale(report.official_final_grade.final_grade)}</strong> ({report.official_final_grade.passed ? 'aprobado' : 'no aprobado'}).</p>}
    </section>
  )
}
