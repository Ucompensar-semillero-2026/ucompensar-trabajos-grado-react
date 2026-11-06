import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, ClipboardList, Gavel, Hourglass, Landmark, Scale } from 'lucide-react'
import { Card, EmptyState, MetricCard } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { processesApi, type ProcessOut } from '@/services/processes.service'
import { committeesApi, type CommitteeOut } from '@/services/committees.service'
import { LoadError } from '@/components/tutor/tutorUi'
import { daysSince } from '@/utils/format'
import { ChartCard, ChartEmpty, Donut, HBarList, type ChartDatum } from './charts'

// Estados donde la siguiente transición la decide el comité (backend: scripts/seed_workflow_config.py, rol consejo_facultad).
const AWAITING_COMMITTEE: Record<string, string> = {
  EN_REVISION_COMITE_FACULTAD: 'Revisión del comité de facultad',
  PRESENTADO_COMITE_GENERAL: 'Presentado al comité general',
  CALIFICACION_REGISTRADA: 'Calificado · posible mención',
}
const PENDING_LIMIT = 8

function countBy(items: ProcessOut[], key: (p: ProcessOut) => { key: string; label: string }): ChartDatum[] {
  const map = new Map<string, ChartDatum>()
  for (const p of items) {
    const k = key(p)
    const current = map.get(k.key)
    if (current) current.value += 1
    else map.set(k.key, { key: k.key, label: k.label, value: 1 })
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}

/** Panel del comité de grado: qué espera su decisión y cómo va el conjunto de trámites. */
export function CommitteeDashboard() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [processes, setProcesses] = useState<ProcessOut[] | null>(null)
  const [committees, setCommittees] = useState<CommitteeOut[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    setProcesses(null)
    // Los comités son un dato secundario: si fallan, el panel sigue.
    committeesApi.list(accessToken).then(setCommittees).catch(() => setCommittees([]))
    try {
      setProcesses(await processesApi.list(accessToken))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los trámites')
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <LoadError message={error} onRetry={() => void load()} />
  if (!processes) return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando el panel del comité…</p>

  const active = processes.filter((p) => !p.state.is_final_state)
  const finished = processes.length - active.length
  const pending = active
    .filter((p) => p.state.code in AWAITING_COMMITTEE)
    .map((p) => ({ process: p, waiting: daysSince(p.updated_at ?? p.created_at) }))
    .sort((a, b) => b.waiting - a.waiting)
  const byState = countBy(active, (p) => ({ key: p.state.code, label: p.state.name }))
  const byModality = countBy(processes, (p) => ({ key: p.modality.code, label: p.modality.name }))
  const activeCommittees = committees?.filter((c) => c.active).length

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Esperan decisión del comité"
          value={pending.length}
          sub={pending.length > 0 ? `El más antiguo lleva ${pending[0].waiting} días sin movimiento` : 'Nada pendiente'}
          subColor={pending.length > 0 ? 'var(--color-primary)' : undefined}
          icon={<Gavel size={16} />}
          to="/comites"
        />
        <MetricCard label="Trámites activos" value={active.length} sub="En curso en la facultad" icon={<ClipboardList size={16} />} />
        <MetricCard label="Finalizados" value={finished} sub="En estado final" icon={<BadgeCheck size={16} />} />
        <MetricCard label="Comités activos" value={activeCommittees ?? '—'} sub="Con sesiones y votaciones" icon={<Landmark size={16} />} to="/comites" />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]"><Hourglass size={18} aria-hidden /> Pendientes de decisión</h2>
          <Link to="/comites" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ir a sesiones y votaciones</Link>
        </div>
        {pending.length === 0 ? (
          <EmptyState icon={Scale} title="No hay trámites esperando al comité" description="Cuando un trámite llegue a revisión del comité, aparecerá aquí con los días que lleva sin movimiento." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {pending.slice(0, PENDING_LIMIT).map(({ process: p, waiting }) => (
              <li key={p.public_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[var(--color-text)]">{p.title?.trim() || p.process_code}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{p.student.full_name} · {p.modality.name}</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-[var(--color-text)]">
                    {AWAITING_COMMITTEE[p.state.code]} · <span className={waiting > 15 ? 'text-[var(--color-primary)]' : ''}>{waiting === 0 ? 'movido hoy' : `sin movimiento hace ${waiting} días`}</span>
                  </p>
                </div>
                <Link to={`/trazabilidad/${p.public_id}`} className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ver trámite</Link>
              </li>
            ))}
          </ul>
        )}
        {pending.length > PENDING_LIMIT && (
          <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">Mostrando {PENDING_LIMIT} de {pending.length}, los que llevan más tiempo sin movimiento primero.</p>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Trámites activos por estado" table={{ headers: ['Estado', 'Trámites'], rows: byState.map((s) => [s.label, s.value]) }}>
          {byState.length === 0 ? <ChartEmpty>No hay trámites activos.</ChartEmpty> : <HBarList data={byState} />}
        </ChartCard>
        <ChartCard title="Trámites por modalidad" table={{ headers: ['Modalidad', 'Trámites'], rows: byModality.map((m) => [m.label, m.value]) }}>
          {byModality.length === 0 ? <ChartEmpty>Aún no hay trámites registrados.</ChartEmpty> : <Donut data={byModality} centerLabel="trámites" />}
        </ChartCard>
      </div>
    </div>
  )
}
