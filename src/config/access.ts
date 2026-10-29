import type { NavSection, User } from '@/types'
import { hasAnyRole, type InstitutionalRole } from '@/config/roles'

// Dos capas de acceso por sección, ambas usadas por el menú (Sidebar) y por
// los guards de rutas (RequireRole / RequireSection):
//
// 1. MODULE_ROLES -- rol INSTITUCIONAL (Entra ID): a qué módulos entra la
//    persona. Sección ausente = cualquier usuario con al menos un rol.
// 2. SECTION_ROLES -- rol de la BD que exige el endpoint del backend, para
//    no mostrar un formulario que el backend va a rechazar al enviar.
//
// El resto de secciones son de solo lectura y el backend ya filtra qué ve
// cada quien (ej. un estudiante solo ve sus propios trámites).
export const MODULE_ROLES: Partial<Record<NavSection, readonly InstitutionalRole[]>> = {
  nuevo: ['Estudiante'],
  proceso: ['Estudiante'],
  'mis-propuestas': ['Estudiante'],
  // Evaluación de propuestas estudiantiles: el backend exige coordinador/administrativo.
  propuestas: ['Coordinador', 'Administrador'],
  // Coordinación académica: asignar tutores y supervisar. El backend exige coordinador/administrativo.
  asignacion: ['Coordinador', 'Administrador'],
  // Portafolio general: el backend exige coordinador/administrativo en /api/coordination/portfolio.
  portafolio: ['Coordinador', 'Administrador'],
  // Espacio del tutor: la ruta la abren Docente y Coordinador (que también puede tutorizar); el backend
  // decide qué proyectos devuelve según la asignación real en process_team.
  tutor: ['Docente', 'Coordinador'],
  buscar: ['Administrador', 'Coordinador', 'ComiteGrado', 'Docente', 'Consulta/Biblioteca'],
  comites: ['ComiteGrado', 'Coordinador', 'Administrador'],
  administrativo: ['Administrador', 'Coordinador'],
  externo: ['Externo', 'Coordinador', 'Administrador'],
  calificaciones: ['Docente', 'Estudiante', 'Coordinador', 'ComiteGrado', 'Administrador'],
  reportes: ['Administrador', 'Coordinador', 'ComiteGrado', 'Consulta/Biblioteca'],
}

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

// El menú del tutor es para el DOCENTE puro. Quien además es coordinador, comité, administrador o
// estudiante conserva el menú de su rol principal. Ser docente NO asigna proyectos: eso es process_team.
export function isTutorWorkspaceUser(user: Pick<User, 'institutionalRoles'>): boolean {
  const roles = user.institutionalRoles
  return roles.includes('Docente') && !roles.some((r) => ['Coordinador', 'Administrador', 'ComiteGrado', 'Estudiante'].includes(r))
}

// Coordinación académica: quien tiene el rol institucional Coordinador o Administrador (y no es estudiante).
export function isCoordinationUser(user: Pick<User, 'institutionalRoles'>): boolean {
  const roles = user.institutionalRoles
  return !roles.includes('Estudiante') && (roles.includes('Coordinador') || roles.includes('Administrador'))
}

export function canAccessModule(section: NavSection, roles: InstitutionalRole[]): boolean {
  const allowed = MODULE_ROLES[section]
  return roles.length > 0 && (!allowed || hasAnyRole(roles, allowed))
}

export function canAccessSection(section: NavSection, role: string): boolean {
  const allowed = SECTION_ROLES[section]
  return !allowed || allowed.includes(role)
}

export function canSeeInMenu(section: NavSection, user: User): boolean {
  return canAccessModule(section, user.institutionalRoles) && canAccessSection(section, user.role)
}

// Aprobar/rechazar un documento -- PUT /documents/{id}/review exige
// require_role("coordinador", "administrativo") en el backend.
const DOCUMENT_REVIEW_ROLES = ['coordinador', 'administrativo']

export function canReviewDocuments(role: string): boolean {
  return DOCUMENT_REVIEW_ROLES.includes(role)
}
