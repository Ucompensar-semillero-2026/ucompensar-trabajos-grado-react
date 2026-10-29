import { Fragment, useEffect, useState, useMemo } from 'react'
import { Card, Button, Badge, EmptyState, SearchField } from '@/components/ui'
import { Check, X, ShieldCheck, Eye, Download, Filter, RefreshCw, FileSearch } from 'lucide-react'
import { canReviewDocuments } from '@/config/access'
import { useAppStore } from '@/stores/app.store'
import { ApiError, resolveFileUrl } from '@/services/http'
import { documentsApi, type ProcessDocumentOut } from '@/services/documents.service'
import { processesApi } from '@/services/processes.service'
import { formatRelativeDate } from '@/utils/format'
import { DocumentViewerModal, type ViewerDocument } from './DocumentViewerModal'

interface Row extends ProcessDocumentOut {
  studentName: string
}

const STATUS_BADGE: Record<ProcessDocumentOut['status'], { label: string; variant: 'green' | 'orange' | 'red' }> = {
  aprobado: { label: 'Aprobado', variant: 'green' },
  pendiente: { label: 'Pendiente', variant: 'orange' },
  rechazado: { label: 'Rechazado', variant: 'red' },
}

export function DocumentosSection() {
  const accessToken = useAppStore((s) => s.accessToken)
  const currentUser = useAppStore((s) => s.currentUser)
  const canReview = currentUser ? canReviewDocuments(currentUser.role) : false

  const [rows, setRows] = useState<Row[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & search
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | ProcessDocumentOut['status']>('todos')
  const [typeFilter, setTypeFilter] = useState<string>('todos')

  // Document Viewer Modal state
  const [activeViewerDoc, setActiveViewerDoc] = useState<ViewerDocument | null>(null)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  // Fila en la que se está confirmando un rechazo (con su comentario)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const loadDocuments = () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    processesApi
      .list(accessToken)
      .then(async (processes) => {
        const perProcess = await Promise.all(
          processes.map((p) =>
            documentsApi
              .listForProcess(accessToken, p.public_id)
              .then((docs) => docs.map((d) => ({ ...d, studentName: p.student.full_name })))
          )
        )
        setRows(perProcess.flat().sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los documentos'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadDocuments()
  }, [accessToken])

  // Unique document types for filter
  const documentTypes = useMemo(() => {
    const types = new Set(rows.map((r) => r.document_type.name))
    return Array.from(types)
  }, [rows])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        r.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.document_type.name.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'todos' || r.status === statusFilter
      const matchesType = typeFilter === 'todos' || r.document_type.name === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  }, [rows, searchTerm, statusFilter, typeFilter])

  const openViewer = (doc: Row) => {
    setActiveViewerDoc({
      public_id: doc.public_id,
      file_name: doc.file_name,
      download_url: doc.download_url,
      studentName: doc.studentName,
      documentType: doc.document_type.name,
      version: doc.version,
      status: doc.status,
    })
    setIsViewerOpen(true)
  }

  async function handleApprove(doc: { public_id?: string }) {
    if (!accessToken || !doc.public_id) return
    setReviewError(null)
    setReviewingId(doc.public_id)
    try {
      const updated = await documentsApi.review(accessToken, doc.public_id, 'aprobado')
      setRows((prev) => prev.map((r) => (r.public_id === doc.public_id ? { ...r, ...updated } : r)))
      if (activeViewerDoc?.public_id === doc.public_id) {
        setActiveViewerDoc((prev) => (prev ? { ...prev, status: 'aprobado' } : null))
      }
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : 'No se pudo aprobar el documento')
    } finally {
      setReviewingId(null)
    }
  }

  async function handleReject(doc: { public_id?: string }, customComment?: string) {
    if (!accessToken || !doc.public_id) return
    const commentToSend = customComment ?? rejectComment
    setReviewError(null)
    setReviewingId(doc.public_id)
    try {
      const updated = await documentsApi.review(
        accessToken,
        doc.public_id,
        'rechazado',
        commentToSend.trim() || undefined
      )
      setRows((prev) => prev.map((r) => (r.public_id === doc.public_id ? { ...r, ...updated } : r)))
      setRejectingId(null)
      setRejectComment('')
      if (activeViewerDoc?.public_id === doc.public_id) {
        setActiveViewerDoc((prev) => (prev ? { ...prev, status: 'rechazado' } : null))
      }
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : 'No se pudo rechazar el documento')
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="animate-in">
      <Card className="p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-bg)]/30 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold text-[var(--color-text)] tracking-tight">Repositorio de Documentos</h2>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
              Visualiza, revisa y gestiona los documentos académicos cargados en los trámites
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDocuments}
            disabled={isLoading}
            className="font-bold flex items-center gap-1.5"
            title="Recargar lista"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Actualizar
          </Button>
        </div>

        {/* Security Banner */}
        <div className="mx-6 mt-5 mb-4 flex items-center gap-3 px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl">
          <ShieldCheck size={16} className="text-[var(--color-primary)] flex-shrink-0" />
          <span className="text-[12px] text-[var(--color-text-muted)] font-medium">
            Almacenamiento seguro en Cloudflare R2 · Visualización en vivo y descargas con enlaces firmados
          </span>
        </div>

        {/* Search and Filters Bar */}
        <div className="mx-6 mb-5 flex flex-wrap items-center justify-between gap-3">
          <SearchField
            label="Buscar documentos"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por archivo, estudiante o tipo…"
            wrapperClassName="min-w-[240px] max-w-md flex-1"
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-2.5 py-1.5 text-[12px]">
              <Filter size={13} className="text-[var(--color-text-dim)]" />
              <span className="text-[var(--color-text-dim)] font-medium">Estado:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="bg-transparent text-[var(--color-text)] font-semibold outline-none cursor-pointer text-[12px]"
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="aprobado">Aprobados</option>
                <option value="rechazado">Rechazados</option>
              </select>
            </div>

            {documentTypes.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-2.5 py-1.5 text-[12px]">
                <span className="text-[var(--color-text-dim)] font-medium">Tipo:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-transparent text-[var(--color-text)] font-semibold outline-none cursor-pointer text-[12px] max-w-[150px] truncate"
                >
                  <option value="todos">Todos los tipos</option>
                  {documentTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mx-6 mb-4 text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
        {reviewError && (
          <p className="mx-6 mb-4 text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {reviewError}
          </p>
        )}

        {/* Table */}
        <div className="overflow-x-auto scrollbar-premium">
          {isLoading ? (
            <p className="px-6 py-8 text-[12.5px] text-[var(--color-text-dim)]">Cargando documentos…</p>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title={rows.length === 0 ? 'Aún no tienes documentos' : 'Sin resultados'}
              description={
                rows.length === 0
                  ? 'Cuando cargues documentos en tus trámites, podrás visualizarlos y gestionarlos desde aquí.'
                  : 'No se encontraron documentos con los filtros aplicados.'
              }
              action={
                rows.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('todos')
                      setTypeFilter('todos')
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Archivo', 'Estudiante', 'Tipo', 'Estado', 'Fecha', 'Acciones'].map((h) => (
                    <th key={h} className="th">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((doc) => (
                  <Fragment key={doc.public_id}>
                    <tr className="group hover:bg-[var(--color-bg)]/40 transition-colors">
                      <td className="td font-bold text-[var(--color-text)]">
                        <button
                          onClick={() => openViewer(doc)}
                          className="hover:text-[var(--color-primary)] transition-colors text-left flex items-center gap-1.5 group/name"
                          title="Click para previsualizar"
                        >
                          <span className="truncate max-w-xs">{doc.file_name}</span>
                          <span className="text-[10px] font-bold text-[var(--color-text-dim)] bg-[var(--color-bg)] px-1 py-0.5 rounded border border-[var(--color-border)]">
                            v{doc.version}
                          </span>
                        </button>
                      </td>
                      <td className="td text-[var(--color-text-muted)]">{doc.studentName}</td>
                      <td className="td text-[var(--color-text-muted)]">{doc.document_type.name}</td>
                      <td className="td">
                        <Badge variant={STATUS_BADGE[doc.status].variant}>{STATUS_BADGE[doc.status].label}</Badge>
                      </td>
                      <td className="td text-[var(--color-text-dim)] font-medium">
                        {formatRelativeDate(doc.uploaded_at)}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          {/* Botón Principal: Ver en Modal */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="font-bold flex items-center gap-1.5 hover:border-[var(--color-primary)]"
                            onClick={() => openViewer(doc)}
                          >
                            <Eye size={14} className="text-[var(--color-primary)]" /> Ver en línea
                          </Button>

                          <button
                            onClick={() => {
                              const a = window.document.createElement('a')
                              a.href = resolveFileUrl(doc.download_url)
                              a.download = doc.file_name
                              a.target = '_blank'
                              window.document.body.appendChild(a)
                              a.click()
                              window.document.body.removeChild(a)
                            }}
                            className="p-1.5 rounded-lg text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                            title="Descargar archivo"
                          >
                            <Download size={15} />
                          </button>

                          {canReview && doc.status === 'pendiente' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="font-bold text-green-700 dark:text-green-400 border-green-300 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/40"
                                disabled={reviewingId === doc.public_id}
                                onClick={() => handleApprove(doc)}
                              >
                                <Check size={14} /> Aprobar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="font-bold text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40"
                                disabled={reviewingId === doc.public_id}
                                onClick={() => {
                                  setRejectingId(doc.public_id)
                                  setRejectComment('')
                                  setReviewError(null)
                                }}
                              >
                                <X size={14} /> Rechazar
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {rejectingId === doc.public_id && (
                      <tr>
                        <td colSpan={6} className="td bg-red-50/50 dark:bg-red-950/20">
                          <div className="flex items-center gap-3 py-1">
                            <span className="text-[12px] font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                              Motivo del rechazo (opcional):
                            </span>
                            <input
                              autoFocus
                              type="text"
                              maxLength={300}
                              value={rejectComment}
                              onChange={(e) => setRejectComment(e.target.value)}
                              placeholder="Ej. Falta la firma del director metodológico…"
                              className="flex-1 text-[12.5px] px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-[var(--color-surface)] text-[var(--color-text)] outline-none focus:border-red-400"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleReject(doc)
                              }}
                            />
                            <Button
                              size="sm"
                              className="font-bold bg-red-600 text-white hover:bg-red-700 flex-shrink-0"
                              disabled={reviewingId === doc.public_id}
                              onClick={() => handleReject(doc)}
                            >
                              Confirmar rechazo
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="font-bold flex-shrink-0"
                              onClick={() => setRejectingId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Visor Modal Interactivo */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        document={activeViewerDoc}
        canReview={canReview}
        onApprove={(doc) => handleApprove(doc)}
        onReject={(doc, comment) => handleReject(doc, comment)}
        isReviewing={Boolean(reviewingId)}
      />
    </div>
  )
}
