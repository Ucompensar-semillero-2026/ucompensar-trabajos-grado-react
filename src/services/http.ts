// Cliente HTTP compartido -- lo único que cada archivo de servicio (uno
// por dominio, igual que app/domains/ en el backend) necesita importar
// para hablar con la API. Nada de lógica de negocio vive acá.
import { useAppStore } from '@/stores/app.store'
import { IDLE_EXPIRED_DETAIL } from '@/config/sessionPolicy'
import { markIdleLogout } from './sessionFlash'
import { idleTimeoutMinutes } from './idleClock'

// In development, use Vite's same-origin /api proxy to avoid browser CORS
// restrictions. Deployments can provide VITE_API_URL pointing to the API base.
const API_URL = (import.meta.env.VITE_API_URL?.trim() || '/api').replace(/\/+$/, '')
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')

// El visor de documentos pide los archivos con la sesión (files.service). Esto queda para las
// pantallas que todavía abren la URL firmada que manda el backend (download_url) y para las
// URLs prefirmadas de subida del adaptador local, que son relativas a la API.
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

/**
 * Mensaje cuando el servidor no mandó uno legible (`detail` de texto). Antes todo caía en «Error de conexión con el
 * servidor», aunque la conexión estuviera bien y la causa fuera otra (datos inválidos, demasiados intentos...).
 */
export function messageForStatus(status: number): string {
  if (status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión a internet.'
  if (status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión.'
  if (status === 403) return 'No tienes permiso para hacer esto.'
  if (status === 404) return 'No encontramos lo que buscas.'
  if (status === 413) return 'El archivo es demasiado grande.'
  if (status === 422 || status === 400) return 'Revisa los datos enviados.'
  if (status === 429) return 'Hiciste demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.'
  if (status >= 500) return 'El servidor tuvo un problema. Intenta de nuevo en unos minutos.'
  return 'No se pudo completar la solicitud.'
}

function detailOf(body: unknown, status: number): string {
  const detail = body && typeof body === 'object' && 'detail' in body ? (body as { detail?: unknown }).detail : undefined
  return typeof detail === 'string' && detail.trim() ? detail : messageForStatus(status)
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
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
        if (body?.detail === IDLE_EXPIRED_DETAIL) markIdleLogout(idleTimeoutMinutes())
        return null
      }
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

export interface UploadOptions {
  method?: 'POST' | 'PUT'
  token: string
  body: FormData
  /** Porcentaje 0–100 del envío del archivo. */
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

function xhrSend<T>(path: string, token: string, { method = 'POST', body, onProgress, signal }: UploadOptions): Promise<{ status: number; data: T | { detail?: unknown } | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, `${API_URL}${path}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      let data = null
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null } catch { data = null }
      resolve({ status: xhr.status, data })
    }
    xhr.onerror = () => reject(new ApiError(0, 'Se perdió la conexión durante la carga. El archivo no se guardó.'))
    xhr.onabort = () => reject(new ApiError(0, 'Carga cancelada. El archivo no se guardó.'))
    if (signal) {
      if (signal.aborted) return xhr.abort()
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(body)
  })
}

/**
 * Subida de archivos con progreso (fetch no informa el avance del envío). Misma política que `request`: credenciales,
 * renovación del token una vez ante un 401 y errores del backend como `ApiError`.
 */
export async function uploadWithProgress<T>(path: string, options: UploadOptions): Promise<T> {
  let res = await xhrSend<T>(path, options.token, options)
  if (res.status === 401) {
    const token = await renewAccessToken()
    if (token) res = await xhrSend<T>(path, token, options)
  }
  if (res.status < 200 || res.status >= 300) {
    throw new ApiError(res.status, detailOf(res.data, res.status))
  }
  return res.data as T
}

export interface DirectUploadOptions {
  headers: Record<string, string>
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/**
 * PUT directo del archivo a una URL prefirmada del almacenamiento (Cloudflare R2). Sin credenciales de la API: ni
 * cookies ni Authorization (la firma de la URL es la única autorización y solo sirve para esa clave y ese Content-Type).
 * Con el adaptador local la URL es relativa a la API y se resuelve contra su origen.
 */
export function putToPresignedUrl(url: string, file: File, { headers, onProgress, signal }: DirectUploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url.startsWith('/') ? `${API_ORIGIN}${url}` : url)
    xhr.withCredentials = false
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      reject(new ApiError(xhr.status, xhr.status === 403 ? 'El permiso de carga venció o no es válido. Vuelve a intentarlo.' : 'El almacenamiento rechazó el archivo. Vuelve a intentarlo.'))
    }
    xhr.onerror = () => reject(new ApiError(0, 'Se perdió la conexión durante la carga. El archivo no se guardó.'))
    xhr.onabort = () => reject(new ApiError(0, 'Carga cancelada. El archivo no se guardó.'))
    if (signal) {
      if (signal.aborted) return xhr.abort()
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(file)
  })
}

/** Envía con la sesión; si el access_token venció (401), lo renueva y repite UNA vez. */
async function sendAuthorized(path: string, options: RequestInit): Promise<Response> {
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
    throw new ApiError(0, messageForStatus(0))
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, detailOf(body, res.status))
  }
  return res
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await sendAuthorized(path, options)

  // 204 (ej. /auth/logout) no trae body -- res.json() reventaría con
  // "Unexpected end of JSON input" si se llama sobre una respuesta vacía.
  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

/** Igual que request(), pero devuelve la respuesta sin leer (archivos: cabeceras y cuerpo binario). */
export function requestRaw(path: string, options: RequestInit = {}): Promise<Response> {
  return sendAuthorized(path, options)
}
