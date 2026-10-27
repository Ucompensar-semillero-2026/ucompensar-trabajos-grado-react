import { createContext, useContext } from 'react'

export interface AuthFlowContextValue {
  /** Lleva a Microsoft y, al volver, navega a `returnTo` (ruta interna). */
  loginWithMicrosoft: (returnTo?: string) => Promise<void>
  /** Cierra la sesión sin navegar. Devuelve un mensaje de error si el servidor no confirmó el cierre. */
  endSession: () => Promise<string | null>
  loginError: string | null
}

export const AuthFlowContext = createContext<AuthFlowContextValue | null>(null)

export function useAuthFlow() {
  const context = useContext(AuthFlowContext)
  if (!context) throw new Error('useAuthFlow debe utilizarse dentro de AuthFlowContext.Provider')
  return context
}
