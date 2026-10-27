import { useState } from 'react'
import { isMicrosoftLoginConfigured } from '@/config/msal'
import { cn } from '@/utils/cn'

function MicrosoftIcon() {
  return (
    <div className="grid grid-cols-2 gap-[1.5px] w-[18px] h-[18px] flex-shrink-0">
      <span className="block rounded-[1px] bg-[#F25022]" />
      <span className="block rounded-[1px] bg-[#7FBA00]" />
      <span className="block rounded-[1px] bg-[#00A4EF]" />
      <span className="block rounded-[1px] bg-[#FFB900]" />
    </div>
  )
}

interface SSOFormProps {
  onMicrosoftLogin: () => void
  error?: string | null
}

// Único acceso a la plataforma: la contraseña se escribe solo en la página
// de Microsoft. Lo usan /login y el diálogo de postulación del catálogo.
export function SSOForm({ onMicrosoftLogin, error }: SSOFormProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)
  const disabled = !isMicrosoftLoginConfigured || isRedirecting

  const handleClick = () => {
    if (disabled) return
    setIsRedirecting(true)
    onMicrosoftLogin()
  }

  return (
    <div>
      {error && (
        <p role="alert" className="text-[11.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-disabled={disabled}
        className={cn(
          'w-full flex items-center justify-center gap-3 bg-white border-[1.5px] border-neutral-border rounded-xl px-5 py-3 mb-4 transition-colors',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'
        )}
      >
        <MicrosoftIcon />
        <div className="text-left">
          <div className="text-[13px] font-semibold text-neutral-text">
            {isRedirecting ? 'Abriendo Microsoft…' : 'Continuar con Microsoft'}
          </div>
          <span className="text-[10px] text-neutral-muted">
            {isMicrosoftLoginConfigured ? 'Cuenta institucional o invitada' : 'No configurado en este entorno'}
          </span>
        </div>
      </button>

      <div className="bg-[var(--color-secondary-soft)] border border-[var(--color-secondary)]/20 rounded-lg px-3.5 py-2.5 flex gap-2 items-start">
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          className="flex-shrink-0 mt-0.5"
        >
          <circle cx="8" cy="8" r="6.5" stroke="var(--color-secondary)" strokeWidth="1.4" />
          <path d="M8 7v5M8 5v1" stroke="var(--color-secondary)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <p className="text-[10.5px] text-[var(--color-secondary)] leading-[1.5]">
          Usa tu correo institucional de Microsoft.
        </p>
      </div>
    </div>
  )
}
