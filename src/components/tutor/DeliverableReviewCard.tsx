import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { filePaths } from '@/services/files.service'
import { ArchivoAcciones } from '@/components/documentos/ArchivoAcciones'
import { workPlanApi, type DeliverableOut, type SubmissionOut } from '@/services/workplan.service'
import { formatRelativeDate } from '@/utils/format'
import { DeliverableStatusBadge } from '@/components/proceso/workPlanUi'
import { formatCalendarDate } from '@/components/proceso/workPlanUi.utils'

const DECISION_LABEL = { aprobado: 'Aprobado', requiere_correcciones: 'Requiere correcciones' } as const

export function DeliverableReviewCard({ deliverable: d, processId, stageName, canManage, onChanged, onReview }: { deliverable: DeliverableOut; processId: string; stageName: string; canManage: boolean; onChanged: () => Promise<void>; onReview?: (submissionPublicId: string) => void }) {
  const accessToken = useAppStore((s) => s.accessToken)
  const templateInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const toggleHistory = async () => {
    const next = !showHistory
    setShowHistory(next)
    if (next && history === null && accessToken) setHistory(await workPlanApi.listSubmissions(accessToken, processId, d.public_id).catch(() => []))
  }

  return (
    <article id={`entregable-${d.public_id}`} className="scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
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
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="text-[var(--color-text)]">Plantilla: {d.template_file_name}</span>
            <ArchivoAcciones
              file={{ path: filePaths.template(processId, d.public_id), fileName: d.template_file_name ?? 'plantilla' }}
              title={`Plantilla · ${d.title}`}
              downloadLabel="Descargar plantilla"
              missing={d.template_missing}
            />
          </span>
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
          <span className="mt-1 inline-flex">
            <ArchivoAcciones
              file={{ path: filePaths.submission(processId, current.public_id), fileName: current.file_name }}
              title={d.title}
              version={current.version}
              downloadLabel="Descargar entrega"
              missing={current.file_missing}
            />
          </span>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">El estudiante aún no ha entregado este documento.</p>
      )}

      {canManage && awaitingReview && current && onReview && (
        <div className="mt-3">
          <Button type="button" size="sm" onClick={() => onReview(current.public_id)}>Revisar entrega</Button>
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
                <ArchivoAcciones
                  file={{ path: filePaths.submission(processId, s.public_id), fileName: s.file_name }}
                  title={d.title}
                  version={s.version}
                  missing={s.file_missing}
                />
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
