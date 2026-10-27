import { LoginPanel } from './LoginPanel'
import { SSOForm } from './SSOForm'
import { Logo } from '@/components/ui/Logo'

interface LoginScreenProps {
  onMicrosoftLogin: () => void
  microsoftError?: string | null
}

// Solo Microsoft Entra ID: la plataforma no maneja contraseñas propias.
export function LoginScreen({ onMicrosoftLogin, microsoftError }: LoginScreenProps) {

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-[var(--color-bg)] transition-colors duration-300 md:flex-row">
      <LoginPanel />

      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center bg-[var(--color-surface)] px-6 pb-20 pt-14 sm:px-11 md:flex-none md:basis-[54%] md:py-12">
        <p className="absolute top-5 right-6 text-[13px] sm:right-8 text-[var(--color-text-dim)] cursor-pointer hover:text-[var(--color-primary)] transition-colors font-medium">
          ¿Necesitas ayuda?
        </p>

        <div className="w-full max-w-[380px] animate-in">
          <div className="mx-auto mb-9 flex h-[64px] w-full max-w-[280px] items-center justify-center sm:h-[75px]">
            <Logo variant="dark" size="lg" className="h-full w-[90%] object-contain" />
          </div>

          <div className="mb-8 text-center">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#073B57]">
              Acceso a la plataforma
            </p>
            <h2 className="mb-2 font-display text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[34px]">
              Bienvenido/a
            </h2>
            <p className="text-[14px] leading-relaxed text-[var(--color-text-muted)]">
              Accede con tu cuenta institucional de Microsoft
            </p>
          </div>

          <div className="animate-in [&_p]:text-[12px] [&_button]:text-[14px]">
            <SSOForm onMicrosoftLogin={onMicrosoftLogin} error={microsoftError} />
          </div>
        </div>

        <p className="absolute bottom-6 px-6 text-[11px] text-[var(--color-text-dim)] text-center opacity-70">
          © 2026 Fundación Universitaria Compensar · Vigilada Mineducación
        </p>
      </div>
    </div>
  )
}
