import { useEffect, useState } from 'react'
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRejecting) {
          setIsRejecting(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isRejecting, onClose])

  if (!isOpen || !doc) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in p-3 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Documento ${doc.file_name}`}
        className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-full h-full max-w-none rounded-none' : 'w-full max-w-5xl h-[90vh]'
        }`}
      >
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex-shrink-0">
              <FileIcon fileName={doc.file_name} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-bold text-[var(--color-text)] truncate max-w-xs md:max-w-md">
                  {doc.file_name}
                </h2>
                {doc.status && (
                  <Badge variant={STATUS_BADGE[doc.status].variant}>
                    {STATUS_BADGE[doc.status].label}
                  </Badge>
                )}
                {doc.version && (
                  <span className="text-[11px] font-bold text-[var(--color-text-dim)] bg-[var(--color-bg)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                    v{doc.version}
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-[var(--color-text-muted)] truncate mt-0.5">
                {doc.studentName && <span>Estudiante: <strong className="text-[var(--color-text)]">{doc.studentName}</strong> · </span>}
                {doc.documentType && <span>Tipo: {doc.documentType}</span>}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              onClick={() => setIsFullscreen((f) => !f)}
              className="p-2 rounded-lg text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              aria-label="Cerrar visor"
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--color-text-dim)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Cerrar visor (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Main Viewport */}
        <div className="flex-1 overflow-hidden relative bg-[var(--color-bg)]/20"><VisorDocumento file={{ path: doc.file_path, fileName: doc.file_name }} /></div>

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
    </div>
  )
}