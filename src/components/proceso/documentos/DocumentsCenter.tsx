import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, FileText, FolderOpen, History, Layers, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Card, EmptyState } from '@/components/ui'
import { allDeliverables } from '../workPlanUi.utils'
import { TaskSubmissionModal } from '../entrega/TaskSubmissionModal'
import { AcademicProgressTimeline, ProcessOverview } from './ProcessOverview'
import { DeliverablesTab } from './DeliverablesTab'
import { CalendarMilestonesTab, ProcessDocumentsTab, VersionsHistoryTab } from './SecondaryTabs'
import { NextActionCard, ProgressSummaryCard, RecentActivityCard } from './SummarySidebar'
import { buildActivity, nextAction, processSummary } from './documentosHelpers'
import { useDocumentsCenter } from './useDocumentsCenter'

type TabId = 'entregables' | 'documentos' | 'versiones' | 'calendario'

const TABS: Array<{ id: TabId; label: string; Icon: typeof FileText }> = [
  { id: 'entregables', label: 'Entregables del plan', Icon: FileText },
  { id: 'documentos', label: 'Documentos del proceso', Icon: Layers },
  { id: 'versiones', label: 'Versiones y observaciones', Icon: History },
  { id: 'calendario', label: 'Calendario y hitos', Icon: CalendarDays },
]

/**
 * Centro de gestión documental del estudiante (ruta /documentos). Reutiliza los servicios y el modal de entrega existentes:
 * el flujo de borradores privados y el único «Entregar» no cambian.
 */
export function DocumentsCenter() {
  const data = useDocumentsCenter()
  const { processes, selected, selectedId, setSelectedId, plan, planState, error, reload, drafts, history, auxState, originalDue, tasks } = data
  const [tab, setTab] = useState<TabId>('entregables')
  const [rowId, setRowId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  const next = useMemo(() => (plan ? nextAction(plan, drafts) : null), [plan, drafts])
  const activity = useMemo(() => (plan ? buildActivity(plan, history) : []), [plan, history])
  const summary = useMemo(() => (plan ? processSummary(plan) : null), [plan])

  const lookup = (id: string | null) => {
    if (!plan || !id) return null
    for (const stage of plan.stages) {
      const deliverable = stage.deliverables.find((d) => d.public_id === id)
      if (deliverable) return { deliverable, stage }
    }
    return null
  }

  if (planState === 'loading') return <p role="status" className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando tus entregables…</p>
  if (planState === 'error') {
    return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
  }
  if (processes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FolderOpen}
          title="Aún no tienes entregables"
          description="Cuando tengas un proceso de grado y tu tutor publique el plan de trabajo, tus entregables aparecerán aquí."
          action={<Link to="/tramites" className="text-[13px] font-bold text-[#0E6B9C] underline underline-offset-4">Ir a Mis proyectos</Link>}
        />
      </Card>
    )
  }
  if (planState === 'none' || !plan || !selectedId || !summary) {
    return (
      <div className="flex flex-col gap-4">
        {processes.length > 1 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
            <label htmlFor="process-selector" className="text-[13px] font-semibold text-[var(--color-text-muted)]">Proceso de grado</label>
            <select id="process-selector" value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value)} className="min-w-[260px] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px]">
              {processes.map((p) => <option key={p.public_id} value={p.public_id}>{p.title?.trim() || `${p.modality.name} · ${p.process_code}`}</option>)}
            </select>
          </div>
        )}
        <Card>
          <EmptyState icon={FolderOpen} title="Tu tutor aún no ha publicado entregables" description="Cuando se publique el plan de trabajo, verás aquí las plantillas, las instrucciones y las fechas límite." />
        </Card>
      </div>
    )
  }

  const selectedRow = lookup(rowId)
  const opened = lookup(openId)
  const dependencyTitle = opened?.deliverable.depends_on_public_id ? allDeliverables(plan).find((x) => x.public_id === opened.deliverable.depends_on_public_id)?.title ?? null : null
  const allApproved = summary.total > 0 && summary.approved === summary.total

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -index : e.key === 'End' ? TABS.length - 1 - index : 0
    if (!move) return
    e.preventDefault()
    const target = TABS[(index + move + TABS.length) % TABS.length].id
    setTab(target)
    tabRefs.current[target]?.focus()
  }

  return (
    <div className="flex flex-col gap-5">
      <ProcessOverview processes={processes} selected={selected} selectedId={selectedId} onSelectProcess={(id) => { setRowId(null); setSelectedId(id) }} plan={plan} />
      <AcademicProgressTimeline stages={plan.stages} />

      {banner && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800">
          <span className="flex items-center gap-2"><CheckCircle2 size={16} aria-hidden="true" />{banner}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Cerrar aviso" className="cursor-pointer rounded-md p-1 hover:bg-emerald-100"><X size={14} aria-hidden="true" /></button>
        </p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,32%)]">
        <section aria-label="Gestión documental" className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
          <div role="tablist" aria-label="Secciones de documentos" className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] px-3 pt-2">
            {TABS.map(({ id, label, Icon }, i) => (
              <button
                key={id}
                ref={(el) => { tabRefs.current[id] = el }}
                role="tab"
                id={`tab-${id}`}
                type="button"
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cn(
                  '-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-[3px] px-4 py-3 text-[13.5px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0E6B9C]',
                  tab === id ? 'border-[#FF641D] text-[#C2410C] dark:text-orange-300' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-secondary)]'
                )}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="p-4 outline-none sm:p-5">
            {tab === 'entregables' && (
              <DeliverablesTab plan={plan} drafts={drafts} selectedId={rowId} defaultSemester={next?.stage.semester ?? null} onSelect={setRowId} onOpen={(id) => { setRowId(id); setOpenId(id) }} />
            )}
            {tab === 'documentos' && <ProcessDocumentsTab processId={selectedId} />}
            {tab === 'versiones' && <VersionsHistoryTab plan={plan} history={history} partial={auxState === 'partial'} loading={auxState === 'loading'} />}
            {tab === 'calendario' && <CalendarMilestonesTab plan={plan} history={history} drafts={drafts} />}
          </div>
        </section>

        <aside aria-label="Resumen y próximas acciones" className="flex min-w-0 flex-col gap-4">
          <NextActionCard selected={selectedRow} next={next} drafts={drafts} allApproved={allApproved} onOpen={(id) => setOpenId(id)} onClearSelection={() => setRowId(null)} />
          <ProgressSummaryCard summary={summary} />
          <RecentActivityCard items={activity} loading={auxState === 'loading'} partial={auxState === 'partial'} onSeeAll={() => setTab('versiones')} />
        </aside>
      </div>

      {opened && (
        <TaskSubmissionModal
          processId={selectedId}
          deliverable={opened.deliverable}
          stage={opened.stage}
          dependencyTitle={dependencyTitle}
          planPublishedAt={plan.published_at}
          dueDetail={{ original: originalDue[opened.deliverable.public_id] ?? null, extensions: tasks[opened.deliverable.public_id]?.extensions ?? [] }}
          onClose={() => { setOpenId(null); void reload() }}
          onSubmitted={() => { setBanner('Entrega registrada. Quedó en revisión por tu tutor.'); void reload() }}
        />
      )}
    </div>
  )
}
