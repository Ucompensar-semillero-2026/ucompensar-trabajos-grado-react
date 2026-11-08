import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Clock3, LogOut } from 'lucide-react'
import { IDLE_WARNING_MS } from '@/config/sessionPolicy'

interface IdleWarningDialogProps {
  /** Segundos que faltan para el cierre; `null` = no hay aviso. */
  secondsLeft: number | null
  onStay: () => void
  onLogout: () => void
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Aviso previo al cierre por inactividad. Queda por encima de todo (también de los visores y modales, z-[110]) y
 * lleva el foco a «Seguir conectado», para que una tecla o un clic basten para continuar.
 */
export function IdleWarningDialog({ secondsLeft, onStay, onLogout }: IdleWarningDialogProps) {
  const stayRef = useRef<HTMLButtonElement>(null)
  const open = secondsLeft !== null

  useEffect(() => {
    if (open) stayRef.current?.focus()
  }, [open])

  if (!open) return null
  const total = IDLE_WARNING_MS / 1000
  const percent = Math.max(0, Math.min(100, (secondsLeft / total) * 100))
  const urgent = secondsLeft <= 30

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#031C34]/70 p-4 backdrop-blur-[3px]">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        aria-describedby="idle-warning-text"
        className="fu-rise w-full max-w-[420px] overflow-hidden rounded-[22px] bg-[var(--color-surface)] text-center shadow-[0_30px_80px_-20px_rgba(3,28,52,0.55)]"
      >
        <div className="px-7 pb-6 pt-8">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${urgent ? 'bg-[#FDECEA] text-[#C62828] dark:bg-red-500/15 dark:text-red-300' : 'bg-[#FFF4E5] text-[#B45309] dark:bg-amber-500/15 dark:text-amber-300'}`}>
            <Clock3 size={28} aria-hidden="true" />
          </div>
          <h2 id="idle-warning-title" className="mt-5 font-display text-[22px] font-bold text-[var(--color-text)]">
            ¿Sigues ahí?
          </h2>
          <p id="idle-warning-text" className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
            Por seguridad, tu sesión se cerrará por inactividad en
          </p>
          <p
            className={`mt-3 font-display text-[44px] font-bold tabular-nums leading-none ${urgent ? 'text-[#C62828] dark:text-red-300' : 'text-[var(--color-text)]'}`}
            aria-hidden="true"
          >
            {clock(secondsLeft)}
          </p>
          {/* Para lectores de pantalla: se anuncia por tramos, no cada segundo. */}
          <span className="sr-only" aria-live="polite">
            {secondsLeft % 30 === 0 || secondsLeft <= 10 ? `Quedan ${clock(secondsLeft)} minutos` : ''}
          </span>
          <div className="mx-auto mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]" aria-hidden="true">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${urgent ? 'bg-[#C62828]' : 'bg-[var(--color-primary)]'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-4 text-[12.5px] text-[var(--color-text-dim)]">Lo que no hayas guardado podría perderse.</p>
        </div>
        <footer className="flex flex-col-reverse gap-2.5 border-t border-[var(--color-border)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-[13px] font-bold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
          <button
            ref={stayRef}
            type="button"
            onClick={onStay}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            Seguir conectado
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
