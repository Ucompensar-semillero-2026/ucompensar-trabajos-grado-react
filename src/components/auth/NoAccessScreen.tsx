import { ShieldOff } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { isMicrosoftLoginConfigured, msalInstance } from '@/config/msal'
import { useAppStore } from '@/stores/app.store'

interface NoAccessScreenProps {
  onLogout: () => void
}

// Cuenta válida (Microsoft o local) pero sin ningún rol institucional:
// no se deja entrar a ningún módulo hasta que la coordinación le asigne
// un App Role en Entra ID.
export function NoAccessScreen({ onLogout }: NoAccessScreenProps) {
  const { currentUser } = useAppStore()
  const account = isMicrosoftLoginConfigured ? msalInstance.getActiveAccount() : null
  const email = currentUser?.email ?? account?.username ?? null

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="w-full max-w-[420px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <Logo variant="dark" size="md" />
        </div>
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center">
          <ShieldOff size={22} className="text-[var(--color-primary)]" />
        </div>
        <h2 className="text-[20px] font-bold text-[var(--color-text)] mb-2">Tu cuenta no tiene acceso</h2>
        <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
          {email ? (
            <>
              La cuenta <strong className="text-[var(--color-text)]">{email}</strong> no tiene un rol asignado
              en la Plataforma de Trabajos de Grado.
            </>
          ) : (
            'Tu cuenta no tiene un rol asignado en la Plataforma de Trabajos de Grado.'
          )}
        </p>
        <p className="text-[12.5px] text-[var(--color-text-muted)] leading-relaxed mt-3">
          Pide a la coordinación de tu programa que te asigne un rol (Estudiante, Docente, Coordinador…) y vuelve a
          iniciar sesión.
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-6 w-full py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[13px] font-bold border-none cursor-pointer transition-colors"
        >
          Entrar con otra cuenta
        </button>
      </div>
    </div>
  )
}
