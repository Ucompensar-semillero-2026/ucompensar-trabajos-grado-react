import { useRef } from 'react'
import { Check, Download, Eye, FileText, Upload } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import type { ChecklistItemOut, ProcessDocumentOut } from '@/services/documents.service'
import type { EtapaPlanTrazabilidad } from '@/services/trazabilidad.service'
import type { DeliverableStatus, SubmissionOut } from '@/services/workplan.service'
import { resolveFileUrl } from '@/services/http'
import { formatRelativeDate } from '@/utils/format'

interface Props {
  checklist: ChecklistItemOut[]
  documents: ProcessDocumentOut[]
  workPlanDocuments: EtapaPlanTrazabilidad[]
  workPlanDocumentsError: string | null
  studentName: string
  canUpload: boolean
  canReview: boolean
  reviewingDocumentId: string | null
  uploadingType: string | null
  onUpload: (documentTypeId: string, file: File) => void
  onApprove: (document: ProcessDocumentOut) => void
  onPreview: (document: ProcessDocumentOut) => void
  onPreviewWorkPlan: (submission: SubmissionOut, deliverableTitle: string) => void
}

const statusMeta: Record<ProcessDocumentOut['status'], { label: string; variant: 'orange' | 'green' | 'red' }> = {
  pendiente: { label: 'En revisión', variant: 'orange' },
  aprobado: { label: 'Aprobado', variant: 'green' },
  rechazado: { label: 'Devuelto', variant: 'red' },
}

const submissionStatusMeta: Record<SubmissionOut['status'], { label: string; variant: 'orange' | 'green' | 'red' }> = {
  en_revision: { label: 'En revisión', variant: 'orange' },
  aprobado: { label: 'Aprobado', variant: 'green' },
  requiere_correcciones: { label: 'Requiere correcciones', variant: 'red' },
}

const deliverableStatusMeta: Record<DeliverableStatus, { label: string; variant: 'gray' | 'blue' | 'orange' | 'red' | 'green' }> = {
  pendiente: { label: 'Pendiente', variant: 'gray' },
  disponible: { label: 'Disponible', variant: 'blue' },
  en_revision: { label: 'En revisión', variant: 'orange' },
  requiere_correcciones: { label: 'Requiere correcciones', variant: 'red' },
  aprobado: { label: 'Aprobado', variant: 'green' },
}

