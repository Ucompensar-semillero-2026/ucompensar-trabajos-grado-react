import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, FileText, Layers, LayoutGrid, LayoutList, Maximize2, Pencil, Search, SlidersHorizontal } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { cn } from '@/utils/cn'
import type { WorkPlanOut } from '@/services/workplan.service'
import type { ProcessOut } from '@/services/processes.service'
import { DeliverableStatusBadge } from '@/components/proceso/workPlanUi'
import { DeliveryCalendar } from './DeliveryCalendar'
import { ProjectGantt } from './ProjectGantt'
import { SubmissionReviewModal } from './SubmissionReview'
import { DeliverableDialog, DeliverableItem, NextDeliveryCard, ProgressStat, Stat, type DetailMode } from './planShared'
import {
  CARD, FILTER_LABELS, formatShort, ganttRange, liveDeliverables, matchesDeliverable, nextDelivery, planCounts, planYears, stageTone, stateTone,
  type DeliverableFilter, type GanttMode,
} from './tutorUi.utils'

interface Props {
  processId: string
  process: ProcessOut
  plan: WorkPlanOut | null
  canManage: boolean
  onPlan: (plan: WorkPlanOut) => void
  reload: () => Promise<void>
}

const modeValue = (m: GanttMode): string => String(m)
const parseMode = (v: string): GanttMode => (v === 'todo' || v === 'hoy' ? v : Number(v))

