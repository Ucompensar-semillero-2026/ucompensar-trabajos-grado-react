// Visor de documentos. Primero pide .../preview-info y decide por `mode`:
//   missing -> "Archivo no disponible. Pide que se vuelva a subir."
//   embed   -> vista previa del propio proveedor (previsto, hoy no se usa)
//   inline  -> el archivo se pide al backend y se dibuja según su tipo (mime):
//   .pdf            -> visor del navegador (iframe)
//   .png .jpg .jpeg -> imagen con zoom
//   .docx           -> docx-preview
//   .xlsx           -> SheetJS: pestañas por hoja y tabla de React
//   cualquier otro  -> "Este formato no tiene vista previa" + Descargar
// El archivo se pide como blob al backend, con la sesión (files.service); nunca
// por URL firmada. docx-preview y SheetJS se cargan con import() dinámico, así
// solo se descargan cuando alguien abre un Word o un Excel.
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Download, FileQuestion, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import {
  MISSING_FILE_MESSAGE,
  PREVIEW_MAX_BYTES,
  apiPath,
  downloadFile,
  fetchFile,
  fetchPreviewInfo,
  fileErrorMessage,
  formatBytes,
  saveBlob,
  type FileRef,
} from '@/services/files.service'
import { MAX_SHEET_COLUMNS, MAX_SHEET_ROWS, readWorkbook, rowsLimitNotice, viewerKindForMime, type SheetData, type ViewerKind } from './visorDocumento.utils'

function useObjectUrl(blob: Blob): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">{children}</div>
}

function Spinner({ label }: { label: string }) {
  return (
    <Centered>
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--color-primary)] border-t-transparent" aria-hidden="true" />
      <p role="status" className="text-[13px] font-semibold text-[var(--color-text-muted)]">{label}</p>
    </Centered>
  )
}

function Notice({ icon, title, text }: { icon: 'alert' | 'file'; title: string; text?: string }) {
  const Icon = icon === 'alert' ? AlertCircle : FileQuestion
  return (
    <Centered>
      <Icon size={40} className={icon === 'alert' ? 'text-amber-500' : 'text-[var(--color-text-dim)]'} aria-hidden="true" />
      <p role={icon === 'alert' ? 'alert' : undefined} className="text-[15px] font-bold text-[var(--color-text)]">{title}</p>
      {text && <p className="max-w-md text-[13px] text-[var(--color-text-muted)]">{text}</p>}
    </Centered>
  )
}

// ── Visores por formato ──────────────────────────────────────────────────────

function PdfViewer({ blob, fileName }: { blob: Blob; fileName: string }) {
  const url = useObjectUrl(blob)
  if (!url) return null
  return <iframe src={`${url}#toolbar=1&navpanes=1&view=FitH`} title={`Vista previa de ${fileName}`} className="h-full w-full border-0 bg-zinc-900" />
}

function ImageViewer({ blob, fileName }: { blob: Blob; fileName: string }) {
  const url = useObjectUrl(blob)
  const [zoom, setZoom] = useState(1)
  if (!url) return null
  const zoomButton = 'p-1 hover:text-[var(--color-primary)] transition-colors'
  return (
    <div className="relative flex h-full items-center justify-center overflow-auto bg-zinc-950/90 p-4">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-2.5 py-1.5 text-white">
        <button type="button" className={zoomButton} aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}><ZoomIn size={16} aria-hidden="true" /></button>
        <span className="px-1 font-mono text-[11px] font-bold">{Math.round(zoom * 100)}%</span>
        <button type="button" className={zoomButton} aria-label="Reducir zoom" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}><ZoomOut size={16} aria-hidden="true" /></button>
        <button type="button" className={zoomButton} aria-label="Restablecer tamaño" onClick={() => setZoom(1)}><RotateCcw size={15} aria-hidden="true" /></button>
      </div>
      <img src={url} alt={fileName} style={{ transform: `scale(${zoom})` }} className="max-h-[85vh] max-w-full select-none rounded-md object-contain shadow-2xl transition-transform" />
    </div>
  )
}

