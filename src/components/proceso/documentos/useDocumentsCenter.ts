import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { monitoringApi, type MyMonitoring } from '@/services/monitoring.service'
import { workPlanApi, type SubmissionOut, type WorkPlanOut } from '@/services/workplan.service'
import { allDeliverables, useStudentWorkPlan } from '../workPlanUi.utils'
import type { DraftMap, HistoryMap } from './documentosHelpers'
import { normalizePlanDates } from './planDates'

/**
 * Datos COMPARTIDOS por «Documentos y entregables» y «Mis fechas y compromisos», todos desde los servicios existentes:
 * - plan, procesos y progreso: `useStudentWorkPlan` (GET /processes y /work-plan);
 * - fechas efectivas y ampliaciones: GET /monitoring/me (el plan se normaliza con ellas: ver `planDates.ts`);
 * - borradores privados: GET …/draft de los entregables que todavía puede entregar (solo el autor los ve);
 * - versiones oficiales: GET …/submissions de los entregables que ya tienen entregas.
 * Un fallo en borradores, historial o seguimiento no impide ver el plan: esas secciones avisan y el resto sigue operativo
 * (sin seguimiento se usan las fechas originales del plan, que es lo único que se sabe).
 */
export function useDocumentsCenter() {
  const base = useStudentWorkPlan()
  const accessToken = useAppStore((s) => s.accessToken)
  const { plan: rawPlan, selectedId } = base
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [history, setHistory] = useState<HistoryMap>({})
  const [auxState, setAuxState] = useState<'loading' | 'ready' | 'partial'>('loading')
  const [monitoring, setMonitoring] = useState<MyMonitoring | null>(null)
  const [monitoringState, setMonitoringState] = useState<'loading' | 'ready' | 'error'>('loading')

  const loadAux = useCallback(
    async (current: WorkPlanOut, processId: string, stale: () => boolean) => {
      if (!accessToken) return
      const items = allDeliverables(current).filter((d) => d.active)
      const [draftResults, historyResults] = await Promise.all([
        Promise.allSettled(items.filter((d) => d.can_submit).map(async (d) => [d.public_id, Boolean((await workPlanApi.draftWorkspace(accessToken, processId, d.public_id)).current_draft)] as const)),
        Promise.allSettled(items.filter((d) => d.submissions_count > 0).map(async (d) => [d.public_id, await workPlanApi.listSubmissions(accessToken, processId, d.public_id)] as const)),
      ])
      if (stale()) return // el plan cambió mientras se cargaba: no se mezclan datos de otro proceso
      const ok = <T,>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> => r.status === 'fulfilled'
      setDrafts(Object.fromEntries(draftResults.filter(ok).map((r): [string, boolean] => [r.value[0], r.value[1]])))
      setHistory(Object.fromEntries(historyResults.filter(ok).map((r): [string, SubmissionOut[]] => [r.value[0], r.value[1]])))
      setAuxState([...draftResults, ...historyResults].some((r) => r.status === 'rejected') ? 'partial' : 'ready')
    },
    [accessToken]
  )

  useEffect(() => {
    if (!rawPlan || !selectedId) return
    let cancelled = false
    setAuxState('loading')
    void loadAux(rawPlan, selectedId, () => cancelled).catch(() => { if (!cancelled) setAuxState('partial') })
    return () => { cancelled = true }
  }, [rawPlan, selectedId, loadAux])

  // El seguimiento es del estudiante (todos sus procesos); se vuelve a pedir cuando el plan cambia (p. ej. tras una entrega).
  useEffect(() => {
    if (!accessToken || !rawPlan) return
    let cancelled = false
    monitoringApi
      .mine(accessToken)
      .then((data) => { if (!cancelled) { setMonitoring(data); setMonitoringState('ready') } })
      .catch(() => { if (!cancelled) setMonitoringState('error') })
    return () => { cancelled = true }
  }, [accessToken, rawPlan])

  const dated = useMemo(() => (rawPlan ? normalizePlanDates(rawPlan, monitoring?.tasks ?? []) : null), [rawPlan, monitoring])

  return {
    ...base,
    /** Plan con fechas efectivas y `is_overdue` coherente (el que deben usar las vistas). */
    plan: dated?.plan ?? null,
    originalDue: dated?.originalDue ?? {},
    tasks: dated?.tasks ?? {},
    monitoring,
    monitoringState,
    drafts,
    history,
    auxState,
  }
}

export type DocumentsCenterData = ReturnType<typeof useDocumentsCenter>
