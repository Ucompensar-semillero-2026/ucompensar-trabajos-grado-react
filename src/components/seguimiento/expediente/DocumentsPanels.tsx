import { ArrowRight, Download, FileText } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ProcessDocumentOut } from '@/services/documents.service'
import { formatMoment, formatMomentDay } from '../monitoringUi.utils'
import { DOCUMENT_STATUS, fileKind } from './dossierHelpers'
import { DossierCard, EmptyNote, SectionError } from './dossierUi'
import type { DossierSection } from './useStudentDossier'

function FileBadge({ name }: { name: string }) {
  const kind = fileKind(name)
  return <span aria-hidden="true" className={cn('flex h-10 w-9 shrink-0 items-end justify-center rounded-md pb-1 text-[9px] font-extrabold shadow-sm', kind.className)}>{kind.label}</span>
}

function DownloadButton({ doc, onDownload, compact }: { doc: ProcessDocumentOut; onDownload: (doc: ProcessDocumentOut) => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onDownload(doc)}
      aria-label={`Descargar ${doc.file_name}`}
      title={`Descargar ${doc.file_name}`}
      className={cn('inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[#1565C0] transition-colors hover:bg-[#1565C0]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B1A] dark:text-sky-300', compact ? 'h-9 w-9' : 'h-9 border border-[var(--color-border)] px-3 text-[12px] font-bold')}
    >
      <Download size={16} aria-hidden="true" />{!compact && 'Descargar'}
    </button>
  )
}

const byNewest = (docs: ProcessDocumentOut[]) => [...docs].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))

/** Pestaña Documentos: todos los documentos del proceso con su estado de revisión. */
export function DocumentsTab({ documents, onDownload }: { documents: DossierSection<ProcessDocumentOut[]>; onDownload: (doc: ProcessDocumentOut) => void }) {
  return (
    <DossierCard title="Documentos" Icon={FileText} titleId="exp-docs-title">
      {documents.loading ? <p role="status" className="text-[13px] text-[var(--color-text-muted)]">Cargando documentos…</p>
        : documents.error ? <SectionError message={documents.error} />
          : !documents.data?.length ? <EmptyNote>El proyecto no tiene documentos cargados.</EmptyNote> : (
            <ul className="divide-y divide-[var(--color-border)]">
              {byNewest(documents.data).map((d) => {
                const st = DOCUMENT_STATUS[d.status]
                return (
                  <li key={d.public_id} className="flex flex-wrap items-center gap-3 py-3">
                    <FileBadge name={d.file_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-[var(--color-secondary)]" title={d.file_name}>{d.file_name}</p>
                      <p className="text-[12px] text-[var(--color-text-muted)]">{d.document_type.name} · v{d.version} · {d.uploaded_by.full_name} · {formatMoment(d.uploaded_at)}</p>
                    </div>
                    <span className={cn('whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-bold leading-none', st.className)}>{st.label}</span>
                    <DownloadButton doc={d} onDownload={onDownload} />
                  </li>
                )
              })}
            </ul>
          )}
    </DossierCard>
  )
}

/** Panel lateral: los tres documentos más recientes. */
export function RecentDocumentsCard({ documents, onDownload, onShowAll }: { documents: DossierSection<ProcessDocumentOut[]>; onDownload: (doc: ProcessDocumentOut) => void; onShowAll: () => void }) {
  const recent = documents.data ? byNewest(documents.data).slice(0, 3) : []
  return (
    <DossierCard title="Documentos recientes" Icon={FileText} titleId="exp-recent-docs-title">
      {documents.loading ? <p role="status" className="text-[12.5px] text-[var(--color-text-muted)]">Cargando documentos…</p>
        : documents.error ? <SectionError message={documents.error} />
          : recent.length === 0 ? <EmptyNote>Sin documentos cargados.</EmptyNote> : (
            <ul className="space-y-3">
              {recent.map((d) => (
                <li key={d.public_id} className="flex items-center gap-3">
                  <FileBadge name={d.file_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[var(--color-secondary)]" title={d.file_name}>{d.file_name}</p>
                    <p className="text-[11.5px] text-[var(--color-text-muted)]">{d.document_type.name} · {formatMomentDay(d.uploaded_at)}</p>
                  </div>
                  <DownloadButton doc={d} onDownload={onDownload} compact />
                </li>
              ))}
            </ul>
          )}
      {(documents.data?.length ?? 0) > 0 && (
        <button type="button" onClick={onShowAll} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-[#1565C0] hover:underline dark:text-sky-300">
          Ver todos los documentos<ArrowRight size={14} aria-hidden="true" />
        </button>
      )}
    </DossierCard>
  )
}
