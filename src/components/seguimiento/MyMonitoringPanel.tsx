import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui'
import { LoadError } from '@/components/tutor/tutorUi'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { monitoringApi, type MyMonitoring } from '@/services/monitoring.service'
import { CommitmentManager } from './CommitmentManager'
import { GroupRiskBanner, RiskLevelBadge } from './monitoringUi'
import { TaskComplianceTimeline } from './TaskComplianceTimeline'

/** Lo que ve el estudiante: sus tareas y fechas (con ampliaciones), sus compromisos y un aviso grupal genérico. */
export function MyMonitoringPanel() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [data, setData] = useState<MyMonitoring | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    setError(null)
    monitoringApi.mine(accessToken).then(setData).catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu seguimiento.'))
  }, [accessToken])
  useEffect(load, [load])

  if (error) return <LoadError message={error} onRetry={load} />
  if (!data) return <p role="status" className="text-[13px] text-[var(--color-text-muted)]">Cargando tus fechas…</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3"><p className="text-[13.5px] text-[var(--color-text-muted)]">Tu nivel de seguimiento:</p><RiskLevelBadge level={data.level} /></div>
      {data.group_alerts.filter((a) => a.active).map((a) => <GroupRiskBanner key={a.process_id} alert={a} />)}
      <Card className="p-5"><h3 className="mb-3 font-display text-[17px] font-bold text-[var(--color-secondary)]">Tus tareas y fechas límite</h3><TaskComplianceTimeline tasks={data.tasks} /></Card>
      <Card className="p-5"><h3 className="mb-3 font-display text-[17px] font-bold text-[var(--color-secondary)]">Tus compromisos</h3><CommitmentManager commitments={data.commitments} /></Card>
    </div>
  )
}
