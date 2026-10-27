import type { NavSection } from '@/types'

// Fuente única de verdad para qué rol puede ver cada sección -- la usan
// tanto el menú (Sidebar, para no mostrar un link que va a fallar) como
// el guard de rutas (RequireSection, para no dejar entrar por URL directa).
//
// El resto de secciones (aparte de las listadas acá) son de solo lectura
// y el backend ya filtra qué ve cada quien (ej. un estudiante solo ve sus
// propios trámites) sin necesitar ocultar el menú entero.
export const SECTION_ROLES: Partial<Record<NavSection, string[]>> = {
  // POST /processes exige "estudiante" (app/domains/processes/router.py)
  nuevo: ['estudiante'],
  // GET/POST /committees exige "consejo_facultad" o "administrativo"
  // (_RUN_SESSION_ROLES, app/domains/committees/router.py)
  comites: ['consejo_facultad', 'administrativo'],
}

// El menú estudiantil se elige por este rol (solo presentación; los permisos reales siguen en SECTION_ROLES y el backend).
export function isStudentRole(role: string): boolean {
  return role === 'estudiante'
}

export function canAccessSection(section: NavSection, role: string): boolean {
  const allowed = SECTION_ROLES[section]
  return !allowed || allowed.includes(role)
}

// Aprobar/rechazar un documento -- PUT /documents/{id}/review exige
// require_role("coordinador", "administrativo") en el backend.
const DOCUMENT_REVIEW_ROLES = ['coordinador', 'administrativo']

export function canReviewDocuments(role: string): boolean {
  return DOCUMENT_REVIEW_ROLES.includes(role)
}