/** Solo enlaces web, de correo o internos: un .docx puede traer `javascript:` en un hipervínculo. */
function neutralizeLinks(container: HTMLElement) {
  container.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? ''
    if (!/^(https?:|mailto:|#)/i.test(href.trim())) a.removeAttribute('href')
    else if (!href.startsWith('#')) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

/**
 * Un .docx sin tamaño de página ni márgenes (p. ej. generado por otra herramienta) se vería como una franja angosta
 * pegada al texto. Se le da la medida de una hoja carta (816 px a 96 ppp) y márgenes de 2,5 cm; si el documento trae
 * los suyos, se respetan.
 */
function paperize(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('section.docx').forEach((page) => {
    if (!page.style.width) page.style.width = 'min(100%, 816px)'
    if (!page.style.minHeight) page.style.minHeight = 'min(1056px, 75vh)'
    if (!page.style.paddingLeft) page.style.padding = '72px 80px'
  })
}

function DocxViewer({ blob }: { blob: Blob }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    import('docx-preview')
      .then(async ({ renderAsync }) => {
        const container = containerRef.current
        if (cancelled || !container) return
        container.replaceChildren()
        await renderAsync(blob, container, undefined, {
          inWrapper: true,
          breakPages: true,
          useBase64URL: true,
        })
        if (cancelled) return
        neutralizeLinks(container)
        paperize(container)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [blob])

  return (
    <div className="relative h-full w-full overflow-auto bg-slate-100 dark:bg-slate-900">
      {state === 'loading' && <div className="absolute inset-0"><Spinner label="Preparando la vista previa del documento Word…" /></div>}
      {state === 'error' && <div className="absolute inset-0 bg-[var(--color-surface)]"><Notice icon="alert" title="No se pudo mostrar la vista previa de este documento Word" text="Puedes descargarlo para abrirlo en tu equipo." /></div>}
      <div
        ref={containerRef}
        data-testid="docx-container"
        className="min-h-full text-zinc-900 [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!px-3 [&_.docx-wrapper]:!py-6 sm:[&_.docx-wrapper]:!px-8 sm:[&_.docx-wrapper]:!py-8 [&_.docx-wrapper>section.docx]:!mb-6 [&_.docx-wrapper>section.docx]:max-w-full [&_.docx-wrapper>section.docx]:rounded-[3px] [&_.docx-wrapper>section.docx]:!shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_32px_rgba(15,23,42,0.12)]"
      />
    </div>
  )
}

function XlsxViewer({ blob, maxRows }: { blob: Blob; maxRows: number }) {
  const [sheets, setSheets] = useState<SheetData[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    let cancelled = false
    setSheets(null)
    setFailed(false)
    setActive(0)
    readWorkbook(blob, maxRows)
      .then((result) => !cancelled && setSheets(result))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [blob, maxRows])

  if (failed) return <Notice icon="alert" title="No se pudo mostrar la vista previa de esta hoja de cálculo" text="Puedes descargarla para abrirla en tu equipo." />
  if (!sheets) return <Spinner label="Preparando la vista previa de la hoja de cálculo…" />
  if (sheets.length === 0) return <Notice icon="file" title="El archivo no tiene hojas" />

  const sheet = sheets[Math.min(active, sheets.length - 1)]
  return (
    <div className="flex h-full flex-col bg-[var(--color-surface)]">
      <div role="tablist" aria-label="Hojas del archivo" className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-[var(--color-border)] px-3 pt-2">
        {sheets.map((s, index) => (
          <button
            key={s.name}
            type="button"
            role="tab"
            id={`hoja-${index}`}
            aria-selected={index === active}
            aria-controls="hoja-activa"
            onClick={() => setActive(index)}
            className={`whitespace-nowrap rounded-t-lg border-b-2 px-3 py-1.5 text-[12.5px] font-semibold ${index === active ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      {(sheet.truncatedRows || sheet.truncatedColumns) && (
        <p role="status" className="flex-shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12.5px] font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          {sheet.truncatedRows && rowsLimitNotice(maxRows)}
          {sheet.truncatedRows && sheet.truncatedColumns && ' '}
          {sheet.truncatedColumns && `Se muestran las primeras ${MAX_SHEET_COLUMNS} columnas.`}
        </p>
      )}
      <div id="hoja-activa" role="tabpanel" aria-labelledby={`hoja-${active}`} className="min-h-0 flex-1 overflow-auto">
        {sheet.header.length === 0 ? (
          <Notice icon="file" title="Esta hoja está vacía" />
        ) : (
          <table className="min-w-full border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr>
                {sheet.header.map((cell, c) => (
                  <th key={c} scope="col" className="sticky top-0 z-10 whitespace-nowrap border-b border-r border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-left font-bold text-[var(--color-text)]">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r} className="odd:bg-[var(--color-surface)] even:bg-[var(--color-bg)]/40">
                  {row.map((cell, c) => (
                    <td key={c} className="whitespace-pre-wrap border-b border-r border-[var(--color-border)] px-3 py-1.5 align-top text-[var(--color-text)]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const KIND_LABEL: Record<ViewerKind, string> = {
  pdf: 'Documento PDF',
  image: 'Imagen',
  docx: 'Documento Word',
  xlsx: 'Hoja de cálculo Excel',
  none: 'Archivo',
}

// ── Componente principal ─────────────────────────────────────────────────────

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; kind: Exclude<ViewerKind, 'none'>; blob: Blob }
  | { status: 'embed'; url: string }
  | { status: 'too-large'; size: number }
  | { status: 'missing'; message: string }
  | { status: 'error'; message: string }
  | { status: 'unsupported' }

/** `maxSheetRows` solo existe para las pruebas (dibujar 1.000 filas en jsdom es lento). */
export function VisorDocumento({ file, maxSheetRows = MAX_SHEET_ROWS }: { file: FileRef; maxSheetRows?: number }) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // La ruta del archivo la confirma preview-info (file_url); hasta entonces, la de FileRef.
  const [downloadPath, setDownloadPath] = useState(file.path)
  const [meta, setMeta] = useState<{ mime: string; size: number | null } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    setDownloadError(null)
    setDownloadPath(file.path)
    setMeta(null)
    if (!accessToken) {
      setState({ status: 'error', message: 'Tu sesión terminó. Vuelve a iniciar sesión.' })
      return
    }
    const controller = new AbortController()
    const { signal } = controller
    setState({ status: 'loading' })

    const load = async (): Promise<LoadState> => {
      // 1) El backend dice cómo mostrarlo (misma regla de permisos que el archivo).
      const info = await fetchPreviewInfo(accessToken, file, signal)
      const path = apiPath(info.file_url)
      setDownloadPath(path)
      setMeta({ mime: info.mime, size: info.size })
      if (info.mode === 'missing') return { status: 'missing', message: info.message ?? MISSING_FILE_MESSAGE }
      if (info.mode === 'embed' && info.embed_url) return { status: 'embed', url: info.embed_url }
      // 2) inline: el visor sale del tipo que informa el backend, no de la extensión.
      const kind = viewerKindForMime(info.mime)
      if (kind === 'none') return { status: 'unsupported' }
      if (info.size != null && info.size > PREVIEW_MAX_BYTES) return { status: 'too-large', size: info.size }
      const loaded = await fetchFile(accessToken, path, PREVIEW_MAX_BYTES, signal)
      return loaded.kind === 'ok' ? { status: 'ready', kind, blob: loaded.blob } : { status: 'too-large', size: loaded.size }
    }

    load()
      .then((next) => !signal.aborted && setState(next))
      .catch((error: unknown) => {
        if (!signal.aborted) setState({ status: 'error', message: fileErrorMessage(error) })
      })
    return () => controller.abort()
    // accessToken fuera a propósito: renovarlo no debe volver a descargar el archivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path])

  const handleDownload = async () => {
    setDownloadError(null)
    if (state.status === 'ready') {
      saveBlob(state.blob, file.fileName)
      return
    }
    if (!accessToken) return
    setDownloading(true)
    try {
      await downloadFile(accessToken, { path: downloadPath, fileName: file.fileName })
    } catch (error) {
      setDownloadError(fileErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  const body = () => {
    switch (state.status) {
      case 'loading':
        return <Spinner label="Cargando el documento…" />
      case 'error':
        return <Notice icon="alert" title={state.message} />
      case 'missing':
        return <Notice icon="file" title={state.message} text="El archivo ya no está guardado en la plataforma. Quien lo subió debe cargarlo de nuevo." />
      case 'unsupported':
        return <Notice icon="file" title="Este formato no tiene vista previa" text="Descarga el archivo para abrirlo en tu equipo." />
      case 'too-large':
        return <Notice icon="file" title="El archivo es muy grande para la vista previa" text={`Pesa ${formatBytes(state.size)}; la vista previa admite hasta ${formatBytes(PREVIEW_MAX_BYTES)}. Descárgalo para verlo.`} />
      case 'embed':
        // Previsto para un proveedor con vista previa propia (p. ej. Office en SharePoint).
        return <iframe src={state.url} title={`Vista previa de ${file.fileName}`} className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="no-referrer" />
      case 'ready':
        if (state.kind === 'pdf') return <PdfViewer blob={state.blob} fileName={file.fileName} />
        if (state.kind === 'image') return <ImageViewer blob={state.blob} fileName={file.fileName} />
        if (state.kind === 'docx') return <DocxViewer blob={state.blob} />
        return <XlsxViewer blob={state.blob} maxRows={maxSheetRows} />
    }
  }

  const missing = state.status === 'missing'
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
        <p className="min-w-0 truncate text-[12.5px] font-medium text-[var(--color-text-muted)]">
          {meta ? [KIND_LABEL[viewerKindForMime(meta.mime)], meta.size != null ? formatBytes(meta.size) : null].filter(Boolean).join(' · ') : 'Cargando…'}
        </p>
        <div className="flex items-center gap-2">
          {downloadError && <span role="alert" className="text-[12px] font-medium text-red-700">{downloadError}</span>}
          {/* Siempre hay Descargar; si el archivo falta, queda deshabilitado (no hay qué bajar). */}
          <Button
            type="button"
            size="sm"
            disabled={downloading || missing}
            title={missing ? MISSING_FILE_MESSAGE : undefined}
            onClick={() => void handleDownload()}
            className="gap-1.5 font-bold"
          >
            <Download size={14} aria-hidden="true" /> {downloading ? 'Descargando…' : 'Descargar'}
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">{body()}</div>
    </div>
  )
}
