import type { ReactNode } from 'react'
import { BookOpen, CalendarClock, CheckCircle2, Download, FileText, Info, ListChecks, MessageSquareText, MessageSquareWarning, RefreshCw, Trash2, UploadCloud, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { DeliverableOut, DraftOut, DraftWorkspaceOut, SubmissionOut } from '@/services/workplan.service'
import type { ExtensionOut } from '@/services/monitoring.service'
import { formatMoment } from '@/components/seguimiento/monitoringUi.utils'
import { fileKind } from '@/components/seguimiento/expediente/dossierHelpers'
import { DeliverableStatusBadge } from '../workPlanUi'
import { formatCalendarDate } from '../workPlanUi.utils'
import { PREVIEWABLE, deadlineInfo, extensionOf, formatBytes, timelineEvents, type AttemptState, type DeadlineTone, type TimelineKind } from './submissionHelpers'

export function PanelCard({ title, Icon, children, className }: { title: string; Icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]', className)}>
      <h3 className="mb-3 flex items-center gap-2.5 font-display text-[16px] font-extrabold text-[var(--color-secondary)]">
        <Icon size={18} aria-hidden="true" className="text-[#0E6B9C]" />{title}
      </h3>
      {children}
    </section>
  )
}

function FileGlyph({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const k = fileKind(name)
  return <span aria-hidden="true" className={cn('flex shrink-0 items-end justify-center rounded-lg pb-1 font-extrabold shadow-sm', k.className, size === 'lg' ? 'h-14 w-12 text-[11px]' : 'h-11 w-10 text-[10px]')}>{k.label}</span>
}

const actionBtn = 'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-bold transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E6B9C]'

// ── A. Instrucciones ─────────────────────────────────────────────────────────

export function TaskInstructionsPanel({ deliverable, workspace, dependencyTitle }: { deliverable: DeliverableOut; workspace: DraftWorkspaceOut; dependencyTitle: string | null }) {
  return (
    <PanelCard title="Instrucciones" Icon={BookOpen}>
      {deliverable.instructions ? (
        <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--color-text)]">{deliverable.instructions}</p>
      ) : (
        <p className="text-[13px] italic text-[var(--color-text-muted)]">Tu tutor no registró instrucciones adicionales para esta actividad.</p>
      )}
      <ul className="mt-4 grid gap-2 text-[12.5px] text-[var(--color-text-muted)] sm:grid-cols-2">
        <li className="flex items-start gap-2"><ListChecks size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-[#1565C0]" /><span><strong className="text-[var(--color-text)]">Formatos:</strong> {workspace.accepted_extensions.join(', ')}</span></li>
        <li className="flex items-start gap-2"><UploadCloud size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-[#1565C0]" /><span><strong className="text-[var(--color-text)]">Tamaño máximo:</strong> {workspace.max_upload_mb} MB</span></li>
        <li className="flex items-start gap-2"><CalendarClock size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-[#1565C0]" /><span><strong className="text-[var(--color-text)]">Fecha límite:</strong> {formatCalendarDate(deliverable.due_date)}</span></li>
        {dependencyTitle && <li className="flex items-start gap-2"><Info size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-[#1565C0]" /><span><strong className="text-[var(--color-text)]">Requiere:</strong> que se apruebe «{dependencyTitle}»</span></li>}
      </ul>
    </PanelCard>
  )
}

// ── B. Plantilla ─────────────────────────────────────────────────────────────

export function TaskTemplateCard({ deliverable, onDownload }: { deliverable: DeliverableOut; onDownload: () => void }) {
  if (!deliverable.template_file_name) return null
  return (
    <PanelCard title="Plantilla de la actividad" Icon={FileText}>
      <div className="flex flex-wrap items-center gap-3">
        <FileGlyph name={deliverable.template_file_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold text-[var(--color-secondary)]" title={deliverable.template_file_name}>{deliverable.template_file_name}</p>
          <p className="text-[12px] text-[var(--color-text-muted)]">Formato {extensionOf(deliverable.template_file_name).replace('.', '').toUpperCase() || 'archivo'} · proporcionada por tu tutor</p>
        </div>
        <button type="button" onClick={onDownload} className={cn(actionBtn, 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-secondary)] hover:border-[#1565C0]')}>
          <Download size={14} aria-hidden="true" />Descargar plantilla
        </button>
      </div>
    </PanelCard>
  )
}

// ── C. Mi entrega ────────────────────────────────────────────────────────────

export function DraftFileCard({ draft, onPreview, onDownload, onDelete, disabled }: { draft: DraftOut; onPreview: () => void; onDownload: () => void; onDelete: () => void; disabled: boolean }) {
  const ext = extensionOf(draft.file_name)
  return (
    <div className="rounded-2xl border-2 border-[#16A34A] bg-[#DCFCE7] p-4 dark:bg-green-500/10">
      <p className="flex items-center gap-2 text-[14px] font-extrabold text-green-800 dark:text-green-200"><CheckCircle2 size={18} aria-hidden="true" />Borrador guardado (no entregado)</p>
      <p className="mt-0.5 text-[12.5px] text-green-900/80 dark:text-green-100/80">Este archivo solo es visible para ti y aún no ha sido enviado al tutor.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white/85 p-3 dark:bg-white/5">
        <FileGlyph name={draft.file_name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-[var(--color-secondary)]" title={draft.file_name}>{draft.file_name}</p>
          <p className="text-[12px] text-[var(--color-text-muted)]">{ext.replace('.', '').toUpperCase()} · {formatBytes(draft.size_bytes)} · Borrador {draft.version}</p>
          <p className="text-[12px] text-[var(--color-text-muted)]">Cargado {formatMoment(draft.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PREVIEWABLE.includes(ext) && <button type="button" onClick={onPreview} disabled={disabled} className={cn(actionBtn, 'border-[var(--color-border)] bg-white text-[var(--color-secondary)] hover:border-[#1565C0]')}><FileText size={14} aria-hidden="true" />Vista previa</button>}
          <button type="button" onClick={onDownload} disabled={disabled} className={cn(actionBtn, 'border-[var(--color-border)] bg-white text-[var(--color-secondary)] hover:border-[#1565C0]')}><Download size={14} aria-hidden="true" />Descargar</button>
          <button type="button" onClick={onDelete} disabled={disabled} className={cn(actionBtn, 'border-red-300 bg-white text-red-700 hover:border-red-500')}><Trash2 size={14} aria-hidden="true" />Eliminar borrador</button>
        </div>
      </div>
    </div>
  )
}

const SUBMISSION_TONE: Record<SubmissionOut['status'], { box: string; label: string }> = {
  en_revision: { box: 'border-[#2563EB] bg-[#DBEAFE] dark:bg-blue-500/10', label: 'En revisión por tu tutor' },
  requiere_correcciones: { box: 'border-[#F97316] bg-[#FFEDD5] dark:bg-orange-500/10', label: 'Tu tutor pidió correcciones' },
  aprobado: { box: 'border-[#16A34A] bg-[#DCFCE7] dark:bg-green-500/10', label: 'Aprobada por tu tutor' },
}

const DECISION_TEXT = { aprobado: 'Aprobado', requiere_correcciones: 'Requiere correcciones' } as const

/** Observaciones del tutor sobre TODAS las versiones oficiales (la más reciente primero), con el estado de la revisión. */
export function TutorObservationsPanel({ submissions }: { submissions: SubmissionOut[] }) {
  const reviews = submissions
    .flatMap((s) => s.reviews.map((r) => ({ r, version: s.version })))
    .sort((a, b) => b.r.created_at.localeCompare(a.r.created_at))
  const last = submissions.length ? submissions.reduce((a, b) => (b.version > a.version ? b : a)) : null
  return (
    <PanelCard title="Observaciones del tutor" Icon={MessageSquareText}>
      {!last ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">Cuando entregues este documento, tu tutor lo revisará y sus observaciones aparecerán aquí.</p>
      ) : (
        <>
          <p className="mb-2 text-[13px] text-[var(--color-text-muted)]">
            Estado de la revisión de la versión {last.version}: <strong className="text-[var(--color-text)]">{last.status === 'aprobado' ? 'aprobada' : last.status === 'requiere_correcciones' ? 'requiere correcciones' : 'en revisión'}</strong>
          </p>
          {reviews.length === 0 ? (
            <p className="rounded-xl bg-[var(--color-bg)] p-3 text-[13px] text-[var(--color-text-muted)]">Tu tutor todavía no ha respondido.</p>
          ) : (
            <ul className="space-y-2">
              {reviews.map(({ r, version }) => (
                <li key={r.public_id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-[13px]">
                  <p className="font-bold text-[var(--color-text)]">
                    {DECISION_TEXT[r.decision]} <span className="font-normal text-[var(--color-text-muted)]">· versión {version} · {r.reviewer.full_name}, {formatMoment(r.created_at)}</span>
                  </p>
                  {r.comment ? <p className="mt-1 whitespace-pre-line text-[var(--color-text-muted)]">{r.comment}</p> : <p className="mt-1 text-[var(--color-text-dim)]">Sin comentarios.</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PanelCard>
  )
}

/** Versión formal más reciente (lo que ve el tutor). */
export function PublishedCard({ submission, onDownload, justPublished }: { submission: SubmissionOut; onDownload: () => void; justPublished: boolean }) {
  const tone = SUBMISSION_TONE[submission.status]
  const lastReview = submission.reviews[submission.reviews.length - 1]
  return (
    <div className={cn('rounded-2xl border-2 p-4', tone.box)}>
      {justPublished && <p role="status" className="mb-2 flex items-center gap-2 text-[14px] font-extrabold text-green-800 dark:text-green-200"><CheckCircle2 size={18} aria-hidden="true" />¡Entrega realizada! Tu tutor ya puede revisarla.</p>}
      <p className="text-[13.5px] font-extrabold text-[var(--color-secondary)]">Versión {submission.version} entregada · {tone.label}</p>
      <p className="text-[12.5px] text-[var(--color-text-muted)]">{submission.file_name} · entregada {formatMoment(submission.submitted_at)}</p>
      {lastReview?.comment && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-white/80 p-3 text-[12.5px] dark:bg-white/5">
          <MessageSquareWarning size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-orange-600" />
          <span><strong>{lastReview.reviewer.full_name}:</strong> {lastReview.comment}</span>
        </p>
      )}
      <button type="button" onClick={onDownload} className={cn(actionBtn, 'mt-3 border-[var(--color-border)] bg-white text-[var(--color-secondary)] hover:border-[#1565C0]')}><Download size={14} aria-hidden="true" />Descargar versión {submission.version}</button>
    </div>
  )
}

export function DraftUploadZone({ accept, maxMb, hasDraft, upload, onFile, onCancel, disabled }: {
  accept: string[]
  maxMb: number
  hasDraft: boolean
  upload: { fileName: string; percent: number } | null
  onFile: (file: File) => void
  onCancel: () => void
  disabled: boolean
}) {
  if (upload) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border-2 border-dashed border-[#0E6B9C] bg-[#DCEEF8]/60 p-5 text-center dark:bg-sky-400/10">
        <p className="text-[13.5px] font-bold text-[var(--color-secondary)]">Guardando borrador… {upload.percent}%</p>
        <p className="truncate text-[12px] text-[var(--color-text-muted)]">{upload.fileName}</p>
        <div className="mx-auto mt-3 h-2.5 max-w-md overflow-hidden rounded-full bg-white dark:bg-white/10" role="progressbar" aria-valuenow={upload.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de la carga">
          <div className="h-full rounded-full bg-[#0E6B9C] transition-[width] duration-200" style={{ width: `${upload.percent}%` }} />
        </div>
        <button type="button" onClick={onCancel} className="mt-3 inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-bold text-red-700 hover:underline"><XCircle size={14} aria-hidden="true" />Cancelar carga</button>
      </div>
    )
  }
  return (
    <label
      onDragOver={(e) => { e.preventDefault() }}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !disabled) onFile(f) }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[#0E6B9C]/50 bg-[var(--color-surface)] p-6 text-center transition-colors hover:border-[#0E6B9C] hover:bg-[#DCEEF8]/40 focus-within:border-[#0E6B9C] dark:hover:bg-sky-400/10',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DCEEF8] text-[#0E6B9C] dark:bg-sky-400/20">{hasDraft ? <RefreshCw size={22} /> : <UploadCloud size={24} />}</span>
      <span className="text-[13.5px] font-bold text-[var(--color-secondary)]">{hasDraft ? 'Arrastra tu archivo aquí o haz clic para reemplazarlo' : 'Arrastra tu archivo aquí o haz clic para seleccionarlo'}</span>
      <span className="text-[12px] text-[var(--color-text-muted)]">Formatos: {accept.join(', ')} · Máximo {maxMb} MB · Se guarda como borrador, no se entrega</span>
      <input type="file" className="sr-only" aria-label={hasDraft ? 'Reemplazar el borrador' : 'Seleccionar archivo'} accept={accept.join(',')} disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }} />
    </label>
  )
}

// ── Columna derecha ──────────────────────────────────────────────────────────

const DEADLINE_TONE: Record<DeadlineTone, string> = {
  verde: 'bg-[#16A34A] text-white', azul: 'bg-[#2563EB] text-white', naranja: 'bg-[#F97316] text-orange-950', rojo: 'bg-[#DC2626] text-white', gris: 'bg-slate-500 text-white',
}

/** Plazos del seguimiento: fecha original, fecha efectiva (la que cuenta para el vencimiento) y ampliaciones autorizadas. */
export function DueDatesPanel({ original, effective, extensions }: { original: string | null; effective: string | null; extensions: ExtensionOut[] }) {
  return (
    <PanelCard title="Plazos y ampliaciones" Icon={CalendarClock}>
      <dl className="space-y-2.5 text-[13px]">
        <div className="flex items-center justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Fecha límite original</dt><dd className="font-bold text-[var(--color-secondary)]">{formatCalendarDate(original)}</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Fecha límite efectiva</dt><dd className="font-bold text-[var(--color-secondary)]">{formatCalendarDate(effective)}</dd></div>
      </dl>
      {extensions.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-[var(--color-text-muted)]">Sin ampliaciones autorizadas.</p>
      ) : (
        <ul className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3 text-[12.5px]">
          {extensions.map((e) => (
            <li key={e.id} className="rounded-lg bg-[var(--color-bg)] p-2.5">
              <p className="font-bold text-[var(--color-text)]">+{e.days_added} {e.days_added === 1 ? 'día' : 'días'} · nuevo plazo {formatCalendarDate(e.new_due_date)}</p>
              <p className="text-[var(--color-text-muted)]">{e.reason}</p>
              <p className="text-[11.5px] text-[var(--color-text-dim)]">Autorizó {e.authorized_by} · {formatMoment(e.authorized_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  )
}

export function TaskInformationPanel({ deliverable, workspace, updatedAt }: { deliverable: DeliverableOut; workspace: DraftWorkspaceOut; updatedAt: string | null }) {
  const deadline = deadlineInfo(deliverable)
  return (
    <PanelCard title="Información de la tarea" Icon={Info}>
      <dl className="space-y-2.5 text-[13px]">
        <div className="flex items-center justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Fecha límite</dt><dd className="font-bold text-[var(--color-secondary)]">{formatCalendarDate(deliverable.due_date)}</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Plazo</dt><dd><span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-bold', DEADLINE_TONE[deadline.tone])}>{deadline.label}</span></dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Estado</dt><dd><DeliverableStatusBadge status={deliverable.status} /></dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Intentos</dt><dd className="font-bold text-[var(--color-secondary)]">{workspace.submissions.length} {workspace.submissions.length === 1 ? 'entrega' : 'entregas'} · {workspace.drafts.length} {workspace.drafts.length === 1 ? 'borrador' : 'borradores'}</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Última actualización</dt><dd className="text-right font-bold text-[var(--color-secondary)]">{updatedAt ? formatMoment(updatedAt) : '—'}</dd></div>
      </dl>
    </PanelCard>
  )
}

const KIND_DOT: Record<TimelineKind, string> = {
  tarea: 'bg-slate-400', borrador: 'bg-[#0E6B9C]', reemplazo: 'bg-sky-300', eliminado: 'bg-slate-400', publicada: 'bg-[#2563EB]', correcciones: 'bg-[#F97316]', aprobada: 'bg-[#16A34A]',
}

export function SubmissionVersionTimeline({ workspace, planPublishedAt }: { workspace: DraftWorkspaceOut; planPublishedAt: string | null }) {
  const events = timelineEvents(workspace, planPublishedAt)
  return (
    <PanelCard title="Historial de versiones" Icon={RefreshCw}>
      {events.length === 0 ? <p className="text-[12.5px] text-[var(--color-text-muted)]">Sin movimientos todavía.</p> : (
        <ol className="relative space-y-3 pl-5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-[2px] before:bg-[var(--color-border)]" aria-label="Historial de versiones">
          {events.map((e) => (
            <li key={e.key} className="relative text-[12.5px]">
              <span aria-hidden="true" className={cn('absolute -left-5 top-1 h-3 w-3 rounded-full ring-2 ring-[var(--color-surface)]', KIND_DOT[e.kind])} />
              <p className="font-bold text-[var(--color-secondary)]">{e.title}</p>
              <p className="text-[11.5px] text-[var(--color-text-muted)]">{formatMoment(e.date)}{e.detail && ` · ${e.detail}`}</p>
            </li>
          ))}
        </ol>
      )}
    </PanelCard>
  )
}

const NOTICE_TEXT: Record<AttemptState, string> = {
  sin_archivo: 'Carga tu archivo: se guardará como borrador privado. Solo se enviará a tu tutor cuando pulses «Entregar».',
  borrador: 'Al entregar, tu archivo se publicará y quedará disponible para tu tutor, quien podrá revisarlo y dejar observaciones.',
  en_revision: 'Tu entrega está publicada y en revisión. Tu tutor te dejará observaciones o la aprobará.',
  requiere_correcciones: 'Tu tutor pidió correcciones. Carga la versión corregida como borrador y entrégala cuando esté lista.',
  aprobada: 'Esta actividad ya fue aprobada. No admite nuevas entregas.',
}

export function SubmissionNotice({ state, blockedReason }: { state: AttemptState; blockedReason: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-[#2563EB]/40 bg-[#DBEAFE] p-4 text-[12.5px] text-blue-950 dark:bg-blue-500/10 dark:text-blue-100">
      <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#2563EB]" />
      <p>{blockedReason && state !== 'aprobada' ? blockedReason : NOTICE_TEXT[state]}</p>
    </div>
  )
}
