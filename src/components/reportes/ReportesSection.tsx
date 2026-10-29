import { useEffect, useState } from 'react'
import { Card, Button, MetricCard } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { processesApi, type ProcessOut } from '@/services/processes.service'
import { parseUtc, daysSince } from '@/utils/format'

const INACTIVITY_THRESHOLD_DAYS = 15
const NEGATIVE_FINAL_STATES = ['CANCELADO', 'REPROBADO']
const MODALITY_COLORS = ['#FF6600', '#243455', '#00adba', '#f7a400', '#f7d8a4', '#a1a1aa']

export function ReportesSection() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [processes, setProcesses] = useState<ProcessOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    processesApi
      .list(accessToken)
      .then(setProcesses)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los trámites'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  const finalizados = processes.filter((p) => p.state.is_final_state)
  const activos = processes.filter((p) => !p.state.is_final_state)
  const alertas = activos.filter((p) => daysSince(p.updated_at ?? p.created_at) > INACTIVITY_THRESHOLD_DAYS)

  const duraciones = finalizados
    .filter((p) => p.closed_at)
    .map((p) => (parseUtc(p.closed_at as string).getTime() - parseUtc(p.created_at).getTime()) / 86_400_000)
  const tiempoPromedio = duraciones.length
    ? `${Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)} días`
    : '—'

  const aprobados = finalizados.filter((p) => !NEGATIVE_FINAL_STATES.includes(p.state.code))
  const tasaAprobacion = finalizados.length ? `${Math.round((aprobados.length / finalizados.length) * 100)}%` : '—'

  const modalidadCounts = new Map<string, number>()
  for (const p of processes) {
    modalidadCounts.set(p.modality.name, (modalidadCounts.get(p.modality.name) ?? 0) + 1)
  }
  const modalityBars = Array.from(modalidadCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], i) => ({
      label,
      count,
      pct: processes.length ? Math.round((count / processes.length) * 100) : 0,
      color: MODALITY_COLORS[i % MODALITY_COLORS.length],
    }))

  return (
    <div className="animate-in space-y-6">
      {error && (
        <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Tiempo promedio" value={isLoading ? '—' : tiempoPromedio} sub="Radicación a cierre" />
        <MetricCard label="Tasa aprobación" value={isLoading ? '—' : tasaAprobacion} sub="Sobre trámites finalizados" />
        <MetricCard label="Trámites finalizados" value={isLoading ? '—' : finalizados.length} sub="En algún estado final" />
        <MetricCard label="Alertas activas" value={isLoading ? '—' : alertas.length} sub={`Más de ${INACTIVITY_THRESHOLD_DAYS} días sin movimiento`} subColor="var(--color-primary)" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-bg)]/30 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-[var(--color-text)] tracking-tight">Trámites por modalidad</h2>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">Distribución de trámites por tipo de trabajo de grado</p>
          </div>
          <Button variant="outline" size="sm" className="font-bold">Exportar Excel</Button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {isLoading ? (
            <p className="text-[12.5px] text-[var(--color-text-dim)]">Cargando…</p>
          ) : modalityBars.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-text-dim)]">Aún no hay trámites registrados.</p>
          ) : (
            modalityBars.map((bar) => (
              <div key={bar.label} className="flex items-center gap-4 group">
                <div className="text-[13px] text-[var(--color-text-muted)] min-w-[180px] font-medium group-hover:text-[var(--color-text)] transition-colors truncate">
                  {bar.label}
                </div>
                <div className="flex-1 h-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                    style={{ width: `${bar.pct}%`, backgroundColor: bar.color }}
                  />
                </div>
                <span className="text-[13px] font-bold text-[var(--color-text)] min-w-[24px] text-right tabular-nums">
                  {bar.count}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
