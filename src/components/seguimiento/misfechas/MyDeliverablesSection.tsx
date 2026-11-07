import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, FileText, LayoutGrid, List, Search } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { CommitmentOut, TaskOut } from '@/services/monitoring.service'
import type { DeliverableOut, StageOut, WorkPlanOut } from '@/services/workplan.service'
import { allDeliverables } from '@/components/proceso/workPlanUi.utils'
import { formatShortDate, normText, semesterGroups, type DraftMap, type HistoryMap } from '@/components/proceso/documentos/documentosHelpers'
import { EmptyNote, FileTypeIcon } from '@/components/proceso/documentos/documentosUi'
import { DeliverablesCalendar } from './DeliverablesCalendar'
import { BUCKET_LABEL, BUCKET_TONE, DAYS_TONE_CLASS, bucketOf, buildCalendarEvents, daysInfo, type Bucket } from './misFechasHelpers'
import { BucketPill, DateRowActions } from './misFechasUi'

type View = 'lista' | 'tarjetas' | 'calendario'

interface Props {
  plan: WorkPlanOut
  drafts: DraftMap
  history: HistoryMap
  tasks: Record<string, TaskOut>
  originalDue: Record<string, string | null>
  commitments: CommitmentOut[]
  onOpen: (deliverableId: string) => void
}

const control =
  'h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none transition-colors focus:border-[#0E6B9C] focus-visible:ring-2 focus-visible:ring-[#0E6B9C]/30'

function Days({ d, className }: { d: DeliverableOut; className?: string }) {
  const info = daysInfo(d)
  return <span className={cn('inline-flex w-fit rounded-md px-2 py-0.5 text-[12.5px] font-bold', DAYS_TONE_CLASS[info.tone], className)}>{info.text}</span>
}

function Due({ d, extended }: { d: DeliverableOut; extended: boolean }) {
  const late = bucketOf(d) === 'vencido'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px]', late ? 'font-bold text-[#B91C1C] dark:text-red-300' : 'text-[var(--color-text)]')} title={extended ? 'Tu tutor autorizó una ampliación del plazo' : undefined}>
      <CalendarDays size={14} aria-hidden="true" className={late ? 'text-[#DC2626]' : 'text-[var(--color-text-muted)]'} />
      {formatShortDate(d.due_date)}
      {extended && <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10.5px] font-bold text-violet-800 dark:bg-violet-500/25 dark:text-violet-200">Plazo ampliado</span>}
    </span>
  )
}

const STATUS_FILTERS: Array<{ value: Bucket | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'aprobado', label: BUCKET_LABEL.aprobado },
  { value: 'revision', label: BUCKET_LABEL.revision },
  { value: 'pendiente', label: BUCKET_LABEL.pendiente },
  { value: 'vencido', label: BUCKET_LABEL.vencido },
]

interface ItemProps {
  d: DeliverableOut
  stage: StageOut
  hint: string | null
  extended: boolean
  hasDraft: boolean
  onOpen: (id: string) => void
}

function Row({ d, stage, hint, extended, hasDraft, onOpen }: ItemProps) {
  const bucket = bucketOf(d)
  return (
    <li className={cn('grid items-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] px-4 py-3 transition-colors duration-150 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]', BUCKET_TONE[bucket].row)}>
      <div className="flex min-w-0 items-center gap-3">
        <FileTypeIcon deliverable={d} tone={BUCKET_TONE[bucketOf(d)].iconBox} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-[var(--color-secondary)]" title={d.title}>{d.title}</p>
          <p className="truncate text-[12px] text-[var(--color-text-muted)]">{stage.name} · {d.mandatory ? 'Obligatorio' : 'Opcional'}</p>
        </div>
      </div>
      <div className="flex flex-col items-start gap-1">
        <BucketPill deliverable={d} hasDraft={hasDraft} />
        {hint && <span className="text-[11.5px] text-[var(--color-text-muted)]">{hint}</span>}
      </div>
      <div className="flex flex-col items-start gap-1">
        <Due d={d} extended={extended} />
        <Days d={d} className="lg:hidden" />
      </div>
      <div className="hidden lg:block"><Days d={d} /></div>
      <DateRowActions deliverable={d} onOpen={onOpen} />
    </li>
  )
}

