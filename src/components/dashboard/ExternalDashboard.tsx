import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Building2, CalendarClock, ClipboardList, FileSignature, Handshake } from 'lucide-react'
import { Card, EmptyState, MetricCard } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { processesApi, type ProcessOut } from '@/services/processes.service'
import { externalApi, type ExternalEntityOut } from '@/services/external.service'
import { workPlanApi, type WorkPlanOut } from '@/services/workplan.service'
import { LoadError } from '@/components/tutor/tutorUi'
import { allDeliverables, formatCalendarDate } from '@/components/proceso/workPlanUi'

// Para no disparar demasiadas consultas: el plan se pide solo para los primeros proyectos.
const PLAN_LIMIT = 10

interface ProjectRow {
  process: ProcessOut
  plan: WorkPlanOut | null
}

function nextDue(plan: WorkPlanOut | null) {
  if (!plan) return null
  return allDeliverables(plan)
    .filter((d) => d.active && d.applicable && d.due_date && d.status !== 'aprobado')
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))[0] ?? null
}

/** Panel de una persona externa (empresa, comunidad, jurado): solo los trámites en los que participa. */
export function ExternalDashboard() {
  const accessToken = useAppStore((s) => s.accessToken)
  const user = useAppStore((s) => s.currentUser)
  const [rows, setRows] = useState<ProjectRow[] | null>(null)
  const [entities, setEntities] = useState<ExternalEntityOut[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    setRows(null)
    externalApi.listEntities(accessToken).then(setEntities).catch(() => setEntities([]))
    try {
      const processes = await processesApi.list(accessToken)
      // El plan solo existe si el tutor lo publicó; un 404 o 403 no es un error del panel.
      const plans = await Promise.allSettled(processes.slice(0, PLAN_LIMIT).map((p) => workPlanApi.get(accessToken, p.public_id)))
      setRows(processes.map((process, i) => ({ process, plan: plans[i]?.status === 'fulfilled' ? plans[i].value : null })))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus proyectos')
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <LoadError message={error} onRetry={() => void load()} />
  if (!rows) return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando tus proyectos…</p>

  const firstName = user?.name.split(' ')[0] ?? ''
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Handshake}
          title={`Hola${firstName ? `, ${firstName}` : ''}. Aún no participas en ningún proyecto`}
          description="La coordinación debe vincularte a un trabajo de grado (por ejemplo, como jurado o representante de la entidad aliada). Cuando lo haga, aquí verás su estado y avance."
        />
      </Card>
    )
  }

  const active = rows.filter((r) => !r.process.state.is_final_state)

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[26px] font-bold text-[var(--color-text)]">Hola{firstName ? `, ${firstName}` : ''}</h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-text-muted)]">
          Proyectos de grado en los que participas{entities.length > 0 ? ` · ${entities.map((e) => e.name).join(', ')}` : ''}.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Proyectos" value={rows.length} sub="En los que participas" icon={<ClipboardList size={16} />} />
        <MetricCard label="En curso" value={active.length} sub="Sin cerrar" icon={<CalendarClock size={16} />} />
        <MetricCard label="Finalizados" value={rows.length - active.length} sub="En estado final" icon={<BadgeCheck size={16} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {rows.map(({ process: p, plan }) => {
          const due = nextDue(plan)
          return (
            <Card key={p.public_id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-[17px] font-bold text-[var(--color-text)]">{p.title?.trim() || p.process_code}</h2>
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">{p.student.full_name} · {p.modality.name}</p>
                </div>
                <span className="rounded-full bg-[var(--color-secondary-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text)]">{p.state.name}</span>
              </div>

              {plan ? (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
                    <span className="text-[var(--color-text-muted)]">Avance del plan</span>
                    <span className="font-bold tabular-nums text-[var(--color-text)]">
                      {plan.progress.total_required === 0 ? '—' : `${plan.progress.percent}% · ${plan.progress.approved}/${plan.progress.total_required}`}
                    </span>
                  </div>
                  <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={plan.progress.percent} aria-label={`Avance de ${p.student.full_name}`} className="h-2 rounded-full bg-[var(--color-bg)]">
                    <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${plan.progress.percent}%` }} />
                  </div>
                  <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">
                    {due ? (
                      <>Próxima entrega: <strong className="text-[var(--color-text)]">{due.title}</strong> · {due.is_overdue ? <span className="font-semibold text-[var(--color-primary)]">vencida ({formatCalendarDate(due.due_date)})</span> : formatCalendarDate(due.due_date)}</>
                    ) : (
                      'Sin entregas pendientes con fecha.'
                    )}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-[12.5px] text-[var(--color-text-muted)]">El plan de trabajo aún no está publicado.</p>
              )}

              <Link to={`/trazabilidad/${p.public_id}`} className="mt-4 inline-block text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ver trazabilidad</Link>
            </Card>
          )
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-info-soft,rgba(8,118,185,0.1))] text-[#0876B9]">
              {entities.length > 0 ? <Building2 size={18} aria-hidden /> : <FileSignature size={18} aria-hidden />}
            </span>
            <div>
              <p className="text-[15px] font-bold text-[var(--color-text)]">Avales de entidades externas</p>
              <p className="text-[12.5px] text-[var(--color-text-muted)]">Consulta los avales registrados para tus proyectos.</p>
            </div>
          </div>
          <Link to="/externo" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ir a avales</Link>
        </div>
      </Card>
    </div>
  )
}
