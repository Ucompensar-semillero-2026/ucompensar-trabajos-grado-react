import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Maximize2, Minimize2, FileText, FileSpreadsheet, Image as ImageIcon, File as FileGeneric, Check } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { VisorDocumento } from './VisorDocumento'
import { viewerKindFor } from './visorDocumento.utils'

export interface ViewerDocument {
  public_id?: string
  file_name: string
  /** Ruta de la API que entrega el archivo (ver filePaths en files.service). */
  file_path: string
  studentName?: string
  documentType?: string
  version?: number
  status?: 'pendiente' | 'aprobado' | 'rechazado'
}

interface DocumentViewerModalProps {
  isOpen: boolean
  onClose: () => void
  document: ViewerDocument | null
  canReview?: boolean
  onApprove?: (doc: ViewerDocument) => Promise<void> | void
  onReject?: (doc: ViewerDocument, comment: string) => Promise<void> | void
  isReviewing?: boolean
}

const STATUS_BADGE: Record<'aprobado' | 'pendiente' | 'rechazado', { label: string; variant: 'green' | 'orange' | 'red' }> = {
  aprobado: { label: 'Aprobado', variant: 'green' },
  pendiente: { label: 'Pendiente', variant: 'orange' },
  rechazado: { label: 'Rechazado', variant: 'red' },
}

function FileIcon({ fileName }: { fileName: string }) {
  switch (viewerKindFor(fileName)) {
    case 'pdf':
      return <FileText className="text-red-500" size={20} aria-hidden="true" />
    case 'docx':
      return <FileText className="text-blue-600" size={20} aria-hidden="true" />
    case 'xlsx':
      return <FileSpreadsheet className="text-emerald-600" size={20} aria-hidden="true" />
    case 'image':
      return <ImageIcon className="text-purple-500" size={20} aria-hidden="true" />
    default:
      return <FileGeneric className="text-zinc-500" size={20} aria-hidden="true" />
  }
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  document: doc,
  canReview = false,
  onApprove,
  onReject,
  isReviewing = false,
}: DocumentViewerModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectComment, setRejectComment] = useState('')

  // Reset states on document change or open
  useEffect(() => {
    if (isOpen) {
      setIsRejecting(false)
      setRejectComment('')
    }
  }, [isOpen, doc?.file_path])

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return
    // En fase de captura y sin propagar Escape/Tab: el visor puede abrirse encima de otra ventana (p. ej. la de
    // entrega de "Mis tareas"), que también escucha el teclado; Escape debe cerrar solo el visor.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (isRejecting) {
          setIsRejecting(false)
        } else {
          onClose()
        }
      } else if (e.key === 'Tab') {
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, isRejecting, onClose])

  // Mientras el visor está abierto, la página de atrás no se desplaza.
  useEffect(() => {
    if (!isOpen) return
    const previous = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    return () => {
      window.document.body.style.overflow = previous
    }
  }, [isOpen])

  if (!isOpen || !doc) return null

  // Portal al <body>: si el visor se dibujara dentro de la página, un contenedor con animación (transform) lo
  // desplazaría y no quedaría centrado en la pantalla ni cubriría el menú. z-[110]: por encima de la ventana de
  // entrega de "Mis tareas" (z-[100]), desde la que también se abre.
  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#031C34]/70 p-2 backdrop-blur-[3px] sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Documento ${doc.file_name}`}
        className={`flex flex-col overflow-hidden bg-[var(--color-surface)] shadow-2xl ring-1 ring-black/10 transition-[width,height] duration-200 ${
          isFullscreen ? 'h-full w-full rounded-none' : 'h-[min(92vh,1000px)] w-full max-w-6xl rounded-2xl'
        }`}
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
              <FileIcon fileName={doc.file_name} />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="max-w-[60vw] truncate font-display text-[15px] font-bold text-[var(--color-secondary)] sm:max-w-md" title={doc.file_name}>
                  {doc.file_name}
                </h2>
                {doc.status && <Badge variant={STATUS_BADGE[doc.status].variant}>{STATUS_BADGE[doc.status].label}</Badge>}
                {doc.version && (
                  <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--color-text-dim)]">
                    v{doc.version}
                  </span>
                )}
              </div>
              {(doc.studentName || doc.documentType) && (
                <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
                  {doc.studentName && <span>Estudiante: <strong className="font-semibold text-[var(--color-text)]">{doc.studentName}</strong></span>}
                  {doc.studentName && doc.documentType && <span> · </span>}
                  {doc.documentType && <span>Tipo: {doc.documentType}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              onClick={() => setIsFullscreen((f) => !f)}
              className="hidden rounded-lg p-2 text-[var(--color-text-dim)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] sm:inline-flex"
            >
              {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              aria-label="Cerrar visor"
              title="Cerrar (Esc)"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--color-text-dim)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <VisorDocumento file={{ path: doc.file_path, fileName: doc.file_name }} />
        </div>

        {/* Modal Review Bottom Bar (if role can review & status is pendiente) */}
        {canReview && doc.status === 'pendiente' && (
          <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            {isRejecting ? (
              <div className="flex-1 flex items-center gap-2 animate-in">
                <span className="text-[12px] font-bold text-red-700 dark:text-red-400 flex-shrink-0">
                  Motivo de rechazo:
                </span>
                <input
                  autoFocus
                  type="text"
                  maxLength={300}
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Ej. El documento no contiene las firmas requeridas…"
                  className="flex-1 text-[12px] px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:border-red-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && onReject) {
                      onReject(doc, rejectComment)
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="font-bold bg-red-600 text-white hover:bg-red-700 flex-shrink-0"
                  disabled={isReviewing}
                  onClick={() => onReject && onReject(doc, rejectComment)}
                >
                  Confirmar Rechazo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold flex-shrink-0"
                  onClick={() => setIsRejecting(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <>
                <div className="text-[12px] text-[var(--color-text-muted)] font-medium">
                  ¿Has revisado este documento? Puedes aprobarlo o solicitar correcciones directamente.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold text-green-700 dark:text-green-400 border-green-300 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/40 flex items-center gap-1.5"
                    disabled={isReviewing}
                    onClick={() => onApprove && onApprove(doc)}
                  >
                    <Check size={14} /> Aprobar Documento
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1.5"
                    disabled={isReviewing}
                    onClick={() => setIsRejecting(true)}
                  >
                    <X size={14} /> Rechazar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    window.document.body,
  )
}