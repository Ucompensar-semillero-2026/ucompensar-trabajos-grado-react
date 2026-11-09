// "Ver" (abre el VisorDocumento) y "Descargar" para un archivo de la API.
// Las descargas también pasan por el backend con la sesión: ya no hay
// enlaces <a href> a URLs firmadas.
import { useState, type ReactNode } from 'react'
import { Download, Eye } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { MISSING_FILE_MESSAGE, downloadFile, fileErrorMessage, type FileRef } from '@/services/files.service'
import { DocumentViewerModal } from './DocumentViewerModal'

interface DownloadFileButtonProps {
  file: FileRef
  className?: string
  ariaLabel?: string
  children?: ReactNode
}

export function DownloadFileButton({ file, className, ariaLabel, children }: DownloadFileButtonProps) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    if (!accessToken || busy) return
    setBusy(true)
    setError(null)
    try {
      await downloadFile(accessToken, file)
    } catch (e) {
      setError(fileErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" aria-label={ariaLabel ?? `Descargar ${file.fileName}`} aria-busy={busy} disabled={busy} onClick={() => void download()} className={className}>
        {children ?? <Download size={16} aria-hidden="true" />}
      </button>
      {error && <span role="alert" className="text-[12px] font-medium text-red-700">{error}</span>}
    </>
  )
}

interface ArchivoAccionesProps {
  file: FileRef
  /** Qué es el archivo (p. ej. el entregable), para la cabecera del visor. */
  title?: string
  version?: number
  downloadLabel?: string
  linkClassName?: string
  /** Marcado como faltante en el backend: se avisa en vez de ofrecer Ver/Descargar. */
  missing?: boolean
}

const DEFAULT_LINK = 'inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0876B9] underline underline-offset-4 disabled:opacity-60'

export function ArchivoAcciones({ file, title, version, downloadLabel = 'Descargar', linkClassName = DEFAULT_LINK, missing = false }: ArchivoAccionesProps) {
  const [open, setOpen] = useState(false)
  if (missing) {
    return <span className="text-[12.5px] font-medium text-amber-700 dark:text-amber-400">{MISSING_FILE_MESSAGE}</span>
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" aria-label={`Ver ${file.fileName}`} onClick={() => setOpen(true)} className={linkClassName}>
        <Eye size={14} aria-hidden="true" /> Ver
      </button>
      <DownloadFileButton file={file} className={linkClassName} ariaLabel={`${downloadLabel}: ${file.fileName}`}>
        <Download size={14} aria-hidden="true" /> {downloadLabel}
      </DownloadFileButton>
      <DocumentViewerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        document={{ file_name: file.fileName, file_path: file.path, documentType: title, version }}
      />
    </span>
  )
}
