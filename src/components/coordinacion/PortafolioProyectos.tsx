import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Briefcase, Eye, FileSearch, Lightbulb, Search, UserPlus } from 'lucide-react'
import { Badge, Button, Card, EmptyState, MetricCard } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { portfolioApi, type PortfolioFilters, type PortfolioItem, type PortfolioPage, type PortfolioSummary } from '@/services/coordination.service'
import { projectModalities, projectOffers } from '@/components/publico/projectCatalog.data'
import { LoadError, ProgressBar } from '@/components/tutor/tutorUi'

const PAGE_SIZE = 15

type TabId = 'disponibles' | 'propuestas' | 'por_asignar' | 'en_proceso' | 'finalizados' | 'todos'
type RecordKind = 'oferta' | 'propuesta' | 'proceso'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'disponibles', label: 'Disponibles' },
  { id: 'propuestas', label: 'Propuestas recibidas' },
  { id: 'por_asignar', label: 'Por asignar' },
  { id: 'en_proceso', label: 'En proceso' },
  { id: 'finalizados', label: 'Finalizados' },
  { id: 'todos', label: 'Todos' },
]

const KIND_LABEL: Record<RecordKind, string> = { oferta: 'Oferta del catálogo', propuesta: 'Propuesta estudiantil', proceso: 'Proceso oficial' }
const KIND_VARIANT: Record<RecordKind, 'blue' | 'orange' | 'green'> = { oferta: 'blue', propuesta: 'orange', proceso: 'green' }

const fieldClass =
  'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]'

/** Fila unificada de la tabla. Cada fila conserva su tipo: oferta, propuesta y proceso nunca se mezclan. */
interface Row {
  key: string
  kind: RecordKind
  code: string
  title: string
  modalityCode: string | null
  modalityName: string
  holder: string
  tutor: string | null
  stateLabel: string
  progress: PortfolioItem['progress']
  overdue: boolean
  updated: string | null
  item?: PortfolioItem
  offerId?: string
}

const modalityName = (id: string) => projectModalities.find((m) => m.id === id)?.name ?? id

/** Ofertas del catálogo público: datos estáticos del frontend, NO entidades de la base de datos. */
const AVAILABLE_OFFERS = projectOffers.filter((o) => o.status === 'Disponible')

function offerRow(o: (typeof projectOffers)[number]): Row {
  return {
    key: `oferta:${o.id}`, kind: 'oferta', code: o.id, title: o.title, modalityCode: o.modalityId, modalityName: modalityName(o.modalityId),
    holder: '—', tutor: null, stateLabel: 'Disponible', progress: null, overdue: false, updated: null, offerId: o.id,
  }
}

function itemRow(i: PortfolioItem): Row {
  return {
    key: `${i.kind}:${i.public_id}`, kind: i.kind, code: i.code, title: i.title, modalityCode: i.modality_code, modalityName: i.modality_name,
    holder: i.holder, tutor: i.tutor?.full_name ?? null, stateLabel: i.state_name, progress: i.progress, overdue: i.overdue, updated: i.updated_at, item: i,
  }
}

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—'

const linkClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-bold text-[#0876B9] hover:bg-[var(--color-info-soft,rgba(8,118,185,0.1))]'

function RowActions({ row, returnTo }: { row: Row; returnTo: string }) {
  if (row.kind === 'oferta') {
    // El origen viaja en location.state: el detalle muestra «Volver al portafolio» y sin acciones de postulación.
    return <Link to={`/proyectos-de-grado/${row.offerId}`} state={{ from: 'portafolio', returnTo }} aria-label={`Ver oferta ${row.title}`} className={linkClass}><Eye size={14} aria-hidden /> Ver oferta</Link>
  }
  const item = row.item!
  if (item.kind === 'propuesta') {
    const evaluating = item.category === 'propuestas'
    return (
      <Link to={`/coordinacion/propuestas/${item.public_id}`} aria-label={`${evaluating ? 'Evaluar' : 'Ver'} propuesta ${item.title}`} className={linkClass}>
        <FileSearch size={14} aria-hidden /> {evaluating ? 'Evaluar propuesta' : 'Ver detalle'}
      </Link>
    )
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {item.category === 'por_asignar' && (
        <Link to="/coordinacion/asignacion" aria-label={`Asignar tutor a ${item.title}`} className={linkClass}><UserPlus size={14} aria-hidden /> Asignar tutor</Link>
      )}
      <Link to={`/coordinacion/proyectos/${item.public_id}`} aria-label={`${item.category === 'finalizados' ? 'Ver cierre de' : 'Abrir expediente de'} ${item.title}`} className={linkClass}>
        <Eye size={14} aria-hidden /> {item.category === 'finalizados' ? 'Ver cierre' : 'Ver detalle'}
      </Link>
    </div>
  )
}

export function PortafolioProyectos() {
  const accessToken = useAppStore((s) => s.accessToken)
  // Pestaña, filtros y página viven en la URL: al volver desde el detalle de una oferta se restablecen.
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const initial = (key: string) => params.get(key) ?? ''
  const [tab, setTab] = useState<TabId>(() => (TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as TabId) : 'todos'))
  const [searchInput, setSearchInput] = useState(() => initial('q'))
  const [search, setSearch] = useState(() => initial('q'))
  const [kind, setKind] = useState<'' | RecordKind>(() => (['oferta', 'propuesta', 'proceso'].includes(initial('kind')) ? (initial('kind') as RecordKind) : ''))
  const [modality, setModality] = useState(() => initial('modality'))
  const [state, setState] = useState(() => initial('state'))
  const [tutor, setTutor] = useState(() => initial('tutor'))
  const [dateFrom, setDateFrom] = useState(() => initial('from'))
  const [dateTo, setDateTo] = useState(() => initial('to'))
  const [page, setPage] = useState(() => Math.max(1, Number(params.get('page')) || 1))
  const [data, setData] = useState<PortfolioPage | null>(null)
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const next = new URLSearchParams()
    const put = (key: string, value: string | number) => value !== '' && value !== 1 && value !== 'todos' && next.set(key, String(value))
    put('tab', tab); put('q', search); put('kind', kind); put('modality', modality); put('state', state)
    put('tutor', tutor); put('from', dateFrom); put('to', dateTo); put('page', page)
    setParams(next, { replace: true })
  }, [tab, search, kind, modality, state, tutor, dateFrom, dateTo, page, setParams])
  const returnTo = `${location.pathname}${location.search}`

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage((p) => (searchInput === search ? p : 1))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  // Las ofertas no tienen estado de proceso, tutor ni fecha de actualización: esos filtros las excluyen.
  const offersAllowed = tab === 'disponibles' || tab === 'todos'
  const backendNeeded = tab !== 'disponibles' && kind !== 'oferta'
  const offerFilterable = !state && !tutor && !dateFrom && !dateTo && (kind === '' || kind === 'oferta')

  const offers = useMemo(() => {
    if (!offersAllowed || !offerFilterable) return []
    const needle = search.trim().toLowerCase()
    return AVAILABLE_OFFERS.filter(
      (o) => (!modality || o.modalityId === modality) && (!needle || [o.id, o.title, o.area].some((v) => v.toLowerCase().includes(needle)))
    ).map(offerRow)
  }, [offersAllowed, offerFilterable, search, modality])

  const load = useCallback(async () => {
    if (!accessToken) return
    setStatus('loading')
    try {
      const filters: PortfolioFilters = {
        category: tab === 'todos' || tab === 'disponibles' ? '' : tab,
        kind: kind === 'oferta' ? '' : kind,
        search, modality, state, tutor, date_from: dateFrom, date_to: dateTo, page, page_size: PAGE_SIZE,
      }
      const [list, sum] = await Promise.all([backendNeeded ? portfolioApi.list(accessToken, filters) : null, portfolioApi.summary(accessToken)])
      setData(list)
      setSummary(sum)
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el portafolio')
      setStatus('error')
    }
  }, [accessToken, tab, kind, search, modality, state, tutor, dateFrom, dateTo, page, backendNeeded])

  useEffect(() => {
    void load()
  }, [load])

  // Facetas del último listado conocido: se conservan mientras se recarga para no vaciar los filtros.
  const [facets, setFacets] = useState<PortfolioPage['facets'] | null>(null)
  useEffect(() => {
    if (data) setFacets(data.facets)
  }, [data])

  // Las ofertas aparecen solo en la primera página; después continúan las filas persistidas.
  const rows: Row[] = [...(page === 1 ? offers : []), ...(data ? data.items.map(itemRow) : [])]
  const total = (data?.total ?? 0) + offers.length
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const filtered = Boolean(search || kind || modality || state || tutor || dateFrom || dateTo)

  const select = (setter: (v: never) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(e.target.value as never)
    setPage(1)
  }
  const changeTab = (id: TabId) => {
    setTab(id)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Ofertas disponibles" value={AVAILABLE_OFFERS.length} sub="Catálogo público (no se guarda en la base)" icon={<Briefcase size={16} />} />
        <MetricCard label="Propuestas por evaluar" value={summary ? summary.proposals_to_evaluate : '—'} sub="Ideas de estudiantes pendientes" icon={<Lightbulb size={16} />} />
        <MetricCard label="Pendientes de asignación" value={summary ? summary.pending_assignment : '—'} sub={summary ? `${summary.pending_assignment_processes} procesos sin tutor` : 'Aprobadas y procesos sin tutor'} icon={<UserPlus size={16} />} />
        <MetricCard label="Procesos en curso" value={summary ? summary.in_progress : '—'} sub="Con tutor activo" icon={<Eye size={16} />} />
        <MetricCard label="Procesos finalizados" value={summary ? summary.finished : '—'} sub="Cierre oficial registrado" icon={<FileSearch size={16} />} />
        <MetricCard label="Procesos con retrasos" value={summary ? summary.delayed : '—'} sub="Con plan publicado y fechas vencidas" icon={<Briefcase size={16} />} />
      </div>

      <Card>
        <div role="tablist" aria-label="Categorías del portafolio" className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => changeTab(t.id)}
              className={`rounded-full border px-4 py-1.5 text-[13px] font-bold transition-colors ${
                tab === t.id ? 'border-[#0876B9] bg-[#0876B9] text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[#0876B9]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative block min-w-[240px] flex-1">
            <span className="sr-only">Buscar por código, proyecto, estudiante o tutor</span>
            <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
            <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por código, proyecto, estudiante o tutor…" className={`${fieldClass} w-full pl-9`} />
          </label>
          <select aria-label="Filtrar por tipo de registro" value={kind} onChange={select(setKind)} className={fieldClass}>
            <option value="">Todos los tipos</option>
            <option value="oferta">Ofertas</option>
            <option value="propuesta">Propuestas</option>
            <option value="proceso">Procesos oficiales</option>
          </select>
          <select aria-label="Filtrar por modalidad" value={modality} onChange={select(setModality)} className={fieldClass}>
            <option value="">Todas las modalidades</option>
            {projectModalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select aria-label="Filtrar por estado" value={state} onChange={select(setState)} className={fieldClass}>
            <option value="">Todos los estados</option>
            {(facets?.states ?? []).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <select aria-label="Filtrar por tutor" value={tutor} onChange={select(setTutor)} className={fieldClass}>
            <option value="">Todos los tutores</option>
            {(facets?.tutors ?? []).map((t) => <option key={t.public_id} value={t.public_id}>{t.full_name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
            Actualizado desde
            <input type="date" aria-label="Actualizado desde" value={dateFrom} onChange={select(setDateFrom)} className={fieldClass} />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
            hasta
            <input type="date" aria-label="Actualizado hasta" value={dateTo} onChange={select(setDateTo)} className={fieldClass} />
          </label>
        </div>

        {status === 'error' ? (
          <LoadError message={error} onRetry={() => void load()} />
        ) : status === 'loading' && !data && backendNeeded ? (
          <p className="px-2 py-6 text-[13px] text-[var(--color-text-muted)]">Cargando portafolio…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={filtered ? 'Ningún registro coincide con los filtros' : 'No hay registros en esta categoría'}
            description={filtered ? 'Prueba con otros filtros.' : 'Cuando existan ofertas, propuestas o procesos en esta categoría aparecerán aquí.'}
          />
        ) : (
          <>
            {offers.length > 0 && (
              <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
                Las ofertas provienen del catálogo público (datos estáticos de la plataforma): no son propuestas ni procesos, y publicar una oferta no crea ningún proceso.
              </p>
            )}
            <div className="overflow-x-auto scrollbar-premium">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead>
                  <tr>{['Código', 'Proyecto', 'Tipo', 'Modalidad', 'Estudiante / grupo', 'Tutor', 'Estado', 'Avance', 'Actualizado', ''].map((h) => <th key={h || 'acciones'} className="th">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td className="td font-mono text-[12px] font-bold">{r.code}</td>
                      <td className="td"><span className="block max-w-[260px] truncate" title={r.title}>{r.title}</span></td>
                      <td className="td"><Badge variant={KIND_VARIANT[r.kind]}>{KIND_LABEL[r.kind]}</Badge></td>
                      <td className="td text-[var(--color-text-muted)]">{r.modalityName}</td>
                      <td className="td">{r.holder}</td>
                      <td className="td">{r.tutor ?? (r.kind === 'proceso' && r.item?.category === 'por_asignar' ? <Badge variant="orange">Sin tutor</Badge> : '—')}</td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="gray">{r.stateLabel}</Badge>
                          {r.overdue && <Badge variant="red">Con retraso</Badge>}
                        </div>
                      </td>
                      <td className="td min-w-[120px]">{r.progress ? <ProgressBar percent={r.progress.percent} label={`Avance aprobado de ${r.title}`} /> : '—'}</td>
                      <td className="td whitespace-nowrap">{formatDate(r.updated)}</td>
                      <td className="td"><RowActions row={r} returnTo={returnTo} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px]">
              <span className="text-[var(--color-text-muted)]">{total} {total === 1 ? 'registro' : 'registros'}{data ? ` · página ${data.page} de ${totalPages}` : ''}</span>
              {data && (
                <span className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={page <= 1 || status === 'loading'} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <Button type="button" size="sm" variant="outline" disabled={page >= totalPages || status === 'loading'} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                </span>
              )}
            </nav>
          </>
        )}
      </Card>
    </div>
  )
}
