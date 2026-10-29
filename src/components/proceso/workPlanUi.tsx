import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { processesApi, type ProcessOut } from '@/services/processes.service'
import { workPlanApi, type DeliverableOut, type DeliverableStatus, type StageOut, type WorkPlanOut } from '@/services/workplan.service'

export const STATUS_META: Record<DeliverableStatus, { label: string; variant: 'gray' | 'blue' | 'orange' | 'red' | 'green' }> = {
  pendiente: { label: 'Pendiente', variant: 'gray' },
  disponible: { label: 'Disponible para entregar', variant: 'blue' },
  en_revision: { label: 'En revisión', variant: 'orange' },
  requiere_correcciones: { label: 'Requiere correcciones', variant: 'red' },
  aprobado: { label: 'Aprobado', variant: 'green' },
}

export function DeliverableStatusBadge({ status }: { status: DeliverableStatus }) {
  const { label, variant } = STATUS_META[status]
  return <Badge variant={variant}>{label}</Badge>
}

/** Fechas `YYYY-MM-DD` del backend: se muestran como fecha de calendario, sin desfase de zona horaria. */
export function formatCalendarDate(value: string | null): string {
  if (!value) return 'Sin fecha definida'
  const [y, m, d] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d))
}

export function processLabel(p: ProcessOut): string {
  return p.title?.trim() || `${p.modality.name} · ${p.process_code}`
}

export function allDeliverables(plan: WorkPlanOut): DeliverableOut[] {
  return plan.stages.flatMap((s) => s.deliverables)
}

export function stagesBySemester(plan: WorkPlanOut): Array<{ semester: number; stages: StageOut[] }> {
  const groups = new Map<number, StageOut[]>()
  for (const stage of plan.stages) groups.set(stage.semester, [...(groups.get(stage.semester) ?? []), stage])
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([semester, stages]) => ({ semester, stages }))
}

export type PlanState = 'loading' | 'ready' | 'none' | 'error'

/**
 * Carga los procesos del estudiante y el plan del seleccionado. Si el estudiante tiene varios procesos
 * nunca se mezclan sus entregables: cada plan es de un único proceso. `none` = sin plan publicado (404).
 */
export function useStudentWorkPlan() {
  const accessToken = useAppStore((s) => s.accessToken)
  const currentUser = useAppStore((s) => s.currentUser)
  const [processes, setProcesses] = useState<ProcessOut[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [plan, setPlan] = useState<WorkPlanOut | null>(null)
  const [planState, setPlanState] = useState<PlanState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !currentUser) return
    let cancelled = false
    processesApi
      .list(accessToken)
      // El backend ya filtra por visibilidad: para un estudiante devuelve sus procesos y aquellos donde es
      // integrante verificado del equipo (p. ej. una propuesta grupal convertida en proceso).
      .then((mine) => {
        if (cancelled) return
        setProcesses(mine)
        setSelectedId((current) => current ?? mine[0]?.public_id ?? null)
        if (mine.length === 0) setPlanState('none')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus procesos')
        setPlanState('error')
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, currentUser])

  const loadPlan = useCallback(
    async (processId: string) => {
      if (!accessToken) return
      try {
        setPlan(await workPlanApi.get(accessToken, processId))
        setPlanState('ready')
        setError(null)
      } catch (err) {
        setPlan(null)
        if (err instanceof ApiError && err.status === 404) {
          setPlanState('none')
        } else {
          setError(err instanceof ApiError ? err.message : 'No se pudo cargar el plan de trabajo')
          setPlanState('error')
        }
      }
    },
    [accessToken]
  )

  useEffect(() => {
    if (!selectedId) return
    setPlanState('loading')
    void loadPlan(selectedId)
  }, [selectedId, loadPlan])

  const selected = useMemo(() => processes?.find((p) => p.public_id === selectedId) ?? null, [processes, selectedId])

  return {
    processes: processes ?? [],
    hasLoadedProcesses: processes !== null,
    selected,
    selectedId,
    setSelectedId,
    plan,
    planState: processes === null && planState !== 'error' ? ('loading' as PlanState) : planState,
    error,
    reload: () => (selectedId ? loadPlan(selectedId) : Promise.resolve()),
  }
}

export function ProcessSelector({
  processes,
  value,
  onChange,
}: {
  processes: ProcessOut[]
  value: string | null
  onChange: (id: string) => void
}) {
  if (processes.length < 2) return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
      <label htmlFor="process-selector" className="text-[13px] font-semibold text-[var(--color-text-muted)]">
        Proceso de grado
      </label>
      <select
        id="process-selector"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[260px] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]"
      >
        {processes.map((p) => (
          <option key={p.public_id} value={p.public_id}>
            {processLabel(p)}
          </option>
        ))}
      </select>
    </div>
  )
}
