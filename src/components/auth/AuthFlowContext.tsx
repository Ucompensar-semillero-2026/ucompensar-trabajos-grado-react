import { createContext, useContext } from 'react'
import type { User } from '@/types'

export interface LoginOptions {
  redirectToDashboard?: boolean
}

export interface AuthFlowContextValue {
  loginWithCredentials: (email: string, password: string, options?: LoginOptions) => Promise<User | null>
  /** Cierra la sesión sin navegar. Devuelve un mensaje de error si el servidor no confirmó el cierre. */
  endSession: () => Promise<string | null>
  isLoggingIn: boolean
  loginError: string | null
}

export const AuthFlowContext = createContext<AuthFlowContextValue | null>(null)

export function useAuthFlow() {
  const context = useContext(AuthFlowContext)
  if (!context) throw new Error('useAuthFlow debe utilizarse dentro de AuthFlowContext.Provider')
  return context
}
