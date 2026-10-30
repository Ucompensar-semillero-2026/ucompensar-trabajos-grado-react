import { Link } from 'react-router-dom'
import { AlertCircle, BarChart3, CalendarClock, ClipboardList, FileCheck2, Gauge, GraduationCap, Hourglass, Users } from 'lucide-react'
import { Badge, Card, EmptyState, MetricCard } from '@/components/ui'
import { formatRelativeDate } from '@/utils/format'
import { ChartCard, ChartEmpty, HBarList } from '@/components/dashboard/charts'
import { formatCalendarDate, STATUS_META } from '@/components/proceso/workPlanUi'
import type { DeliverableStatus } from '@/services/workplan.service'
import type { TutorOverviewOut } from '@/services/tutor.service'
import {
  LoadError,
  PlanStatusBadge,
  ProgressBar,
  ProjectsTable,
  projectTitle,
  useTutorOverview,
} from './tutorUi'

function Loading() {
  return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando tus proyectos…</p>
}

const NO_PROJECTS = {
  icon: GraduationCap,
  title: 'Aún no tienes proyectos asignados',
  description:
    'Ser docente no asigna proyectos por sí solo: coordinación o administración debe registrarte como tutor de un proceso. Cuando ocurra, aparecerá aquí.',
}

/** Estados comunes: cargando, error con reintento y sin proyectos. Devuelve null si hay datos. */
function useGate() {
  const overview = useTutorOverview()
  const { data, status, error, reload } = overview
  let gate: React.ReactNode = null
  if (status === 'loading' && !data) gate = <Loading />
  else if (status === 'error') gate = <LoadError message={error} onRetry={() => void reload()} />
  else if (data && data.projects.length === 0) {
    gate = (
      <Card>
        <EmptyState {...NO_PROJECTS} />
      </Card>
    )
  }
  return { ...overview, gate }
}

