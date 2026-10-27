import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import type { BackendUser } from '@/types/api'
import { ApiError } from '@/services/http'
import { authApi } from '@/services/auth.service'
import type { LoginOptions } from '@/components/auth/AuthFlowContext'

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function toStoreUser(user: BackendUser) {
  return {
    id: user.public_id,
    name: user.full_name,
    initials: initials(user.full_name),
    email: user.email,
    role: user.role.name,
  }
}

const SESSION_FLAG_KEY = 'ucomp_has_session'

export function useAuth() {
  const { loginSuccess, logout: storeLogout } = useAppStore()
  const navigate = useNavigate()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  // El access_token vive solo en memoria (nunca en localStorage, ver
  // app.store.ts) a propósito -- un XSS no puede robarlo de ahí porque no
  // hay ningún storage que leer. El costo es que un F5 borra ese estado
  // de React. Este efecto lo recupera al arrancar la app intercambiando
  // la cookie HttpOnly de refresh_token (que sí sobrevive al refresh,
  // porque la pone el navegador, no React) por un access_token nuevo.
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Si no hay indicio de sesión previa en este navegador, no se llama a
    // /auth/refresh para evitar disparar una petición 401 innecesaria.
    if (localStorage.getItem(SESSION_FLAG_KEY) !== 'true') {
      setIsRestoringSession(false)
      return
    }

    authApi
      .refresh()
      .then(async (tokens) => {
        const user = await authApi.me(tokens.access_token)
        if (!cancelled) {
          localStorage.setItem(SESSION_FLAG_KEY, 'true')
          loginSuccess(toStoreUser(user), tokens.access_token)
        }
      })
      .catch(() => {
        // Sin cookie o ya expiró (7 días) -- limpiar bandera y dejar deslogueado
        localStorage.removeItem(SESSION_FLAG_KEY)
      })
      .finally(() => {
        if (!cancelled) setIsRestoringSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [loginSuccess])

  const loginWithCredentials = useCallback(
    async (email: string, password: string, options: LoginOptions = {}) => {
      setIsLoggingIn(true)
      setLoginError(null)
      try {
        const tokens = await authApi.login(email, password)
        const user = await authApi.me(tokens.access_token)
        const authenticatedUser = toStoreUser(user)
        localStorage.setItem(SESSION_FLAG_KEY, 'true')
        loginSuccess(authenticatedUser, tokens.access_token)
        if (options.redirectToDashboard !== false) navigate('/dashboard')
        return authenticatedUser
      } catch (err) {
        setLoginError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
        return null
      } finally {
        setIsLoggingIn(false)
      }
    },
    [loginSuccess, navigate]
  )

  // Cierra la sesión sin navegar a /login (la usa el flujo de postulación). Solo
  // limpia el estado local si el servidor confirmó la invalidación del refresh_token.
  const endSession = useCallback(async (): Promise<string | null> => {
    try {
      await authApi.logout()
    } catch (err) {
      return err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor'
    }
    localStorage.removeItem(SESSION_FLAG_KEY)
    storeLogout()
    return null
  }, [storeLogout])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_FLAG_KEY)
    storeLogout()
    navigate('/login')
    authApi.logout().catch(() => {
      // Aunque falle el aviso al backend, la sesión local ya quedó
      // cerrada -- no bloquear al usuario por esto.
    })
  }, [storeLogout, navigate])

  return { logout, endSession, loginWithCredentials, isLoggingIn, loginError, isRestoringSession }
}