export function TabDocumentos({ checklist, documents, workPlanDocuments, workPlanDocumentsError, studentName, canUpload, canReview, reviewingDocumentId, uploadingType, onUpload, onApprove, onPreview, onPreviewWorkPlan }: Props) {
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const checklistTypeIds = new Set(checklist.map((item) => item.document_type.public_id))
  const otherDocumentTypes = [...new Map(documents
    .filter((document) => !checklistTypeIds.has(document.document_type.public_id))
    .map((document) => [document.document_type.public_id, document.document_type])).values()]
  return (
    <div className="space-y-3">
      {checklist.length === 0 && documents.length === 0 && workPlanDocuments.length === 0 ? <EmptyState icon={FileText} title="Sin documentos cargados" description="Todavía no hay archivos asociados a este trámite." /> : checklist.map((item) => {
        const typeId = item.document_type.public_id
        const versions = documents.filter((doc) => doc.document_type.public_id === typeId).sort((a, b) => b.version - a.version)
        return <Card key={typeId} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-[var(--color-text)]">{item.document_type.name}{item.mandatory && <span className="ml-2 text-[10px] font-bold uppercase text-[var(--color-primary)]">Obligatorio</span>}</h3>{item.note && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.note}</p>}</div>
            {canUpload && <>
              <input ref={(el) => { inputs.current[typeId] = el }} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg" aria-label={`Seleccionar ${item.document_type.name}`} onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(typeId, file); e.target.value = '' }} />
              <Button size="sm" variant="outline" disabled={uploadingType === typeId} onClick={() => inputs.current[typeId]?.click()}><Upload size={14} aria-hidden="true" />{uploadingType === typeId ? 'Cargando…' : versions.length ? 'Cargar versión' : 'Cargar documento'}</Button>
            </>}
          </div>
          {versions.length === 0 ? <p className="rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]">{item.checklist_status === 'faltante' ? 'Sin cargar' : item.checklist_status}</p> : (
            <ol className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
              {versions.map((doc) => {
                const meta = statusMeta[doc.status]
                return <li key={doc.public_id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                  <FileText size={17} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[var(--color-text)]">{doc.file_name}</p><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">v{doc.version} · {formatRelativeDate(doc.uploaded_at)} · {doc.uploaded_by.full_name}</p>{doc.reviewed_by && <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Revisado por {doc.reviewed_by.full_name}{doc.reviewed_at ? ` · ${formatRelativeDate(doc.reviewed_at)}` : ''}{doc.comment ? ` · ${doc.comment}` : ''}</p>}</div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <div className="flex items-center gap-1">
                    {canReview && doc.status === 'pendiente' && <Button type="button" size="sm" disabled={reviewingDocumentId === doc.public_id} onClick={() => onApprove(doc)}><Check size={14} aria-hidden="true" />{reviewingDocumentId === doc.public_id ? 'Aprobando…' : 'Aprobar'}</Button>}
                    <button type="button" aria-label={`Previsualizar ${doc.file_name}`} onClick={() => onPreview(doc)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"><Eye size={16} aria-hidden="true" /></button>
                    <a aria-label={`Descargar ${doc.file_name}`} href={resolveFileUrl(doc.download_url)} download={doc.file_name} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"><Download size={16} aria-hidden="true" /></a>
                  </div>
                </li>
              })}
            </ol>
          )}
        </Card>
      })}
      {otherDocumentTypes.map((documentType) => {
        const versions = documents
          .filter((document) => document.document_type.public_id === documentType.public_id)
          .sort((a, b) => b.version - a.version)
        return <Card key={documentType.public_id} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">{documentType.name}</h3>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Documentos cargados asociados a este trámite.</p>
          </div>
          <ol className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
            {versions.map((doc) => {
              const meta = statusMeta[doc.status]
              return <li key={doc.public_id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <FileText size={17} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">{doc.file_name}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">v{doc.version} · {formatRelativeDate(doc.uploaded_at)} · {doc.uploaded_by.full_name}</p>
                  {doc.reviewed_by && <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Revisado por {doc.reviewed_by.full_name}{doc.reviewed_at ? ` · ${formatRelativeDate(doc.reviewed_at)}` : ''}{doc.comment ? ` · ${doc.comment}` : ''}</p>}
                </div>
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <div className="flex items-center gap-1">
                  {canReview && doc.status === 'pendiente' && <Button type="button" size="sm" disabled={reviewingDocumentId === doc.public_id} onClick={() => onApprove(doc)}><Check size={14} aria-hidden="true" />{reviewingDocumentId === doc.public_id ? 'Aprobando…' : 'Aprobar'}</Button>}
                  <button type="button" aria-label={`Previsualizar ${doc.file_name}`} onClick={() => onPreview(doc)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"><Eye size={16} aria-hidden="true" /></button>
                  <a aria-label={`Descargar ${doc.file_name}`} href={resolveFileUrl(doc.download_url)} download={doc.file_name} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"><Download size={16} aria-hidden="true" /></a>
                </div>
              </li>
            })}
          </ol>
        </Card>
      })}
      <Card className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Plan de trabajo por etapas</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Cada entregable y sus archivos se muestran en su propio apartado.</p>
        </div>
        {workPlanDocumentsError ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{workPlanDocumentsError}</p>
        ) : workPlanDocuments.length === 0 ? (
          <p className="rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]">Este trámite aún no tiene un plan de trabajo con etapas publicadas.</p>
        ) : (
          <div className="space-y-4">
            {workPlanDocuments.map((stage, stageIndex) => (
              <section key={stage.publicId} className="space-y-3 rounded-xl border border-[var(--color-border)] p-3 sm:p-4" aria-label={`Etapa ${stage.name}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-[var(--color-text)]">{stageIndex + 1}. {stage.name}</h4>
                  {!stage.active && <Badge variant="gray">Etapa inactiva</Badge>}
                </div>
                {stage.deliverables.length === 0 ? (
                  <p className="rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]">Esta etapa aún no tiene entregables configurados.</p>
                ) : (
                  <div className="space-y-3">
                    {stage.deliverables.map((deliverable) => {
                      const status = deliverableStatusMeta[deliverable.status]
                      return <article key={deliverable.publicId} className="space-y-3 rounded-xl bg-[var(--color-bg)] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h5 className="text-sm font-semibold text-[var(--color-text)]">{deliverable.deliverableTitle}</h5>
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                              {deliverable.mandatory ? 'Obligatorio' : 'Opcional'}
                              {deliverable.dueDate ? ` · Fecha límite: ${new Date(`${deliverable.dueDate.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO')}` : ''}
                            </p>
                          </div>
                          {!deliverable.applicable ? <Badge variant="gray">No aplica</Badge> : <Badge variant={status.variant}>{status.label}</Badge>}
                        </div>
                        {deliverable.instructions && <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{deliverable.instructions}</p>}
                        {!deliverable.applicable ? (
                          <p className="text-xs text-[var(--color-text-muted)]">Este entregable no aplica al proyecto.</p>
                        ) : deliverable.submissions.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)]">El estudiante aún no ha cargado este documento.</p>
                        ) : (
                          <ol className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                            {deliverable.submissions.map((submission) => {
                              const submissionStatus = submissionStatusMeta[submission.status]
                              const latestReview = submission.reviews[submission.reviews.length - 1]
                              return <li key={submission.public_id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                                <FileText size={17} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-[var(--color-text)]">{submission.file_name}</p>
                                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">v{submission.version} · {formatRelativeDate(submission.submitted_at)} · {submission.submitted_by.full_name}</p>
                                  {(latestReview?.comment || submission.student_comment) && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{latestReview?.comment ?? submission.student_comment}</p>}
                                </div>
                                <Badge variant={submissionStatus.variant}>{submissionStatus.label}</Badge>
                                <div className="flex items-center gap-1">
                                  <button type="button" aria-label={`Previsualizar ${submission.file_name}`} onClick={() => onPreviewWorkPlan(submission, deliverable.deliverableTitle)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"><Eye size={16} aria-hidden="true" /></button>
                                  <a aria-label={`Descargar ${submission.file_name}`} href={resolveFileUrl(submission.download_url)} download={submission.file_name} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"><Download size={16} aria-hidden="true" /></a>
                                </div>
                              </li>
                            })}
                          </ol>
                        )}
                      </article>
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </Card>
      <p className="px-1 text-[11px] text-[var(--color-text-muted)]">Documentos asociados al trámite de {studentName}.</p>
    </div>
  )
}