function Card({ d, stage, hint, extended, hasDraft, onOpen }: ItemProps) {
  return (
    <li className={cn('flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] p-4 transition-colors duration-150', BUCKET_TONE[bucketOf(d)].row)}>
      <div className="flex items-start gap-3">
        <FileTypeIcon deliverable={d} tone={BUCKET_TONE[bucketOf(d)].iconBox} />
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-snug text-[var(--color-secondary)]">{d.title}</p>
          <p className="text-[12px] text-[var(--color-text-muted)]">{stage.name} · {d.mandatory ? 'Obligatorio' : 'Opcional'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><BucketPill deliverable={d} hasDraft={hasDraft} /><Days d={d} /></div>
      <Due d={d} extended={extended} />
      {hint && <p className="text-[12px] text-[var(--color-text-muted)]">{hint}</p>}
      <div className="border-t border-[var(--color-border)] pt-2"><DateRowActions deliverable={d} onOpen={onOpen} /></div>
    </li>
  )
}

export function MyDeliverablesSection({ plan, drafts, history, tasks, originalDue, commitments, onOpen }: Props) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Bucket | 'todos'>('todos')
  const [semester, setSemester] = useState<number | 'todos'>('todos')
  const [view, setView] = useState<View>('lista')
  const [toggled, setToggled] = useState<Record<number, boolean>>({})
  const [filtersOpen, setFiltersOpen] = useState(false)

  const groups = useMemo(() => semesterGroups(plan), [plan])
  const everything = useMemo(() => allDeliverables(plan), [plan])
  const filtering = search.trim() !== '' || status !== 'todos' || semester !== 'todos'
  const query = normText(search.trim())

  const visible = useMemo(
    () =>
      groups
        .filter((g) => semester === 'todos' || g.semester === semester)
        .map((g) => ({
          ...g,
          rows: g.rows.filter(({ deliverable: d, stage }) => (status === 'todos' || bucketOf(d) === status) && (query === '' || normText(d.title).includes(query) || normText(stage.name).includes(query))),
        }))
        .filter((g) => g.rows.length > 0),
    [groups, semester, status, query]
  )

  // Se abre por defecto el primer semestre que tiene algo que hacer; con filtros activos se abren todos.
  const defaultSemester = groups.find((g) => g.rows.some((r) => r.deliverable.applicable && bucketOf(r.deliverable) !== 'aprobado'))?.semester ?? groups[0]?.semester ?? null
  const isOpen = (s: number) => filtering || (toggled[s] ?? s === defaultSemester)
  const events = useMemo(() => buildCalendarEvents(plan, history, tasks, commitments, originalDue), [plan, history, tasks, commitments, originalDue])

  const hintFor = (d: DeliverableOut): string | null => {
    if (!d.applicable) return 'No aplica a tu proyecto'
    if (d.status === 'pendiente' && !d.is_overdue) {
      const dep = d.depends_on_public_id ? everything.find((x) => x.public_id === d.depends_on_public_id) : null
      return `Se habilita al aprobar ${dep ? `«${dep.title}»` : 'el entregable previo'}`
    }
    return null
  }
  const clear = () => { setSearch(''); setStatus('todos'); setSemester('todos') }
  const Item = view === 'tarjetas' ? Card : Row

  return (
    <section aria-label="Mis entregables del plan de trabajo" className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
      <h2 className="font-display text-[20px] font-extrabold text-[var(--color-secondary)]">Mis entregables del plan de trabajo</h2>

      <div className="flex flex-wrap items-end gap-2" role="search">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Buscar entregable</span>
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar entregable…" className={cn(control, 'w-full pl-9')} />
        </label>
        <button type="button" aria-expanded={filtersOpen} aria-controls="mis-fechas-filtros" onClick={() => setFiltersOpen((v) => !v)} className={cn(control, 'cursor-pointer font-bold sm:hidden')}>
          Filtros{filtering ? ' (activos)' : ''}
        </button>
        <div id="mis-fechas-filtros" className={cn('flex-wrap items-end gap-2', filtersOpen ? 'flex w-full' : 'hidden sm:flex')}>
          <label className="flex flex-col text-[11px] font-semibold text-[var(--color-text-muted)]">
            Estado
            <select value={status} onChange={(e) => setStatus(e.target.value as Bucket | 'todos')} className={cn(control, 'mt-0.5 min-w-[170px]')}>
              {STATUS_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {groups.length > 1 && (
            <label className="flex flex-col text-[11px] font-semibold text-[var(--color-text-muted)]">
              Semestre
              <select value={String(semester)} onChange={(e) => setSemester(e.target.value === 'todos' ? 'todos' : Number(e.target.value))} className={cn(control, 'mt-0.5 min-w-[150px]')}>
                <option value="todos">Todos</option>
                {groups.map((g) => <option key={g.semester} value={g.semester}>Semestre {g.semester}</option>)}
              </select>
            </label>
          )}
          {filtering && <button type="button" onClick={clear} className="h-10 cursor-pointer rounded-xl px-3 text-[13px] font-bold text-[#0E6B9C] hover:bg-[#0E6B9C]/10">Limpiar filtros</button>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label="Vista" className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1 text-[12.5px] font-bold">
            {([['lista', 'Lista', List], ['tarjetas', 'Tarjetas', LayoutGrid]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={cn('inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]', view === value ? 'bg-[#FF641D]/15 text-[#C2410C] dark:text-orange-300' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}>
                <Icon size={14} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <button type="button" aria-pressed={view === 'calendario'} onClick={() => setView((v) => (v === 'calendario' ? 'lista' : 'calendario'))} className={cn('inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-[13px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]', view === 'calendario' ? 'border-[#FF641D] bg-[#FF641D]/10 text-[#C2410C] dark:text-orange-300' : 'border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[#0E6B9C]')}>
            <CalendarDays size={15} aria-hidden="true" />Calendario
          </button>
        </div>
      </div>

      {view === 'calendario' ? (
        <DeliverablesCalendar events={events} onOpenDeliverable={onOpen} />
      ) : groups.length === 0 || groups.every((g) => g.rows.length === 0) ? (
        <EmptyNote title="Tu plan todavía no tiene entregables">Cuando tu tutor agregue entregables al plan, aparecerán aquí.</EmptyNote>
      ) : visible.length === 0 ? (
        <EmptyNote title="Ningún entregable coincide con los filtros">Prueba con otro estado o semestre.</EmptyNote>
      ) : (
        visible.map((g) => {
          const open = isOpen(g.semester)
          const percent = g.total > 0 ? Math.round((g.approved / g.total) * 100) : 0
          const panelId = `mf-semestre-${g.semester}`
          return (
            <div key={g.semester} className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
              <button type="button" aria-expanded={open} aria-controls={panelId} disabled={filtering} onClick={() => setToggled((t) => ({ ...t, [g.semester]: !open }))} className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 bg-[#0E6B9C]/[0.06] px-4 py-3 text-left transition-colors hover:bg-[#0E6B9C]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C] disabled:cursor-default">
                <ChevronDown size={18} aria-hidden="true" className={cn('shrink-0 text-[var(--color-text-muted)] transition-transform', open ? 'rotate-0' : '-rotate-90')} />
                <span className="min-w-0 flex-1 text-[15px] font-extrabold text-[var(--color-secondary)]">Semestre {g.semester} <span className="font-semibold text-[var(--color-text-muted)]">– {g.title}</span></span>
                <span className="rounded-full bg-[#0E6B9C]/10 px-2.5 py-1 text-[12px] font-bold text-[#0E6B9C] dark:bg-sky-400/15 dark:text-sky-300">{g.rows.length} {g.rows.length === 1 ? 'entregable' : 'entregables'}</span>
                {g.total > 0 && (
                  <span className="flex items-center gap-2" title={`${g.approved} de ${g.total} aprobados`}>
                    <span className="h-2 w-28 overflow-hidden rounded-full bg-[var(--color-border)]" aria-hidden="true"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></span>
                    <span className="w-10 text-right text-[13px] font-bold text-[var(--color-text)]">{percent}%</span>
                  </span>
                )}
              </button>
              {open && (
                <div id={panelId}>
                  {view === 'lista' && (
                    <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-x-4 bg-[var(--color-bg)] px-4 py-2 text-[11.5px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] md:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <span>Entregable</span><span>Estado</span><span>Fecha límite</span><span className="hidden lg:block">Días restantes</span><span className="text-right">Acciones</span>
                    </div>
                  )}
                  <ul className={cn(view === 'tarjetas' && 'grid gap-3 border-t border-[var(--color-border)] p-4 sm:grid-cols-2 2xl:grid-cols-3')}>
                    {g.rows.map(({ deliverable, stage }) => (
                      <Item key={deliverable.public_id} d={deliverable} stage={stage} hint={hintFor(deliverable)} extended={(tasks[deliverable.public_id]?.extensions.length ?? 0) > 0} hasDraft={Boolean(drafts[deliverable.public_id])} onOpen={onOpen} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })
      )}
      <p className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]"><FileText size={13} aria-hidden="true" />Un borrador guardado es privado: solo cuenta como entrega cuando pulsas «Entregar» en el detalle.</p>
    </section>
  )
}
