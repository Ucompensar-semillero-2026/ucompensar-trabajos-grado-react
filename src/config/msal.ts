import { PublicClientApplication, type AuthenticationResult, type RedirectRequest } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? ''
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID ?? ''

export const isMicrosoftLoginConfigured = Boolean(clientId && tenantId)

// Authority con el tenant explícito, NO /common: los invitados de
// Gmail/Outlook solo traen los App Roles si inician sesión contra este
// tenant (con /common entrarían a su propio directorio, sin roles).
//
// redirectUri = origen actual -> coincide con las Redirect URIs registradas
// (http://localhost:5173 y el dominio de Vercel). Un preview de Vercel con
// otra URL fallaría con AADSTS50011 hasta registrarlo en Azure.
//
// sessionStorage: la caché de MSAL muere al cerrar la pestaña. La sesión de
// la app no depende de ella -- después del login se cambia el id_token por
// la sesión propia del backend (cookie HttpOnly de refresh, ver useAuth).
export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    // La app NO usa logoutRedirect/logoutPopup (mostrarían pantallas de Microsoft); se conserva el origen registrado
    // solo como valor seguro por si algún día se invoca un logout de Microsoft de forma explícita.
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
})

export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
  // 'login' fuerza autenticación interactiva en cada inicio de sesión: no se reutiliza en silencio la sesión
  // anterior de Microsoft del navegador.
  prompt: 'login',
}

// Resultado de la vuelta desde login.microsoftonline.com. Se resuelve una
// sola vez en main.tsx, antes de pintar la app, para que useAuth sepa al
// montar si viene de un login recién hecho (y no tenga que esperar a
// eventos de MSAL).
export interface MsalRedirectOutcome {
  result: AuthenticationResult | null
  errorCode: string | null
  errorMessage: string | null
}

let redirectOutcome: MsalRedirectOutcome = { result: null, errorCode: null, errorMessage: null }

export async function bootstrapMsal(): Promise<void> {
  if (!isMicrosoftLoginConfigured) return
  await msalInstance.initialize()
  try {
    const result = await msalInstance.handleRedirectPromise()
    if (result?.account) {
      msalInstance.setActiveAccount(result.account)
    } else if (!msalInstance.getActiveAccount()) {
      const [cached] = msalInstance.getAllAccounts()
      if (cached) msalInstance.setActiveAccount(cached)
    }
    redirectOutcome = { result, errorCode: null, errorMessage: null }
  } catch (err) {
    const error = err as { errorCode?: string; errorMessage?: string; message?: string }
    redirectOutcome = {
      result: null,
      errorCode: error.errorCode ?? 'unknown_error',
      errorMessage: error.errorMessage ?? error.message ?? null,
    }
  }
}

export function getMsalRedirectOutcome(): MsalRedirectOutcome {
  return redirectOutcome
}

// Solo limpia la caché local de MSAL: no cierra la sesión de Microsoft del
// usuario en el navegador (Outlook, Teams, etc. siguen abiertos).
export async function clearMicrosoftSession(): Promise<void> {
  if (!isMicrosoftLoginConfigured) return
  msalInstance.setActiveAccount(null)
  await msalInstance.clearCache()
}
