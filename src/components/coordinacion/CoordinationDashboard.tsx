import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, BarChart3, ClipboardList, FileCheck2, FolderKanban, GraduationCap, Lightbulb, UserCheck, UserX, Users } from 'lucide-react'
import { Card, EmptyState, MetricCard } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import {
  coordinationApi,
  portfolioApi,
  type CoordinationPage,
  type CoordinationSummary,
  type PortfolioItem,
  type PortfolioPage,
  type PortfolioSummary,
} from '@/services/coordination.service'
import { LoadError, projectTitle } from '@/components/tutor/tutorUi'
import { CHART_COLORS, ChartCard, ChartEmpty, Donut, GroupedColumns, HBarList, type ChartDatum } from '@/components/dashboard/charts'
import { daysSince, parseUtc } from '@/utils/format'

interface DashboardData {
  summary: CoordinationSummary
  unassigned: CoordinationPage
}

/** Datos de los gráficos. Si fallan, el panel principal sigue funcionando y solo los gráficos muestran el error. */
interface ChartsData {
  portfolio: PortfolioPage | null
  portfolioSummary: PortfolioSummary | null
  failed: boolean
}

const PORTFOLIO = '/coordinacion/portafolio'
const MONTHS = 6
const INACTIVITY_THRESHOLD_DAYS = 15
const PORTFOLIO_PAGE_SIZE = 100

/** Últimos `MONTHS` meses (el actual incluido) como claves AAAA-MM y su nombre corto. */
function lastMonths(now = new Date()) {
  return Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(d).replace('.', ''),
    }
  })
}

