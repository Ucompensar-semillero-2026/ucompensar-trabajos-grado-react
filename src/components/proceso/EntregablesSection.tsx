import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Download, FileUp, FolderOpen, History, MessageSquareText } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError, resolveFileUrl } from '@/services/http'
import {
  DEFAULT_ACCEPTED_EXTENSIONS,
  workPlanApi,
  type DeliverableOut,
  type StageOut,
  type SubmissionOut,
  type WorkPlanOut,
} from '@/services/workplan.service'
import { formatRelativeDate } from '@/utils/format'
import {
  DeliverableStatusBadge,
  ProcessSelector,
  allDeliverables,
  formatCalendarDate,
  stagesBySemester,
  useStudentWorkPlan,
} from './workPlanUi'

const DECISION_LABEL = { aprobado: 'Aprobado', requiere_correcciones: 'Requiere correcciones' } as const

function downloadLinkClass(primary = false) {
  return primary
    ? 'inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#0876B9]/40 px-4 py-2 text-[13px] font-semibold text-[#0876B9] hover:bg-[var(--color-info-soft,rgba(8,118,185,0.1))]'
    : 'inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0876B9] underline underline-offset-4'
}

interface DeliverableCardProps {
  deliverable: DeliverableOut
  stage: StageOut
  plan: WorkPlanOut
  processId: string
  onChanged: () => Promise<void>
}

