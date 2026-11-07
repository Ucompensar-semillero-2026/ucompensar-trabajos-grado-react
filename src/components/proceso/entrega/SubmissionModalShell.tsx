import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { lockScroll } from '@/utils/scrollLock'

interface Props {
  labelledBy: string
  onClose: () => void
  /** Mientras hay una carga o publicación en curso no se cierra con Esc ni con clic fuera. */
  locked: boolean
  header: ReactNode
  footer: ReactNode
  children: ReactNode
}

/** Ventana amplia (≈88 % del ancho, hasta 90 % del alto) sobre la app, con fondo oscurecido y desenfocado. */
export function SubmissionModalShell({ labelledBy, onClose, locked, header, footer, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const unlock = lockScroll()
    ref.current?.focus({ preventScroll: true })
    return () => { unlock(); previous?.focus({ preventScroll: true }) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ref.current) return
      // Un diálogo anidado (confirmación) gestiona sus propias teclas.
      if (ref.current.querySelector('[role="alertdialog"]')) return
      if (e.key === 'Escape') { if (!lockedRef.current) closeRef.current(); return }
      if (e.key !== 'Tab') return
      const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])')).filter((el) => el.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#031C34]/60 p-2 backdrop-blur-[3px] sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose() }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="fu-rise relative flex max-h-[96dvh] min-h-0 w-full flex-col overflow-hidden rounded-[22px] bg-[var(--color-surface)] shadow-[0_30px_80px_-20px_rgba(3,28,52,0.55)] outline-none sm:max-h-[90dvh] lg:w-[88vw] lg:max-w-[1500px]"
      >
        <header className="shrink-0 border-b border-[var(--color-border)] px-4 py-3.5 sm:px-6">{header}</header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F7F9FC] p-4 sm:p-6 dark:bg-white/[0.02]">{children}</div>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 sm:px-6">{footer}</footer>
      </div>
    </div>,
    document.body,
  )
}