const monthKey = (iso: string) => {
  const d = parseUtc(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildCharts(items: PortfolioItem[]) {
  const byModality = new Map<string, ChartDatum>()
  for (const p of items) {
    const key = p.modality_code ?? p.modality_name
    const current = byModality.get(key)
    if (current) current.value += 1
    else byModality.set(key, { key, label: p.modality_name, value: 1, to: p.modality_code ? `${PORTFOLIO}?kind=proceso&modality=${encodeURIComponent(p.modality_code)}` : undefined })
  }

  const months = lastMonths()
  const opened = months.map((m) => items.filter((p) => monthKey(p.created_at) === m.key).length)
  const closed = months.map((m) => items.filter((p) => p.closed_at && monthKey(p.closed_at) === m.key).length)

  const byTutor = new Map<string, ChartDatum>()
  for (const p of items) {
    if (!p.tutor || p.category !== 'en_proceso') continue
    const current = byTutor.get(p.tutor.public_id)
    if (current) current.value += 1
    else byTutor.set(p.tutor.public_id, { key: p.tutor.public_id, label: p.tutor.full_name, value: 1, to: `${PORTFOLIO}?kind=proceso&tutor=${encodeURIComponent(p.tutor.public_id)}` })
  }

  // Lo que pide acción ya: entregas vencidas o proyectos en curso sin movimiento. Los que no tienen tutor van en su propia tarjeta.
  const attention = items
    .filter((p) => p.category === 'en_proceso')
    .map((p) => ({ item: p, idle: daysSince(p.updated_at) }))
    .filter(({ item, idle }) => item.overdue || idle > INACTIVITY_THRESHOLD_DAYS)
    .sort((a, b) => Number(b.item.overdue) - Number(a.item.overdue) || b.idle - a.idle)
    .slice(0, 6)

  return {
    modalities: [...byModality.values()],
    months,
    opened,
    closed,
    tutors: [...byTutor.values()].sort((a, b) => b.value - a.value).slice(0, 8),
    attention,
  }
}

/** Tablero de Coordinación: todos los indicadores salen de la API; un cero solo aparece si la consulta respondió vacía. */
export function CoordinationDashboard() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [data, setData] = useState<DashboardData | null>(null)
  const [charts, setCharts] = useState<ChartsData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setStatus('loading')
    // Los gráficos se piden en paralelo, pero su fallo no tumba el panel.
    void Promise.allSettled([
      portfolioApi.list(accessToken, { kind: 'proceso', page_size: PORTFOLIO_PAGE_SIZE }),
      portfolioApi.summary(accessToken),
    ]).then(([list, sum]) =>
      setCharts({
        portfolio: list.status === 'fulfilled' ? list.value : null,
        portfolioSummary: sum.status === 'fulfilled' ? sum.value : null,
        failed: list.status === 'rejected',
      })
    )
    try {
      const [summary, unassigned] = await Promise.all([
        coordinationApi.summary(accessToken),
        coordinationApi.processes(accessToken, { assignment: 'sin_tutor', page_size: 5 }),
      ])
      setData({ summary, unassigned })
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el panel de Coordinación')
      setStatus('error')
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  if (status === 'error') return <LoadError message={error} onRetry={() => void load()} />
  if (!data) return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando el panel de Coordinación…</p>

  const { summary, unassigned } = data
  const portfolioSummary = charts?.portfolioSummary ?? null
  const items = charts?.portfolio?.items ?? []
  const built = buildCharts(items)
  const truncated = charts?.portfolio ? charts.portfolio.total > items.length : false

  const shortcuts = [
    { to: '/coordinacion/asignacion', icon: UserCheck, title: 'Asignación de tutores', text: 'Asigna o cambia el tutor de cada proyecto.' },
    { to: '/tramites', icon: FolderKanban, title: 'Gestión de proyectos', text: 'Consulta los trámites y su trazabilidad.' },
    { to: '/reportes', icon: BarChart3, title: 'Seguimiento e informes', text: 'Revisa indicadores y reportes del programa.' },
  ]

  const states: ChartDatum[] = summary.state_distribution
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((s) => ({ key: s.code, label: s.name, value: s.count, to: `${PORTFOLIO}?kind=proceso&state=${encodeURIComponent(s.code)}` }))

  const chartsLoading = charts === null
  const chartsFallback = (empty: string) =>
    chartsLoading ? <ChartEmpty>Cargando…</ChartEmpty> : charts?.failed ? <ChartEmpty>No se pudieron cargar estos datos. Recarga la página para intentarlo de nuevo.</ChartEmpty> : <ChartEmpty>{empty}</ChartEmpty>

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Procesos registrados" value={summary.registered_processes} sub="Trámites de grado en el sistema" icon={<ClipboardList size={16} />} to={`${PORTFOLIO}?kind=proceso`} />
        <MetricCard label="Pendientes de asignar tutor" value={summary.pending_tutor} sub="Procesos abiertos sin tutor activo" icon={<UserX size={16} />} subColor={summary.pending_tutor > 0 ? 'var(--color-primary)' : undefined} to="/coordinacion/asignacion" />
        <MetricCard label="Con tutor activo" value={summary.with_tutor} sub="Asignación vigente en el equipo" icon={<UserCheck size={16} />} to={`${PORTFOLIO}?tab=en_proceso`} />
        <MetricCard label="Proyectos con retraso" value={summary.delayed_projects} sub="Plan publicado con fecha vencida" icon={<AlertTriangle size={16} />} subColor={summary.delayed_projects > 0 ? 'var(--color-primary)' : undefined} to={`${PORTFOLIO}?tab=en_proceso`} />
        <MetricCard label="Estudiantes activos" value={summary.active_students} sub="Con proceso sin cerrar" icon={<GraduationCap size={16} />} />
        <MetricCard label="Entregas por revisar" value={summary.pending_reviews} sub="Esperan la decisión del tutor" icon={<FileCheck2 size={16} />} to={`${PORTFOLIO}?tab=en_proceso`} />
        <MetricCard label="Propuestas por evaluar" value={portfolioSummary ? portfolioSummary.proposals_to_evaluate : '—'} sub="Enviadas por estudiantes" icon={<Lightbulb size={16} />} to="/coordinacion/propuestas" />
        <MetricCard label="Finalizados" value={portfolioSummary ? portfolioSummary.finished : '—'} sub="Con cierre oficial registrado" icon={<BadgeCheck size={16} />} to={`${PORTFOLIO}?tab=finalizados`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Trámites por estado"
          subtitle="Toca un estado para ver la lista"
          table={{ headers: ['Estado', 'Trámites'], rows: states.map((s) => [s.label, s.value]) }}
        >
          {states.length === 0 ? <ChartEmpty>Aún no hay trámites registrados.</ChartEmpty> : <HBarList data={states} />}
        </ChartCard>

        <ChartCard
          title="Trámites por modalidad"
          subtitle="Toca una modalidad para ver la lista"
          table={{ headers: ['Modalidad', 'Trámites'], rows: built.modalities.map((m) => [m.label, m.value]) }}
        >
          {built.modalities.length === 0 ? chartsFallback('Aún no hay trámites registrados.') : <Donut data={built.modalities} centerLabel="trámites" />}
        </ChartCard>

        <ChartCard
          title="Radicados y cerrados por mes"
          subtitle={`Últimos ${MONTHS} meses`}
          table={{ headers: ['Mes', 'Radicados', 'Cerrados'], rows: built.months.map((m, i) => [m.label, built.opened[i], built.closed[i]]) }}
        >
          {items.length === 0 ? (
            chartsFallback('Aún no hay trámites para mostrar la tendencia.')
          ) : (
            <GroupedColumns
              categories={built.months.map((m) => m.label)}
              series={[
                { key: 'opened', label: 'Radicados', color: CHART_COLORS[0] },
                { key: 'closed', label: 'Cerrados', color: CHART_COLORS[2] },
              ]}
              values={{ opened: built.opened, closed: built.closed }}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Carga de tutores"
          subtitle="Proyectos en curso por tutor"
          table={{ headers: ['Tutor', 'Proyectos en curso'], rows: built.tutors.map((t) => [t.label, t.value]) }}
        >
          {built.tutors.length === 0 ? chartsFallback('Ningún tutor tiene proyectos en curso todavía.') : <HBarList data={built.tutors} color={CHART_COLORS[1]} unit="proyectos" />}
        </ChartCard>
      </div>

      {truncated && (
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Los gráficos de modalidad, tendencia y tutores se calculan con {items.length} de {charts?.portfolio?.total} trámites.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]"><AlertTriangle size={18} aria-hidden /> Requieren atención</h2>
            <Link to={`${PORTFOLIO}?tab=en_proceso`} className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ver proyectos en curso</Link>
          </div>
          {built.attention.length === 0 ? (
            chartsLoading || charts?.failed ? (
              chartsFallback('')
            ) : (
              <EmptyState icon={BadgeCheck} title="Nada atrasado" description={`Ningún proyecto en curso tiene entregas vencidas ni lleva más de ${INACTIVITY_THRESHOLD_DAYS} días sin movimiento.`} />
            )
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {built.attention.map(({ item, idle }) => (
                <li key={item.public_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--color-text)]">{item.holder}</p>
                    <p className="max-w-[360px] truncate text-[12px] text-[var(--color-text-muted)]" title={item.title}>{item.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary)]">
                      <AlertTriangle size={12} aria-hidden />
                      {item.overdue ? 'Entregas vencidas' : `Sin movimiento hace ${idle} días`}
                    </p>
                  </div>
                  <Link to={`/coordinacion/proyectos/${item.public_id}`} className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ver expediente</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]"><Users size={18} aria-hidden /> Procesos sin tutor</h2>
            <Link to="/coordinacion/asignacion" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Asignar tutores</Link>
          </div>
          {unassigned.total === 0 ? (
            <EmptyState icon={UserCheck} title="No hay procesos pendientes de tutor" description={summary.registered_processes === 0 ? 'Aún no hay procesos registrados. Aparecerán cuando los estudiantes se postulen.' : 'Todos los procesos abiertos ya tienen un tutor activo.'} />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {unassigned.items.map((p) => (
                <li key={p.process_public_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--color-text)]">{p.student.full_name}</p>
                    <p className="max-w-[360px] truncate text-[12px] text-[var(--color-text-muted)]" title={projectTitle(p)}>{projectTitle(p)} · {p.modality_name}</p>
                  </div>
                  <Link to="/coordinacion/asignacion" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Asignar tutor</Link>
                </li>
              ))}
            </ul>
          )}
          {unassigned.total > unassigned.items.length && (
            <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">Mostrando {unassigned.items.length} de {unassigned.total}.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {shortcuts.map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="group flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[#0876B9]">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-info-soft,rgba(8,118,185,0.1))] text-[#0876B9]">
              <Icon size={18} aria-hidden />
            </span>
            <span>
              <span className="block font-display text-[18px] font-bold text-[var(--color-secondary)] group-hover:underline">{title}</span>
              <span className="mt-0.5 block text-[13px] text-[var(--color-text-muted)]">{text}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
