import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Cloud, CloudOff, FileText, Inbox, Loader2, X, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAppStore } from '@/stores/app.store'
import { filePaths } from '@/services/files.service'
import { DocumentViewerModal, type ViewerDocument } from '@/components/documentos/DocumentViewerModal'
import { resolveFileUrl } from '@/services/http'
import { workPlanApi, type DeliverableOut, type StageOut } from '@/services/workplan.service'
import type { ExtensionOut } from '@/services/monitoring.service'
import { formatMoment } from '@/components/seguimiento/monitoringUi.utils'
import { DeliverableStatusBadge } from '../workPlanUi'
import { SubmissionModalShell } from './SubmissionModalShell'
import { SubmissionConfirmationDialog } from './SubmissionConfirmationDialog'
import { DeliverButton } from './DeliverButton'
import {
  DraftFileCard, DraftUploadZone, DueDatesPanel, PanelCard, PublishedCard, SubmissionNotice, SubmissionVersionTimeline, TaskInformationPanel, TaskInstructionsPanel, TaskTemplateCard, TutorObservationsPanel,
} from './SubmissionPanels'
import { ATTEMPT_LABEL, attemptState, lastUpdate, latestSubmission, nextSubmissionVersion } from './submissionHelpers'
import { useSubmissionWorkspace } from './useSubmissionWorkspace'

interface Props {
  processId: string
  deliverable: DeliverableOut
  stage: StageOut
  dependencyTitle: string | null
  planPublishedAt: string | null
  /** Plazos del seguimiento (original y ampliaciones); si se omite, no se muestra el panel de plazos. */
  dueDetail?: { original: string | null; extensions: ExtensionOut[] }
  onClose: () => void
  /** Se llama tras una entrega para refrescar la lista de entregables. */
  onSubmitted: () => void
}

/**
 * Detalle y entrega de UNA tarea (estilo «tarea» de Teams): el archivo se guarda como borrador privado y solo se publica para
 * el tutor con el ÚNICO botón «Entregar» del pie, tras una confirmación.
 */
