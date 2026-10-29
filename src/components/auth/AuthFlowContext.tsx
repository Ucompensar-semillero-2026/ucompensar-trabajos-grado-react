import { createContext, useContext } from 'react'
import type { PublicFlash } from '@/services/sessionFlash'

/** Motivo del cierre de sesión. Solo `manual` muestra un mensaje de «sesión cerrada». */
export type SessionEndReason = 'manual' | 'postulation_success' | 'proposal_success' | 'leave_authenticated_area'

export interface EndSessionOptions {
  reason?: SessionEndReason
  /** Ruta pública a la que volver tras cerrar también la sesión de Microsoft. */
  returnTo?: string
  /** Confirmación (datos mínimos) que se mostrará en `returnTo`, una sola vez. */
  flash?: PublicFlash
}

export interface AuthFlowContextValue {
  /** Lleva a Microsoft y, al volver, navega a `returnTo` (ruta interna). */
  loginWithMicrosoft: (returnTo?: string) => Promise<void>
  /**
   * Cierra la sesión de la app y de Microsoft. Devuelve un mensaje de error si el servidor no confirmó el cierre
   * (en ese caso la sesión local se conserva). Con `returnTo` vuelve a esa página pública tras el logout.
   */
  endSession: (options?: EndSessionOptions) => Promise<string | null>
  loginError: string | null
}

export const AuthFlowContext = createContext<AuthFlowContextValue | null>(null)

export function useAuthFlow() {
  const context = useContext(AuthFlowContext)
  if (!context) throw new Error('useAuthFlow debe utilizarse dentro de AuthFlowContext.Provider')
  return context
}
