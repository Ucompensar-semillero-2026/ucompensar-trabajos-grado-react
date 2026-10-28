import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, Upload, FolderOpen, Send, Eye } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { documentsApi, type ChecklistItemOut } from '@/services/documents.service'
import { processesApi, type ProcessOut, type ProcessHistoryOut } from '@/services/processes.service'
import { workflowApi, type AllowedTransitionOut } from '@/services/workflow.service'
import { formatRelativeDate } from '@/utils/format'
import { DocumentViewerModal, type ViewerDocument } from '@/components/documentos/DocumentViewerModal'

const CHECKLIST_COLORS: Record<string, string> = {
  aprobado: 'var(--color-teal)',
  pendiente: 'var(--color-primary)',
  rechazado: '#ef4444',
  faltante: 'var(--color-text-dim)',
}

export function TrazabilidadSection() {
  const { processId } = useParams<{ processId: string }>()
  const accessToken = useAppStore((s) => s.accessToken)
  const currentUser = useAppStore((s) => s.currentUser)

  const [process, setProcess] = useState<ProcessOut | null>(null)
  const [history, setHistory] = useState<ProcessHistoryOut[]>([])
  const [checklist, setChecklist] = useState<ChecklistItemOut[]>([])
  const [transitions, setTransitions] = useState<AllowedTransitionOut[]>([])
  const [tab, setTab] = useState<'docs' | 'audit'>('docs')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isChangingState, setIsChangingState] = useState(false)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [activeViewerDoc, setActiveViewerDoc] = useState<ViewerDocument | null>(null)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = () => {
    if (!accessToken || !processId) return
    setIsLoading(true)
    setError(null)
    Promise.all([
      processesApi.get(accessToken, processId),
      processesApi.history(accessToken, processId),
      documentsApi.checklist(accessToken, processId),
    ])
      .then(([proc, hist, check]) => {
        setProcess(proc)
        setHistory(hist)
        setChecklist(check)
        return workflowApi.transitions(accessToken, proc.modality.public_id)
      })
      .then(setTransitions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el trámite'))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [accessToken, processId])

  const availableTransitions = process
    ? transitions.filter(
        (t) => t.source_state.public_id === process.state.public_id && t.authorized_role.name === currentUser?.role
      )
    : []

  const handleChangeState = async (targetStatePublicId: string) => {
    if (!accessToken || !processId) return
    setIsChangingState(true)
    setActionError(null)
    try {
      await processesApi.changeState(accessToken, processId, targetStatePublicId)
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado')
    } finally {
      setIsChangingState(false)
    }
  }

  const handleUpload = async (documentTypePublicId: string, file: File) => {
    if (!accessToken || !processId) return
    setUploadingType(documentTypePublicId)
    setActionError(null)
    try {
      await documentsApi.upload(accessToken, processId, documentTypePublicId, file)
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo cargar el documento')
    } finally {
      setUploadingType(null)
    }
  }

  if (!processId) {
    return (
      <div className="max-w-4xl">
        <p className="text-sm text-[var(--color-text-dim)]">
          Selecciona un trámite desde <Link to="/tramites" className="text-[var(--color-primary)] font-semibold hover:underline">la lista de trámites</Link> para ver su trazabilidad.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-dim)]">Cargando trámite…</p>
  }

  if (error || !process) {
    return (
      <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 max-w-4xl">
        {error ?? 'Trámite no encontrado'}
      </p>
    )
  }

  return (
    <div className="max-w-4xl space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="section-title">{process.student.full_name} — {process.modality.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="font-mono font-bold text-xs text-[var(--color-teal)]">{process.process_code}</span>
            <span className="text-zinc-300">·</span>
            <span className="text-xs text-zinc-500">{process.academic_semester}</span>
            <StatusBadge status={process.state.code} />
          </div>
        </div>
        {availableTransitions.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {availableTransitions.map((t) => (
              <button
                key={t.public_id}
                onClick={() => handleChangeState(t.target_state.public_id)}
                disabled={isChangingState}
                className="btn-primary gap-2.5 font-bold text-sm px-4 py-2.5 disabled:opacity-50"
              >
                <Send size={16} />
                {t.target_state.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {actionError && (
        <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {actionError}
        </p>
      )}

      {process.state.description && (
        <div className="card p-4">
          <p className="text-xs text-[var(--color-text-dim)]">{process.state.description}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {([
          ['docs', `Documentos (${checklist.length})`],
          ['audit', `Trazabilidad (${history.length})`],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: tab === k ? 'var(--color-primary)' : 'transparent',
              color: tab === k ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: 'transparent',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Documents tab */}
      {tab === 'docs' && (
        <div className="space-y-3 animate-fadeIn">
          {checklist.length === 0 && (
            <p className="text-[12.5px] text-[var(--color-text-dim)]">
              Esta modalidad no tiene documentos requeridos configurados.
            </p>
          )}

          {checklist.map((item) => (
            <div
              key={item.document_type.public_id}
              className="card flex items-center gap-3 px-4 py-3.5"
              style={{ borderLeft: `3px solid ${CHECKLIST_COLORS[item.checklist_status]}` }}
            >
              <FolderOpen size={15} className="text-zinc-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                  {item.document_type.name}
                  {item.mandatory && <span className="ml-2 text-[9px] font-bold uppercase text-[var(--color-primary)]">Obligatorio</span>}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {item.document
                    ? `${item.document.file_name} · v${item.document.version} · ${formatRelativeDate(item.document.uploaded_at)}`
                    : 'Sin cargar'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.document && (
                  <button
                    onClick={() => {
                      if (!item.document) return
                      setActiveViewerDoc({
                        public_id: item.document.public_id,
                        file_name: item.document.file_name,
                        download_url: item.document.download_url,
                        studentName: process.student.full_name,
                        documentType: item.document_type.name,
                        version: item.document.version,
                        status: item.document.status,
                      })
                      setIsViewerOpen(true)
                    }}
                    className="p-1.5 rounded-lg transition-colors text-[var(--color-text-dim)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)]"
                    title="Ver documento en línea"
                  >
                    <Eye size={16} />
                  </button>
                )}
                {item.checklist_status === 'aprobado' && <CheckCircle2 size={18} style={{ color: CHECKLIST_COLORS.aprobado }} />}
                {item.checklist_status === 'rechazado' && <XCircle size={18} style={{ color: CHECKLIST_COLORS.rechazado }} />}
                {item.checklist_status === 'pendiente' && <Clock size={18} style={{ color: CHECKLIST_COLORS.pendiente }} />}
                <input
                  ref={(el) => { fileInputs.current[item.document_type.public_id] = el }}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(item.document_type.public_id, file)
                    e.target.value = ''
                  }}
                />
                <button
                  onClick={() => fileInputs.current[item.document_type.public_id]?.click()}
                  disabled={uploadingType === item.document_type.public_id}
                  className="p-1.5 rounded-lg transition-colors text-[var(--color-text-dim)] hover:text-[var(--color-primary)] disabled:opacity-50"
                  title={item.document ? 'Cargar nueva versión' : 'Cargar documento'}
                >
                  <Upload size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit tab */}
      {tab === 'audit' && (
        <div className="card overflow-hidden animate-fadeIn">
          {history.length === 0 ? (
            <p className="px-5 py-4 text-[12.5px] text-[var(--color-text-dim)]">Sin movimientos registrados todavía.</p>
          ) : (
            history.map((entry, i) => (
              <div
                key={entry.public_id}
                className="flex gap-3.5 px-5 py-4"
                style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}
              >
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ background: 'var(--color-primary)' }} />
                  {i < history.length - 1 && <div className="w-px flex-1 bg-[var(--color-border)] mt-1.5" />}
                </div>
                <div className="pb-2 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {entry.previous_state ? `${entry.previous_state.name} → ${entry.new_state.name}` : entry.new_state.name}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {entry.user.full_name} · {formatRelativeDate(entry.event_date)}
                    {entry.comment && ` · ${entry.comment}`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Visor Modal */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        document={activeViewerDoc}
      />
    </div>
  )
}