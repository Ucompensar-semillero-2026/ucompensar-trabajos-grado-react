import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { lockScroll } from '@/utils/scrollLock'

interface ModalDialogProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Acciones fijas al pie (fuera del área desplazable). */
  footer?: React.ReactNode
  wide?: boolean
}

/**
 * Diálogo modal reutilizable. Se monta en `document.body` (un ancestro con transform/overflow no puede recortarlo),
 * bloquea el scroll del fondo, mantiene el foco dentro y cierra con Esc. Estructura: encabezado fijo, contenido con
 * desplazamiento propio (`min-h-0`) y acciones fijas.
 */
export function ModalDialog({ title, onClose, children, footer, wide }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const unlockScroll = lockScroll()
    dialogRef.current?.focus({ preventScroll: true })
    return () => {
      unlockScroll()
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'),
      ).filter((el) => el.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061F2D]/70 p-2 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={`flex max-h-[96dvh] min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl outline-none sm:max-h-[90dvh] ${wide ? 'sm:w-[min(1100px,96vw)]' : 'sm:w-[min(36rem,96vw)]'}`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <h2 className="font-display text-[18px] font-bold text-[var(--color-secondary)]">{title}</h2>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </header>
        <div data-testid="modal-body" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
