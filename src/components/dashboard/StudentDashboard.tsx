import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, FileText, GraduationCap, Lightbulb, Upload } from 'lucide-react'
import { Card, EmptyState } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { calendarApi, type CalendarEvent } from '@/services/calendar.service'
import type { ProcessOut } from '@/services/processes.service'
import type { DeliverableOut, StageOut, WorkPlanOut } from '@/services/workplan.service'
import { DeliverableStatusBadge, ProcessSelector, STATUS_META, allDeliverables, formatCalendarDate, processLabel, useStudentWorkPlan } from '@/components/proceso/workPlanUi'
import { ChartCard, ChartEmpty, HBarList, ProgressRing } from './charts'

const UPCOMING_LIMIT = 4
const CALENDAR_LIMIT = 4

type StageStep = { stage: StageOut; state: 'hecha' | 'actual' | 'pendiente'; approved: number; total: number }

const counts = (d: DeliverableOut) => d.active && d.applicable && d.mandatory

/** Etapas en orden con su estado: la primera sin terminar es la actual. */
function stageSteps(plan: WorkPlanOut): StageStep[] {
  const stages = plan.stages.filter((s) => s.active).sort((a, b) => a.semester - b.semester || a.sort_order - b.sort_order)
  let currentFound = false
  return stages.map((stage) => {
    const required = stage.deliverables.filter(counts)
    const approved = required.filter((d) => d.status === 'aprobado').length
    const done = required.length > 0 && approved === required.length
    let state: StageStep['state'] = 'pendiente'
    if (done) state = 'hecha'
    else if (!currentFound) {
      state = 'actual'
      currentFound = true
    }
    return { stage, state, approved, total: required.length }
  })
}

/** Etiqueta del estado general, siempre con ícono y texto (nunca solo color). */
function planHealth(plan: WorkPlanOut) {
  const { overdue, needs_corrections } = plan.progress
  if (plan.official_completion) return { text: 'Proceso finalizado', icon: CheckCircle2, className: 'bg-[var(--color-teal-soft)] text-[var(--color-text)]' }
  if (overdue > 0) return { text: `${overdue} entrega${overdue === 1 ? '' : 's'} vencida${overdue === 1 ? '' : 's'}`, icon: AlertTriangle, className: 'bg-[var(--color-primary-soft)] text-[var(--color-text)]' }
  if (needs_corrections > 0) return { text: `${needs_corrections} con correcciones`, icon: AlertTriangle, className: 'bg-[var(--color-amber-soft)] text-[var(--color-text)]' }
  return { text: 'Al día', icon: CheckCircle2, className: 'bg-[var(--color-teal-soft)] text-[var(--color-text)]' }
}

function eventDate(e: CalendarEvent) {
  if (!e.starts_at) return 'Fecha por confirmar'
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(e.starts_at))
}

/** Próximas fechas del calendario académico publicado que aplican a la modalidad del estudiante. */
function useUpcomingEvents(process: ProcessOut | null) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  const modalityCode = process?.modality.code
  useEffect(() => {
    let cancelled = false
    calendarApi
      .events()
      .then(({ items }) => {
        if (cancelled) return
        const relevant = items
          .filter((e) => e.timeline === 'proximo' || e.timeline === 'en_curso')
          .filter((e) => e.applies_to_all_modalities || e.modalities.some((m) => m.code === modalityCode))
          .sort((a, b) => (a.starts_at ?? '9999').localeCompare(b.starts_at ?? '9999'))
        setEvents(relevant.slice(0, CALENDAR_LIMIT))
      })
      .catch(() => !cancelled && setEvents([]))
    return () => {
      cancelled = true
    }
  }, [modalityCode])
  return events
}

