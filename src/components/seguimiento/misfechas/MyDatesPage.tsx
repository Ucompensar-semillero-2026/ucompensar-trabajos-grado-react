import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, FolderOpen, Handshake, X } from 'lucide-react'
import { Card, EmptyState } from '@/components/ui'
import { allDeliverables } from '@/components/proceso/workPlanUi'
import { useDocumentsCenter } from '@/components/proceso/documentos/useDocumentsCenter'
import { TaskSubmissionModal } from '@/components/proceso/entrega/TaskSubmissionModal'
import { CommitmentManager } from '../CommitmentManager'
import { GroupRiskBanner, RiskLevelBadge } from '../monitoringUi'
import { MyDeliverablesSection } from './MyDeliverablesSection'
import { ProjectSummaryBar } from './ProjectSummaryBar'
import { NextCommitmentCard, ProgressDonutCard, StatusLegendCard } from './StatusOverview'
import { nextCommitment, summarize } from './misFechasHelpers'

/**
 * «Mis fechas y compromisos» (ruta /mis-fechas). Comparte con «Documentos y entregables» la MISMA fuente de datos y las mismas
 * fechas efectivas (`useDocumentsCenter`), de modo que un entregable nunca tiene estados o fechas distintos en cada página.
 * El detalle es el modal de entrega existente (borradores privados y único «Entregar»).
 */
export function MyDatesPage() {
  const data = useDocumentsCenter()
  const { processes, selected, selectedId, setSelectedId, plan, planState, error, reload, drafts, history, originalDue, tasks, monitoring, monitoringState } = data
  const [openId, setOpenId] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const commitmentsRef = useRef<HTMLElement>(null)

  const commitments = useMemo(() => monitoring?.commitments ?? [], [monitoring])
  const summary = useMemo(() => (plan ? summarize(plan) : null), [plan])
  const next = useMemo(() => (plan ? nextCommitment(plan, drafts, commitments) : null), [plan, drafts, commitments])

  if (planState === 'loading') return <p role="status" className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando tus fechas…</p>
  if (planState === 'error') return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>

  const commitmentsSection = (
    <section ref={commitmentsRef} id="compromisos" tabIndex={-1} aria-label="Compromisos acordados con tu tutor" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] outline-none">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-[18px] font-extrabold text-[var(--color-secondary)]"><Handshake size={19} aria-hidden="true" className="text-[#0E6B9C]" />Compromisos acordados con tu tutor</h2>
        {monitoring && <span className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">Tu nivel de seguimiento: <RiskLevelBadge level={monitoring.level} /></span>}
      </div>
      {monitoringState === 'error' && <p role="alert" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">No se pudo cargar tu seguimiento: las fechas mostradas son las originales del plan y los compromisos no están disponibles.</p>}
      {monitoring?.group_alerts.filter((a) => a.active).map((a) => <div key={a.process_id} className="mb-3"><GroupRiskBanner alert={a} /></div>)}
      {monitoring ? <CommitmentManager commitments={commitments} /> : monitoringState === 'loading' ? <p role="status" className="text-[13px] text-[var(--color-text-muted)]">Cargando compromisos…</p> : null}
    </section>
  )

  if (processes.length === 0 || planState === 'none' || !plan || !selectedId || !summary) {
    return (
      <div className="flex flex-col gap-5">
        <Card>
          <EmptyState
            icon={FolderOpen}
            title={processes.length === 0 ? 'Aún no tienes un proceso de grado' : 'Tu tutor aún no ha publicado el plan de trabajo'}
            description={processes.length === 0 ? 'Cuando tengas un proceso de grado, aquí verás tus fechas límite y el estado de tus entregables.' : 'Cuando se publique el plan, verás aquí tus entregables, sus fechas límite y tu avance.'}
            action={processes.length === 0 ? <Link to="/tramites" className="text-[13px] font-bold text-[#0E6B9C] underline underline-offset-4">Ir a Mis proyectos</Link> : undefined}
          />
        </Card>
        {monitoring && commitmentsSection}
      </div>
    )
  }

  const stageOf = (id: string | null) => {
    if (!id) return null
    for (const stage of plan.stages) {
      const deliverable = stage.deliverables.find((d) => d.public_id === id)
      if (deliverable) return { deliverable, stage }
    }
    return null
  }
  const opened = stageOf(openId)
  const dependencyTitle = opened?.deliverable.depends_on_public_id ? allDeliverables(plan).find((x) => x.public_id === opened.deliverable.depends_on_public_id)?.title ?? null : null
  const allApproved = summary.total > 0 && summary.counts.aprobado === summary.total
  const seeCommitments = () => { commitmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); commitmentsRef.current?.focus({ preventScroll: true }) }

  return (
    <div className="flex flex-col gap-5">
      <ProjectSummaryBar processes={processes} selected={selected} selectedId={selectedId} onSelectProcess={setSelectedId} plan={plan} />

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <ProgressDonutCard plan={plan} />
        <StatusLegendCard />
        <div className="lg:col-span-2 2xl:col-span-1 [&>section]:h-full">
          <NextCommitmentCard next={next} inReview={summary.counts.revision} allApproved={allApproved} extended={next?.kind === 'entregable' && (tasks[next.action.deliverable.public_id]?.extensions.length ?? 0) > 0} onOpen={setOpenId} onSeeCommitments={seeCommitments} />
        </div>
      </div>

      {banner && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800">
          <span className="flex items-center gap-2"><CheckCircle2 size={16} aria-hidden="true" />{banner}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Cerrar aviso" className="cursor-pointer rounded-md p-1 hover:bg-emerald-100"><X size={14} aria-hidden="true" /></button>
        </p>
      )}

      <MyDeliverablesSection plan={plan} drafts={drafts} history={history} tasks={tasks} originalDue={originalDue} commitments={commitments} onOpen={setOpenId} />

      {commitmentsSection}

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
