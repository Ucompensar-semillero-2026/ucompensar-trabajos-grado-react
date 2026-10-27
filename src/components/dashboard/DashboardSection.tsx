import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { processesApi, type ProcessOut } from '@/services/processes.service'
import { formatRelativeDate, daysSince } from '@/utils/format'
import { AlertCircle, FileCheck2, BadgeCheck, History, Layers } from 'lucide-react'

const INACTIVITY_THRESHOLD_DAYS = 15
const MODALITY_COLORS = ['#FF6600', '#243455', '#00adba', '#f7a400', '#f7d8a4', '#a1a1aa']

export function DashboardSection() {
  const navigate = useNavigate()
  const accessToken = useAppStore((s) => s.accessToken)
  const [processes, setProcesses] = useState<ProcessOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    processesApi
      .list(accessToken)
      .then(setProcesses)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los trámites'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  const activos = processes.filter((p) => !p.state.is_final_state)
  const finalizados = processes.filter((p) => p.state.is_final_state)
  const inactivos = activos.filter((p) => daysSince(p.updated_at ?? p.created_at) > INACTIVITY_THRESHOLD_DAYS)

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

  const recientes = [...processes].sort(
    (a, b) =>
      new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()
  ).slice(0, 6)

  return (
    <div className="space-y-6 animate-in">
      {/* Alert banner -- solo aparece si hay trámites activos inactivos >15 días (RF21) */}
      {!isLoading && inactivos.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl px-5 py-4 bg-[var(--color-surface)] border-l-4 border-l-[var(--color-primary)] shadow-md">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0 text-white shadow-[0_0_15px_rgba(255,102,0,0.4)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-[18px] font-bold text-[var(--color-text)] tracking-tight">Atención inmediata requerida</h3>
            <p className="text-[13px] text-[var(--color-text-dim)]">
              Tienes <strong className="text-[var(--color-text)]">{inactivos.length} trámite{inactivos.length === 1 ? '' : 's'}</strong> que requiere{inactivos.length === 1 ? '' : 'n'} atención por inactividad prolongada (más de {INACTIVITY_THRESHOLD_DAYS} días).
            </p>
          </div>
          <button
            onClick={() => navigate('/tramites')}
            className="btn-primary px-5 py-2.5 text-[13px]"
          >
            Revisar ahora
          </button>
        </div>
      )}

      {error && (
        <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Trámites activos"
          value={isLoading ? '—' : activos.length}
          sub="En proceso actualmente"
          icon={<FileCheck2 size={16} className="text-[var(--color-primary)]" />}
        />
        <MetricCard
          label="Finalizados"
          value={isLoading ? '—' : finalizados.length}
          sub="Trámites en estado final"
          icon={<BadgeCheck size={16} className="text-[var(--color-teal)]" />}
        />
        <MetricCard
          label="Con alerta inactividad"
          value={isLoading ? '—' : inactivos.length}
          sub={<><AlertCircle size={12} className="mr-0.5" /> Más de {INACTIVITY_THRESHOLD_DAYS} días sin movimiento</>}
          subColor="var(--color-primary)"
          icon={<History size={16} className="text-[var(--color-text-dim)]" />}
        />
        <MetricCard
          label="Modalidades en uso"
          value={isLoading ? '—' : modalidadCounts.size}
          sub="Distintas modalidades activas"
          icon={<Layers size={16} className="text-[var(--color-text-dim)]" />}
        />
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        {/* Recent tramites table */}
        <div className="xl:col-span-2 card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] bg-transparent">
            <h2 className="text-[18px] font-bold text-[var(--color-text)] tracking-tight">Trámites recientes</h2>
            <button onClick={() => navigate('/tramites')} className="btn-ghost text-[11px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-transparent">
              Ver todos los trámites →
            </button>
          </div>
          <div className="overflow-x-auto scrollbar-premium flex-1">
            {isLoading ? (
              <p className="px-6 py-8 text-[12.5px] text-[var(--color-text-dim)]">Cargando trámites…</p>
            ) : recientes.length === 0 ? (
              <p className="px-6 py-8 text-[12.5px] text-[var(--color-text-dim)]">
                No hay trámites registrados todavía.
              </p>
            ) : (
              <table className="w-full border-collapse" style={{ minWidth: 500 }}>
                <thead>
                  <tr>
                    {['Estudiante', 'Código', 'Modalidad', 'Estado', 'Última act.'].map(h => (
                      <th key={h} className="th text-[9px] uppercase tracking-widest text-[var(--color-text-dim)] font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recientes.map(row => (
                    <tr
                      key={row.public_id}
                      className="cursor-pointer transition-colors group border-b border-[var(--color-border)]/50 last:border-0 hover:bg-[var(--color-bg)]/50"
                      onClick={() => navigate(`/trazabilidad/${row.public_id}`)}
                    >
                      <td className="td font-bold text-[13px] text-[var(--color-text)] group-hover:text-[var(--color-primary)] py-4">{row.student.full_name}</td>
                      <td className="td font-bold text-[12px] text-[var(--color-teal)] py-4">{row.process_code}</td>
                      <td className="td text-[var(--color-text-muted)] text-[12px] truncate max-w-[140px] py-4">{row.modality.name}</td>
                      <td className="td py-4"><StatusBadge status={row.state.code} /></td>
                      <td className="td text-[var(--color-text-dim)] font-medium text-[11px] whitespace-nowrap italic py-4">
                        {formatRelativeDate(row.updated_at ?? row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modality bars */}
        <div className="card p-6 flex flex-col">
          <h2 className="text-[18px] font-bold text-[var(--color-text)] mb-6 tracking-tight">Por modalidad</h2>
          <div className="space-y-6 flex-1">
            {isLoading ? (
              <p className="text-[12.5px] text-[var(--color-text-dim)]">Cargando…</p>
            ) : modalityBars.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-text-dim)]">Aún no hay trámites por modalidad.</p>
            ) : (
              modalityBars.map(bar => (
                <div key={bar.label} className="group">
                  <div className="flex justify-between mb-2">
                    <span className="text-[12px] font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors truncate pr-2">{bar.label}</span>
                    <span className="text-[12px] font-bold text-[var(--color-text)] tabular-nums flex-shrink-0">{bar.count}</span>
                  </div>
                  <div className="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden border border-[var(--color-border)]">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                      style={{ width: `${bar.pct}%`, background: bar.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 p-4 bg-[var(--color-bg)]/50 rounded-xl flex items-start gap-3 border border-[var(--color-border)]/50">
            <div className="mt-0.5 text-[var(--color-text-dim)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
              </svg>
            </div>
            <p className="text-[10px] text-[var(--color-text-dim)] leading-relaxed italic pr-2">
              Datos en vivo desde la API -- se actualizan cada vez que recargas el dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
