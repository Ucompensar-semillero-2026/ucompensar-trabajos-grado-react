import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
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
  /** `review`: ventana grande (92 % del ancho, hasta 1320 px), fondo desenfocado y cierre con X junto a un icono. */
  variant?: 'review'
  icon?: ReactNode
}

/**
 * Diálogo modal reutilizable. Se monta en `document.body` (un ancestro con transform/overflow no puede recortarlo),
 * bloquea el scroll del fondo, mantiene el foco dentro y cierra con Esc. Estructura: encabezado fijo, contenido con
 * desplazamiento propio (`min-h-0`) y acciones fijas.
 */
export function ModalDialog({ title, onClose, children, footer, wide, variant, icon }: ModalDialogProps) {
  const review = variant === 'review'
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
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#061F2D]/70 p-2 sm:p-4 ${review ? 'backdrop-blur-[3px]' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={`flex max-h-[96dvh] min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl outline-none ${review ? 'sm:max-h-[92dvh] sm:w-[min(92vw,1320px)]' : 'sm:max-h-[90dvh]'} ${review ? '' : wide ? 'sm:w-[min(1100px,96vw)]' : 'sm:w-[min(36rem,96vw)]'}`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {review && icon && <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF6500] dark:bg-orange-500/15">{icon}</span>}
            <h2 className={`font-display font-bold text-[var(--color-secondary)] ${review ? 'truncate text-[22px] font-extrabold' : 'text-[18px]'}`}>{title}</h2>
          </div>
          {review ? (
            <button type="button" aria-label="Cerrar" title="Cerrar (Esc)" onClick={onClose} className="rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-slate-100 hover:text-[var(--color-text)] dark:hover:bg-white/10"><X size={20} aria-hidden="true" /></button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
          )}
        </header>
        <div data-testid="modal-body" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
