import { useMemo } from 'react'
import { useAppStore } from '@/stores/app.store'
import type { ActorTramite, RolTramite, TramiteTrazabilidad } from '@/services/trazabilidad.service'

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CO')
}

function samePerson(person: { id: string; nombre: string }, actor: ActorTramite, isDemo: boolean) {
  return person.id === actor.id || (isDemo && (normalize(person.nombre).includes(normalize(actor.nombre)) || normalize(actor.nombre).includes(normalize(person.nombre))))
}

export function usePermisos() {
  const user = useAppStore((state) => state.currentUser)
  const actor = useMemo<ActorTramite>(() => {
    const role = user?.role ?? ''
    const rol: RolTramite = role === 'coordinador' || role === 'administrativo'
      ? 'Coordinador'
      : role === 'estudiante'
        ? 'Estudiante'
        : role === 'evaluador'
          ? 'Evaluador'
          : role.includes('comite') || role.includes('consejo')
            ? 'Comite'
            : role.startsWith('tutor_') || role === 'docente_curso' || role === 'coordinador_movilidad' || role === 'grupo_investigacion'
              ? 'Tutor'
              : 'Consulta'
    return { id: user?.id ?? 'anonymous', nombre: user?.name ?? 'Usuario', rol }
  }, [user])

  const canView = (tramite: TramiteTrazabilidad) => {
    if (actor.rol === 'Coordinador') return true
    if (actor.rol === 'Estudiante') return tramite.estudiantes.some((person) => samePerson(person, actor, Boolean(tramite.isDemo)))
    if (actor.rol === 'Tutor') return Boolean(tramite.tutor && samePerson(tramite.tutor, actor, Boolean(tramite.isDemo)))
    if (actor.rol === 'Comite' && user?.role === 'consejo_facultad') return true
    if (actor.rol === 'Evaluador' || actor.rol === 'Comite') return tramite.jurados.some((person) => samePerson(person, actor, Boolean(tramite.isDemo)))
    return false
  }

  const canComment = (tramite: TramiteTrazabilidad) => canView(tramite) && ['Coordinador', 'Tutor', 'Estudiante'].includes(actor.rol)
  const canManage = (tramite: TramiteTrazabilidad) => canView(tramite) && (actor.rol === 'Coordinador' || (actor.rol === 'Tutor' && Boolean(tramite.tutor && samePerson(tramite.tutor, actor, Boolean(tramite.isDemo)))))

  return { actor, canView, canComment, canManage }
}
