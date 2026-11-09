import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock, FileText, GraduationCap, Layers, LayoutGrid, LayoutList,
  ListChecks, Pencil, Plus, Power, Search, SlidersHorizontal, type LucideIcon,
} from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { cn } from '@/utils/cn'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { workPlanApi, type StageOut, type WorkPlanOut } from '@/services/workplan.service'
import type { ProcessOut } from '@/services/processes.service'
import { AddStageForm, CreatePlanForm, NewDeliverableForm, PlanHeader, StageForm } from './PlanEditor'
import { SubmissionReviewModal } from './SubmissionReview'
import { DeliverableDialog, DeliverableItem, NextDeliveryCard, ProgressStat, Stat } from './planShared'
import { DeliveryCalendar } from './DeliveryCalendar'
import { Pill, ProgressBar } from './tutorUi'
import {
  CARD, FILTER_LABELS, formatShort, liveDeliverables, matchesDeliverable, nextDelivery, planCounts, stageDateRange, stageSummary, stateTone,
  type DeliverableFilter,
} from './tutorUi.utils'

interface Props {
  processId: string
  process: ProcessOut
  plan: WorkPlanOut | null
  canManage: boolean
  onPlan: (plan: WorkPlanOut) => void
  reload: () => Promise<void>
  /** Entregable que se debe abrir al llegar (viene de «Ver entregable» del resumen). */
  focusId: string | null
  onFocusHandled: () => void
}

const STAGE_ICONS: LucideIcon[] = [BookOpen, GraduationCap, Layers, ListChecks]

