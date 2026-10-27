// Cliente HTTP compartido -- lo único que cada archivo de servicio (uno
// por dominio, igual que app/domains/ en el backend) necesita importar
// para hablar con la API. Nada de lógica de negocio vive acá.

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

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  const isFormData = options.body instanceof FormData
  try {
    res = await fetch(`${API_URL}${path}`, {
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
