import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/** Zoom relativo al ancho disponible: 100 % = la página ocupa todo el ancho del visor. */
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
const GAP = 12

function useObjectUrl(blob: Blob): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

/** Una página: reserva su alto real y la dibuja en un canvas solo cuando se acerca a la zona visible. */
function PdfPage({ pdf, pageNumber, width, root }: { pdf: PDFDocumentProxy; pageNumber: number; width: number; root: HTMLElement | null }) {
  const holder = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [visible, setVisible] = useState(pageNumber <= 2)

  useEffect(() => {
    let live = true
    void pdf.getPage(pageNumber).then((page) => {
      if (!live) return
      const base = page.getViewport({ scale: 1 })
      setSize({ w: width, h: (base.height / base.width) * width })
    })
    return () => { live = false }
  }, [pdf, pageNumber, width])

  useEffect(() => {
    const node = holder.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true) }, { root, rootMargin: '600px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [root])

  useEffect(() => {
    if (!visible || !size || !canvas.current) return
    let live = true
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    void pdf.getPage(pageNumber).then((page) => {
      if (!live || !canvas.current) return
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: (size.w / page.getViewport({ scale: 1 }).width) * ratio })
      const el = canvas.current
      el.width = Math.floor(viewport.width)
      el.height = Math.floor(viewport.height)
      el.style.width = `${size.w}px`
      el.style.height = `${size.h}px`
      const context = el.getContext('2d')
      if (!context) return
      task = page.render({ canvasContext: context, viewport })
      task.promise.catch(() => undefined) // una página cancelada al cambiar el zoom no es un error
    })
    return () => { live = false; task?.cancel() }
  }, [pdf, pageNumber, size, visible])

  return (
    <div ref={holder} data-page={pageNumber} className="mx-auto bg-white shadow-md" style={{ width: size?.w ?? width, height: size?.h ?? width * 1.294 }}>
      <canvas ref={canvas} aria-label={`Página ${pageNumber}`} className="block" />
    </div>
  )
}

/**
 * Visor PDF integrado (pdf.js): dibuja las páginas del archivo real, la primera completa y ajustada al ancho disponible, con
 * navegación por páginas y zoom. Un solo desplazamiento (el de este contenedor): no hay barra de impresión del navegador.
 * Si el archivo no se puede leer con pdf.js, cae al visor nativo del navegador sin barras.
 */
export function PdfPagesViewer({ blob, fileName }: { blob: Blob; fileName: string }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [page, setPage] = useState(1)
  const [zoomIndex, setZoomIndex] = useState(2)
  const [width, setWidth] = useState(0)
  const fallbackUrl = useObjectUrl(blob)

  useEffect(() => {
    let cancelled = false
    let doc: PDFDocumentProxy | null = null
    setStatus('loading')
    setPdf(null)
    setPage(1)
    void (async () => {
      try {
        const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
        lib.GlobalWorkerOptions.workerSrc = worker.default
        doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
        if (cancelled) return void doc.destroy()
        setPdf(doc)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('fallback')
      }
    })()
    return () => { cancelled = true; void doc?.destroy() }
  }, [blob])

  // Ancho disponible: la página se ajusta a él (menos el margen) y se recalcula si cambia el tamaño del contenedor.
  useEffect(() => {
    const node = scroller.current
    if (!node) return
    const measure = () => setWidth(Math.max(200, node.clientWidth - GAP * 2))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [status])

  const zoom = ZOOMS[zoomIndex]
  const pages = pdf?.numPages ?? 0

  const goTo = useCallback((n: number) => {
    const target = Math.min(Math.max(1, n), Math.max(1, pages))
    setPage(target)
    scroller.current?.querySelector(`[data-page="${target}"]`)?.scrollIntoView?.({ block: 'start' })
  }, [pages])

  // La página actual sigue al desplazamiento: la primera cuyo borde inferior todavía está a la vista.
  const onScroll = () => {
    const node = scroller.current
    if (!node || pages === 0) return
    const top = node.scrollTop + 8
    const children = Array.from(node.querySelectorAll<HTMLElement>('[data-page]'))
    const current = children.find((el) => el.offsetTop + el.offsetHeight > top)
    if (current) setPage(Number(current.dataset.page))
  }

  if (status === 'fallback' && fallbackUrl) {
    return <iframe src={`${fallbackUrl}#toolbar=0&navpanes=0&view=FitH`} title={`Vista previa de ${fileName}`} className="h-full w-full border-0 bg-zinc-100" />
  }

  const btn = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-black/5 hover:text-[var(--color-text)] disabled:opacity-40 dark:hover:bg-white/10'
  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100 dark:bg-zinc-900" aria-label={`Vista previa de ${fileName}`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-[var(--color-surface)] px-2 py-1 text-[12px] dark:border-white/10">
        <div className="flex items-center gap-1">
          <button type="button" className={btn} aria-label="Página anterior" disabled={page <= 1} onClick={() => goTo(page - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
          <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <input
              type="number"
              aria-label="Ir a la página"
              min={1}
              max={Math.max(1, pages)}
              value={page}
              disabled={pages === 0}
              onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 1) goTo(n) }}
              className="h-7 w-12 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1 text-center text-[12px] text-[var(--color-text)]"
            />
            <span aria-live="polite">/ {pages || '…'}</span>
          </div>
          <button type="button" className={btn} aria-label="Página siguiente" disabled={pages === 0 || page >= pages} onClick={() => goTo(page + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={btn} aria-label="Reducir zoom" disabled={zoomIndex === 0} onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}><Minus size={15} aria-hidden="true" /></button>
          <span className="w-12 text-center font-bold text-[var(--color-text)]">{Math.round(zoom * 100)} %</span>
          <button type="button" className={btn} aria-label="Aumentar zoom" disabled={zoomIndex === ZOOMS.length - 1} onClick={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}><Plus size={15} aria-hidden="true" /></button>
          <button type="button" className={btn} aria-label="Ajustar al ancho" onClick={() => setZoomIndex(2)}><RotateCcw size={14} aria-hidden="true" /></button>
        </div>
      </div>
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto px-3 py-3" style={{ scrollBehavior: 'smooth' }}>
        {status === 'loading' || !pdf ? (
          <p role="status" className="py-10 text-center text-[13px] font-semibold text-[var(--color-text-muted)]">Cargando documento…</p>
        ) : (
          <div className="flex flex-col" style={{ gap: GAP, width: Math.max(width * zoom, width) }}>
            {Array.from({ length: pdf.numPages }, (_, i) => <PdfPage key={`${i + 1}-${zoom}`} pdf={pdf} pageNumber={i + 1} width={width * zoom} root={scroller.current} />)}
          </div>
        )}
      </div>
    </div>
  )
}