export function PlanWorkspace({ processId, process, plan, canManage, onPlan, reload, focusId, onFocusHandled }: Props) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [stageId, setStageId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DeliverableFilter>('todos')
  const [onlyMandatory, setOnlyMandatory] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<'tabla' | 'tarjetas'>('tabla')
  const [detail, setDetail] = useState<{ id: string; mode: 'ver' | 'editar' } | null>(null)
  const [addingStage, setAddingStage] = useState(false)
  const [editingStage, setEditingStage] = useState(false)
  const [showDates, setShowDates] = useState(false)
  const [confirmStage, setConfirmStage] = useState(false)
  const [stageBusy, setStageBusy] = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)

  const stages = useMemo(() => plan?.stages ?? [], [plan])
  const stage: StageOut | undefined = stages.find((s) => s.public_id === stageId) ?? stages[0]
  const all = useMemo(() => stages.flatMap((s) => s.deliverables), [stages])

  // «Ver entregable» desde el resumen (o desde la próxima entrega/calendario): se elige su etapa y se abre su detalle.
  useEffect(() => {
    if (!focusId || !plan) return
    const owner = plan.stages.find((s) => s.deliverables.some((d) => d.public_id === focusId))
    if (owner) {
      setStageId(owner.public_id)
      setDetail({ id: focusId, mode: 'ver' })
    }
    onFocusHandled()
  }, [focusId, plan, onFocusHandled])

  const openDeliverable = (id: string, mode: 'ver' | 'editar' = 'ver') => {
    const owner = stages.find((s) => s.deliverables.some((d) => d.public_id === id))
    if (owner) setStageId(owner.public_id)
    setDetail({ id, mode })
  }

  const counts = planCounts(plan)
  const progress = plan && plan.progress.total_required > 0 ? plan.progress : null
  // Proyecto cancelado o cerrado: sus entregas ya no están «activas» y no se presentan como próximas.
  const projectClosed = Boolean(process.closed_at || plan?.official_completion || stateTone(process.state.name) === 'red')
  const next = projectClosed ? null : nextDelivery(plan)
  const live = liveDeliverables(plan)
  const allApproved = live.length > 0 && live.every((d) => d.status === 'aprobado')

  const setActive = async (active: boolean) => {
    if (!accessToken || !stage || stageBusy) return
    setStageBusy(true)
    setStageError(null)
    try {
      onPlan(await workPlanApi.updateStage(accessToken, processId, stage.public_id, { active }))
      setConfirmStage(false)
      setNotice(active ? 'Etapa activada.' : 'Etapa desactivada. Sus entregables se conservan.')
    } catch (err) {
      setStageError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado de la etapa')
    } finally {
      setStageBusy(false)
    }
  }

  if (!plan) {
    return (
      <div className="flex flex-col gap-5">
        {canManage ? <CreatePlanForm processId={processId} onPlan={onPlan} /> : <Card><p className="text-[13px] text-[var(--color-text-muted)]">Aún no hay un plan de trabajo para este proyecto.</p></Card>}
      </div>
    )
  }

  const rows = stage ? stage.deliverables.filter((d) => matchesDeliverable(d, query, filter, onlyMandatory)) : []
  const summary = stage ? stageSummary(stage) : null
  const range = stage ? stageDateRange(stage) : { first: null, last: null }
  const StageIcon = STAGE_ICONS[Math.max(0, stages.findIndex((s) => s.public_id === stage?.public_id)) % STAGE_ICONS.length]
  const selected = detail ? all.find((d) => d.public_id === detail.id) ?? null : null
  const hasFilters = filter !== 'todos' || onlyMandatory

  return (
    <div className="flex flex-col gap-5">
      {/* Indicadores generales */}
      <section aria-label="Indicadores del plan" className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
        <ProgressStat title="Avance general" percent={progress?.percent ?? null} approved={progress?.approved ?? 0} total={progress?.total_required ?? 0} className="sm:col-span-2 lg:col-span-1" />
        <Stat icon={BookOpen} tone="blue" value={counts.stages} label="Etapas" />
        <Stat icon={FileText} tone="blue" value={counts.deliverables} label="Entregables" />
        <Stat icon={CheckCircle2} tone="green" value={counts.approved} label="Aprobados" />
        <Stat icon={Clock} tone="orange" value={counts.inReview} label="Por revisar" />
        <Stat icon={AlertTriangle} tone="red" value={counts.overdue} label="Vencidos" />
      </section>

      {canManage && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {plan.status === 'publicado' ? 'Plan publicado: los cambios se aplican de inmediato.' : 'Plan en borrador: el estudiante aún no lo ve.'}
            </p>
            <Button type="button" variant="outline" size="sm" aria-haspopup="dialog" onClick={() => setShowDates(true)}>
              <CalendarDays size={14} aria-hidden="true" /> Fechas y publicación
            </Button>
          </div>
        </div>
      )}

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        {/* Columna izquierda: etapas */}
        <section aria-label="Etapas del plan de trabajo" className={cn(CARD, 'flex flex-col gap-3 p-4 lg:self-start')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-[18px] font-extrabold text-[var(--color-secondary)]">Etapas del plan de trabajo</h3>
            {canManage && <Button type="button" variant="outline" size="sm" onClick={() => setAddingStage((v) => !v)}><Plus size={14} aria-hidden="true" /> Nueva etapa</Button>}
          </div>
          {addingStage && <AddStageForm processId={processId} onPlan={onPlan} onClose={() => setAddingStage(false)} />}
          {stages.length === 0 && <p className="text-[13px] text-[var(--color-text-muted)]">El plan aún no tiene etapas.{canManage ? ' Crea la primera con «Nueva etapa».' : ''}</p>}
          <ul className="flex flex-col gap-2.5">
            {stages.map((s, i) => {
              const sum = stageSummary(s)
              const active = s.public_id === stage?.public_id
              return (
                <li key={s.public_id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`Etapa ${i + 1}: ${s.name}`}
                    onClick={() => { setStageId(s.public_id); setEditingStage(false); setConfirmStage(false) }}
                    className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition', active ? 'border-[#FF6500] bg-orange-50/70 shadow-sm dark:bg-orange-500/10' : 'border-[#DCE6F2] hover:border-[#FF6500]/50 dark:border-[var(--color-border)]')}
                  >
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white', active ? 'bg-[#FF6500]' : 'bg-slate-400')}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[14px] font-bold text-[var(--color-secondary)]">{s.name}</span>
                      <span className="block text-[12px] text-[var(--color-text-muted)]">Semestre {s.semester} · {sum.total} {sum.total === 1 ? 'entregable' : 'entregables'}</span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="flex-1"><ProgressBar percent={sum.percent} label={`Avance de ${s.name}`} /></span>
                        <span className="text-[12px] font-extrabold text-[var(--color-secondary)]">{sum.percent} %</span>
                      </span>
                      <span className="mt-1.5 inline-flex"><Pill tone={sum.state.tone}>{sum.state.label}</Pill></span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" className={active ? 'text-[#FF6500]' : 'text-[var(--color-text-muted)]'} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Columna central: entregables de la etapa */}
        <section aria-label="Entregables de la etapa" className={cn(CARD, 'min-w-0 p-4 lg:self-start')}>
          {stage && summary ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF6500] dark:bg-orange-500/15"><StageIcon size={20} aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h3 className="break-words font-display text-[19px] font-extrabold text-[var(--color-secondary)]">{stage.name}</h3>
                    {stage.description && <p className="text-[13px] text-[var(--color-text-muted)]">{stage.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={summary.state.tone}>{summary.state.label}</Pill>
                  {canManage && (
                    <>
                      <Button type="button" variant="outline" size="sm" aria-expanded={editingStage} onClick={() => setEditingStage((v) => !v)}><Pencil size={13} aria-hidden="true" /> Editar etapa</Button>
                      <Button type="button" variant="outline" size="sm" disabled={stageBusy} onClick={() => (stage.active ? setConfirmStage(true) : void setActive(true))}>
                        <Power size={13} aria-hidden="true" /> {stage.active ? 'Desactivar etapa' : 'Activar etapa'}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {confirmStage && (
                <div role="alertdialog" aria-label="Confirmar desactivación de la etapa" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                  <span className="min-w-0 flex-1">¿Desactivar «{stage.name}»? Sus entregables dejan de contarse en el avance y el estudiante ya no los ve; no se borra nada y puedes volver a activarla.</span>
                  <Button type="button" size="sm" disabled={stageBusy} onClick={() => void setActive(false)}>{stageBusy ? 'Desactivando…' : 'Sí, desactivar'}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmStage(false)}>Cancelar</Button>
                </div>
              )}
              {stageError && <p role="alert" className="mt-2 text-[13px] font-medium text-red-700">{stageError}</p>}
              {editingStage && <div className="mt-3"><StageForm stage={stage} processId={processId} onPlan={onPlan} onDone={() => { setEditingStage(false); setNotice('Etapa guardada.') }} /></div>}

              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#DCE6F2] p-3 text-[13px] dark:border-[var(--color-border)] sm:grid-cols-5">
                <div><dt className="text-[11px] text-[var(--color-text-muted)]">Primera fecha límite</dt><dd className="font-bold text-[var(--color-secondary)]">{formatShort(range.first)}</dd></div>
                <div><dt className="text-[11px] text-[var(--color-text-muted)]">Última fecha límite</dt><dd className="font-bold text-[var(--color-secondary)]">{formatShort(range.last)}</dd></div>
                <div><dt className="text-[11px] text-[var(--color-text-muted)]">Entregables</dt><dd className="font-bold text-[var(--color-secondary)]">{summary.total}</dd></div>
                <div><dt className="text-[11px] text-[var(--color-text-muted)]">Aprobados</dt><dd className="font-bold text-[var(--color-secondary)]">{summary.approved}{summary.required ? ` de ${summary.required}` : ''}</dd></div>
                <div className="col-span-2 sm:col-span-1">
                  <dt className="text-[11px] text-[var(--color-text-muted)]">Avance</dt>
                  <dd className="flex items-center gap-2"><span className="flex-1"><ProgressBar percent={summary.percent} label={`Avance de la etapa ${stage.name}`} /></span><span className="font-extrabold text-[var(--color-secondary)]">{summary.percent} %</span></dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-display text-[17px] font-extrabold text-[var(--color-secondary)]">Entregables de la etapa ({stage.deliverables.length})</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 focus-within:border-[#0876B9]">
                    <Search size={14} aria-hidden="true" className="text-[var(--color-text-muted)]" />
                    <span className="sr-only">Buscar entregable</span>
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar entregable…" className="w-36 border-none bg-transparent text-[13px] text-[var(--color-text)] outline-none" />
                  </label>
                  <Button type="button" variant="outline" size="sm" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
                    <SlidersHorizontal size={14} aria-hidden="true" /> Filtrar{hasFilters ? ' •' : ''}
                  </Button>
                  <div role="group" aria-label="Tipo de visualización" className="inline-flex overflow-hidden rounded-xl border border-[var(--color-border)]">
                    <button type="button" title="Vista de tabla" aria-label="Vista de tabla" aria-pressed={view === 'tabla'} onClick={() => setView('tabla')} className={cn('p-2', view === 'tabla' ? 'bg-[#FF6500] text-white' : 'text-[var(--color-text-muted)]')}><LayoutList size={15} aria-hidden="true" /></button>
                    <button type="button" title="Vista de tarjetas" aria-label="Vista de tarjetas" aria-pressed={view === 'tarjetas'} onClick={() => setView('tarjetas')} className={cn('p-2', view === 'tarjetas' ? 'bg-[#FF6500] text-white' : 'text-[var(--color-text-muted)]')}><LayoutGrid size={15} aria-hidden="true" /></button>
                  </div>
                </div>
              </div>

              {filtersOpen && (
                <div className="mt-3 flex flex-wrap items-end gap-4 rounded-xl border border-[#DCE6F2] bg-slate-50/60 p-3 dark:border-[var(--color-border)] dark:bg-white/5">
                  <label className="flex flex-col gap-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
                    Estado
                    <select value={filter} onChange={(e) => setFilter(e.target.value as DeliverableFilter)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-text)]">
                      {(Object.keys(FILTER_LABELS) as DeliverableFilter[]).map((k) => <option key={k} value={k}>{FILTER_LABELS[k]}</option>)}
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-2 text-[13px] text-[var(--color-text)]">
                    <input type="checkbox" checked={onlyMandatory} onChange={(e) => setOnlyMandatory(e.target.checked)} className="h-4 w-4 accent-[#FF6500]" /> Solo obligatorios
                  </label>
                  {hasFilters && <button type="button" onClick={() => { setFilter('todos'); setOnlyMandatory(false) }} className="text-[13px] font-semibold text-[#0876B9] underline underline-offset-4">Quitar filtros</button>}
                </div>
              )}

              {stage.deliverables.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-[#DCE6F2] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)] dark:border-[var(--color-border)]">Esta etapa aún no tiene entregables.{canManage ? ' Agrégalos con «Agregar entregable».' : ''}</p>
              ) : rows.length === 0 ? (
                <p role="status" className="mt-4 rounded-xl border border-dashed border-[#DCE6F2] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)] dark:border-[var(--color-border)]">Ningún entregable coincide con la búsqueda o los filtros.</p>
              ) : view === 'tabla' ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-[#DCE6F2] dark:border-[var(--color-border)]">
                  <div aria-hidden="true" className="hidden border-b border-[#DCE6F2] bg-slate-50 px-3 py-2 text-[12px] font-bold text-[var(--color-text-muted)] dark:border-[var(--color-border)] dark:bg-white/5 md:grid md:grid-cols-[minmax(0,1fr)_120px_150px_110px] md:gap-3">
                    <span>Entregable</span><span>Fecha límite</span><span>Estado</span><span className="text-right">Acciones</span>
                  </div>
                  <ul aria-label="Entregables de la etapa" className="divide-y divide-[#DCE6F2] dark:divide-[var(--color-border)]">
                    {rows.map((d) => <DeliverableItem key={d.public_id} d={d} layout="fila" canManage={canManage} onOpen={(mode) => setDetail({ id: d.public_id, mode })} />)}
                  </ul>
                </div>
              ) : (
                <ul aria-label="Entregables de la etapa" className="mt-3 grid gap-3 sm:grid-cols-2">
                  {rows.map((d) => <DeliverableItem key={d.public_id} d={d} layout="tarjeta" canManage={canManage} onOpen={(mode) => setDetail({ id: d.public_id, mode })} />)}
                </ul>
              )}

              {canManage && <NewDeliverableForm stage={stage} processId={processId} onPlan={(p) => { onPlan(p); setNotice('Entregable creado.') }} />}
            </>
          ) : (
            <p className="text-[13px] text-[var(--color-text-muted)]">Selecciona o crea una etapa para ver sus entregables.</p>
          )}
        </section>

        {/* Columna derecha: próxima entrega y calendario */}
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2 lg:grid lg:grid-cols-2 xl:col-span-1 xl:flex xl:flex-col">
          <NextDeliveryCard
            next={next}
            closedState={projectClosed ? process.state.name : null}
            allApproved={allApproved}
            hasDeliverables={live.length > 0}
            onOpen={(id) => openDeliverable(id)}
          />

          {stage && (
            <DeliveryCalendar
              key={stage.public_id}
              deliverables={stage.deliverables.filter((d) => d.active && d.due_date)}
              nextId={next?.deliverable.public_id ?? null}
              stageName={stage.name}
              onOpen={(id) => openDeliverable(id)}
            />
          )}
        </div>
      </div>

      {showDates && canManage && (
        <ModalDialog title="Fechas y publicación" onClose={() => setShowDates(false)}>
          <PlanHeader plan={plan} processId={processId} onPlan={onPlan} />
        </ModalDialog>
      )}

      {selected && detail && (
        <DeliverableDialog
          deliverable={selected}
          mode={detail.mode}
          processId={processId}
          stages={stages}
          all={all}
          canManage={canManage}
          onPlan={onPlan}
          reload={reload}
          onMode={(mode) => setDetail({ id: selected.public_id, mode })}
          onClose={() => setDetail(null)}
          onReview={(id) => { setDetail(null); setReviewId(id) }}
          onSaved={() => setNotice('Entregable guardado.')}
        />
      )}
      {reviewId && <SubmissionReviewModal processId={processId} submissionId={reviewId} onClose={() => setReviewId(null)} onChanged={reload} />}
    </div>
  )
}
