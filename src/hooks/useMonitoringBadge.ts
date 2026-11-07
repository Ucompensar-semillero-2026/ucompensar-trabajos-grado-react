import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { monitoringApi } from '@/services/monitoring.service'

const REFRESH_MS = 5 * 60 * 1000

/**
 * Número de ESTUDIANTES (no de tareas) que requieren seguimiento, para el indicador del menú. Lo calcula el backend;
 * si la consulta falla no se muestra ningún número (nunca uno inventado).
 */
export function useMonitoringBadge(enabled: boolean): number | null {
  const accessToken = useAppStore((s) => s.accessToken)
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled || !accessToken) {
      setCount(null)
      return
    }
    let cancelled = false
    const load = () =>
      monitoringApi
        .summary(accessToken)
        .then((s) => { if (!cancelled) setCount(s.needing_attention) })
        .catch(() => { if (!cancelled) setCount(null) })
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [enabled, accessToken])

  return count
}
