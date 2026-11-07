import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, FolderOpen, LayoutGrid, List, Search } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { DeliverableOut, StageOut, WorkPlanOut } from '@/services/workplan.service'
import { allDeliverables } from '../workPlanUi.utils'
import {
  NO_FILTERS,
  STATUS_FILTER_OPTIONS,
  applyFilters,
  displayStatus,
  filtersActive,
  formatShortDate,
  semesterGroups,
  type DraftMap,
  type Filters,
} from './documentosHelpers'
import { DeliverableActions, EmptyNote, FileTypeIcon, StatusPill } from './documentosUi'

interface Props {
  plan: WorkPlanOut
  drafts: DraftMap
  selectedId: string | null
  /** Semestre que se abre por defecto (el del entregable que requiere atención). */
  defaultSemester: number | null
  onSelect: (deliverableId: string) => void
  onOpen: (deliverableId: string) => void
}

const control =
  'h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none transition-colors focus:border-[#0E6B9C] focus-visible:ring-2 focus-visible:ring-[#0E6B9C]/30'

function DueDate({ d }: { d: DeliverableOut }) {
  const late = d.is_overdue && d.status !== 'aprobado'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px]', late ? 'font-bold text-red-700 dark:text-red-300' : 'text-[var(--color-text)]')}>
      <CalendarDays size={14} aria-hidden="true" className={late ? 'text-red-600' : 'text-[var(--color-text-muted)]'} />
      {formatShortDate(d.due_date)}
    </span>
  )
}

interface RowProps {
  d: DeliverableOut
  stage: StageOut
  hint: string | null
  drafts: DraftMap
  selected: boolean
  onSelect: (id: string) => void
  onOpen: (id: string) => void
}