function DeliverableCard({ deliverable: d, stage, plan, processId, onChanged }: DeliverableCardProps) {
  const accessToken = useAppStore((s) => s.accessToken)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadingRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [showObservations, setShowObservations] = useState(false)
  const [history, setHistory] = useState<SubmissionOut[] | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const accepted = d.accepted_extensions?.length ? d.accepted_extensions : DEFAULT_ACCEPTED_EXTENSIONS
  const current = d.current_submission
  const dependency = d.depends_on_public_id ? allDeliverables(plan).find((x) => x.public_id === d.depends_on_public_id) : null
  const observations = current?.reviews ?? []

  const handleFile = async (file: File | undefined) => {
    if (!file || !accessToken || uploadingRef.current) return
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!accepted.includes(extension)) {
      setMessage({ kind: 'error', text: `Formato no permitido. Usa: ${accepted.join(', ')}` })
      return
    }
    uploadingRef.current = true
    setUploading(true)
    setMessage(null)
    try {
      await workPlanApi.submit(accessToken, processId, d.public_id, file)
      setHistory(null)
      await onChanged()
      setMessage({ kind: 'ok', text: 'Entrega registrada. Quedó en revisión por tu tutor.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'No se pudo registrar la entrega' })
    } finally {
      uploadingRef.current = false
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const toggleHistory = async () => {
    const next = !showHistory
    setShowHistory(next)
    if (next && history === null && accessToken) {
      try {
        setHistory(await workPlanApi.listSubmissions(accessToken, processId, d.public_id))
      } catch {
        setHistory([])
      }
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h5 className="font-display text-[18px] font-bold leading-tight text-[var(--color-secondary)]">{d.title}</h5>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{stage.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={d.mandatory ? 'blue' : 'gray'}>{d.mandatory ? 'Obligatorio' : 'Opcional'}</Badge>
          <DeliverableStatusBadge status={d.status} />
          {d.is_overdue && <Badge variant="red">Vencido</Badge>}
        </div>
      </header>

      {d.instructions && (
        <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text)]">Instrucciones del tutor: </span>
          {d.instructions}
        </p>
      )}

      <p className="flex items-center gap-2 text-[13px] text-[var(--color-text)]">
        <CalendarClock size={15} aria-hidden className="text-[#0876B9]" />
        Fecha límite: <strong>{formatCalendarDate(d.due_date)}</strong>
      </p>

      {d.template_download_url && (
        <a href={resolveFileUrl(d.template_download_url)} target="_blank" rel="noopener noreferrer" className={downloadLinkClass(true)}>
          <Download size={15} aria-hidden /> Descargar plantilla
          {d.template_file_name && <span className="font-normal text-[var(--color-text-muted)]">({d.template_file_name})</span>}
        </a>
      )}

      {current && (
        <div className="rounded-xl bg-[var(--color-bg)] px-4 py-3 text-[13px]">
          <p className="font-semibold text-[var(--color-text)]">
            {current.file_name} <span className="font-normal text-[var(--color-text-muted)]">· versión {current.version}</span>
          </p>
          <p className="text-[12px] text-[var(--color-text-muted)]">Entregado {formatRelativeDate(current.submitted_at)}</p>
          <a href={resolveFileUrl(current.download_url)} target="_blank" rel="noopener noreferrer" className={`${downloadLinkClass()} mt-1`}>
            <Download size={14} aria-hidden /> Descargar mi entrega
          </a>
        </div>
      )}

      {d.status === 'requiere_correcciones' && observations.length > 0 && !showObservations && (
        <p role="status" className="text-[13px] font-medium text-red-700">
          Tu tutor pidió correcciones. Revisa las observaciones y sube una nueva versión.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {d.can_submit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              aria-label={`Seleccionar archivo para ${d.title}`}
              accept={accepted.join(',')}
              onChange={(e) => void handleFile(e.target.files?.[0])}
              tabIndex={-1}
            />
            <Button type="button" size="md" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <FileUp size={16} aria-hidden />
              {uploading ? 'Subiendo…' : current ? 'Reemplazar entrega' : 'Subir documento'}
            </Button>
          </>
        ) : d.status === 'aprobado' ? (
          <span className="text-[13px] font-semibold text-green-700">Entrega aprobada por tu tutor</span>
        ) : !d.applicable ? (
          <span className="text-[13px] text-[var(--color-text-muted)]">Este entregable no aplica a tu proyecto.</span>
        ) : d.status === 'pendiente' ? (
          <span className="text-[13px] text-[var(--color-text-muted)]">
            Se habilita cuando se apruebe {dependency ? `«${dependency.title}»` : 'el entregable previo'}.
          </span>
        ) : null}

        {observations.length > 0 && (
          <button
            type="button"
            onClick={() => setShowObservations((v) => !v)}
            aria-expanded={showObservations}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0876B9] underline underline-offset-4"
          >
            <MessageSquareText size={15} aria-hidden /> Ver observaciones ({observations.length})
          </button>
        )}
        {d.submissions_count > 0 && (
          <button
            type="button"
            onClick={() => void toggleHistory()}
            aria-expanded={showHistory}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0876B9] underline underline-offset-4"
          >
            <History size={15} aria-hidden /> Historial ({d.submissions_count})
          </button>
        )}
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-[13px] font-medium ${message.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}>
          {message.text}
        </p>
      )}

      {showObservations && (
        <ul className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
          {observations.map((r) => (
            <li key={r.public_id} className="text-[13px]">
              <p className="font-semibold text-[var(--color-text)]">
                {DECISION_LABEL[r.decision]} · <span className="font-normal text-[var(--color-text-muted)]">{r.reviewer.full_name}, {formatRelativeDate(r.created_at)}</span>
              </p>
              {r.comment && <p className="mt-0.5 whitespace-pre-line text-[var(--color-text-muted)]">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {showHistory && (
        <ul className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
          {history === null ? (
            <li className="text-[12px] text-[var(--color-text-muted)]">Cargando historial…</li>
          ) : (
            history.map((s) => (
              <li key={s.public_id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span>
                  <strong>v{s.version}</strong> · {s.file_name} · {formatRelativeDate(s.submitted_at)}
                </span>
                <span className="flex items-center gap-3">
                  <DeliverableStatusBadge status={s.status} />
                  <a href={resolveFileUrl(s.download_url)} target="_blank" rel="noopener noreferrer" className={downloadLinkClass()}>
                    Descargar
                  </a>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </article>
  )
}

export function EntregablesSection() {
  const { processes, selectedId, setSelectedId, plan, planState, error, reload } = useStudentWorkPlan()

  if (planState === 'loading') {
    return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando tus entregables…</p>
  }
  if (planState === 'error') {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
        {error}
      </p>
    )
  }
  if (processes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FolderOpen}
          title="Aún no tienes entregables"
          description="Cuando tengas un proceso de grado y tu tutor publique el plan de trabajo, tus entregables aparecerán aquí."
          action={<Link to="/tramites" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Ir a Mis trámites</Link>}
        />
      </Card>
    )
  }
  if (planState === 'none' || !plan || !selectedId) {
    return (
      <>
        <ProcessSelector processes={processes} value={selectedId} onChange={setSelectedId} />
        <Card>
          <EmptyState
            icon={FolderOpen}
            title="Tu tutor aún no ha publicado entregables"
            description="Cuando se publique el plan de trabajo, verás aquí las plantillas, las instrucciones y las fechas límite."
          />
        </Card>
      </>
    )
  }

  const { progress } = plan
  return (
    <div className="flex flex-col gap-6">
      <ProcessSelector processes={processes} value={selectedId} onChange={setSelectedId} />

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[14px] text-[var(--color-text)]">
          <strong>{progress.approved}</strong> de <strong>{progress.total_required}</strong> entregables obligatorios aprobados
          {progress.total_required > 0 && <> · {progress.percent}%</>}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="orange">En revisión: {progress.pending_review}</Badge>
          <Badge variant="red">Con correcciones: {progress.needs_corrections}</Badge>
          <Badge variant={progress.overdue ? 'red' : 'gray'}>Vencidos: {progress.overdue}</Badge>
        </div>
      </Card>

      {stagesBySemester(plan).map(({ semester, stages }) => (
        <section key={semester} aria-labelledby={`entregables-semestre-${semester}`}>
          <h3 id={`entregables-semestre-${semester}`} className="mb-4 text-[22px] font-bold text-[var(--color-secondary)]">
            Semestre {semester}
          </h3>
          <div className="flex flex-col gap-6">
            {stages.map((stage) => (
              <div key={stage.public_id}>
                <h4 className="mb-3 text-[17px] font-bold text-[var(--color-text)]">{stage.name}</h4>
                <div className="grid gap-4 xl:grid-cols-2">
                  {stage.deliverables.map((d) => (
                    <DeliverableCard key={d.public_id} deliverable={d} stage={stage} plan={plan} processId={selectedId} onChanged={reload} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
