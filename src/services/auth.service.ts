import { ApiError, authHeaders, request } from './http'
import type { BackendUser } from '@/types/api'

export interface TokenResponse {
  access_token: string
  token_type: string
}

export const authApi = {
  login: (email: string, password: string) =>
    // El refresh_token no viaja en este body -- el backend lo setea como
    // cookie HttpOnly (Set-Cookie), invisible para JS. El navegador la
    // guarda solo si el fetch va con credentials: 'include' (ver http.ts).
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Cambia el id_token de Microsoft por la sesión propia del backend
  // (mismo access_token + cookie de refresh que /auth/login). El backend
  // DEBE validar la firma del token contra las claves de Entra ID antes de
  // confiar en el oid y los roles -- el frontend no es prueba de nada.
  microsoftLogin: (idToken: string) =>
    request<TokenResponse>('/auth/microsoft', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    }),

  me: (accessToken: string) =>
    request<BackendUser>('/auth/me', { headers: authHeaders(accessToken) }),

  verifyIdentity: async (accessToken: string, password: string, expectedPublicId: string): Promise<void> => {
    const user = await request<{ public_id: string }>('/auth/verify', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ password }),
    })
    if (user.public_id !== expectedPublicId) {
      throw new ApiError(403, 'Las credenciales no corresponden a la cuenta que inició esta sesión.')
    }
  },

  // Cambia el refresh_token de la cookie (que el navegador manda solo)
  // por un access_token nuevo. Se llama al arrancar la app para restaurar
  // la sesión tras un refresh de página, y falla con 401 si no hay cookie
  // o ya expiró -- en ese caso, a login normal.
  refresh: () => request<TokenResponse>('/auth/refresh', { method: 'POST' }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}
