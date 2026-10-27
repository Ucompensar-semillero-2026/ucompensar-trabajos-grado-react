import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import type { BackendUser } from '@/types/api'
import type { AuthMethod } from '@/types'
import { ApiError } from '@/services/http'
import { authApi } from '@/services/auth.service'
import {
  clearMicrosoftSession,
  getMsalRedirectOutcome,
  loginRequest,
  msalInstance,
} from '@/config/msal'
import {
  NO_ACCESS_PATH,
  homePathFor,
  institutionalRolesFromBackendRole,
  parseInstitutionalRoles,
  type InstitutionalRole,
} from '@/config/roles'

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function toStoreUser(user: BackendUser, institutionalRoles: InstitutionalRole[], authMethod: AuthMethod) {
  return {
    id: user.public_id,
    name: user.full_name,
    initials: initials(user.full_name),
    email: user.email,
    role: user.role.name,
    institutionalRoles,
    authMethod,
  }
}

// El backend sincroniza los App Roles de Entra ID en cada login con
// Microsoft (`institutional_roles`). El respaldo por rol de la BD solo
// aplica a cuentas antiguas sin Microsoft vinculado.
function resolveInstitutionalRoles(user: BackendUser): { roles: InstitutionalRole[]; authMethod: AuthMethod } {
  const fromEntra = parseInstitutionalRoles(user.institutional_roles)
  if (fromEntra.length > 0) return { roles: fromEntra, authMethod: 'sso' }
  return { roles: institutionalRolesFromBackendRole(user.role.name), authMethod: 'credentials' }
}

// Mensajes legibles para los errores que devuelve Microsoft en la vuelta
// del redirect. AADSTS50105 = la cuenta no está asignada a la app
// ("Asignación requerida" = Sí en Entra ID).
function describeMicrosoftError(code: string | null, message: string | null): string {
  if (message?.includes('AADSTS50105')) return 'NO_ACCESS'
  if (code === 'user_cancelled') return 'Cancelaste el inicio de sesión con Microsoft.'
  return 'No se pudo iniciar sesión con Microsoft. Intenta de nuevo.'
}

// A dónde volver después de Microsoft (ej. la oferta a la que el estudiante
// se estaba postulando). Viaja en el `state` del redirect; solo se aceptan
// rutas internas, para no convertir el login en un redirect abierto.
function safeReturnPath(state: string | undefined): string | null {
  if (!state || !state.startsWith('/') || state.startsWith('//') || state.startsWith('/\\')) return null
  return state
}

const SESSION_FLAG_KEY = 'ucomp_has_session'

// El resultado del redirect se consume una sola vez. Sin esto, el doble
// montaje de StrictMode en desarrollo mandaría el id_token dos veces.
let microsoftRedirectConsumed = false

export function useAuth() {
  const { loginSuccess, logout: storeLogout } = useAppStore()
  const navigate = useNavigate()
  // El efecto de restaurar sesión debe correr UNA vez al montar. `navigate`
  // cambia de identidad en cada navegación (React Router), así que no puede
  // ir en sus dependencias: re-dispararía /auth/refresh en cada cambio de ruta.
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const [microsoftError, setMicrosoftError] = useState<string | null>(null)
  // El access_token vive solo en memoria (nunca en localStorage, ver
  // app.store.ts) a propósito -- un XSS no puede robarlo de ahí porque no
  // hay ningún storage que leer. El costo es que un F5 borra ese estado
  // de React. Este efecto lo recupera al arrancar la app intercambiando
  // la cookie HttpOnly de refresh_token (que sí sobrevive al refresh,
  // porque la pone el navegador, no React) por un access_token nuevo.
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  useEffect(() => {
    let cancelled = false
    const outcome = getMsalRedirectOutcome()

    // 1. Vuelta de login.microsoftonline.com con error
    if (outcome.errorCode && !microsoftRedirectConsumed) {
      microsoftRedirectConsumed = true
      const description = describeMicrosoftError(outcome.errorCode, outcome.errorMessage)
      if (description === 'NO_ACCESS') navigateRef.current(NO_ACCESS_PATH, { replace: true })
      else setMicrosoftError(description)
      setIsRestoringSession(false)
      return
    }

    // 2. Vuelta de login.microsoftonline.com con éxito
    if (outcome.result && !microsoftRedirectConsumed) {
      microsoftRedirectConsumed = true
      const roles = parseInstitutionalRoles(outcome.result.idTokenClaims && (outcome.result.idTokenClaims as { roles?: unknown }).roles)
      if (roles.length === 0) {
        navigateRef.current(NO_ACCESS_PATH, { replace: true })
        setIsRestoringSession(false)
        return
      }

      authApi
        .microsoftLogin(outcome.result.idToken)
        .then(async (tokens) => {
          const user = await authApi.me(tokens.access_token)
          localStorage.setItem(SESSION_FLAG_KEY, 'true')
          loginSuccess(toStoreUser(user, roles, 'sso'), tokens.access_token)
          navigateRef.current(safeReturnPath(outcome.result?.state) ?? homePathFor(roles), { replace: true })
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 403) {
            navigateRef.current(NO_ACCESS_PATH, { replace: true })
            return
          }
          // 404/405: el backend todavía no tiene POST /auth/microsoft
          const notReady = err instanceof ApiError && (err.status === 404 || err.status === 405)
          const notConfigured = err instanceof ApiError && err.status === 503
          setMicrosoftError(
            notReady || notConfigured
              ? 'Tu cuenta de Microsoft es válida, pero el servidor no tiene configurado el inicio de sesión con Microsoft.'
              : err instanceof ApiError
                ? err.message
                : 'No se pudo conectar con el servidor'
          )
          clearMicrosoftSession().catch(() => {})
        })
        .finally(() => setIsRestoringSession(false))
      return
    }

    // 3. F5 con sesión previa: restaurar con la cookie de refresh.
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
          const { roles, authMethod } = resolveInstitutionalRoles(user)
          localStorage.setItem(SESSION_FLAG_KEY, 'true')
          loginSuccess(toStoreUser(user, roles, authMethod), tokens.access_token)
        }
      })
      .catch(() => {
        // Sin cookie o ya expiró (8 h para Microsoft) -- limpiar bandera y dejar deslogueado
        localStorage.removeItem(SESSION_FLAG_KEY)
      })
      .finally(() => {
        if (!cancelled) setIsRestoringSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [loginSuccess])

  // `returnTo`: ruta interna a la que volver tras Microsoft (por defecto, el
  // panel del rol). Navega fuera de la app; la vuelta la resuelve
  // bootstrapMsal() en main.tsx antes de pintar.
  const loginWithMicrosoft = useCallback(async (returnTo?: string) => {
    setMicrosoftError(null)
    try {
      await msalInstance.loginRedirect({ ...loginRequest, state: safeReturnPath(returnTo) ?? undefined })
    } catch {
      setMicrosoftError('No se pudo abrir el inicio de sesión de Microsoft.')
    }
  }, [])

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
    clearMicrosoftSession().catch(() => {})
    return null
  }, [storeLogout])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_FLAG_KEY)
    storeLogout()
    navigate('/login')
    clearMicrosoftSession().catch(() => {})
    authApi.logout().catch(() => {
      // Aunque falle el aviso al backend, la sesión local ya quedó
      // cerrada -- no bloquear al usuario por esto.
    })
  }, [storeLogout, navigate])

  return {
    logout,
    endSession,
    loginWithMicrosoft,
    microsoftError,
    isRestoringSession,
  }
}
