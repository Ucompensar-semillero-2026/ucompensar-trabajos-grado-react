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

export type RouteArea = 'protected' | 'public' | 'neutral'

const PROTECTED_PREFIXES = [
  '/dashboard', '/mis-propuestas', '/coordinacion', '/mi-proceso', '/tutor', '/tramites', '/nuevo', '/buscar',
  '/trazabilidad', '/documentos', '/comites', '/administrativo', '/externo', '/calificaciones', '/notificaciones', '/reportes',
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
