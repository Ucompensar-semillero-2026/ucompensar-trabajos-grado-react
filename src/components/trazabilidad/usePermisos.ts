import { useMemo } from 'react'
import { useAppStore } from '@/stores/app.store'
import { hasModule, hasProcessRole, isProcessStudent } from '@/config/access'
import { can } from '@/config/actions'
import type { ProcessDetailOut } from '@/services/processes.service'
import type { ActorTramite, RolTramite, TramiteTrazabilidad } from '@/services/trazabilidad.service'
import type { User } from '@/types'

// Regla 1 de docs/ROLES-DISENO.md: los permisos NO se deciden con el rol de la
// persona. En un trámite real todo sale del backend:
//   - my_process_roles  -> qué es la persona en ESE trámite (estudiante, tutor, evaluador);
//   - allowed_actions   -> qué puede hacer (manage_team, review_document, ...);
//   - available-transitions -> a qué estados puede moverlo.
// `actor.rol` solo etiqueta comentarios y reuniones (que se guardan en este navegador)
// y elige el escenario de los trámites de ejemplo (MOCK_TRAMITES).

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-CO')
}

function samePerson(person: { id: string; nombre: string }, actor: ActorTramite, isDemo: boolean) {
  return person.id === actor.id || (isDemo && (normalize(person.nombre).includes(normalize(actor.nombre)) || normalize(actor.nombre).includes(normalize(person.nombre))))
}

/** Escenario de la persona según su espacio de trabajo (módulos de GET /auth/me). Solo para mostrar. */
function rolFromModules(user: User | null): RolTramite {
  if (hasModule(user, 'workspace-coordination')) return 'Coordinador'
  if (hasModule(user, 'workspace-student')) return 'Estudiante'
  if (hasModule(user, 'workspace-tutor') || hasModule(user, 'tutor')) return 'Tutor'
  if (hasModule(user, 'workspace-committee')) return 'Comite'
  if (hasModule(user, 'workspace-external')) return 'Evaluador'
  return 'Consulta'
}

/** Rol de la persona en ESTE trámite real, a partir de lo que dice el backend. Solo para mostrar. */
export function rolInProcess(detail: ProcessDetailOut | null | undefined): RolTramite {
  if (can(detail, 'manage_team')) return 'Coordinador'
  if (hasProcessRole(detail, 'tutor')) return 'Tutor'
  if (isProcessStudent(detail)) return 'Estudiante'
  if (hasProcessRole(detail, 'evaluador')) return 'Evaluador'
  return 'Consulta'
}

export function actorFor(user: User | null, rol: RolTramite): ActorTramite {
  return { id: user?.id ?? 'anonymous', nombre: user?.name ?? 'Usuario', rol }
}

/** Permisos sobre un trámite REAL: todo sale del detalle que devuelve el backend. */
export function processPermissions(detail: ProcessDetailOut | null | undefined) {
  const isStudent = isProcessStudent(detail)
  const isTutor = hasProcessRole(detail, 'tutor')
  const managesTeam = can(detail, 'manage_team')
  return {
    isStudent,
    isTutor,
    managesTeam,
    canUpload: isStudent && can(detail, 'upload_document'),
    canReviewDocuments: can(detail, 'review_document'),
    // Gestión del expediente (reuniones, exportar historial): coordinación o el tutor del trámite.
    canManage: managesTeam || isTutor,
    canComment: managesTeam || isTutor || isStudent,
    canExport: managesTeam,
  }
}

/** Para el listado y los trámites de EJEMPLO (sin backend). */
export function usePermisos() {
  const user = useAppStore((state) => state.currentUser)
  const actor = useMemo<ActorTramite>(() => actorFor(user, rolFromModules(user)), [user])

  const canView = (tramite: TramiteTrazabilidad) => {
    if (actor.rol === 'Coordinador') return true
    if (actor.rol === 'Estudiante') return tramite.estudiantes.some((person) => samePerson(person, actor, Boolean(tramite.isDemo)))
    if (actor.rol === 'Tutor') return Boolean(tramite.tutor && samePerson(tramite.tutor, actor, Boolean(tramite.isDemo)))
    // El comité ve los trámites de ejemplo completos; un evaluador, solo donde es jurado.
    if (actor.rol === 'Comite') return true
    if (actor.rol === 'Evaluador') return tramite.jurados.some((person) => samePerson(person, actor, Boolean(tramite.isDemo)))
    return false
  }

  const canComment = (tramite: TramiteTrazabilidad) => canView(tramite) && ['Coordinador', 'Tutor', 'Estudiante'].includes(actor.rol)
  const canManage = (tramite: TramiteTrazabilidad) => canView(tramite) && (actor.rol === 'Coordinador' || (actor.rol === 'Tutor' && Boolean(tramite.tutor && samePerson(tramite.tutor, actor, Boolean(tramite.isDemo)))))

  return { actor, canView, canComment, canManage }
}
