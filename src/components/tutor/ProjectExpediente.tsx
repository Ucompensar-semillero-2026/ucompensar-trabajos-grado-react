import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, FileUp } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError, resolveFileUrl } from '@/services/http'
import { processesApi, type ProcessHistoryOut, type ProcessOut, type TeamMemberOut } from '@/services/processes.service'
import { workPlanApi, type DeliverableOut, type PlanEventOut, type SubmissionOut, type WorkPlanOut } from '@/services/workplan.service'
import { formatRelativeDate } from '@/utils/format'
import { DeliverableStatusBadge, formatCalendarDate } from '@/components/proceso/workPlanUi'
import { LoadError, ProgressBar } from './tutorUi'
import { PlanEditor } from './PlanEditor'

const TABS = [
  ['resumen', 'Resumen'],
  ['plan', 'Plan de trabajo'],
  ['documentos', 'Documentos y entregables'],
  ['cronograma', 'Cronograma'],
  ['historial', 'Historial de actividad'],
] as const
type TabId = (typeof TABS)[number][0]

const EVENT_LABELS: Record<string, string> = {
  plan_creado: 'Plan creado',
  fechas_del_plan: 'Fechas del plan modificadas',
  plan_publicado: 'Plan publicado',
  etapa_creada: 'Etapa creada',
  etapa_editada: 'Etapa editada',
  entregable_creado: 'Entregable creado',
  entregable_editado: 'Entregable editado',
  plantilla_subida: 'Plantilla subida',
  entrega_recibida: 'Entrega recibida',
  entrega_revisada: 'Entrega revisada',
}

const DECISION_LABEL = { aprobado: 'Aprobado', requiere_correcciones: 'Requiere correcciones' } as const

interface ExpedienteData {
  process: ProcessOut
  plan: WorkPlanOut | null
  team: TeamMemberOut[]
  activity: PlanEventOut[]
  history: ProcessHistoryOut[]
}

function useExpediente(processId: string | undefined) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [data, setData] = useState<ExpedienteData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || !processId) return
    try {
      const [process, team, history] = await Promise.all([
        processesApi.get(accessToken, processId),
        processesApi.team(accessToken, processId),
        processesApi.history(accessToken, processId),
      ])
      let plan: WorkPlanOut | null = null
      let activity: PlanEventOut[] = []
      try {
        plan = await workPlanApi.get(accessToken, processId)
        activity = await workPlanApi.activity(accessToken, processId).catch(() => [])
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err // 404 = aún no hay plan
      }
      setData({ process, plan, team, activity, history })
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'No encontramos este proyecto o no tienes acceso a él.' : err instanceof ApiError ? err.message : 'No se pudo cargar el proyecto')
      setStatus('error')
    }
  }, [accessToken, processId])

  useEffect(() => {
    setStatus('loading')
    void load()
  }, [load])

  return { data, status, error, reload: load, setPlan: (plan: WorkPlanOut) => setData((d) => (d ? { ...d, plan } : d)) }
}

// ── Revisión de un entregable ─────────────────────────────────────────────────