function DeliverableRow({ d, stage, hint, drafts, selected, onSelect, onOpen }: RowProps) {
  return (
    <li
      onClick={() => onSelect(d.public_id)}
      className={cn(
        'grid cursor-pointer items-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] px-4 py-3 transition-colors md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1fr)_168px]',
        selected ? 'bg-[#FF641D]/10 dark:bg-[#FF641D]/10' : 'hover:bg-[var(--color-bg)]'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <FileTypeIcon deliverable={d} />
        <div className="min-w-0">
          <button
            type="button"
            aria-pressed={selected}
            onClick={(e) => { e.stopPropagation(); onSelect(d.public_id) }}
            className="block max-w-full cursor-pointer truncate text-left text-[14px] font-bold text-[var(--color-secondary)] hover:text-[#0E6B9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]"
          >
            {d.title}
          </button>
          <p className="truncate text-[12px] text-[var(--color-text-muted)]">
            {stage.name} · {d.mandatory ? 'Obligatorio' : 'Opcional'}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-start gap-1">
        <StatusPill status={displayStatus(d, drafts)} />
        {hint && <span className="text-[11.5px] text-[var(--color-text-muted)]">{hint}</span>}
      </div>
      <DueDate d={d} />
      <DeliverableActions deliverable={d} onOpen={onOpen} />
    </li>
  )
}

function DeliverableCardItem({ d, stage, hint, drafts, selected, onSelect, onOpen }: RowProps) {
  return (
    <li
      onClick={() => onSelect(d.public_id)}
      className={cn('flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-colors', selected ? 'border-[#FF641D] bg-[#FF641D]/5' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[#0E6B9C]/50')}
    >
      <div className="flex items-start gap-3">
        <FileTypeIcon deliverable={d} />
        <div className="min-w-0">
          <button type="button" aria-pressed={selected} onClick={(e) => { e.stopPropagation(); onSelect(d.public_id) }} className="cursor-pointer text-left text-[14px] font-bold leading-snug text-[var(--color-secondary)] hover:text-[#0E6B9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]">
            {d.title}
          </button>
          <p className="text-[12px] text-[var(--color-text-muted)]">{stage.name} · {d.mandatory ? 'Obligatorio' : 'Opcional'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill status={displayStatus(d, drafts)} />
        <DueDate d={d} />
      </div>
      {hint && <p className="text-[12px] text-[var(--color-text-muted)]">{hint}</p>}
      <div className="flex justify-end border-t border-[var(--color-border)] pt-2">
        <DeliverableActions deliverable={d} onOpen={onOpen} />
      </div>
    </li>
  )
}

export function DeliverablesTab({ plan, drafts, selectedId, defaultSemester, onSelect, onOpen }: Props) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [view, setView] = useState<'lista' | 'tarjetas'>('lista')
  const [toggled, setToggled] = useState<Record<number, boolean>>({})

  const groups = useMemo(() => semesterGroups(plan), [plan])
  const visible = useMemo(() => applyFilters(groups, filters, drafts), [groups, filters, drafts])
  const filtering = filtersActive(filters)
  const everything = useMemo(() => allDeliverables(plan), [plan])
  const openDefault = defaultSemester ?? groups[0]?.semester ?? null
  const isOpen = (semester: number) => filtering || (toggled[semester] ?? semester === openDefault)

  /** Explica por qué un entregable todavía no se puede entregar (dependencia real del plan). */
  const hintFor = (d: DeliverableOut): string | null => {
    if (!d.applicable) return 'No aplica a tu proyecto'
    if (d.status === 'pendiente') {
      const dep = d.depends_on_public_id ? everything.find((x) => x.public_id === d.depends_on_public_id) : null
      return `Se habilita al aprobar ${dep ? `«${dep.title}»` : 'el entregable previo'}`
    }
    return null
  }

  if (groups.length === 0 || groups.every((g) => g.rows.length === 0)) {
    return <EmptyNote title="Tu plan todavía no tiene entregables">Cuando tu tutor agregue entregables al plan, aparecerán aquí.</EmptyNote>
  }

  const Item = view === 'lista' ? DeliverableRow : DeliverableCardItem

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[19px] font-extrabold text-[var(--color-secondary)]">Entregables por semestre</h2>
        <div role="group" aria-label="Vista" className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1 text-[12.5px] font-bold">
          {([['lista', 'Lista', List], ['tarjetas', 'Tarjetas', LayoutGrid]] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={cn('inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]', view === value ? 'bg-[#FF641D]/15 text-[#C2410C] dark:text-orange-300' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="search">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Buscar entregable</span>
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
          <input type="search" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Buscar entregable…" className={cn(control, 'w-full pl-9')} />
        </label>
        <label>
          <span className="sr-only">Filtrar por estado</span>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as Filters['status'] }))} className={control}>
            {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        {groups.length > 1 && (
          <label>
            <span className="sr-only">Filtrar por semestre</span>
            <select value={String(filters.semester)} onChange={(e) => setFilters((f) => ({ ...f, semester: e.target.value === 'todos' ? 'todos' : Number(e.target.value) }))} className={control}>
              <option value="todos">Todos los semestres</option>
              {groups.map((g) => <option key={g.semester} value={g.semester}>Semestre {g.semester}</option>)}
            </select>
          </label>
        )}
        {filtering && (
          <button type="button" onClick={() => setFilters(NO_FILTERS)} className="h-10 cursor-pointer rounded-xl px-3 text-[13px] font-bold text-[#0E6B9C] hover:bg-[#0E6B9C]/10">
            Limpiar filtros
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyNote title="Ningún entregable coincide con los filtros">Prueba con otro estado o semestre.</EmptyNote>
      ) : (
        visible.map((g) => {
          const open = isOpen(g.semester)
          const percent = g.total > 0 ? Math.round((g.approved / g.total) * 100) : 0
          const panelId = `semestre-${g.semester}-panel`
          return (
            <section key={g.semester} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                disabled={filtering}
                onClick={() => setToggled((t) => ({ ...t, [g.semester]: !open }))}
                className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C] disabled:cursor-default"
              >
                <ChevronDown size={18} aria-hidden="true" className={cn('shrink-0 text-[var(--color-text-muted)] transition-transform', open ? 'rotate-0' : '-rotate-90')} />
                <span className="min-w-0 flex-1 text-[15px] font-extrabold text-[var(--color-secondary)]">
                  Semestre {g.semester} <span className="font-semibold text-[var(--color-text-muted)]">– {g.title}</span>
                </span>
                <span className="rounded-full bg-[#0E6B9C]/10 px-2.5 py-1 text-[12px] font-bold text-[#0E6B9C] dark:bg-sky-400/15 dark:text-sky-300">
                  {g.rows.length} {g.rows.length === 1 ? 'entregable' : 'entregables'}
                </span>
                {g.total > 0 && (
                  <span className="flex items-center gap-2" title={`${g.approved} de ${g.total} aprobados`}>
                    <span className="h-2 w-28 overflow-hidden rounded-full bg-[var(--color-border)]" aria-hidden="true">
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="w-10 text-right text-[13px] font-bold text-[var(--color-text)]">{percent}%</span>
                  </span>
                )}
              </button>
              {open && (
                <div id={panelId}>
                  {view === 'lista' && (
                    <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1fr)_168px] gap-x-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-[11.5px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] md:grid">
                      <span>Entregable</span>
                      <span>Estado</span>
                      <span>Fecha límite</span>
                      <span className="text-right">Acciones</span>
                    </div>
                  )}
                  <ul className={cn(view === 'tarjetas' && 'grid gap-3 border-t border-[var(--color-border)] p-4 sm:grid-cols-2 2xl:grid-cols-3')}>
                    {g.rows.map(({ deliverable, stage }) => (
                      <Item key={deliverable.public_id} d={deliverable} stage={stage} hint={hintFor(deliverable)} drafts={drafts} selected={selectedId === deliverable.public_id} onSelect={onSelect} onOpen={onOpen} />
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )
        })
      )}
      <p className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
        <FolderOpen size={13} aria-hidden="true" />
        Un borrador guardado es privado: tu tutor solo ve lo que entregas con «Entregar».
      </p>
    </div>
  )
}