export function TaskSubmissionModal({ processId, deliverable: d, stage, dependencyTitle, planPublishedAt, dueDetail, onClose, onSubmitted }: Props) {
  const accessToken = useAppStore((s) => s.accessToken)
  const ws = useSubmissionWorkspace(accessToken, processId, d.public_id)
  const [confirming, setConfirming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Archivo abierto en el visor (borrador, plantilla o versión entregada): se ve sin descargarlo.
  const [viewing, setViewing] = useState<ViewerDocument | null>(null)
  const workspace = ws.workspace
  const state = attemptState(workspace)
  const draft = workspace?.current_draft ?? null
  const last = latestSubmission(workspace)
  const busy = Boolean(ws.upload) || ws.publishing
  const canSubmit = Boolean(workspace?.can_submit)
  // En revisión ya hay una versión publicada: preparar otra es una acción deliberada (no se reemplaza libremente).
  const [preparingNew, setPreparingNew] = useState(false)
  const showUpload = canSubmit && (state !== 'en_revision' || Boolean(draft) || preparingNew)
  // «Entregar» solo existe mientras haya algo que publicar o pueda haberlo (no en publicada/aprobada sin borrador nuevo).
  const showDeliver = canSubmit && (state === 'sin_archivo' || state === 'borrador' || state === 'requiere_correcciones' || preparingNew)
  const updatedAt = lastUpdate(workspace)

  const downloadTemplate = async () => {
    if (!accessToken) return
    try {
      // Enlace firmado fresco (el de la lista pudo caducar).
      const plan = await workPlanApi.get(accessToken, processId)
      const url = plan.stages.flatMap((s) => s.deliverables).find((x) => x.public_id === d.public_id)?.template_download_url
      if (!url) throw new Error()
      const link = document.createElement('a')
      link.href = resolveFileUrl(url)
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
    } catch {
      ws.setNotice({ kind: 'error', text: 'No se pudo descargar la plantilla.' })
    }
  }

  const confirmPublish = async () => {
    const ok = await ws.publish()
    setConfirming(false)
    if (ok) { setPreparingNew(false); onSubmitted() }
  }

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <button type="button" onClick={onClose} disabled={busy} className="mt-1 inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-2 text-[13px] font-bold text-[#1565C0] hover:bg-[#1565C0]/10 disabled:opacity-50 dark:text-sky-300">
          <ArrowLeft size={16} aria-hidden="true" />Volver
        </button>
        <span aria-hidden="true" className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#DCEEF8] text-[#0E6B9C] dark:bg-sky-400/20"><FileText size={22} /></span>
        <div className="min-w-0">
          <h2 id="task-modal-title" className="font-display text-[20px] font-extrabold leading-tight text-[var(--color-secondary)] md:text-[22px]">{d.title}</h2>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">{stage.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-bold', d.mandatory ? 'bg-[#062B4F] text-white' : 'bg-slate-200 text-slate-700')}>{d.mandatory ? 'Obligatorio' : 'Opcional'}</span>
            <DeliverableStatusBadge status={d.status} />
          </div>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="text-right">
          <p className={cn('flex items-center justify-end gap-1.5 text-[12.5px] font-extrabold', state === 'borrador' ? 'text-green-700 dark:text-green-300' : 'text-[var(--color-secondary)]')}>
            {state === 'sin_archivo' ? <CloudOff size={15} aria-hidden="true" /> : <Cloud size={15} aria-hidden="true" />}{ATTEMPT_LABEL[state]}
          </p>
          <p className="text-[11.5px] text-[var(--color-text-muted)]">{updatedAt ? `Última actualización: ${formatMoment(updatedAt)}` : 'Sin actividad todavía'}</p>
        </div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar ventana" className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-secondary)] disabled:opacity-50">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )

  const footer = (
    <>
      <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-[var(--color-border)] px-5 text-[13.5px] font-bold text-[var(--color-secondary)] hover:border-[#1565C0] disabled:opacity-50">
        {showDeliver ? 'Cancelar' : 'Cerrar'}
      </button>
      {showDeliver && (
        <DeliverButton
          size="md"
          onClick={() => setConfirming(true)}
          disabled={!draft || busy}
          title={!draft ? 'Carga primero tu archivo como borrador' : undefined}
          icon={ws.publishing ? <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : undefined}
        >
          {ws.publishing ? 'Entregando…' : 'Entregar'}
        </DeliverButton>
      )}
    </>
  )

  return (
    <SubmissionModalShell labelledBy="task-modal-title" onClose={onClose} locked={busy} header={header} footer={footer}>
      {!workspace ? (
        ws.loadError ? <p role="alert" className="rounded-xl border-2 border-red-400 bg-red-50 p-4 text-[13px] font-semibold text-red-800">{ws.loadError}</p>
          : <p role="status" className="p-6 text-center text-[13px] text-[var(--color-text-muted)]">Cargando la tarea…</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <TaskInstructionsPanel deliverable={d} workspace={workspace} dependencyTitle={dependencyTitle} />
            <TaskTemplateCard
              deliverable={d}
              onDownload={() => void downloadTemplate()}
              onPreview={() => d.template_file_name && setViewing({ file_name: d.template_file_name, file_path: filePaths.template(processId, d.public_id), documentType: `Plantilla · ${d.title}` })}
            />
            <PanelCard title="Mi entrega" Icon={Inbox} className="border-2 border-[#0E6B9C]/30">
              <div className="space-y-4">
                {ws.notice && (
                  <p role={ws.notice.kind === 'ok' ? 'status' : 'alert'} className={cn('flex items-start gap-2 rounded-xl border-2 p-3 text-[13px] font-semibold', ws.notice.kind === 'ok' ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-200' : 'border-red-500 bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200')}>
                    {ws.notice.kind === 'ok' ? <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" /> : <XCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />}{ws.notice.text}
                  </p>
                )}
                {last && !draft && <PublishedCard submission={last} justPublished={ws.published?.public_id === last.public_id} onPreview={() => setViewing({ file_name: last.file_name, file_path: filePaths.submission(processId, last.public_id), documentType: d.title, version: last.version })} onDownload={() => void ws.openFresh({ kind: 'submission', publicId: last.public_id })} />}
                {draft && (
                  confirmDelete ? (
                    <div role="group" aria-label="Confirmar eliminación" className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 text-[13px] dark:bg-red-500/10">
                      <p className="font-bold text-red-800 dark:text-red-200">¿Eliminar el borrador «{draft.file_name}»?</p>
                      <p className="text-red-900/80 dark:text-red-100/80">Dejará de estar disponible para entregar. No afecta a lo que ya hayas entregado.</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => setConfirmDelete(false)} className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-[var(--color-border)] bg-white px-3 text-[12.5px] font-bold">Conservar</button>
                        <button type="button" onClick={() => { setConfirmDelete(false); void ws.removeDraft() }} className="inline-flex h-9 cursor-pointer items-center rounded-xl bg-red-600 px-3 text-[12.5px] font-bold text-white">Sí, eliminar</button>
                      </div>
                    </div>
                  ) : (
                    <DraftFileCard draft={draft} disabled={busy} onPreview={() => setViewing({ file_name: draft.file_name, file_path: filePaths.draft(processId, d.public_id), documentType: `Borrador (no entregado) · ${d.title}`, version: draft.version })} onDownload={() => void ws.openFresh({ kind: 'draft' })} onDelete={() => setConfirmDelete(true)} />
                  )
                )}
                {!draft && !last && !ws.upload && <p className="text-[13px] text-[var(--color-text-muted)]">Aún no has cargado tu archivo para esta actividad.</p>}
                {showUpload ? (
                  <DraftUploadZone accept={workspace.accepted_extensions} maxMb={workspace.max_upload_mb} hasDraft={Boolean(draft)} upload={ws.upload} disabled={ws.publishing} onFile={(f) => void ws.uploadFile(f)} onCancel={ws.cancelUpload} />
                ) : canSubmit && state === 'en_revision' ? (
                  <button type="button" onClick={() => setPreparingNew(true)} className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-[#0E6B9C] hover:underline">
                    Preparar una nueva versión (se publicará como versión {nextSubmissionVersion(workspace)} al entregarla)
                  </button>
                ) : null}
              </div>
            </PanelCard>
            <TutorObservationsPanel submissions={workspace.submissions} />
          </div>
          <aside aria-label="Información de la tarea" className="space-y-5">
            <TaskInformationPanel deliverable={d} workspace={workspace} updatedAt={updatedAt} />
            {dueDetail && <DueDatesPanel original={dueDetail.original} effective={d.due_date} extensions={dueDetail.extensions} />}
            <SubmissionVersionTimeline workspace={workspace} planPublishedAt={planPublishedAt} />
            <SubmissionNotice state={state} blockedReason={workspace.blocked_reason} />
          </aside>
        </div>
      )}
      {confirming && draft && (
        <SubmissionConfirmationDialog
          fileName={draft.file_name}
          version={nextSubmissionVersion(workspace)}
          taskTitle={d.title}
          late={d.is_overdue}
          publishing={ws.publishing}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void confirmPublish()}
        />
      )}
      <DocumentViewerModal isOpen={viewing !== null} onClose={() => setViewing(null)} document={viewing} />
    </SubmissionModalShell>
  )
}
