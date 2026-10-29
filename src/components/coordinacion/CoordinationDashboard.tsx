import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, ClipboardList, FileCheck2, FolderKanban, GraduationCap, UserCheck, UserX, Users } from 'lucide-react'
import { Card, EmptyState, MetricCard } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { coordinationApi, type CoordinationPage, type CoordinationSummary } from '@/services/coordination.service'
import { LoadError, projectTitle } from '@/components/tutor/tutorUi'

interface DashboardData {
  summary: CoordinationSummary
  unassigned: CoordinationPage
}

/** Tablero de Coordinación: todos los indicadores salen de la API; un cero solo aparece si la consulta respondió vacía. */
export function CoordinationDashboard() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [data, setData] = useState<DashboardData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setStatus('loading')
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
  const shortcuts = [
    { to: '/coordinacion/asignacion', icon: UserCheck, title: 'Asignación de tutores', text: 'Asigna o cambia el tutor de cada proyecto.' },
    { to: '/tramites', icon: FolderKanban, title: 'Gestión de proyectos', text: 'Consulta los trámites y su trazabilidad.' },
    { to: '/reportes', icon: BarChart3, title: 'Seguimiento e informes', text: 'Revisa indicadores y reportes del programa.' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Procesos registrados" value={summary.registered_processes} sub="Trámites de grado en el sistema" icon={<ClipboardList size={16} />} />
        <MetricCard label="Pendientes de asignar tutor" value={summary.pending_tutor} sub="Procesos abiertos sin tutor activo" icon={<UserX size={16} />} subColor={summary.pending_tutor > 0 ? 'var(--color-primary)' : undefined} />
        <MetricCard label="Con tutor activo" value={summary.with_tutor} sub="Asignación vigente en el equipo" icon={<UserCheck size={16} />} />
        <MetricCard label="Estudiantes activos" value={summary.active_students} sub="Con proceso sin cerrar" icon={<GraduationCap size={16} />} />
        <MetricCard label="Entregas por revisar" value={summary.pending_reviews} sub="Esperan la decisión del tutor" icon={<FileCheck2 size={16} />} />
        <MetricCard label="Proyectos con retraso" value={summary.delayed_projects} sub="Plan publicado con fecha vencida" icon={<AlertTriangle size={16} />} />
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
                  <p className="max-w-[460px] truncate text-[12px] text-[var(--color-text-muted)]" title={projectTitle(p)}>{projectTitle(p)} · {p.modality_name}</p>
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
  )
}
