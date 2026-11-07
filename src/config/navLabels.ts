import type { NavSection, User } from '@/types'
import { hasModule } from '@/config/access'

// CATÁLOGO ÚNICO de nomenclatura por perfil. El identificador técnico de cada módulo (`NavSection`) y su ruta NO cambian: aquí
// solo se decide cómo se LLAMA cada módulo para cada perfil. Menú lateral, títulos de página, enlaces internos y buscador
// leen de este archivo, así que un nombre se cambia en un solo lugar.
//
// El perfil sale de los módulos que informa el backend (GET /auth/me -> modules), igual que el menú y las rutas: no se
// comparan nombres de rol. Un módulo sin entrada para un perfil conserva su nombre original.

export type Audience = 'student' | 'teacher' | 'coordination' | 'other'

/** Espacio de trabajo de la persona. Un usuario con varios roles toma el que le asigna el backend (ver `modules_for`). */
export function audienceOf(user: Pick<User, 'modules'> | null | undefined): Audience {
  if (hasModule(user, 'workspace-student')) return 'student'
  if (hasModule(user, 'workspace-tutor')) return 'teacher'
  if (hasModule(user, 'workspace-coordination')) return 'coordination'
  return 'other'
}

type Labels = Partial<Record<Exclude<Audience, 'other'>, string>>

/**
 * Áreas funcionales relacionadas entre perfiles:
 *   Procesos     Mi proceso de grado        | Seguimiento de proyectos    | Gestión de procesos
 *   Proyectos    Mis proyectos              | Proyectos asignados         | Proyectos de grado
 *   Propuestas   Mis propuestas             | (sin módulo para docentes)  | Gestión de propuestas
 *   Entregables  Mis tareas                 | Entregables de estudiantes  | Seguimiento de entregables
 *   Fechas       Importantes                | Fechas y compromisos        | Seguimiento y alertas
 */
export const NAV_LABELS: Partial<Record<NavSection, Labels>> = {
  dashboard: { student: 'Inicio', teacher: 'Inicio', coordination: 'Inicio' },
  tutor: { teacher: 'Inicio' },
  // Procesos
  proceso: { student: 'Mi proceso de grado' },
  trazabilidad: { teacher: 'Seguimiento de proyectos', coordination: 'Seguimiento de proyectos' },
  tramites: { student: 'Mis proyectos', coordination: 'Gestión de procesos' },
  // Proyectos
  'tutor-proyectos': { teacher: 'Proyectos asignados' },
  portafolio: { coordination: 'Proyectos de grado' },
  // Propuestas
  'mis-propuestas': { student: 'Mis propuestas' },
  propuestas: { coordination: 'Gestión de propuestas' },
  // Entregables
  documentos: { student: 'Mis tareas', coordination: 'Seguimiento de entregables' },
  'tutor-revisiones': { teacher: 'Entregables de estudiantes' },
  // Fechas y alertas
  'mis-fechas': { student: 'Importantes' },
  seguimiento: { teacher: 'Fechas y compromisos', coordination: 'Seguimiento y alertas' },
}

/** Nombre del módulo para ese perfil, o `undefined` si conserva su nombre original. */
export function labelFor(section: NavSection, audience: Audience): string | undefined {
  return audience === 'other' ? undefined : NAV_LABELS[section]?.[audience]
}

/** Nombre del módulo para ese perfil, con el original como respaldo. */
export function navLabel(section: NavSection, audience: Audience, fallback: string): string {
  return labelFor(section, audience) ?? fallback
}