/** Pestaña «Cronograma»: indicadores, Gantt con fechas reales, tabla de todos los entregables, próxima entrega y calendario. */
export function ScheduleBoard({ processId, process, plan, canManage, onPlan, reload }: Props) {
  const [stageId, setStageId] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ id: string; mode: DetailMode } | null>(null)
  const [mode, setMode] = useState<GanttMode>('todo')
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DeliverableFilter>('todos')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<'tabla' | 'tarjetas'>('tabla')
  const [notice, setNotice] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)

  const stages = useMemo(() => plan?.stages ?? [], [plan])
  const all = useMemo(() => stages.flatMap((s) => s.deliverables), [stages])

  if (!plan) return <Card><p className="text-[13px] text-[var(--color-text-muted)]">Aún no hay un plan de trabajo para este proyecto.</p></Card>

  const stage = stages.find((s) => s.public_id === stageId) ?? null
  const projectClosed = Boolean(process.closed_at || plan.official_completion || stateTone(process.state.name) === 'red')
  const counts = planCounts(plan)
  const progress = plan.progress.total_required > 0 ? plan.progress : null
  const scope: WorkPlanOut = stage ? { ...plan, stages: [stage] } : plan
  const next = projectClosed ? null : nextDelivery(scope)
  const nextId = next?.deliverable.public_id ?? null
  const live = liveDeliverables(scope)
  const allApproved = live.length > 0 && live.every((d) => d.status === 'aprobado')
  const range = ganttRange(plan, mode)
  const years = planYears(plan)

  const items = stages.flatMap((s, i) => s.deliverables.map((d) => ({ d, stage: { name: s.name, index: i }, stageId: s.public_id })))
  const inStage = items.filter((x) => !stageId || x.stageId === stageId)
  const rows = inStage.filter((x) => matchesDeliverable(x.d, query, filter, false))
  const filtered = Boolean(query.trim()) || filter !== 'todos' || Boolean(stageId)
  const picked = pickedId ? all.find((d) => d.public_id === pickedId) ?? null : null
  const pickedStage = picked ? stages.find((s) => s.deliverables.some((d) => d.public_id === picked.public_id)) : null
  const selectedDetail = detail ? all.find((d) => d.public_id === detail.id) ?? null : null

  const open = (id: string, m: DetailMode = 'ver') => {
    const owner = stages.find((s) => s.deliverables.some((d) => d.public_id === id))
    if (owner && stageId && owner.public_id !== stageId) setStageId(owner.public_id) // el contexto sigue al entregable
    setPickedId(id)
    setDetail({ id, mode: m })
  }
  const clearFilters = () => { setQuery(''); setFilter('todos'); setStageId(null) }

  const gantt = range ? (
    <ProjectGantt
      plan={plan}
      range={range}
      nextId={nextId}
      selectedStageId={stageId}
      selectedDeliverableId={pickedId}
      onSelectStage={(id) => { setStageId(id); setPickedId(null) }}
      onSelectDeliverable={setPickedId}
      large={expanded}
    />
  ) : null

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Indicadores del cronograma" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <ProgressStat title="Avance del cronograma" percent={progress?.percent ?? null} approved={progress?.approved ?? 0} total={progress?.total_required ?? 0} className="sm:col-span-2 lg:col-span-1" />
        <Stat icon={FileText} tone="blue" value={counts.deliverables} label="Entregables" />
        <Stat icon={CheckCircle2} tone="green" value={counts.approved} label="Aprobados" />
        <Stat icon={Clock} tone="orange" value={counts.inReview} label="En revisión" />
        <Stat icon={AlertTriangle} tone="red" value={counts.overdue} label="Vencidos" />
      </section>

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{notice}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Gantt */}
          <section aria-label="Cronograma del proyecto" className={cn(CARD, 'min-w-0 p-4')}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-display text-[19px] font-extrabold text-[var(--color-secondary)]"><CalendarDays size={19} aria-hidden="true" className="text-[#FF6500]" />Cronograma del proyecto</h3>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-text-muted)]">
                  <span className="sr-only">Rango del cronograma</span>
                  <select aria-label="Rango del cronograma" value={modeValue(mode)} onChange={(e) => setMode(parseMode(e.target.value))} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-text)]">
                    <option value="todo">Todo el proyecto</option>
                    <option value="hoy">Próximos 6 meses</option>
                    {years.map((y) => <option key={y} value={y}>Año {y}</option>)}
                  </select>
                </label>
                <button type="button" title="Ampliar cronograma" aria-label="Ampliar cronograma" disabled={!range} onClick={() => setExpanded(true)} className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition hover:text-[#FF6500] disabled:opacity-50"><Maximize2 size={15} aria-hidden="true" /></button>
              </div>
            </div>

            {gantt ?? <p className="rounded-xl border border-dashed border-[#DCE6F2] px-4 py-8 text-center text-[13px] text-[var(--color-text-muted)] dark:border-[var(--color-border)]">Aún no hay fechas en el plan: define las fechas límite de los entregables para ver el cronograma.</p>}

            {range && (
              <ul aria-label="Leyenda del cronograma" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-[var(--color-text-muted)]">
                {stages.filter((s) => s.active).map((s) => (
                  <li key={s.public_id} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={cn('h-2.5 w-5 rounded-full', { orange: 'bg-orange-300', blue: 'bg-sky-300', green: 'bg-emerald-300', gray: 'bg-slate-300', red: 'bg-red-300' }[stageTone(stages.indexOf(s))])} />{s.name}</li>
                ))}
                <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-emerald-600" />Aprobado</li>
                <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-[#FF6500]" />En revisión</li>
                <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-[#0876B9]" />Próxima entrega</li>
                <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-slate-400" />Pendiente</li>
                <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-red-500" />Vencido</li>
              </ul>
            )}

            {picked && (
              <div role="status" aria-label="Entregable seleccionado" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DCE6F2] bg-slate-50/70 px-4 py-3 dark:border-[var(--color-border)] dark:bg-white/5">
                <div className="min-w-0">
                  <p className="break-words text-[14px] font-bold text-[var(--color-secondary)]">{picked.title}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{pickedStage?.name} · {formatShort(picked.due_date)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DeliverableStatusBadge status={picked.status} />
                  <Button type="button" size="sm" variant="outline" onClick={() => open(picked.public_id)}>Ver detalle</Button>
                  {canManage && <Button type="button" size="sm" variant="outline" onClick={() => open(picked.public_id, 'editar')}><Pencil size={13} aria-hidden="true" /> Editar</Button>}
                </div>
              </div>
            )}
          </section>

          {/* Tabla */}
          <section aria-label="Entregables del proyecto" className={cn(CARD, 'min-w-0 p-4')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-display text-[19px] font-extrabold text-[var(--color-secondary)]"><FileText size={19} aria-hidden="true" className="text-[#FF6500]" />Entregables del proyecto ({items.length})</h3>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 focus-within:border-[#0876B9]">
                  <Search size={14} aria-hidden="true" className="text-[var(--color-text-muted)]" />
                  <span className="sr-only">Buscar entregable</span>
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar entregable…" className="w-36 border-none bg-transparent text-[13px] text-[var(--color-text)] outline-none" />
                </label>
                <Button type="button" variant="outline" size="sm" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}><SlidersHorizontal size={14} aria-hidden="true" /> Filtrar{filtered ? ' •' : ''}</Button>
                <div role="group" aria-label="Tipo de visualización" className="inline-flex overflow-hidden rounded-xl border border-[var(--color-border)]">
                  <button type="button" title="Vista de tabla" aria-label="Vista de tabla" aria-pressed={view === 'tabla'} onClick={() => setView('tabla')} className={cn('p-2', view === 'tabla' ? 'bg-[#FF6500] text-white' : 'text-[var(--color-text-muted)]')}><LayoutList size={15} aria-hidden="true" /></button>
                  <button type="button" title="Vista de tarjetas" aria-label="Vista de tarjetas" aria-pressed={view === 'tarjetas'} onClick={() => setView('tarjetas')} className={cn('p-2', view === 'tarjetas' ? 'bg-[#FF6500] text-white' : 'text-[var(--color-text-muted)]')}><LayoutGrid size={15} aria-hidden="true" /></button>
                </div>
              </div>
            </div>

            {(filtersOpen || stageId) && (
              <div className="mt-3 flex flex-wrap items-end gap-4 rounded-xl border border-[#DCE6F2] bg-slate-50/60 p-3 dark:border-[var(--color-border)] dark:bg-white/5">
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
                  Etapa
                  <select value={stageId ?? ''} onChange={(e) => { setStageId(e.target.value || null); setPickedId(null) }} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-text)]">
                    <option value="">Todas las etapas</option>
                    {stages.map((s) => <option key={s.public_id} value={s.public_id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
                  Estado
                  <select value={filter} onChange={(e) => setFilter(e.target.value as DeliverableFilter)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-text)]">
                    {(Object.keys(FILTER_LABELS) as DeliverableFilter[]).map((k) => <option key={k} value={k}>{FILTER_LABELS[k]}</option>)}
                  </select>
                </label>
                {filtered && <button type="button" onClick={clearFilters} className="text-[13px] font-semibold text-[#0876B9] underline underline-offset-4">Quitar filtros</button>}
              </div>
            )}
            {filtered && <p role="status" className="mt-2 text-[12px] text-[var(--color-text-muted)]">Mostrando {rows.length} de {items.length} entregables{stage ? ` · etapa «${stage.name}»` : ''}.</p>}

            {items.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[#DCE6F2] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)] dark:border-[var(--color-border)]">El plan todavía no tiene entregables.</p>
            ) : rows.length === 0 ? (
              <p role="status" className="mt-4 rounded-xl border border-dashed border-[#DCE6F2] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)] dark:border-[var(--color-border)]">Ningún entregable coincide con la búsqueda o los filtros.</p>
            ) : view === 'tabla' ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-[#DCE6F2] dark:border-[var(--color-border)]">
                <div aria-hidden="true" className="hidden border-b border-[#DCE6F2] bg-slate-50 px-3 py-2 text-[12px] font-bold text-[var(--color-text-muted)] dark:border-[var(--color-border)] dark:bg-white/5 md:grid md:grid-cols-[minmax(0,1fr)_170px_130px_150px_110px] md:gap-3">
                  <span>Entregable</span><span>Etapa</span><span>Fecha límite</span><span>Estado</span><span className="text-right">Acciones</span>
                </div>
                <ul aria-label="Entregables del proyecto" className="divide-y divide-[#DCE6F2] dark:divide-[var(--color-border)]">
                  {rows.map(({ d, stage: st }) => <DeliverableItem key={d.public_id} d={d} layout="fila" canManage={canManage} stage={st} selected={d.public_id === pickedId} onOpen={(m) => open(d.public_id, m)} />)}
                </ul>
              </div>
            ) : (
              <ul aria-label="Entregables del proyecto" className="mt-3 grid gap-3 sm:grid-cols-2">
                {rows.map(({ d, stage: st }) => <DeliverableItem key={d.public_id} d={d} layout="tarjeta" canManage={canManage} stage={st} selected={d.public_id === pickedId} onOpen={(m) => open(d.public_id, m)} />)}
              </ul>
            )}
          </section>
        </div>

        {/* Panel derecho */}
        <div className="flex min-w-0 flex-col gap-5 xl:self-start">
          <NextDeliveryCard
            next={next}
            closedState={projectClosed ? process.state.name : null}
            allApproved={allApproved}
            hasDeliverables={live.length > 0}
            scopeLabel={stage ? `Etapa: ${stage.name}` : undefined}
            onOpen={(id) => open(id)}
          />
          <DeliveryCalendar
            key={stageId ?? 'todas'}
            deliverables={(stage ? stage.deliverables : all).filter((d) => d.active && d.due_date)}
            nextId={nextId}
            stageName={stage ? stage.name : 'Todas las etapas'}
            onOpen={(id) => open(id)}
          />
          <p className="inline-flex items-center gap-2 px-1 text-[12px] text-[var(--color-text-muted)]"><Layers size={14} aria-hidden="true" />Las fechas se editan en «Plan de trabajo y entregables» o desde la acción «Editar» de cada entregable.</p>
        </div>
      </div>

      {expanded && gantt && (
        <ModalDialog title="Cronograma del proyecto" wide onClose={() => setExpanded(false)}>
          {gantt}
        </ModalDialog>
      )}

      {selectedDetail && detail && (
        <DeliverableDialog
          deliverable={selectedDetail}
          mode={detail.mode}
          processId={processId}
          stages={stages}
          all={all}
          canManage={canManage}
          onPlan={onPlan}
          reload={reload}
          onMode={(m) => setDetail({ id: selectedDetail.public_id, mode: m })}
          onClose={() => setDetail(null)}
          onReview={(id) => { setDetail(null); setReviewId(id) }}
          onSaved={() => setNotice('Entregable guardado: el cronograma y el calendario ya usan la nueva fecha.')}
        />
      )}
      {reviewId && <SubmissionReviewModal processId={processId} submissionId={reviewId} onClose={() => setReviewId(null)} onChanged={reload} />}
    </div>
  )
}
