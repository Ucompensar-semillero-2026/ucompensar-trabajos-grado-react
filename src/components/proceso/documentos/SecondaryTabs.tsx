import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, Eye, FileCheck2, Flag, MessageSquareText, RefreshCw, Send, TriangleAlert } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAppStore } from '@/stores/app.store'
import { ApiError, resolveFileUrl } from '@/services/http'
import { documentsApi, type ProcessDocumentOut } from '@/services/documents.service'
import { filePaths } from '@/services/files.service'
import { formatMoment } from '@/components/seguimiento/monitoringUi.utils'
import { DocumentViewerModal, type ViewerDocument } from '@/components/documentos/DocumentViewerModal'
import type { WorkPlanOut } from '@/services/workplan.service'
import { StatusPill, EmptyNote } from './documentosUi'
import { bogotaTodayIso, buildMilestones, versionRows, type DraftMap, type HistoryMap, type Milestone, type MilestoneKind, displayStatus, instantMs } from './documentosHelpers'

const linkBtn =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 text-[12px] font-bold text-[#0E6B9C] transition-colors hover:border-[#0E6B9C] hover:bg-[#0E6B9C]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]'

// ── Pestaña 2: documentos del proceso (endpoints existentes de documentos) ───

const DOC_STATUS: Record<ProcessDocumentOut['status'], { label: string; cls: string }> = {
  aprobado: { label: 'Aprobado', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300' },
  pendiente: { label: 'Pendiente de revisión', cls: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300' },
  rechazado: { label: 'Rechazado', cls: 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300' },
}

export function ProcessDocumentsTab({ processId }: { processId: string }) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [docs, setDocs] = useState<ProcessDocumentOut[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<ViewerDocument | null>(null)

  const load = () => {
    if (!accessToken) return
    setDocs(null)
    setError(null)
    documentsApi
      .listForProcess(accessToken, processId)
      .then((rows) => setDocs([...rows].sort((a, b) => instantMs(b.uploaded_at) - instantMs(a.uploaded_at))))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los documentos del proceso'))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [accessToken, processId])

  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
        {error}
        <button type="button" onClick={load} className={linkBtn}><RefreshCw size={13} aria-hidden="true" />Reintentar</button>
      </div>
    )
  }
  if (docs === null) return <p role="status" className="py-6 text-[13px] text-[var(--color-text-muted)]">Cargando documentos del proceso…</p>
  if (docs.length === 0) {
    return <EmptyNote title="Tu proceso aún no tiene documentos generales">Los documentos del trámite (distintos de los entregables del plan) aparecerán aquí cuando existan.</EmptyNote>
  }
  return (
    <>
      <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">Documentos generales del trámite. Los entregables del plan de trabajo están en la pestaña «Entregables del plan».</p>
      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
        {docs.map((doc) => (
          <li key={doc.public_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-[var(--color-surface)] px-4 py-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0E6B9C]/10 text-[#0E6B9C]"><FileCheck2 size={20} /></span>
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate text-[14px] font-bold text-[var(--color-secondary)]" title={doc.file_name}>{doc.file_name}</p>
              <p className="text-[12px] text-[var(--color-text-muted)]">{doc.document_type.name} · versión {doc.version} · cargado {formatMoment(doc.uploaded_at)}</p>
              {doc.comment && <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">Comentario: {doc.comment}</p>}
            </div>
            <span className={cn('whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-bold', DOC_STATUS[doc.status].cls)}>{DOC_STATUS[doc.status].label}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={linkBtn}
                aria-label={`Ver ${doc.file_name}`}
                onClick={() => setViewing({ public_id: doc.public_id, file_name: doc.file_name, file_path: filePaths.document(doc.public_id), documentType: doc.document_type.name, version: doc.version, status: doc.status })}
              >
                <Eye size={14} aria-hidden="true" />Ver
              </button>
              <a className={linkBtn} href={resolveFileUrl(doc.download_url)} target="_blank" rel="noopener noreferrer" download aria-label={`Descargar ${doc.file_name}`}>
                <Download size={14} aria-hidden="true" />Descargar
              </a>
            </div>
          </li>
        ))}
      </ul>
      <DocumentViewerModal isOpen={viewing !== null} onClose={() => setViewing(null)} document={viewing} canReview={false} />
    </>
  )
}

// ── Pestaña 3: versiones y observaciones (solo entregas OFICIALES) ───────────

const DECISION = { aprobado: 'Aprobado', requiere_correcciones: 'Requiere correcciones' } as const

export function VersionsHistoryTab({ plan, history, partial, loading }: { plan: WorkPlanOut; history: HistoryMap; partial: boolean; loading: boolean }) {
  const rows = useMemo(() => versionRows(plan, history), [plan, history])
  if (loading && rows.length === 0) return <p role="status" className="py-6 text-[13px] text-[var(--color-text-muted)]">Cargando versiones…</p>
  return (
    <>
      <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">Solo aparecen las entregas que formalizaste. Tus borradores son privados y no figuran aquí.</p>
      {partial && <p role="alert" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">No se pudo cargar el historial completo de algunos entregables; la lista puede estar incompleta.</p>}
      {rows.length === 0 ? (
        <EmptyNote title="Aún no has entregado documentos">Cuando formalices una entrega, verás aquí sus versiones y las observaciones de tu tutor.</EmptyNote>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ deliverable: d, stage, submission: s }) => (
            <li key={s.public_id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-[var(--color-secondary)]">{d.title} <span className="font-semibold text-[var(--color-text-muted)]">· versión {s.version}</span></p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{stage.name} · {s.file_name} · entregada {formatMoment(s.submitted_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={s.status === 'aprobado' ? 'aprobada' : s.status === 'requiere_correcciones' ? 'con_correcciones' : 'en_revision'} />
                  <a className={linkBtn} href={resolveFileUrl(s.download_url)} target="_blank" rel="noopener noreferrer" aria-label={`Vista previa de la versión ${s.version} de ${d.title}`}><Eye size={14} aria-hidden="true" />Ver</a>
                  <a className={linkBtn} href={resolveFileUrl(s.download_url)} target="_blank" rel="noopener noreferrer" download aria-label={`Descargar la versión ${s.version} de ${d.title}`}><Download size={14} aria-hidden="true" /></a>
                </div>
              </div>
              {s.student_comment && <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]"><span className="font-bold text-[var(--color-text)]">Tu comentario:</span> {s.student_comment}</p>}
              {s.reviews.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">Aún sin respuesta del tutor.</p>
              ) : (
                <ul className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
                  {s.reviews.map((r) => (
                    <li key={r.public_id} className="text-[13px]">
                      <p className="flex items-center gap-1.5 font-bold text-[var(--color-text)]">
                        <MessageSquareText size={14} aria-hidden="true" className={r.decision === 'aprobado' ? 'text-emerald-600' : 'text-red-600'} />
                        {DECISION[r.decision]}
                        <span className="font-normal text-[var(--color-text-muted)]">· {r.reviewer.full_name}, respondió {formatMoment(r.created_at)}</span>
                      </p>
                      {r.comment && <p className="mt-0.5 whitespace-pre-line pl-5 text-[var(--color-text-muted)]">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// ── Pestaña 4: calendario y hitos (solo fechas reales del sistema) ───────────

const MILESTONE_STYLE: Record<MilestoneKind, { Icon: typeof Flag; cls: string }> = {
  plan: { Icon: Flag, cls: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200' },
  limite: { Icon: CalendarDays, cls: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300' },
  entrega: { Icon: Send, cls: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300' },
  revision: { Icon: FileCheck2, cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' },
  correccion: { Icon: TriangleAlert, cls: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300' },
}

const dayMonth = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }

function MilestoneList({ items }: { items: Milestone[] }) {
  return (
    <ul className="space-y-2">
      {items.map((m) => {
        const { Icon, cls } = MILESTONE_STYLE[m.kind]
        return (
          <li key={m.key} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
            <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--color-bg)] text-center leading-none" title={longDate.format(parse(m.date))}>
              <span className="text-[10.5px] font-bold uppercase text-[var(--color-text-muted)]">{dayMonth.format(parse(m.date)).split(' ')[1]?.replace('.', '')}</span>
              <span className="text-[16px] font-extrabold text-[var(--color-secondary)]">{parse(m.date).getDate()}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-[var(--color-text)]">{m.label}</p>
              {m.detail && <p className="truncate text-[12px] text-[var(--color-text-muted)]" title={m.detail}>{m.detail}</p>}
            </div>
            <span aria-hidden="true" className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cls)}><Icon size={15} /></span>
          </li>
        )
      })}
    </ul>
  )
}

export function CalendarMilestonesTab({ plan, history, drafts }: { plan: WorkPlanOut; history: HistoryMap; drafts: DraftMap }) {
  const all = useMemo(() => buildMilestones(plan, history), [plan, history])
  const today = bogotaTodayIso()
  const upcoming = all.filter((m) => m.date >= today)
  const past = all.filter((m) => m.date < today).reverse()
  // Entregables vencidos sin entregar: se resaltan porque son lo único del calendario que exige acción inmediata.
  const overdue = plan.stages.flatMap((s) => s.deliverables).filter((d) => d.active && displayStatus(d, drafts) === 'vencida')
  return (
    <div className="space-y-5">
      {overdue.length > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-800">
          <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {overdue.length === 1 ? `«${overdue[0].title}» está vencido.` : `${overdue.length} entregables están vencidos.`}
        </p>
      )}
      {all.length === 0 ? (
        <EmptyNote title="Todavía no hay fechas registradas">Cuando tu plan tenga fechas límite o registres entregas, aparecerán aquí.</EmptyNote>
      ) : (
        <>
          <section aria-label="Próximos hitos">
            <h3 className="mb-2 text-[14px] font-extrabold text-[var(--color-secondary)]">Próximos</h3>
            {upcoming.length ? <MilestoneList items={upcoming} /> : <p className="text-[13px] text-[var(--color-text-muted)]">No hay fechas próximas.</p>}
          </section>
          {past.length > 0 && (
            <section aria-label="Hitos anteriores">
              <h3 className="mb-2 text-[14px] font-extrabold text-[var(--color-secondary)]">Anteriores</h3>
              <MilestoneList items={past} />
            </section>
          )}
        </>
      )}
      <p className="text-[12px] text-[var(--color-text-muted)]">Se muestran solo fechas registradas en el sistema. El sistema no guarda una fecha de apertura por entregable, por eso no aparece.</p>
    </div>
  )
}