function DeliverableReviewCard({ deliverable: d, processId, stageName, canManage, onChanged }: { deliverable: DeliverableOut; processId: string; stageName: string; canManage: boolean; onChanged: () => Promise<void> }) {
  const accessToken = useAppStore((s) => s.accessToken)
  const templateInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [asking, setAsking] = useState(false)
  const [history, setHistory] = useState<SubmissionOut[] | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const current = d.current_submission
  const awaitingReview = current?.status === 'en_revision'

  const guard = async (action: (token: string) => Promise<unknown>) => {
    if (!accessToken || busy) return
    setBusy(true)
    setError(null)
    try {
      await action(accessToken)
      setHistory(null)
      await onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
    } finally {
      setBusy(false)
    }
  }

  const decide = (decision: 'aprobado' | 'requiere_correcciones') =>
    guard(async (t) => {
      await workPlanApi.review(t, processId, (current as SubmissionOut).public_id, decision, comment)
      setComment('')
      setAsking(false)
    })

  const toggleHistory = async () => {
    const next = !showHistory
    setShowHistory(next)
    if (next && history === null && accessToken) setHistory(await workPlanApi.listSubmissions(accessToken, processId, d.public_id).catch(() => []))
  }

  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h5 className="font-display text-[18px] font-bold text-[var(--color-secondary)]">{d.title}</h5>
          <p className="text-[12px] text-[var(--color-text-muted)]">{stageName} · {d.mandatory ? 'Obligatorio' : 'Opcional'} · Fecha límite: {formatCalendarDate(d.due_date)}</p>
        </div>
        <div className="flex gap-1.5">
          <DeliverableStatusBadge status={d.status} />
          {d.is_overdue && <Badge variant="red">Vencido</Badge>}
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
        {d.template_download_url ? (
          <a href={resolveFileUrl(d.template_download_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[#0876B9] underline underline-offset-4">
            <Download size={14} aria-hidden /> Plantilla: {d.template_file_name}
          </a>
        ) : (
          <span className="text-[var(--color-text-muted)]">Sin plantilla</span>
        )}
        {canManage && (
          <>
            <input
              ref={templateInput}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-label={`Subir plantilla para ${d.title}`}
              accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void guard((t) => workPlanApi.uploadTemplate(t, processId, d.public_id, file))
                e.target.value = ''
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => templateInput.current?.click()}>
              <FileUp size={14} aria-hidden /> {d.template_download_url ? 'Reemplazar plantilla' : 'Subir plantilla'}
            </Button>
          </>
        )}
      </div>

      {current ? (
        <div className="mt-3 rounded-xl bg-[var(--color-bg)] px-4 py-3 text-[13px]">
          <p className="font-semibold text-[var(--color-text)]">{current.file_name} <span className="font-normal text-[var(--color-text-muted)]">· versión {current.version} · {formatRelativeDate(current.submitted_at)}</span></p>
          {current.student_comment && <p className="mt-0.5 text-[var(--color-text-muted)]">Comentario del estudiante: {current.student_comment}</p>}
          <a href={resolveFileUrl(current.download_url)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#0876B9] underline underline-offset-4">
            <Download size={14} aria-hidden /> Descargar entrega
          </a>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">El estudiante aún no ha entregado este documento.</p>
      )}

      {canManage && awaitingReview && (
        <div className="mt-3 flex flex-col gap-3">
          {asking && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Escribe las observaciones para el estudiante…"
              aria-label="Observaciones para solicitar correcciones"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]"
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" disabled={busy} onClick={() => void decide('aprobado')}>Aprobar entrega</Button>
            {asking ? (
              <Button type="button" variant="outline" size="sm" disabled={busy || !comment.trim()} onClick={() => void decide('requiere_correcciones')}>
                Enviar solicitud de correcciones
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setAsking(true)}>Solicitar correcciones</Button>
            )}
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[13px] font-medium text-red-700">{error}</p>}

      {d.submissions_count > 0 && (
        <button type="button" onClick={() => void toggleHistory()} aria-expanded={showHistory} className="mt-3 text-[13px] font-semibold text-[#0876B9] underline underline-offset-4">
          Versiones y decisiones ({d.submissions_count})
        </button>
      )}
      {showHistory && (
        <ul className="mt-2 flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
          {history === null ? <li className="text-[12px] text-[var(--color-text-muted)]">Cargando…</li> : history.map((s) => (
            <li key={s.public_id} className="text-[13px]">
              <p><strong>v{s.version}</strong> · {s.file_name} · {formatRelativeDate(s.submitted_at)} · <DeliverableStatusBadge status={s.status} />{' '}
                <a href={resolveFileUrl(s.download_url)} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0876B9] underline underline-offset-4">Descargar</a>
              </p>
              {s.reviews.map((r) => (
                <p key={r.public_id} className="ml-3 text-[12px] text-[var(--color-text-muted)]">
                  {DECISION_LABEL[r.decision]} por {r.reviewer.full_name} · {formatRelativeDate(r.created_at)}{r.comment ? `: ${r.comment}` : ''}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

// ── Pestañas ──────────────────────────────────────────────────────────────────

function Summary({ data }: { data: ExpedienteData }) {
  const { process, plan, team } = data
  const tutors = team.filter((m) => m.process_role === 'tutor')
  const progress = plan?.status === 'publicado' && plan.progress.total_required > 0 ? plan.progress : null
  const fact = (label: string, value: string) => (
    <div key={label}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">{value}</dd>
    </div>
  )
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fact('Proyecto', process.title?.trim() || `Sin título registrado · ${process.process_code}`)}
          {fact('Estudiante', process.student.full_name)}
          {fact('Modalidad', process.modality.name)}
          {fact('Tutor', tutors.length ? tutors.map((t) => t.user.full_name).join(', ') : 'Sin tutor activo')}
          {fact('Estado del proceso', process.state.name)}
          {fact('Fecha de inicio', plan ? formatCalendarDate(plan.start_date) : 'Plan sin crear')}
          {fact('Fecha objetivo', plan ? formatCalendarDate(plan.target_end_date) : 'Plan sin crear')}
          {fact('Finalización oficial', plan?.official_completion || process.closed_at ? 'Proceso cerrado' : 'Proceso en curso')}
        </dl>
      </Card>
      <Card>
        <h3 className="mb-2 text-[18px] font-bold text-[var(--color-text)]">Avance de entregables aprobados</h3>
        {progress ? (
          <>
            <ProgressBar percent={progress.percent} label="Avance de entregables obligatorios aprobados" />
            <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
              {progress.percent}% · {progress.approved} de {progress.total_required} obligatorios aprobados · {progress.pending_review} por revisar · {progress.needs_corrections} con correcciones · {progress.overdue} vencidos.
              Un 100 % de entregables no equivale a la finalización oficial del proceso.
            </p>
          </>
        ) : (
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {plan ? 'El avance se mostrará cuando el plan esté publicado y tenga entregables obligatorios.' : 'Aún no hay un plan de trabajo: crea uno en la pestaña «Plan de trabajo».'}
          </p>
        )}
        {plan && plan.stages.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
            {plan.stages.map((s) => {
              const required = s.deliverables.filter((d) => d.mandatory && d.active && d.applicable)
              const approved = required.filter((d) => d.status === 'aprobado').length
              return (
                <li key={s.public_id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span className="text-[var(--color-text)]">{s.name} <span className="text-[var(--color-text-muted)]">· semestre {s.semester}</span></span>
                  <span className="text-[var(--color-text-muted)]">{required.length ? `${approved}/${required.length} aprobados` : 'Sin obligatorios'}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Schedule({ plan }: { plan: WorkPlanOut | null }) {
  if (!plan) return <Card><p className="text-[13px] text-[var(--color-text-muted)]">Aún no hay un plan de trabajo.</p></Card>
  const rows = plan.stages
    .flatMap((s) => s.deliverables.filter((d) => d.active).map((d) => ({ d, stage: s.name })))
    .sort((a, b) => (a.d.due_date ?? '9999').localeCompare(b.d.due_date ?? '9999'))
  return (
    <Card>
      <p role="status" className="mb-4 text-[13px] text-[var(--color-text-muted)]">
        {plan.status === 'publicado' ? 'Fechas publicadas y confirmadas para el estudiante.' : 'Borrador: estas fechas aún no están confirmadas ni visibles para el estudiante.'}
      </p>
      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map(({ d, stage }) => (
          <li key={d.public_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
            <span><strong className="text-[var(--color-text)]">{formatCalendarDate(d.due_date)}</strong> · {d.title} <span className="text-[var(--color-text-muted)]">({stage})</span></span>
            <span className="flex items-center gap-2">{d.is_overdue && <Badge variant="red">Vencido</Badge>}<DeliverableStatusBadge status={d.status} /></span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Activity({ activity, history }: { activity: PlanEventOut[]; history: ProcessHistoryOut[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 text-[18px] font-bold text-[var(--color-text)]">Cambios del plan y entregas</h3>
        {activity.length === 0 ? <p className="text-[13px] text-[var(--color-text-muted)]">Sin actividad registrada.</p> : (
          <ol className="flex flex-col gap-3">
            {activity.map((e) => (
              <li key={e.public_id} className="border-l-2 border-[#0876B9] pl-3">
                <p className="text-[13px] font-semibold text-[var(--color-text)]">{EVENT_LABELS[e.event_type] ?? e.event_type}{e.subject ? ` · ${e.subject}` : ''}</p>
                {e.detail && <p className="text-[12px] text-[var(--color-text-muted)]">{e.detail}</p>}
                <p className="text-[12px] text-[var(--color-text-muted)]">{e.actor.full_name} · {formatRelativeDate(e.created_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card>
        <h3 className="mb-3 text-[18px] font-bold text-[var(--color-text)]">Estados del proceso</h3>
        {history.length === 0 ? <p className="text-[13px] text-[var(--color-text-muted)]">Sin movimientos.</p> : (
          <ol className="flex flex-col gap-3">
            {history.map((h) => (
              <li key={h.public_id} className="border-l-2 border-[#FF6500] pl-3">
                <p className="text-[13px] font-semibold text-[var(--color-text)]">{h.previous_state ? `${h.previous_state.name} → ` : ''}{h.new_state.name}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">{formatRelativeDate(h.event_date)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

export function ProjectExpediente({ backTo = { to: '/tutor/proyectos', label: 'Volver a mis proyectos' } }: { backTo?: { to: string; label: string } }) {
  const { processId } = useParams<{ processId: string }>()
  const [params, setParams] = useSearchParams()
  const currentUser = useAppStore((s) => s.currentUser)
  const { data, status, error, reload, setPlan } = useExpediente(processId)
  const tab = (TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'resumen') as TabId

  if (!processId) return null
  if (status === 'loading' && !data) return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando proyecto…</p>
  if (status === 'error' || !data) return <LoadError message={error} onRetry={() => void reload()} />

  const isTutor = data.team.some((m) => m.process_role === 'tutor' && m.user.public_id === currentUser?.id)
  // Solo el tutor ACTIVO modifica el plan y revisa entregas; Coordinación supervisa en modo consulta.
  // El backend decide de verdad (403/404); esto solo evita mostrar controles inútiles.
  const canManage = data.plan?.can_manage ?? isTutor

  return (
    <div className="flex flex-col gap-5">
      <Link to={backTo.to} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0876B9] underline underline-offset-4">
        <ArrowLeft size={14} aria-hidden /> {backTo.label}
      </Link>

      <div role="tablist" aria-label="Secciones del proyecto" className="flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'resumen' ? {} : { tab: id })}
            className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors ${tab === id ? 'bg-[#FF6500] text-white' : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!canManage && (
        <p role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
          Vista de consulta: solo el tutor asignado a este proyecto puede modificar el plan o revisar entregas.
        </p>
      )}

      <div role="tabpanel">
        {tab === 'resumen' && <Summary data={data} />}
        {tab === 'plan' && (canManage ? <PlanEditor plan={data.plan} processId={processId} onPlan={setPlan} /> : <Schedule plan={data.plan} />)}
        {tab === 'documentos' && (
          data.plan ? (
            <div className="flex flex-col gap-6">
              {data.plan.stages.map((stage) => (
                <section key={stage.public_id} aria-label={stage.name}>
                  <h3 className="mb-3 text-[18px] font-bold text-[var(--color-secondary)]">{stage.name} <span className="text-[13px] font-normal text-[var(--color-text-muted)]">· semestre {stage.semester}</span></h3>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {stage.deliverables.map((d) => (
                      <DeliverableReviewCard key={d.public_id} deliverable={d} processId={processId} stageName={stage.name} canManage={canManage} onChanged={reload} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Card><p className="text-[13px] text-[var(--color-text-muted)]">Crea el plan de trabajo para definir los entregables.</p></Card>
          )
        )}
        {tab === 'cronograma' && <Schedule plan={data.plan} />}
        {tab === 'historial' && <Activity activity={data.activity} history={data.history} />}
      </div>
    </div>
  )
}
