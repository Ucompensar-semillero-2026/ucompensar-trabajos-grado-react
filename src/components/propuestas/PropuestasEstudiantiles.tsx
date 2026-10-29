import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Lightbulb } from 'lucide-react'
import { Button, Card, EmptyState, MetricCard } from '@/components/ui'
import { LoadError } from '@/components/tutor/tutorUi'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import {
  MODALITY_LABELS,
  STATUS_LABELS,
  proposalsApi,
  type ProposalPage,
  type ProposalStatus,
  type ProposalSummary,
  type SuggestedModality,
} from '@/services/proposals.service'
import { formatRelativeDate } from '@/utils/format'
import { ProposalStatusBadge, inputClass } from './propuestasUi'

const PAGE_SIZE = 15
const STATUS_ORDER: ProposalStatus[] = ['pendiente_revision', 'en_evaluacion', 'requiere_informacion', 'aprobada', 'pendiente_tutor', 'tutor_asignado', 'rechazada', 'convertida']

export function PropuestasEstudiantiles() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [modality, setModality] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ProposalPage | null>(null)
  const [summary, setSummary] = useState<ProposalSummary | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    if (!accessToken) return
    setState('loading')
    try {
      const [list, sum] = await Promise.all([
        proposalsApi.list(accessToken, { search, modality, status, date_from: dateFrom, date_to: dateTo, page, page_size: PAGE_SIZE }),
        proposalsApi.summary(accessToken),
      ])
      setData(list)
      setSummary(sum)
      setError(null)
      setState('ready')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las propuestas')
      setState('error')
    }
  }, [accessToken, search, modality, status, dateFrom, dateTo, page])

  useEffect(() => {
    void load()
  }, [load])

  const filter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(e.target.value)
    setPage(1)
  }
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const filtering = Boolean(search || modality || status || dateFrom || dateTo)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Por revisar" value={summary ? summary.by_status.pendiente_revision : '—'} sub="Pendientes de revisión" icon={<Lightbulb size={16} />} />
        <MetricCard label="En evaluación" value={summary ? summary.by_status.en_evaluacion : '—'} sub="Con evaluación iniciada" icon={<Eye size={16} />} />
        <MetricCard label="Esperan información" value={summary ? summary.by_status.requiere_informacion : '—'} sub="Respuesta del autor" icon={<Eye size={16} />} />
        <MetricCard label="Pendientes de tutor" value={summary ? summary.by_status.aprobada + summary.by_status.pendiente_tutor : '—'} sub="Aprobadas sin tutor confirmado" icon={<Eye size={16} />} />
      </div>
      {summary && (
        <ul aria-label="Propuestas por estado" className="flex flex-wrap gap-2 text-[12px]">
          {STATUS_ORDER.map((s) => (
            <li key={s}><span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[var(--color-text-muted)]">{STATUS_LABELS[s]}: <strong className="text-[var(--color-text)]">{summary.by_status[s]}</strong></span></li>
          ))}
        </ul>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-[12px] font-semibold text-[var(--color-text-muted)]">Buscar
            <input type="search" className={inputClass} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Título, código o autor…" />
          </label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Modalidad
            <select className={inputClass} value={modality} onChange={filter(setModality)}>
              <option value="">Todas</option>
              {(Object.keys(MODALITY_LABELS) as SuggestedModality[]).map((k) => <option key={k} value={k}>{MODALITY_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Estado
            <select className={inputClass} value={status} onChange={filter(setStatus)}>
              <option value="">Todos</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Desde<input type="date" className={inputClass} value={dateFrom} onChange={filter(setDateFrom)} /></label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Hasta<input type="date" className={inputClass} value={dateTo} onChange={filter(setDateTo)} /></label>
        </div>

        {state === 'error' ? (
          <LoadError message={error} onRetry={() => void load()} />
        ) : !data ? (
          <p className="px-2 py-6 text-[13px] text-[var(--color-text-muted)]">Cargando propuestas…</p>
        ) : data.total === 0 ? (
          <EmptyState icon={Lightbulb} title={filtering ? 'Ninguna propuesta coincide con los filtros' : 'Aún no hay propuestas'} description={filtering ? 'Prueba con otros filtros.' : 'Las propuestas aparecen cuando los estudiantes presentan sus ideas desde el catálogo público.'} />
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-premium">
              <table className="w-full min-w-[860px] border-collapse">
                <thead><tr>{['Código', 'Propuesta', 'Autor', 'Modalidad sugerida', 'Estado', 'Enviada', ''].map((h) => <th key={h || 'acc'} className="th">{h}</th>)}</tr></thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.public_id}>
                      <td className="td font-mono text-[12px] font-bold">{p.code}</td>
                      <td className="td"><span className="block max-w-[260px] truncate" title={p.title}>{p.title}</span><span className="text-[12px] text-[var(--color-text-muted)]">{p.member_count} compañero(s)</span></td>
                      <td className="td font-semibold">{p.author.full_name}</td>
                      <td className="td text-[var(--color-text-muted)]">{MODALITY_LABELS[p.suggested_modality]}</td>
                      <td className="td"><ProposalStatusBadge status={p.status} /></td>
                      <td className="td text-[12px] text-[var(--color-text-muted)]">{formatRelativeDate(p.created_at)}</td>
                      <td className="td text-right">
                        <Link to={`/coordinacion/propuestas/${p.public_id}`} aria-label={`Abrir la propuesta ${p.code}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-bold text-[#0876B9] hover:bg-[var(--color-info-soft,rgba(8,118,185,0.1))]">
                          <Eye size={14} aria-hidden /> Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px]">
              <span className="text-[var(--color-text-muted)]">{data.total} propuesta(s) · página {data.page} de {totalPages}</span>
              <span className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={page <= 1 || state === 'loading'} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button type="button" size="sm" variant="outline" disabled={page >= totalPages || state === 'loading'} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
              </span>
            </nav>
          </>
        )}
      </Card>
    </div>
  )
}
