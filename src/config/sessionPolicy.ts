import { NO_ACCESS_PATH } from '@/config/roles'

/**
 * Política de sesión: la sesión solo vive mientras el usuario está en el área autenticada o completa una operación
 * pública. Esta clasificación decide cuándo una navegación es una SALIDA del área autenticada.
 *
 *  - protected: módulos del portal (requieren sesión).
 *  - public: páginas públicas del sitio.
 *  - neutral: login, sin acceso y rutas desconocidas. No cuentan como salida ni como entrada, para no cerrar la sesión
 *    por una redirección legítima de Microsoft ni por un enlace roto que el catch-all reenvía a la portada.
 */
/** Confirmación del cierre voluntario de sesión (única pantalla que informa que la sesión se cerró). */
export const SESSION_CLOSED_PATH = '/sesion-cerrada'

/**
 * Cierre por inactividad (checklist de seguridad #4; OWASP ASVS 3.3.2, ISO 27002 8.5). El tiempo real lo decide el
 * servidor (`idle_timeout_minutes` en GET /auth/me); este valor solo se usa hasta recibirlo.
 */
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 15
/** Cuánto antes del cierre aparece el aviso «¿Sigues ahí?». */
export const IDLE_WARNING_MS = 2 * 60 * 1000
/** Texto exacto con el que el servidor rechaza una sesión cerrada por inactividad (app/domains/auth/sessions.py). */
export const IDLE_EXPIRED_DETAIL = 'Tu sesión se cerró por inactividad'

export type RouteArea = 'protected' | 'public' | 'neutral'

const PROTECTED_PREFIXES = [
  '/dashboard', '/mis-propuestas', '/coordinacion', '/mi-proceso', '/tutor', '/tramites', '/nuevo', '/buscar',
  '/trazabilidad', '/documentos', '/comites', '/administrativo', '/externo', '/calificaciones', '/notificaciones', '/reportes', '/seguimiento', '/mis-fechas',
]

const startsWithSegment = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)

export function routeArea(pathname: string): RouteArea {
  if (pathname === '/login' || pathname === SESSION_CLOSED_PATH || startsWithSegment(pathname, NO_ACCESS_PATH)) return 'neutral'
  if (PROTECTED_PREFIXES.some((prefix) => startsWithSegment(pathname, prefix))) return 'protected'
  if (pathname === '/' || startsWithSegment(pathname, '/proyectos-de-grado')) return 'public'
  return 'neutral'
}

/** True solo en la transición real portal → sitio público. */
export function isExitFromPortal(previous: RouteArea | null, next: RouteArea): boolean {
  return previous === 'protected' && next === 'public'
}
