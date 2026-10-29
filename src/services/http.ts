// Cliente HTTP compartido -- lo único que cada archivo de servicio (uno
// por dominio, igual que app/domains/ en el backend) necesita importar
// para hablar con la API. Nada de lógica de negocio vive acá.
import { useAppStore } from '@/stores/app.store'

// In development, use Vite's same-origin /api proxy to avoid browser CORS
// restrictions. Deployments can provide VITE_API_URL pointing to the API base.
const API_URL = (import.meta.env.VITE_API_URL?.trim() || '/api').replace(/\/+$/, '')
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')

// El backend devuelve rutas relativas para archivos (ej. /local-storage/...)
// -- hay que anteponerles el origen para que el navegador los pueda abrir.
export function resolveFileUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

// Marca local de "hubo sesión en este navegador" (ver useAuth): evita llamar
// a /auth/refresh al cargar la página si nunca se inició sesión.
export const SESSION_FLAG_KEY = 'ucomp_has_session'

function send(path: string, options: RequestInit): Promise<Response> {
  const isFormData = options.body instanceof FormData
  return fetch(`${API_URL}${path}`, {
    // Necesario para que el navegador mande/reciba la cookie HttpOnly de
    // refresh_token (ver auth.service.ts) -- sin esto, cross-origin
    // (Vercel <-> Render) el navegador ni siquiera intenta adjuntarla.
    credentials: 'include',
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })
}

// El access_token dura 15 min. Cuando una llamada autenticada responde 401 se
// pide uno nuevo con la cookie de refresh y se repite la llamada UNA vez. Las
// llamadas que fallan a la vez comparten la misma renovación (el backend
// rota la cookie en cada /auth/refresh). Si la renovación falla (cookie
// vencida, o pasaron las 8 h de la sesión de Microsoft) se cierra la sesión.
let refreshing: Promise<string | null> | null = null

function renewAccessToken(): Promise<string | null> {
  refreshing ??= send('/auth/refresh', { method: 'POST' })
    .then(async (res) => {
      if (!res.ok) return null
      const body = (await res.json()) as { access_token?: string }
      return body.access_token ?? null
    })
    .catch(() => null)
    .then((token) => {
      const store = useAppStore.getState()
      if (token) {
        store.setAccessToken(token)
      } else if (store.isAuthenticated) {
        localStorage.removeItem(SESSION_FLAG_KEY)
        store.logout()
      }
      return token
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

function hasBearer(headers: HeadersInit | undefined): boolean {
  return new Headers(headers).has('Authorization')
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await send(path, options)
    if (res.status === 401 && hasBearer(options.headers) && !path.startsWith('/auth/')) {
      const token = await renewAccessToken()
      if (token) {
        // Objeto plano: send() expande los headers con `...` (un Headers quedaría vacío).
        const headers = new Headers(options.headers)
        headers.delete('Authorization')
        res = await send(path, { ...options, headers: { ...Object.fromEntries(headers), ...authHeaders(token) } })
      }
    }
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : 'Error de conexión con el servidor'
    throw new ApiError(res.status, detail)
  }

  // 204 (ej. /auth/logout) no trae body -- res.json() reventaría con
  // "Unexpected end of JSON input" si se llama sobre una respuesta vacía.
  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}