export function StudentDashboard() {
  const user = useAppStore((s) => s.currentUser)
  const { processes, selected, selectedId, setSelectedId, plan, planState, error } = useStudentWorkPlan()
  const events = useUpcomingEvents(selected)
  const firstName = user?.name.split(' ')[0] ?? ''

  if (planState === 'loading') return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando tu proceso de grado…</p>
  if (planState === 'error') {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
  }

  if (processes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={GraduationCap}
          title={`Hola${firstName ? `, ${firstName}` : ''}. Aún no tienes un proceso de grado`}
          description="Explora las opciones de grado o envía tu propia propuesta. Cuando inicie tu proceso, aquí verás tu avance, tus entregas y las fechas importantes."
          action={
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/proyectos-de-grado" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ver opciones de grado</Link>
              <Link to="/mis-propuestas" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Mis propuestas</Link>
            </div>
          }
        />
      </Card>
    )
  }

  const header = (
    <header>
      <h1 className="text-[26px] font-bold text-[var(--color-text)]">Hola{firstName ? `, ${firstName}` : ''}</h1>
      {selected && (
        <p className="mt-1 text-[13.5px] text-[var(--color-text-muted)]">
          {processLabel(selected)} · {selected.modality.name} · Estado: <strong className="text-[var(--color-text)]">{selected.state.name}</strong>
        </p>
      )}
    </header>
  )

  const calendarCard = (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]"><CalendarDays size={18} aria-hidden /> Fechas importantes</h2>
        <Link to="/proyectos-de-grado#calendario" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ver calendario</Link>
      </div>
      {events === null ? (
        <ChartEmpty>Cargando…</ChartEmpty>
      ) : events.length === 0 ? (
        <ChartEmpty>No hay fechas próximas publicadas para tu modalidad.</ChartEmpty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-xl border border-[var(--color-border)] p-3.5 text-[13px]">
              <p className="font-bold text-[var(--color-text)]">{eventDate(e)}{e.date_kind === 'tentativa' ? ' (tentativa)' : ''}</p>
              <p className="text-[var(--color-text-muted)]">{e.title}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )

  if (planState === 'none' || !plan) {
    return (
      <div className="flex flex-col gap-5">
        <ProcessSelector processes={processes} value={selectedId} onChange={setSelectedId} />
        {header}
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Tu tutor aún no ha publicado el plan de trabajo"
            description="Cuando lo publique, aquí verás tu avance, tus próximas entregas y el estado de cada etapa."
            action={<Link to="/mi-proceso" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ver mi proceso</Link>}
          />
        </Card>
        {calendarCard}
      </div>
    )
  }

  const { progress } = plan
  const health = planHealth(plan)
  const steps = stageSteps(plan)
  const current = steps.find((s) => s.state === 'actual')
  const deliverables = allDeliverables(plan).filter((d) => d.active && d.applicable)
  const upcoming = deliverables
    .filter((d) => d.status === 'disponible' || d.status === 'requiere_correcciones')
    .sort((a, b) => Number(b.is_overdue) - Number(a.is_overdue) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    .slice(0, UPCOMING_LIMIT)
  const byStatus = (Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>)
    .map((status) => ({ key: status, label: STATUS_META[status].label, value: deliverables.filter((d) => d.status === status).length }))
    .filter((d) => d.value > 0)

  return (
    <div className="flex flex-col gap-5">
      <ProcessSelector processes={processes} value={selectedId} onChange={setSelectedId} />
      {header}

      <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <ProgressRing percent={progress.total_required === 0 ? null : progress.percent} label="Avance de tu plan" />
            <div className="min-w-[160px] flex-1">
              <h2 className="text-[18px] font-bold text-[var(--color-text)]">Avance de tu plan</h2>
              <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                {progress.total_required === 0 ? 'Aún no hay entregables obligatorios.' : `${progress.approved} de ${progress.total_required} entregables obligatorios aprobados`}
              </p>
              <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${health.className}`}>
                <health.icon size={13} aria-hidden /> {health.text}
              </p>
              <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
                Fecha objetivo: <strong className="text-[var(--color-text)]">{formatCalendarDate(plan.target_end_date)}</strong>
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-[18px] font-bold text-[var(--color-text)]">Etapas de tu plan</h2>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
            {current ? <>Estás en: <strong className="text-[var(--color-text)]">{current.stage.name}</strong></> : steps.length > 0 ? 'Completaste todas las etapas.' : 'El plan no tiene etapas activas.'}
          </p>
          <ol className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, steps.length)}, minmax(0, 1fr))` }}>
            {steps.map((s) => (
              <li key={s.stage.public_id} className="min-w-0 text-center text-[12px]" aria-current={s.state === 'actual' ? 'step' : undefined}>
                <div className="h-1.5 rounded-full" style={{ background: s.state === 'hecha' ? 'var(--color-secondary)' : s.state === 'actual' ? 'var(--color-primary)' : 'var(--color-border)' }} />
                <p className={`mt-2 truncate font-semibold ${s.state === 'actual' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`} title={s.stage.name}>{s.stage.name}</p>
                <p className="text-[var(--color-text-muted)]">
                  {s.state === 'hecha' ? 'Completada' : s.total === 0 ? 'Sin entregables' : `${s.approved}/${s.total} aprobados`}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]"><CalendarClock size={18} aria-hidden /> Lo que te toca ahora</h2>
            <Link to="/mi-proceso" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ver plan completo</Link>
          </div>
          {upcoming.length === 0 ? (
            <ChartEmpty>No tienes entregas pendientes por ahora.</ChartEmpty>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {upcoming.map((d) => (
                <li key={d.public_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[var(--color-text)]">{d.title}</p>
                    <p className={`text-[12px] ${d.is_overdue ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                      {d.is_overdue ? 'Vencida · ' : d.status === 'requiere_correcciones' ? 'Tu tutor pidió ajustes · ' : 'Fecha límite · '}
                      {formatCalendarDate(d.due_date)}
                    </p>
                  </div>
                  {d.can_submit ? (
                    <Link to="/documentos" className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px]">
                      <Upload size={14} aria-hidden /> Subir entrega
                    </Link>
                  ) : (
                    <DeliverableStatusBadge status={d.status} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <ChartCard
          title="Tus entregables"
          subtitle="Estado de todos los entregables del plan"
          table={{ headers: ['Estado', 'Entregables'], rows: byStatus.map((s) => [s.label, s.value]) }}
        >
          {byStatus.length === 0 ? <ChartEmpty>El plan aún no tiene entregables.</ChartEmpty> : <HBarList data={byStatus} unit="entregables" />}
          <Link to="/documentos" className="mt-4 inline-flex items-center gap-2 px-2 text-[13px] font-bold text-[#0876B9] underline underline-offset-4">
            <FileText size={15} aria-hidden /> Ir a Documentos y entregables
          </Link>
        </ChartCard>
      </div>

      {calendarCard}

      <p className="flex items-start gap-2 text-[12px] text-[var(--color-text-muted)]">
        <Lightbulb size={14} className="mt-0.5 flex-shrink-0" aria-hidden />
        El avance cuenta solo entregables obligatorios aprobados por tu tutor. Subir un archivo no suma hasta que se apruebe.
      </p>
    </div>
  )
}
