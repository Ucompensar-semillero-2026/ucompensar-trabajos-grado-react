import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, GitBranch, RefreshCw } from 'lucide-react'
import { Card, EmptyState, SearchField, Select } from '@/components/ui'
import { StatusBadge } from '@/components/ui/Badge'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { isTutorWorkspaceUser } from '@/config/access'
import { formatRelativeDate } from '@/utils/format'
import { ETAPAS_TRAZABILIDAD, listarProcesosTrazabilidad, MOCK_TRAMITES, stepForStateCode, type EstadoTramite } from '@/services/trazabilidad.service'
import { EstadoBadge } from './EstadoBadge'
import { SecuenciaProyecto } from './Timeline'
import { usePermisos } from './usePermisos'

type TraceRow = Awaited<ReturnType<typeof listarProcesosTrazabilidad>>[number]

export function TrazabilidadIndex() {
  const navigate = useNavigate()
  const accessToken = useAppStore((s) => s.accessToken)
  const currentUser = useAppStore((s) => s.currentUser)
  const isTutor = currentUser ? isTutorWorkspaceUser(currentUser) : false
  const { canView } = usePermisos()
  const [rows, setRows] = useState<TraceRow[]>([])
  const [query, setQuery] = useState('')
  const [selectedState, setSelectedState] = useState('todos')
  const [selectedProgram, setSelectedProgram] = useState('todos')
  const [selectedTutor, setSelectedTutor] = useState('todos')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (!accessToken) {
      setIsLoading(false)
      setError('La sesión no está disponible. Vuelve a iniciar sesión para consultar los trámites.')
      return
    }
    setIsLoading(true)
    setError(null)
    listarProcesosTrazabilidad(accessToken)
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los trámites.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { load() }, [accessToken])

  const stateOptions = useMemo(() => unique([
    ...rows.map(({ process }) => [process.state.code, process.state.name] as const),
    ...MOCK_TRAMITES.map(({ estado }) => [estado, estado.replace(/_/g, ' ')] as const),
  ]), [rows])
  const programOptions = useMemo(() => [...new Set([...rows.map(({ process }) => process.modality.name), ...MOCK_TRAMITES.map(({ programa }) => programa)])].sort((a, b) => a.localeCompare(b, 'es')), [rows])
  const tutorOptions = useMemo(() => [...new Set([...rows.map(({ tutor }) => tutor), ...MOCK_TRAMITES.map(({ tutor }) => tutor?.nombre ?? null)].filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'es')), [rows])
  const filtered = rows.filter(({ process: p, tutor }) => {
    const updated = (p.updated_at ?? p.created_at).slice(0, 10)
    const normalizedQuery = query.trim().toLocaleLowerCase('es-CO')
    const matchesQuery = !normalizedQuery || [p.process_code, p.title ?? '', p.student.full_name, p.modality.name, p.academic_semester, tutor ?? '']
      .some((value) => value.toLocaleLowerCase('es-CO').includes(normalizedQuery))
    return matchesQuery
      && (selectedState === 'todos' || p.state.code === selectedState)
      && (selectedProgram === 'todos' || p.modality.name === selectedProgram)
      && (selectedTutor === 'todos' || tutor === selectedTutor)
      && (!fromDate || updated >= fromDate)
      && (!toDate || updated <= toDate)
  })
  const demoFiltered = MOCK_TRAMITES.filter((tramite) => canView(tramite)).filter((tramite) => {
    const updated = tramite.fechaActualizacion.slice(0, 10)
    const normalizedQuery = query.trim().toLocaleLowerCase('es-CO')
    const matchesQuery = !normalizedQuery || [
      tramite.codigo, tramite.titulo, tramite.programa,
      ...tramite.estudiantes.map((student) => student.nombre),
      tramite.tutor?.nombre ?? '',
    ].some((value) => value.toLocaleLowerCase('es-CO').includes(normalizedQuery))
    return matchesQuery
      && (selectedState === 'todos' || tramite.estado === selectedState as EstadoTramite)
      && (selectedProgram === 'todos' || tramite.programa === selectedProgram)
      && (selectedTutor === 'todos' || tramite.tutor?.nombre === selectedTutor)
      && (!fromDate || updated >= fromDate)
      && (!toDate || updated <= toDate)
  })

  return (
    <div className="max-w-6xl space-y-5 animate-fadeIn">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title">{isTutor ? 'Trazabilidad de mis proyectos' : 'Trazabilidad de trámites'}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{isTutor ? 'Consulta los estados, documentos y movimientos de los proyectos que tienes asignados.' : 'Busca un trámite y consulta su estado, documentos e historial de movimientos.'}</p>
        </div>
        <button type="button" onClick={load} disabled={isLoading} className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50">
          <RefreshCw size={15} aria-hidden="true" className={isLoading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-[var(--color-border)] p-4 sm:grid-cols-2 xl:grid-cols-4">
          <SearchField label="Buscar trámite" placeholder="Título, código, estudiante…" value={query} onChange={(e) => setQuery(e.target.value)} wrapperClassName="sm:col-span-2 xl:col-span-1" />
          <Select aria-label="Filtrar por estado" value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
            <option value="todos">Todos los estados</option>
            {stateOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </Select>
          <Select aria-label="Filtrar por programa o modalidad" value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)}>
            <option value="todos">Todos los programas</option>
            {programOptions.map((program) => <option key={program} value={program}>{program}</option>)}
          </Select>
          <Select aria-label="Filtrar por tutor" value={selectedTutor} onChange={(e) => setSelectedTutor(e.target.value)}>
            <option value="todos">Todos los tutores</option>
            {tutorOptions.map((tutor) => <option key={tutor} value={tutor}>{tutor}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            Desde <input aria-label="Fecha inicial" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className="field-input min-w-0 flex-1" />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            Hasta <input aria-label="Fecha final" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className="field-input min-w-0 flex-1" />
          </label>
        </div>

        {error && <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={load} className="font-semibold underline">Reintentar</button></div>}
        {isLoading ? (
          <p role="status" className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">Cargando trámites…</p>
        ) : !error && rows.length === 0 ? (
          <EmptyState icon={GitBranch} title={isTutor ? 'Aún no tienes proyectos asignados' : 'No hay trámites disponibles'} description={isTutor ? 'Cuando coordinación te asigne un proyecto, su trazabilidad aparecerá aquí.' : 'Los trámites visibles para tu cuenta aparecerán aquí.'} />
        ) : !error && filtered.length === 0 ? (
          <EmptyState icon={GitBranch} title="No encontramos resultados" description="Cambia los filtros para ver otros trámites." />
        ) : !error ? (
          <>
            <div className="border-b border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-text-muted)]">{filtered.length} de {rows.length} trámite{rows.length === 1 ? '' : 's'}</div>
            <div className="divide-y divide-[var(--color-border)]">
              {filtered.map(({ process: p, tutor }) => {
                const step = stepForStateCode(p.state.code, p.state.is_final_state, Boolean(tutor))
                const stage = Math.min(tutor && step <= 3 ? 4 : step, ETAPAS_TRAZABILIDAD.length) - 1
                return (
                  <div key={p.public_id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[var(--color-bg)] sm:flex-row sm:items-center">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]"><GitBranch size={19} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-[var(--color-teal)]">{p.process_code}</span><StatusBadge status={p.state.code} label={p.state.name} /></div>
                      <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text)]">{p.title?.trim() || p.modality.name}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{p.student.full_name} · Tutor: {tutor ?? 'Pendiente'} · {p.modality.name} · {p.academic_semester}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Etapa actual: {ETAPAS_TRAZABILIDAD[stage]}</p>
                      <div className="mt-2 overflow-x-auto"><SecuenciaProyecto tramite={{ pasoActual: step, tutor: tutor ? { id: tutor, nombre: tutor } : null }} /></div>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)] sm:flex-col sm:items-end">
                      <span>Actualizado {formatRelativeDate(p.updated_at ?? p.created_at)}</span>
                      <button type="button" onClick={() => navigate(`/trazabilidad/${p.public_id}`)} className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                        Ver  <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
      </Card>
      {demoFiltered.length > 0 && <Card className="overflow-hidden">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-bold text-[var(--color-text)]">Ejemplos demostrativos</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Datos de prueba; no son expedientes reales</span>
        </div>
        <p className="mb-4 text-xs text-[var(--color-text-muted)]">Los comentarios, reuniones y cambios de los ejemplos se mantienen solo en esta sesión del navegador.</p>
        <div className="divide-y divide-[var(--color-border)]">
          {demoFiltered.map((tramite) => (
            <article key={tramite.id} className="py-4 first:pt-1 last:pb-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--color-teal)]">{tramite.codigo}</span>
                    <EstadoBadge estado={tramite.estado} />
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-[var(--color-text)]">{tramite.titulo}</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {tramite.estudiantes.map((student) => student.nombre).join(', ')} · Tutor: {tramite.tutor?.nombre ?? 'Pendiente'} · {tramite.programa}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Etapa actual: {tramite.etapaActual}</p>
                  <div className="mt-2 overflow-x-auto"><SecuenciaProyecto tramite={tramite} /></div>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)] sm:flex-col sm:items-end">
                  <span>Actualizado {formatRelativeDate(tramite.fechaActualizacion)}</span>
                  <button type="button" onClick={() => navigate(`/trazabilidad/${tramite.id}`)} className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    Ver trazabilidad <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Card>}
    </div>
  )
}

function unique(entries: readonly (readonly [string, string])[]) {
  return [...new Map(entries).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
}
