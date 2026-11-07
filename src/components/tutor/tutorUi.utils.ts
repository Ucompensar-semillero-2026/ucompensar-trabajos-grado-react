// Funciones y constantes de tutorUi.tsx que no son componentes (fast refresh de Vite).
import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { tutorApi, type PlanStatus, type TutorOverviewOut } from '@/services/tutor.service'


/** Carga el panel del tutor (proyectos donde es tutor ACTIVO, según el backend). Permite reintentar. */
export function useTutorOverview() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [data, setData] = useState<TutorOverviewOut | null>(null)
  const [status, setStatus] = useState<OverviewStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setStatus('loading')
    try {
      setData(await tutorApi.overview(accessToken))
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu panel')
      setStatus('error')
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  return { data, status, error, reload: load }
}

export function projectTitle(p: { title: string | null; process_code: string }): string {
  return p.title?.trim() || `Sin título registrado · ${p.process_code}`
}

export const PLAN_STATUS_META: Record<PlanStatus, { label: string; variant: 'gray' | 'orange' | 'green' }> = {
  sin_plan: { label: 'Sin plan', variant: 'gray' },
  borrador: { label: 'Borrador', variant: 'orange' },
  publicado: { label: 'Publicado', variant: 'green' },
}

export type OverviewStatus = 'loading' | 'ready' | 'error'
