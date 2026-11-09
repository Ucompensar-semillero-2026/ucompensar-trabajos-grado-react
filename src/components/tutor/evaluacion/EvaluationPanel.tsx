import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { evaluationApi, type EvaluationOut } from '@/services/evaluation.service'
import { workPlanApi } from '@/services/workplan.service'
import { allDeliverables } from '@/components/proceso/workPlanUi.utils'
import { formatShortDate } from '@/components/proceso/documentos/documentosHelpers'
import type { WorkPlanOut } from '@/services/workplan.service'
import { LoadError } from '../tutorUi'
import { EvaluationConfigCard } from './EvaluationConfigCard'
import { EvaluationConfigEditor } from './EvaluationConfigEditor'
import { EvaluationGradebook, EvaluationSummaryCard } from './EvaluationGrading'
import { ProjectSummaryCard } from './ProjectSummaryCard'
import type { DeliverableOption } from './evaluationDraft'

/** Entregables ACTIVOS del plan de este proyecto, con su etapa y fecha límite, listos para asociarlos a un momento. */
function planOptions(plan: WorkPlanOut): DeliverableOption[] {
  const stageName = new Map(plan.stages.map((s) => [s.public_id, s.name]))
  return allDeliverables(plan)
    .filter((d) => d.active)
    .map((d) => {
      const parts = [stageName.get(d.stage_public_id), d.due_date ? `vence ${formatShortDate(d.due_date)}` : null].filter(Boolean)
      return { value: d.public_id, label: d.title, detail: parts.length ? parts.join(' · ') : undefined }
    })
}

/**
 * Evaluación de un proyecto de grado (pestaña «Evaluación» del expediente): una sola pantalla con la configuración general (porcentaje de
 * cada momento), el resumen de calificación y el libro de calificaciones del proyecto. Las notas no se ponen aquí: se registran en la
 * ventana «Revisión de entrega»; los entregables y sus fechas se administran en «Plan de trabajo y entregables». Todo viene del backend.
 */
export function EvaluationPanel({ processId }: { processId: string }) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [report, setReport] = useState<EvaluationOut | null>(null)
  const [deliverables, setDeliverables] = useState<DeliverableOption[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const load = useMemo(
    () => async () => {
      if (!accessToken) return
      setState('loading')
      try {
        const [evaluation, workPlan] = await Promise.all([
          evaluationApi.get(accessToken, processId),
          workPlanApi.get(accessToken, processId).catch(() => null), // sin plan todavía: simplemente no hay entregables que asociar
        ])
        setReport(evaluation)
        setDeliverables(workPlan ? planOptions(workPlan) : [])
        setState('ready')
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la evaluación del proyecto.')
        setState('error')
      }
    },
    [accessToken, processId]
  )

  useEffect(() => { void load() }, [load])

  if (state === 'loading' && !report) return <p role="status" className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando evaluación…</p>
  if (state === 'error' || !report) return <LoadError message={error} onRetry={() => void load()} />

  const reportLink = (
    <Link
      to={`/documentos/reporte-notas?proceso=${processId}`}
      className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#0E6B9C] underline-offset-4 hover:underline dark:text-sky-300"
    >
      <BarChart3 size={15} aria-hidden="true" />
      Ver el libro de calificaciones del proyecto
    </Link>
  )

  if (!report.can_configure && !report.can_grade) {
    return (
      <div className="flex flex-col gap-4">
        <ProjectSummaryCard report={report} />
        <p role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
          Vista de consulta: solo el tutor o un evaluador asignado califica este proyecto y solo el tutor o Coordinación configura la evaluación.
        </p>
        <div>{reportLink}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <EvaluationConfigCard
          processId={processId}
          report={report}
          deliverables={deliverables}
          onReport={setReport}
          advancedOpen={advancedOpen}
          onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
        />
        <EvaluationSummaryCard processId={processId} report={report} />
      </div>

      {advancedOpen && report.can_configure && (
        <section aria-label="Actividades y ponderaciones de cada momento">
          <EvaluationConfigEditor processId={processId} report={report} deliverables={deliverables} onReport={setReport} />
        </section>
      )}

      <EvaluationGradebook report={report} />
      <div>{reportLink}</div>
    </div>
  )
}
