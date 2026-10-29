import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { tutorApi, type PlanStatus, type TutorOverviewOut, type TutorProjectOut } from '@/services/tutor.service'
import { formatCalendarDate } from '@/components/proceso/workPlanUi'

export type OverviewStatus = 'loading' | 'ready' | 'error'

/** Carga el panel del tutor (proyectos donde es tutor ACTIVO, según el backend). Permite reintentar. */
export function useTutorOverview() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [data, setData] = useState<TutorOverviewOut | null>(null)
  const [status, setStatus] = useState<OverviewStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setStatus('loading')
    try {
      setData(await tutorApi.overview(accessToken))
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu panel')
      setStatus('error')
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  return { data, status, error, reload: load }
}

export function projectTitle(p: { title: string | null; process_code: string }): string {
  return p.title?.trim() || `Sin título registrado · ${p.process_code}`
}

export const PLAN_STATUS_META: Record<PlanStatus, { label: string; variant: 'gray' | 'orange' | 'green' }> = {
  sin_plan: { label: 'Sin plan', variant: 'gray' },
  borrador: { label: 'Borrador', variant: 'orange' },
  publicado: { label: 'Publicado', variant: 'green' },
}

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  const { label, variant } = PLAN_STATUS_META[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-secondary-soft)]"
    >
      <div className="h-full rounded-full bg-[#FF6500]" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function LoadError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-[13px] text-red-700">
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}

type ProjectFilter = 'todos' | PlanStatus | 'revision' | 'correcciones' | 'vencidos'

const FILTER_LABELS: Array<[ProjectFilter, string]> = [
  ['todos', 'Todos los estados'],
  ['sin_plan', 'Sin plan'],
  ['borrador', 'Plan en borrador'],
  ['publicado', 'Plan publicado'],
  ['revision', 'Con entregas por revisar'],
  ['correcciones', 'Con correcciones pendientes'],
  ['vencidos', 'Con entregas vencidas'],
]

const selectClass =
  'min-w-[170px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]'

/** Tabla de proyectos con filtros por proyecto/estudiante, modalidad, etapa y estado. */
export function ProjectsTable({ projects, limit }: { projects: TutorProjectOut[]; limit?: number }) {
  const [text, setText] = useState('')
  const [modality, setModality] = useState('')
  const [stage, setStage] = useState('')
  const [state, setState] = useState<ProjectFilter>('todos')

  const modalities = useMemo(() => [...new Set(projects.map((p) => p.modality_name))].sort(), [projects])
  const stages = useMemo(() => [...new Set(projects.map((p) => p.current_stage).filter((s): s is string => Boolean(s)))].sort(), [projects])

  const filtered = projects.filter((p) => {
    const haystack = `${projectTitle(p)} ${p.student.full_name} ${p.process_code}`.toLowerCase()
    if (text && !haystack.includes(text.toLowerCase())) return false
    if (modality && p.modality_name !== modality) return false
    if (stage && p.current_stage !== stage) return false
    if (state === 'revision') return p.pending_review_count > 0
    if (state === 'correcciones') return p.corrections_count > 0
    if (state === 'vencidos') return p.overdue_count > 0
    if (state !== 'todos') return p.plan_status === state
    return true
  })
  const rows = limit ? filtered.slice(0, limit) : filtered

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar por proyecto o estudiante…"
          aria-label="Buscar por proyecto o estudiante"
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]"
        />
        <select value={modality} onChange={(e) => setModality(e.target.value)} aria-label="Filtrar por modalidad" className={selectClass}>
          <option value="">Todas las modalidades</option>
          {modalities.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filtrar por etapa" className={selectClass}>
          <option value="">Todas las etapas</option>
          {stages.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value as ProjectFilter)} aria-label="Filtrar por estado" className={selectClass}>
          {FILTER_LABELS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <p className="px-2 py-6 text-center text-[13px] text-[var(--color-text-muted)]">Ningún proyecto coincide con los filtros.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-premium">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr>
                {['Estudiante', 'Proyecto', 'Modalidad', 'Etapa actual', 'Avance aprobado', 'Próxima entrega', 'Por revisar', ''].map((h) => (
                  <th key={h || 'acciones'} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.process_public_id}>
                  <td className="td font-semibold">{p.student.full_name}</td>
                  <td className="td">
                    <span className="block max-w-[260px] truncate" title={projectTitle(p)}>{projectTitle(p)}</span>
                    <PlanStatusBadge status={p.plan_status} />
                  </td>
                  <td className="td text-[var(--color-text-muted)]">{p.modality_name}</td>
                  <td className="td text-[var(--color-text-muted)]">{p.current_stage ?? '—'}</td>
                  <td className="td min-w-[150px]">
                    {p.progress ? (
                      <>
                        <ProgressBar percent={p.progress.percent} label={`Avance de ${p.student.full_name}`} />
                        <span className="mt-1 block text-[12px] text-[var(--color-text-muted)]">
                          {p.progress.percent}% · {p.progress.approved}/{p.progress.total_required}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-[var(--color-text-muted)]">Sin plan publicado</span>
                    )}
                  </td>
                  <td className="td text-[13px]">
                    {p.next_due_date ? (
                      <>
                        <span className="block font-semibold">{p.next_due_title}</span>
                        <span className="text-[12px] text-[var(--color-text-muted)]">{formatCalendarDate(p.next_due_date)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td">{p.pending_review_count > 0 ? <Badge variant="orange">{p.pending_review_count}</Badge> : '0'}</td>
                  <td className="td text-right">
                    <Link
                      to={`/tutor/proyectos/${p.process_public_id}`}
                      aria-label={`Ver proyecto de ${p.student.full_name}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-bold text-[#0876B9] hover:bg-[var(--color-info-soft,rgba(8,118,185,0.1))]"
                    >
                      <Eye size={14} aria-hidden /> Ver proyecto
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {limit && filtered.length > rows.length && (
        <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">Mostrando {rows.length} de {filtered.length} proyectos.</p>
      )}
    </div>
  )
}
