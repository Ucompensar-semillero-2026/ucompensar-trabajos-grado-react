import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Settings2 } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui'
import { LoadError } from '@/components/tutor/tutorUi'
import { useAppStore } from '@/stores/app.store'
import { hasModule } from '@/config/access'
import { ApiError } from '@/services/http'
import {
  monitoringApi, type MonitoringSummary, type RiskLevel, type StudentFilters, type StudentPage,
} from '@/services/monitoring.service'
import { AlertDistributionChart } from './AlertDistributionChart'
import { FollowUpFilters } from './FollowUpFilters'
import { FollowUpKpiGrid } from './FollowUpKpiCards'
import { FollowUpSkeleton } from './FollowUpSkeleton'
import { StudentsMonitoringPanel } from './StudentsMonitoringTable'
import { UpcomingTasksPanel } from './UpcomingTasksPanel'

const PAGE_SIZE = 15

export function TaskMonitoringDashboard() {
  const accessToken = useAppStore((s) => s.accessToken)
  const user = useAppStore((s) => s.currentUser)
  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [page, setPage] = useState<StudentPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<StudentFilters>({ page: 1, page_size: PAGE_SIZE })
  const [modalities, setModalities] = useState<Array<{ code: string; name: string }>>([])
  const [projects, setProjects] = useState<Array<{ id: string; label: string }>>([])

  const load = useCallback(() => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    Promise.all([monitoringApi.summary(accessToken), monitoringApi.students(accessToken, filters)])
      .then(([s, p]) => {
        setSummary(s)
        setPage(p)
        // Las opciones de filtro salen de los propios datos del backend (no de listas escritas aquí).
        setModalities((cur) => mergeUnique(cur, p.items.map((r) => ({ code: r.modality_code, name: r.modality_name })), (m) => m.code))
        setProjects((cur) => mergeUnique(cur, p.items.map((r) => ({ id: r.process_id, label: r.project_title ?? r.process_code })), (m) => m.id))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el seguimiento.'))
      .finally(() => setLoading(false))
  }, [accessToken, filters])

  useEffect(load, [load])

  const set = (patch: Partial<StudentFilters>) => setFilters((f) => ({ ...f, ...patch, page: 'page' in patch ? patch.page : 1 }))
  const clear = () => setFilters({ page: 1, page_size: PAGE_SIZE })
  const pages = Math.max(1, Math.ceil((page?.total ?? 0) / PAGE_SIZE))
  const activeFilters = Boolean(filters.search || filters.process_id || filters.modality || filters.level || filters.commitment)
  const selectLevel = (level: RiskLevel | undefined) => set({ level })

  return (
    <div className="space-y-5">
      {user && hasModule(user, 'workspace-coordination') && (
        <div className="flex justify-end">
          <Link to="/seguimiento/configuracion"><Button variant="outline" size="sm" className="gap-2"><Settings2 size={14} aria-hidden="true" />Configurar alertas</Button></Link>
        </div>
      )}

      {error && <LoadError message={error} onRetry={load} />}

      {loading && !page && !error ? <FollowUpSkeleton /> : (
        <>
          {summary && <FollowUpKpiGrid summary={summary} level={filters.level} onSelectLevel={selectLevel} />}

          <FollowUpFilters filters={filters} projects={projects} modalities={modalities} active={activeFilters} onChange={set} onClear={clear} />

          {page && page.items.length === 0 && !error ? (
            <Card>
              <EmptyState
                icon={BellRing}
                title={activeFilters ? 'Ningún estudiante coincide con los filtros' : 'Todavía no hay estudiantes con seguimiento'}
                description={activeFilters ? 'Prueba con otros filtros o límpialos.' : 'Aparecerán cuando tengas proyectos asignados con un plan de trabajo publicado.'}
              />
            </Card>
          ) : page ? (
            <div className="grid grid-cols-1 items-start gap-5 min-[1760px]:grid-cols-[minmax(290px,330px)_minmax(0,1fr)]">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 min-[1760px]:grid-cols-1">
                {summary && <AlertDistributionChart summary={summary} level={filters.level} onSelectLevel={selectLevel} />}
                <UpcomingTasksPanel rows={page.items} />
              </div>
              <StudentsMonitoringPanel rows={page.items} total={page.total} busy={loading}>
                {pages > 1 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-[var(--color-text-muted)]">
                    <span>Página {page.page} de {pages} · {page.total} estudiantes</span>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={page.page <= 1} onClick={() => set({ page: page.page - 1 })}>Anterior</Button>
                      <Button type="button" variant="outline" size="sm" disabled={page.page >= pages} onClick={() => set({ page: page.page + 1 })}>Siguiente</Button>
                    </div>
                  </div>
                )}
              </StudentsMonitoringPanel>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function mergeUnique<T>(current: T[], incoming: T[], key: (item: T) => string): T[] {
  const map = new Map(current.map((i) => [key(i), i]))
  for (const i of incoming) map.set(key(i), i)
  return [...map.values()]
}
