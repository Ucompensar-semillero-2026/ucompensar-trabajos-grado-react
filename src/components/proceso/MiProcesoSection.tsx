import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, FileText, GraduationCap, History } from 'lucide-react'
import { Badge, Card, EmptyState } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { processesApi, type ProcessHistoryOut } from '@/services/processes.service'
import { formatRelativeDate } from '@/utils/format'
import {
  DeliverableStatusBadge,
  ProcessSelector,
  allDeliverables,
  formatCalendarDate,
  processLabel,
  stagesBySemester,
  useStudentWorkPlan,
} from './workPlanUi'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">{value}</dd>
    </div>
  )
}

export function MiProcesoSection() {
  const accessToken = useAppStore((s) => s.accessToken)
  const { processes, selected, selectedId, setSelectedId, plan, planState, error } = useStudentWorkPlan()
  const [history, setHistory] = useState<ProcessHistoryOut[]>([])

  useEffect(() => {
    if (!accessToken || !selectedId) return
    let cancelled = false
    processesApi
      .history(accessToken, selectedId)
      .then((h) => !cancelled && setHistory(h))
      .catch(() => !cancelled && setHistory([]))
    return () => {
      cancelled = true
    }
  }, [accessToken, selectedId])

  if (planState === 'loading') {
    return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando tu proceso…</p>
  }

  if (planState === 'error') {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
        {error}
      </p>
    )
  }

  if (processes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={GraduationCap}
          title="Aún no tienes un proceso de grado activo"
          description="Cuando te postules a una oferta o inicies un trámite, aquí verás tu plan de trabajo, tus fechas y tu avance."
          action={
            <Link to="/tramites" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">
              Ir a Mis trámites
            </Link>
          }
        />
      </Card>
    )
  }

  if (planState === 'none' || !plan) {
    return (
      <>
        <ProcessSelector processes={processes} value={selectedId} onChange={setSelectedId} />
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Tu tutor aún no ha publicado el plan de trabajo"
            description={`Para «${selected ? processLabel(selected) : 'tu proceso'}» todavía no hay etapas ni fechas publicadas. Cuando tu tutor las confirme, aparecerán aquí.`}
            action={
              <Link to="/tramites" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">
                Ver Mis trámites
              </Link>
            }
          />
        </Card>
      </>
    )
  }

  const { progress } = plan
  const upcoming = allDeliverables(plan)
    .filter((d) => d.due_date && (d.status === 'disponible' || d.status === 'requiere_correcciones'))
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-5">
      <ProcessSelector processes={processes} value={selectedId} onChange={setSelectedId} />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[22px] font-bold text-[var(--color-secondary)]">
              {plan.process_title?.trim() || (selected ? processLabel(selected) : 'Proyecto de grado')}
            </h2>
            {selected && (
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                {selected.modality.name} · {selected.process_code}
              </p>
            )}
          </div>
          <Badge variant={plan.official_completion ? 'green' : 'blue'}>
            {plan.official_completion ? 'Proceso finalizado oficialmente' : 'Proceso en curso'}
          </Badge>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <Fact label="Estado del proceso" value={plan.process_state_name} />
          <Fact label="Fecha de inicio" value={formatCalendarDate(plan.start_date)} />
          <Fact label="Fecha objetivo de finalización" value={formatCalendarDate(plan.target_end_date)} />
        </dl>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold text-[var(--color-text)]">Avance de entregables aprobados</p>
            <p className="font-display text-[22px] font-extrabold text-[var(--color-secondary)]">
              {progress.total_required === 0 ? '—' : `${progress.percent}%`}
            </p>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            aria-label="Avance de entregables obligatorios aprobados"
            className="h-3 overflow-hidden rounded-full bg-[var(--color-secondary-soft)]"
          >
            <div className="h-full rounded-full bg-[#FF6500] transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
            {progress.total_required === 0
              ? 'Aún no hay entregables obligatorios publicados.'
              : `${progress.approved} de ${progress.total_required} entregables obligatorios aprobados por tu tutor. Subir un archivo no suma al avance hasta que se apruebe.`}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2 text-[12px]">
            <li><Badge variant="orange">En revisión: {progress.pending_review}</Badge></li>
            <li><Badge variant="red">Con correcciones: {progress.needs_corrections}</Badge></li>
            <li><Badge variant={progress.overdue ? 'red' : 'gray'}>Vencidos: {progress.overdue}</Badge></li>
          </ul>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]">
            <CalendarClock size={18} aria-hidden /> Próximas entregas
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">No hay entregas con fecha pendiente.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {upcoming.map((d) => (
                <li key={d.public_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--color-text)]">{d.title}</p>
                    <p className={`text-[12px] ${d.is_overdue ? 'font-semibold text-red-600' : 'text-[var(--color-text-muted)]'}`}>
                      {d.is_overdue ? 'Vencida · ' : 'Fecha límite · '}
                      {formatCalendarDate(d.due_date)}
                    </p>
                  </div>
                  <DeliverableStatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/documentos" className="mt-4 inline-flex items-center gap-2 text-[13px] font-bold text-[#0876B9] underline underline-offset-4">
            <FileText size={15} aria-hidden /> Ir a Documentos y entregables
          </Link>
        </Card>

        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]">
            <History size={18} aria-hidden /> Historial del proceso
          </h3>
          {history.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">Sin movimientos registrados.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {history.map((h) => (
                <li key={h.public_id} className="border-l-2 border-[#0876B9] pl-3">
                  <p className="text-[13px] font-semibold text-[var(--color-text)]">
                    {h.previous_state ? `${h.previous_state.name} → ` : ''}
                    {h.new_state.name}
                  </p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{formatRelativeDate(h.event_date)}</p>
                  {h.comment && <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{h.comment}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {stagesBySemester(plan).map(({ semester, stages }) => (
        <section key={semester} aria-labelledby={`semestre-${semester}`}>
          <h3 id={`semestre-${semester}`} className="mb-3 text-[20px] font-bold text-[var(--color-secondary)]">
            Semestre {semester}
          </h3>
          <div className="flex flex-col gap-4">
            {stages.map((stage) => (
              <Card key={stage.public_id}>
                <h4 className="text-[17px] font-bold text-[var(--color-text)]">{stage.name}</h4>
                {stage.description && <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{stage.description}</p>}
                <ul className="mt-3 divide-y divide-[var(--color-border)]">
                  {stage.deliverables.map((d) => (
                    <li key={d.public_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[14px] text-[var(--color-text)]">
                          {d.title} {!d.mandatory && <span className="text-[12px] text-[var(--color-text-muted)]">(opcional)</span>}
                          {!d.applicable && <span className="text-[12px] text-[var(--color-text-muted)]"> · No aplica</span>}
                        </p>
                        <p className="text-[12px] text-[var(--color-text-muted)]">{formatCalendarDate(d.due_date)}</p>
                      </div>
                      <DeliverableStatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
