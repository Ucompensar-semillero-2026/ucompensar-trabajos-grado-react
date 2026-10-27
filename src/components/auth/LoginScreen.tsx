import { useState } from 'react'
import { LoginPanel } from './LoginPanel'
import { SSOForm } from './SSOForm'
import { CredentialsForm } from './CredentialsForm'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/utils/cn'

type TabType = 'sso' | 'credentials'

interface LoginScreenProps {
  onCredentialsLogin: (email: string, password: string) => void
  isLoggingIn?: boolean
  loginError?: string | null
}

export function LoginScreen({ onCredentialsLogin, isLoggingIn, loginError }: LoginScreenProps) {
  // 'credentials' por defecto -- es la única forma de entrar que de verdad
  // funciona hoy (ver SSOForm: el SSO de Microsoft todavía no existe).
  const [activeTab, setActiveTab] = useState<TabType>('credentials')

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
              Accede con tu cuenta institucional
              <br />o tus credenciales UCompensar
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[var(--color-bg)] rounded-xl p-1 mb-6 border border-[var(--color-border)]">
            {(['sso', 'credentials'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-200 cursor-pointer border-none',
                  activeTab === tab
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50'
                )}
              >
                {tab === 'sso' ? 'Microsoft SSO' : 'Credenciales'}
              </button>
            ))}
          </div>

          <div
            className="animate-in [&_a]:text-[12px] [&_input]:min-h-11 [&_input]:text-[14px] [&_label]:text-[11px] [&_p]:text-[12px] [&_button]:text-[14px]"
            key={activeTab}
          >
            {activeTab === 'sso' ? (
              <SSOForm onSwitchToCredentials={() => setActiveTab('credentials')} />
            ) : (
              <CredentialsForm onSubmit={onCredentialsLogin} isLoading={isLoggingIn} error={loginError} />
            )}
          </div>
        </div>

        <p className="absolute bottom-6 px-6 text-[11px] text-[var(--color-text-dim)] text-center opacity-70">
          © 2026 Fundación Universitaria Compensar · Vigilada Mineducación
        </p>
      </div>
    </div>
  )
}
