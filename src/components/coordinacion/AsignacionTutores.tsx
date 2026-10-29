import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Search, UserCheck, UserPlus, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, MetricCard } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { coordinationApi, type CoordinationPage, type CoordinationProcessOut, type CoordinationSummary } from '@/services/coordination.service'
import { modalitiesApi } from '@/services/modalities.service'
import { processesApi, type TutorCandidate } from '@/services/processes.service'
import type { ModalityOut } from '@/types/api'
import { lockScroll } from '@/utils/scrollLock'
import { LoadError, projectTitle } from '@/components/tutor/tutorUi'

const PAGE_SIZE = 15
const ROLE_LABEL: Record<string, string> = {
  tutor_investigador: 'Tutor de investigación',
  tutor_emprendedor: 'Tutor de emprendimiento',
  tutor_consultor: 'Tutor consultor',
  docente_curso: 'Docente de curso',
  coordinador_movilidad: 'Coordinador de movilidad',
  evaluador: 'Evaluador',
  grupo_investigacion: 'Grupo de investigación',
}

const fieldClass =
  'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]'

// ── Modal de asignación ───────────────────────────────────────────────────────

function AssignTutorModal({ process, onClose, onDone }: { process: CoordinationProcessOut; onClose: () => void; onDone: () => void }) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [candidates, setCandidates] = useState<TutorCandidate[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const changing = process.tutor !== null

  useEffect(() => {
    const unlock = lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !submitting.current && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [onClose])

  const loadCandidates = useCallback(async () => {
    if (!accessToken) return
    try {
      setCandidates(await processesApi.teamCandidates(accessToken))
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de docentes')
    }
  }, [accessToken])

  useEffect(() => {
    void loadCandidates()
  }, [loadCandidates])

  const visible = (candidates ?? []).filter((c) => c.public_id !== process.tutor?.public_id && c.full_name.toLowerCase().includes(search.trim().toLowerCase()))

  const confirm = async () => {
    // Solo un docente de la lista que devolvió el backend; el backend valida de nuevo permisos y elegibilidad.
    if (!accessToken || !selected || submitting.current || !(candidates ?? []).some((c) => c.public_id === selected)) return
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      if (changing) await processesApi.changeTutor(accessToken, process.process_public_id, selected)
      else await processesApi.addTeamMember(accessToken, process.process_public_id, selected, 'tutor')
      await processesApi.team(accessToken, process.process_public_id) // se vuelve a consultar el equipo persistido
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la asignación') // se conserva la selección
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061F2D]/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="assign-title" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">
        <header className="flex items-start justify-between gap-3 bg-gradient-to-r from-[#073B57] to-[#145B78] px-6 py-5 text-white">
          <div className="min-w-0">
            <h2 id="assign-title" className="text-[20px] font-bold text-white">{changing ? 'Cambiar tutor' : 'Asignar tutor'}</h2>
            <p className="mt-1 truncate text-[13px] text-white/85" title={projectTitle(process)}>{projectTitle(process)}</p>
            <p className="text-[12px] text-white/75">{process.process_code} · {process.student.full_name} · {process.modality_name}</p>
            {changing && <p className="mt-1 text-[12px] text-white/85">Tutor actual: {process.tutor?.full_name}. Su asignación se desactivará y quedará en el historial.</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"><X size={18} aria-hidden /></button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-6">
          <label className="relative block">
            <span className="sr-only">Buscar docente</span>
            <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar docente por nombre…" className={`${fieldClass} w-full pl-9`} />
          </label>

          {loadError ? (
            <LoadError message={loadError} onRetry={() => void loadCandidates()} />
          ) : candidates === null ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">Cargando docentes elegibles…</p>
          ) : visible.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {candidates.length === 0 ? 'No hay docentes elegibles registrados en el sistema.' : 'Ningún docente coincide con la búsqueda.'}
            </p>
          ) : (
            <ul role="radiogroup" aria-label="Docentes elegibles" className="flex flex-col gap-2">
              {visible.map((c) => (
                <li key={c.public_id}>
                  <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 ${selected === c.public_id ? 'border-[#FF6500] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)]'}`}>
                    <span className="flex items-center gap-3">
                      <input type="radio" name="tutor" value={c.public_id} checked={selected === c.public_id} onChange={() => setSelected(c.public_id)} className="h-4 w-4 accent-[#FF6500]" />
                      <span>
                        <span className="block text-[14px] font-semibold text-[var(--color-text)]">{c.full_name}</span>
                        <span className="block text-[12px] text-[var(--color-text-muted)]">{ROLE_LABEL[c.role.name] ?? c.role.name}</span>
                      </span>
                    </span>
                    <Badge variant="blue">{c.active_projects} {c.active_projects === 1 ? 'proyecto' : 'proyectos'}</Badge>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert" className="text-[13px] font-medium text-red-700">{error}</p>}
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!selected || busy} onClick={() => void confirm()}>
            {busy ? 'Registrando…' : 'Confirmar asignación'}
          </Button>
        </footer>
      </div>
    </div>
  )
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export function AsignacionTutores() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [modality, setModality] = useState('')
  const [state, setState] = useState('')
  const [assignment, setAssignment] = useState<'' | 'sin_tutor' | 'con_tutor'>('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CoordinationPage | null>(null)
  const [summary, setSummary] = useState<CoordinationSummary | null>(null)
  const [modalities, setModalities] = useState<ModalityOut[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<CoordinationProcessOut | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    if (!accessToken) return
    setStatus('loading')
    try {
      const [list, sum] = await Promise.all([
        coordinationApi.processes(accessToken, { search, modality, state, assignment, page, page_size: PAGE_SIZE }),
        coordinationApi.summary(accessToken),
      ])
      setData(list)
      setSummary(sum)
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de procesos')
      setStatus('error')
    }
  }, [accessToken, search, modality, state, assignment, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (accessToken) modalitiesApi.list(accessToken).then(setModalities).catch(() => setModalities([]))
  }, [accessToken])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const filter = (setter: (v: never) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value as never)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Proyectos sin asignar" value={summary ? summary.pending_tutor : '—'} sub="Procesos abiertos sin tutor" icon={<UserPlus size={16} />} />
        <MetricCard label="Proyectos asignados" value={summary ? summary.with_tutor : '—'} sub="Con tutor activo" icon={<UserCheck size={16} />} />
        <MetricCard label="Tutores disponibles" value={summary ? summary.tutors_available : '—'} sub="Docentes elegibles" icon={<Eye size={16} />} />
      </div>

      {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] font-medium text-green-800">{notice}</p>}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative block min-w-[240px] flex-1">
            <span className="sr-only">Buscar por código, proyecto o estudiante</span>
            <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
            <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por código, proyecto o estudiante…" className={`${fieldClass} w-full pl-9`} />
          </label>
          <select aria-label="Filtrar por modalidad" value={modality} onChange={filter(setModality)} className={fieldClass}>
            <option value="">Todas las modalidades</option>
            {modalities.map((m) => <option key={m.public_id} value={m.name}>{m.name}</option>)}
          </select>
          <select aria-label="Filtrar por estado del proceso" value={state} onChange={filter(setState)} className={fieldClass}>
            <option value="">Todos los estados</option>
            {(summary?.state_distribution ?? []).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <select aria-label="Filtrar por estado de asignación" value={assignment} onChange={filter(setAssignment)} className={fieldClass}>
            <option value="">Con y sin tutor</option>
            <option value="sin_tutor">Sin tutor</option>
            <option value="con_tutor">Con tutor</option>
          </select>
        </div>

        {status === 'error' ? (
          <LoadError message={error} onRetry={() => void load()} />
        ) : !data ? (
          <p className="px-2 py-6 text-[13px] text-[var(--color-text-muted)]">Cargando procesos…</p>
        ) : data.total === 0 ? (
          <EmptyState
            icon={UserCheck}
            title={search || modality || state || assignment ? 'Ningún proceso coincide con los filtros' : 'Aún no hay procesos registrados'}
            description={search || modality || state || assignment ? 'Prueba con otros filtros.' : 'Los procesos aparecen cuando los estudiantes se postulan a una oferta o inician un trámite.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-premium">
              <table className="w-full min-w-[920px] border-collapse">
                <thead>
                  <tr>{['Código', 'Estudiante', 'Proyecto', 'Modalidad', 'Estado', 'Tutor actual', ''].map((h) => <th key={h || 'acciones'} className="th">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.process_public_id}>
                      <td className="td font-mono text-[12px] font-bold">{p.process_code}</td>
                      <td className="td font-semibold">{p.student.full_name}</td>
                      <td className="td"><span className="block max-w-[240px] truncate" title={projectTitle(p)}>{projectTitle(p)}</span></td>
                      <td className="td text-[var(--color-text-muted)]">{p.modality_name}</td>
                      <td className="td"><Badge variant="gray">{p.process_state_name}</Badge></td>
                      <td className="td">{p.tutor ? p.tutor.full_name : <Badge variant="orange">Sin tutor</Badge>}</td>
                      <td className="td">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" size="sm" variant={p.tutor ? 'outline' : 'primary'} aria-label={`${p.tutor ? 'Cambiar tutor' : 'Asignar tutor'} de ${p.student.full_name}`} onClick={() => { setNotice(null); setTarget(p) }}>
                            {p.tutor ? 'Cambiar tutor' : 'Asignar tutor'}
                          </Button>
                          <Link to={`/coordinacion/proyectos/${p.process_public_id}`} aria-label={`Abrir expediente de ${p.student.full_name}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-bold text-[#0876B9] hover:bg-[var(--color-info-soft,rgba(8,118,185,0.1))]">
                            <Eye size={14} aria-hidden /> Expediente
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px]">
              <span className="text-[var(--color-text-muted)]">{data.total} {data.total === 1 ? 'proceso' : 'procesos'} · página {data.page} de {totalPages}</span>
              <span className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={page <= 1 || status === 'loading'} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button type="button" size="sm" variant="outline" disabled={page >= totalPages || status === 'loading'} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
              </span>
            </nav>
          </>
        )}
      </Card>

      {target && (
        <AssignTutorModal
          process={target}
          onClose={() => setTarget(null)}
          onDone={() => {
            setNotice(`Tutor ${target.tutor ? 'cambiado' : 'asignado'} correctamente para ${target.student.full_name}.`)
            setTarget(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