export function TutorPanel() {
  const { data, gate } = useGate()
  if (gate || !data) return <>{gate}</>
  const { stats } = data
  const sub = (text: string) => <span>{text}</span>
  const progressBars = data.projects
    .filter((p) => p.progress)
    .map((p) => ({ key: p.process_public_id, label: p.student.full_name, value: p.progress?.percent ?? 0, to: `/tutor/proyectos/${p.process_public_id}` }))
    .sort((a, b) => a.value - b.value)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Proyectos asignados" value={stats.assigned_projects} sub={sub('Donde eres tutor activo')} icon={<Users size={16} />} to="/tutor/proyectos" />
        <MetricCard label="Estudiantes activos" value={stats.active_students} sub={sub('Con proceso sin cerrar')} icon={<GraduationCap size={16} />} />
        <MetricCard label="Entregas por revisar" value={stats.pending_reviews} sub={sub('Esperan tu decisión')} icon={<FileCheck2 size={16} />} subColor={stats.pending_reviews > 0 ? 'var(--color-primary)' : undefined} to="/tutor/revisiones" />
        <MetricCard label="Próximas a vencer" value={stats.due_soon} sub={sub('En los próximos 7 días')} icon={<CalendarClock size={16} />} to="/tutor/estadisticas" />
        <MetricCard label="Con correcciones pendientes" value={stats.needs_corrections} sub={sub('Esperan al estudiante')} icon={<AlertCircle size={16} />} to="/tutor/proyectos" />
        <MetricCard
          label="Promedio de avance"
          value={stats.average_progress === null ? '—' : `${stats.average_progress}%`}
          sub={sub(stats.average_progress === null ? 'Sin planes publicados con entregables obligatorios' : 'Solo proyectos con plan publicado')}
          icon={<Gauge size={16} />}
          to="/tutor/estadisticas"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Avance por proyecto"
          subtitle="Entregables obligatorios aprobados · toca uno para abrirlo"
          table={{ headers: ['Estudiante', 'Avance'], rows: progressBars.map((p) => [p.label, `${p.value}%`]) }}
        >
          {progressBars.length === 0 ? (
            <ChartEmpty>Ningún proyecto tiene todavía un plan publicado.</ChartEmpty>
          ) : (
            <HBarList data={progressBars} max={100} unit="" format={(v) => `${v}%`} />
          )}
          {data.projects.length > progressBars.length && progressBars.length > 0 && (
            <p className="mt-2 px-2 text-[12px] text-[var(--color-text-muted)]">{data.projects.length - progressBars.length} proyecto(s) aún sin plan publicado.</p>
          )}
        </ChartCard>
        <ChartCard title="Estado de los entregables" subtitle="Todos tus proyectos con plan publicado">
          <Distribution stats={stats} />
        </ChartCard>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[18px] font-bold text-[var(--color-text)]">Mis proyectos</h2>
          <Link to="/tutor/proyectos" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ver todos</Link>
        </div>
        <ProjectsTable projects={data.projects} limit={6} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]"><FileCheck2 size={18} aria-hidden /> Entregas por revisar</h2>
          {data.pending_reviews.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">No tienes entregas pendientes de revisión.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {data.pending_reviews.slice(0, 5).map((r) => (
                <li key={r.submission_public_id} className="py-2.5">
                  <Link to={`/tutor/proyectos/${r.process_public_id}?tab=documentos`} className="text-[14px] font-semibold text-[#0876B9] hover:underline">
                    {r.deliverable_title} · v{r.version}
                  </Link>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{r.student.full_name} · {formatRelativeDate(r.submitted_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]"><CalendarClock size={18} aria-hidden /> Próximas fechas límite</h2>
          {data.upcoming_deadlines.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">No hay fechas límite próximas.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {data.upcoming_deadlines.slice(0, 5).map((d, i) => (
                <li key={`${d.process_public_id}-${i}`} className="py-2.5">
                  <Link to={`/tutor/proyectos/${d.process_public_id}`} className="text-[14px] font-semibold text-[#0876B9] hover:underline">{d.deliverable_title}</Link>
                  <p className={`text-[12px] ${d.is_overdue ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                    {d.student.full_name} · {d.is_overdue ? 'Vencida · ' : ''}{formatCalendarDate(d.due_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

export function TutorProjectsPage() {
  const { data, gate } = useGate()
  if (gate || !data) return <>{gate}</>
  return (
    <Card>
      <ProjectsTable projects={data.projects} />
    </Card>
  )
}

export function TutorPlansPage() {
  const { data, gate } = useGate()
  if (gate || !data) return <>{gate}</>
  return (
    <Card>
      <p className="mb-4 text-[13px] text-[var(--color-text-muted)]">
        Las fechas solo se muestran como confirmadas al estudiante cuando publicas el plan. Mientras esté en borrador, el estudiante no lo ve.
      </p>
      <ul className="divide-y divide-[var(--color-border)]">
        {data.projects.map((p) => (
          <li key={p.process_public_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[var(--color-text)]">{p.student.full_name}</p>
              <p className="max-w-[420px] truncate text-[12px] text-[var(--color-text-muted)]" title={projectTitle(p)}>{projectTitle(p)}</p>
            </div>
            <div className="flex items-center gap-3">
              <PlanStatusBadge status={p.plan_status} />
              <Link
                to={`/tutor/proyectos/${p.process_public_id}?tab=plan`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-bold text-[#0876B9] hover:bg-[var(--color-info-soft,rgba(8,118,185,0.1))]"
              >
                <ClipboardList size={14} aria-hidden /> {p.plan_status === 'sin_plan' ? 'Crear plan' : 'Editar plan'}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function TutorReviewsPage() {
  const { data, gate } = useGate()
  if (gate || !data) return <>{gate}</>
  return (
    <Card>
      {data.pending_reviews.length === 0 ? (
        <EmptyState icon={FileCheck2} title="No hay entregas por revisar" description="Cuando un estudiante suba un documento, aparecerá aquí para que lo apruebes o pidas correcciones." />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {data.pending_reviews.map((r) => (
            <li key={r.submission_public_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[var(--color-text)]">{r.deliverable_title} <span className="font-normal text-[var(--color-text-muted)]">· versión {r.version}</span></p>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {r.student.full_name} · {projectTitle({ title: r.project_title, process_code: r.process_code })} · entregado {formatRelativeDate(r.submitted_at)}
                  {r.due_date ? ` · fecha límite ${formatCalendarDate(r.due_date)}` : ''}
                </p>
              </div>
              <Link
                to={`/tutor/proyectos/${r.process_public_id}?tab=documentos`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6500] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#E05A00]"
              >
                <Hourglass size={14} aria-hidden /> Revisar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const DISTRIBUTION_ORDER: DeliverableStatus[] = ['pendiente', 'disponible', 'en_revision', 'requiere_correcciones', 'aprobado']

function Distribution({ stats }: { stats: TutorOverviewOut['stats'] }) {
  const total = DISTRIBUTION_ORDER.reduce((sum, s) => sum + stats.status_distribution[s], 0)
  if (total === 0) return <p className="text-[13px] text-[var(--color-text-muted)]">Aún no hay entregables en planes publicados.</p>
  return (
    <ul className="flex flex-col gap-3">
      {DISTRIBUTION_ORDER.map((s) => (
        <li key={s}>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <Badge variant={STATUS_META[s].variant}>{STATUS_META[s].label}</Badge>
            <span className="font-semibold text-[var(--color-text)]">{stats.status_distribution[s]}</span>
          </div>
          <ProgressBar percent={Math.round((stats.status_distribution[s] / total) * 100)} label={`${STATUS_META[s].label}: ${stats.status_distribution[s]} de ${total}`} />
        </li>
      ))}
    </ul>
  )
}

export function TutorStatsPage() {
  const { data, gate } = useGate()
  if (gate || !data) return <>{gate}</>
  const { stats } = data
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Entregas por revisar" value={stats.pending_reviews} sub="Pendientes" icon={<FileCheck2 size={16} />} />
        <MetricCard label="Con correcciones" value={stats.needs_corrections} sub="Esperan al estudiante" icon={<AlertCircle size={16} />} />
        <MetricCard label="Vencidas" value={stats.overdue} sub="Pasó la fecha límite" icon={<CalendarClock size={16} />} />
        <MetricCard label="Promedio de avance" value={stats.average_progress === null ? '—' : `${stats.average_progress}%`} sub="Plan publicado" icon={<BarChart3 size={16} />} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-[18px] font-bold text-[var(--color-text)]">Estado de los entregables</h2>
          <Distribution stats={stats} />
        </Card>
        <Card>
          <h2 className="mb-4 text-[18px] font-bold text-[var(--color-text)]">Avance por proyecto</h2>
          <ul className="flex flex-col gap-4">
            {data.projects.map((p) => (
              <li key={p.process_public_id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-semibold text-[var(--color-text)]">{p.student.full_name}</span>
                  <span className="text-[var(--color-text-muted)]">{p.progress ? `${p.progress.percent}%` : 'Sin plan publicado'}</span>
                </div>
                {p.progress && <ProgressBar percent={p.progress.percent} label={`Avance de ${p.student.full_name}`} />}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-[var(--color-text-muted)]">
            El avance cuenta solo entregables obligatorios aprobados. Un 100 % no significa que el proceso de grado esté finalizado oficialmente.
          </p>
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 text-[18px] font-bold text-[var(--color-text)]">Próximas fechas límite</h2>
        {data.upcoming_deadlines.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">No hay fechas límite próximas.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {data.upcoming_deadlines.map((d, i) => (
              <li key={`${d.process_public_id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                <span><strong>{d.deliverable_title}</strong> · {d.student.full_name}</span>
                <span className="text-[var(--color-text-muted)]">{formatCalendarDate(d.due_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
