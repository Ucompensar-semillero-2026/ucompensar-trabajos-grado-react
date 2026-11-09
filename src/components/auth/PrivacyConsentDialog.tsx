import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, LogOut, ShieldCheck } from 'lucide-react'
import { PRIVACY_PURPOSE, PRIVACY_RESPONSIBLE, PRIVACY_RIGHTS } from '@/config/privacy'

interface PrivacyConsentDialogProps {
  open: boolean
  policyUrl: string
  policyVersion: string
  onAccept: () => Promise<string | null>
  onLogout: () => void
}

/**
 * Autorización de tratamiento de datos (Ley 1581). Aparece una sola vez tras ingresar (y otra vez si la universidad
 * cambia la política). No se puede cerrar sin decidir: aceptar o salir. La aceptación la guarda el servidor con
 * fecha, versión, IP y navegador (POST /auth/privacy-consent).
 */
export function PrivacyConsentDialog({ open, policyUrl, policyVersion, onAccept, onLogout }: PrivacyConsentDialogProps) {
  const acceptRef = useRef<HTMLButtonElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) acceptRef.current?.focus()
  }, [open])

  if (!open) return null

  const accept = async () => {
    setSaving(true)
    setError(null)
    const failure = await onAccept()
    setSaving(false)
    if (failure) setError(failure)
  }

  return createPortal(
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-[#031C34]/70 p-4 backdrop-blur-[3px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        className="fu-rise flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-[22px] bg-[var(--color-surface)] shadow-[0_30px_80px_-20px_rgba(3,28,52,0.55)]"
      >
        <header className="flex items-start gap-3.5 border-b border-[var(--color-border)] px-6 pb-4 pt-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FB] text-[#0876B9] dark:bg-sky-500/15 dark:text-sky-300">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <div>
            <h2 id="privacy-title" className="font-display text-[20px] font-bold leading-tight text-[var(--color-text)]">
              Tratamiento de tus datos personales
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--color-text-dim)]">Ley 1581 de 2012 · Política {policyVersion}</p>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 text-[13.5px] leading-relaxed text-[var(--color-text-muted)]">
          <Item title="Quién es el responsable">
            {PRIVACY_RESPONSIBLE.name} (NIT {PRIVACY_RESPONSIBLE.nit}), {PRIVACY_RESPONSIBLE.address}.
          </Item>
          <Item title="Para qué usamos tus datos">{PRIVACY_PURPOSE}</Item>
          <Item title="Tus derechos">{PRIVACY_RIGHTS}</Item>
          <Item title="Cómo ejercerlos">
            Escribe a <a className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline" href={`mailto:${PRIVACY_RESPONSIBLE.email}`}>{PRIVACY_RESPONSIBLE.email}</a>,
            llama al {PRIVACY_RESPONSIBLE.phone} o usa el canal de PQRSF de la universidad.
          </Item>
          <a
            href={policyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-primary)] underline-offset-2 hover:underline"
          >
            Leer la política de tratamiento de datos completa
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          <p className="rounded-xl bg-[var(--color-bg)] px-4 py-3 text-[12.5px] text-[var(--color-text)]">
            Al hacer clic en <strong>«Acepto»</strong> autorizas a UCompensar a tratar tus datos con esta finalidad. Guardamos la fecha de tu
            aceptación como constancia.
          </p>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-700">{error}</p>}
        </div>

        <footer className="flex flex-col-reverse gap-2.5 border-t border-[var(--color-border)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-[13px] font-bold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <LogOut size={16} aria-hidden="true" />
            No acepto, salir
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={() => void accept()}
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 text-[13px] font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Acepto'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-0.5 text-[12px] font-bold uppercase tracking-wide text-[var(--color-text)]">{title}</h3>
      <p>{children}</p>
    </div>
  )
}
