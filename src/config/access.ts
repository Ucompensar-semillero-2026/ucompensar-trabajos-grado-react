import type { User } from '@/types'
import { NO_ACCESS_PATH } from '@/config/roles'

// Qué puede hacer cada persona lo decide SOLO el backend (docs/ROLES-DISENO.md,
// regla 1 y contrato 6.1):
//
// - Módulos: GET /auth/me -> `modules` (secciones del menú, espacio de trabajo
//   y gestión). Aquí no hay listas de roles: solo se pregunta si el módulo está.
// - Acciones sobre un trámite: GET /processes/{id} -> `allowed_actions`
//   (ver config/actions.ts).
//
// Una clave que el frontend no conoce se ignora sin romper nada: el backend
// puede agregar módulos antes de que exista la pantalla.

export const KNOWN_MODULES = [
  'dashboard',
  'proceso',
  'mis-propuestas',
  'propuestas',
  'asignacion',
  'portafolio',
  'tutor',
  'tutor-proyectos',
  'tutor-planes',
  'tutor-revisiones',
  'tutor-estadisticas',
  'tramites',
  'nuevo',
  'buscar',
  'trazabilidad',
  'documentos',
  'reportes',
  'comites',
  'administrativo',
  'externo',
  'calificaciones',
  'notificaciones',
  // Espacio de trabajo: qué menú e inicio ve la persona.
  'workspace-student',
  'workspace-tutor',
  'workspace-coordination',
  // Gestión fuera de un trámite.
  'administrativo-gestion',
  'externo-gestion',
] as const

export type ModuleKey = (typeof KNOWN_MODULES)[number]

const KNOWN = new Set<string>(KNOWN_MODULES)

/** Módulos de /auth/me que el frontend conoce, sin repetidos (los demás se ignoran). */
export function knownModules(modules: readonly string[] | undefined): ModuleKey[] {
  return [...new Set((modules ?? []).filter((m): m is ModuleKey => KNOWN.has(m)))]
}

export function hasModule(user: Pick<User, 'modules'> | null | undefined, module: ModuleKey): boolean {
  return Boolean(user?.modules.includes(module))
}

// Inicio de cada persona: el primer módulo de esta lista que tenga.
const HOME_BY_MODULE: Array<[ModuleKey, string]> = [
  ['workspace-coordination', '/dashboard'],
  ['comites', '/comites'],
  ['workspace-tutor', '/tutor'],
  ['tutor', '/tutor'],
  ['workspace-student', '/dashboard'],
  ['externo', '/externo'],
  ['buscar', '/buscar'],
  ['dashboard', '/dashboard'],
]

export function homePathFor(modules: readonly ModuleKey[]): string {
  const match = HOME_BY_MODULE.find(([module]) => modules.includes(module))
  return match ? match[1] : NO_ACCESS_PATH
}
