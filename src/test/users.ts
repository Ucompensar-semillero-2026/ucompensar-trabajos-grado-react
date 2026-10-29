import { knownModules, type ModuleKey } from '@/config/access'
import type { User } from '@/types'

// SOLO PARA PRUEBAS: espejo de permissions.modules_for del backend, para armar
// usuarios como los que devuelve GET /auth/me. Si cambia la tabla del backend
// (docs/ROLES-DISENO.md 4.1), se actualiza aquí.
const ANY = ['estudiante', 'docente', 'coordinador', 'comite_grado', 'administrador', 'consulta', 'externo']
const COORDINATION = ['coordinador', 'administrador']
const TUTOR_WORKSPACE = ['docente', 'coordinador']

const MODULES: Record<string, string[]> = {
  dashboard: ANY,
  tramites: ANY,
  trazabilidad: ANY,
  documentos: ANY,
  notificaciones: ANY,
  proceso: ['estudiante'],
  'mis-propuestas': ['estudiante'],
  nuevo: ['estudiante'],
  propuestas: COORDINATION,
  asignacion: COORDINATION,
  portafolio: COORDINATION,
  tutor: TUTOR_WORKSPACE,
  'tutor-proyectos': TUTOR_WORKSPACE,
  'tutor-planes': TUTOR_WORKSPACE,
  'tutor-revisiones': TUTOR_WORKSPACE,
  'tutor-estadisticas': TUTOR_WORKSPACE,
  buscar: ['administrador', 'coordinador', 'comite_grado', 'docente', 'consulta'],
  comites: ['comite_grado', 'administrador'],
  administrativo: ['administrador', 'coordinador'],
  externo: ['externo', 'coordinador', 'administrador'],
  calificaciones: ['docente', 'estudiante', 'coordinador', 'comite_grado', 'administrador', 'externo'],
  reportes: ['administrador', 'coordinador', 'comite_grado', 'consulta'],
  'administrativo-gestion': ['administrador'],
  'externo-gestion': ['administrador'],
}

export function modulesFor(roles: readonly string[]): ModuleKey[] {
  const has = (list: readonly string[]) => list.some((r) => roles.includes(r))
  const modules = Object.entries(MODULES).filter(([, allowed]) => has(allowed)).map(([key]) => key)
  if (roles.includes('estudiante') && !has(['administrador', 'coordinador', 'comite_grado', 'docente'])) modules.push('workspace-student')
  if (roles.includes('docente') && !has(['coordinador', 'administrador', 'comite_grado', 'estudiante'])) modules.push('workspace-tutor')
  if (has(COORDINATION) && !roles.includes('estudiante')) modules.push('workspace-coordination')
  return knownModules(modules)
}

export function makeUser(roles: string[], overrides: Partial<User> = {}): User {
  const key = roles.join('-') || 'sin-rol'
  return {
    id: `${key}-id`,
    name: 'Persona de Prueba',
    initials: 'PP',
    email: `${key}@ucompensar.edu.co`,
    roles,
    modules: modulesFor(roles),
    ...overrides,
  }
}
