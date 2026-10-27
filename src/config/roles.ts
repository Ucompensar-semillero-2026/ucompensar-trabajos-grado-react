// Rol INSTITUCIONAL: quién es la persona en la universidad y a qué módulos
// entra. Viene de los App Roles de Microsoft Entra ID (claim `roles` del
// id_token). Es distinto del rol POR TRÁMITE (tutor, evaluador...) que vive
// en la BD y dice qué hace en cada trabajo de grado.
//
// Los valores deben coincidir EXACTAMENTE con los "Value" de los App Roles
// de la app registration en Azure.
export const INSTITUTIONAL_ROLES = [
  'Estudiante',
  'Docente',
  'Coordinador',
  'ComiteGrado',
  'Administrador',
  'Consulta/Biblioteca',
  'Externo',
] as const

export type InstitutionalRole = (typeof INSTITUTIONAL_ROLES)[number]

export const INSTITUTIONAL_ROLE_LABELS: Record<InstitutionalRole, string> = {
  Estudiante: 'Estudiante',
  Docente: 'Docente',
  Coordinador: 'Coordinación',
  ComiteGrado: 'Comité de grado',
  Administrador: 'Administración',
  'Consulta/Biblioteca': 'Consulta / Biblioteca',
  Externo: 'Externo',
}

// Descarta cualquier valor que no sea un App Role conocido -- un claim
// `roles` con basura no debe abrir ningún módulo.
export function parseInstitutionalRoles(claim: unknown): InstitutionalRole[] {
  if (!Array.isArray(claim)) return []
  return INSTITUTIONAL_ROLES.filter((role) => claim.includes(role))
}

// Para quien entra con usuario/contraseña (cuentas no-Microsoft): su rol
// institucional se deduce del rol que tiene en la BD.
const BACKEND_TO_INSTITUTIONAL: Record<string, InstitutionalRole> = {
  estudiante: 'Estudiante',
  tutor_investigador: 'Docente',
  tutor_emprendedor: 'Docente',
  tutor_consultor: 'Docente',
  docente_curso: 'Docente',
  coordinador_movilidad: 'Docente',
  evaluador: 'Docente',
  // Temporal: grupo_investigacion debería ser una entidad aparte, no un
  // rol de persona (punto 6 del plan).
  grupo_investigacion: 'Docente',
  coordinador: 'Coordinador',
  consejo_facultad: 'ComiteGrado',
  administrativo: 'Administrador',
  empresa_cliente: 'Externo',
  comunidad_beneficiaria: 'Externo',
}

export function institutionalRolesFromBackendRole(backendRole: string): InstitutionalRole[] {
  const role = BACKEND_TO_INSTITUTIONAL[backendRole]
  return role ? [role] : []
}

// Panel de inicio de cada rol. El orden es la prioridad cuando alguien
// tiene varios (ej. ["Coordinador","Docente"] -> panel de Coordinador).
const HOME_BY_ROLE: Array<[InstitutionalRole, string]> = [
  ['Administrador', '/dashboard'],
  ['Coordinador', '/dashboard'],
  ['ComiteGrado', '/comites'],
  ['Docente', '/tramites'],
  // "Inicio" del menú estudiantil (STUDENT_NAV_GROUPS) es /dashboard
  ['Estudiante', '/dashboard'],
  ['Externo', '/externo'],
  ['Consulta/Biblioteca', '/buscar'],
]

export const NO_ACCESS_PATH = '/sin-acceso'

export function homePathFor(roles: InstitutionalRole[]): string {
  const match = HOME_BY_ROLE.find(([role]) => roles.includes(role))
  return match ? match[1] : NO_ACCESS_PATH
}

export function hasAnyRole(userRoles: InstitutionalRole[], allowed: readonly InstitutionalRole[]): boolean {
  return allowed.some((role) => userRoles.includes(role))
}
