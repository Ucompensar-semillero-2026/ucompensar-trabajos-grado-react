import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { processesApi, type EligibleMembersOut, type TeamMemberOut, type TeamRole } from '@/services/processes.service'

// Nombre de respaldo si el backend no envía `role_label`.
const FALLBACK_LABEL: Record<string, string> = { estudiante: 'Estudiante', tutor: 'Tutor', evaluador: 'Evaluador' }
// Roles que coordinación asigna y retira (el estudiante lo pone el sistema al radicar).
const MANAGED_ROLES: readonly TeamRole[] = ['tutor', 'evaluador']
const isManaged = (role: string): role is TeamRole => (MANAGED_ROLES as readonly string[]).includes(role)

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date)
}

interface TeamPanelProps {
  processId: string
  /** allowed_actions del trámite incluye manage_team (lo decide el backend). */
  canManage: boolean
}

/**
 * Equipo del trámite (docs/ROLES-DISENO.md, contrato 6.1). Todos los que ven el
 * trámite ven quién lo integra; quien tiene `manage_team` además asigna y retira
 * tutor y evaluadores con las personas que el backend dice que son elegibles.
 */
export function TeamPanel({ processId, canManage }: TeamPanelProps) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [team, setTeam] = useState<TeamMemberOut[]>([])
  const [eligible, setEligible] = useState<Partial<Record<TeamRole, EligibleMembersOut>>>({})
  const [selected, setSelected] = useState<Partial<Record<TeamRole, string>>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setTeam(await processesApi.team(accessToken, processId))
      if (canManage) {
        const [tutor, evaluador] = await Promise.all(MANAGED_ROLES.map((role) => processesApi.eligibleMembers(accessToken, processId, role)))
        setEligible({ tutor, evaluador })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el equipo del trámite')
    }
  }, [accessToken, processId, canManage])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (action: (token: string) => Promise<unknown>) => {
    if (!accessToken || busy) return
    setBusy(true)
    setError(null)
    try {
      await action(accessToken)
      setSelected({})
      await load()
    } catch (err) {
      // Los 422 traen un mensaje claro del backend (p. ej. "El evaluador debe tener el rol institucional docente o externo").
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
    } finally {
      setBusy(false)
    }
  }

  const labelOf = (m: TeamMemberOut) => m.role_label ?? FALLBACK_LABEL[m.process_role] ?? m.process_role
  const tutors = team.filter((m) => m.process_role === 'tutor')

  return (
    <section aria-labelledby="team-title" className="card p-4">
      <h2 id="team-title" className="text-[16px] font-bold text-[var(--color-text)]">Equipo del trámite</h2>
      <ul className="mt-2 flex flex-col gap-1.5" aria-label="Integrantes">
        {team.map((m) => (
          <li key={m.public_id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span>
              <strong>{labelOf(m)}:</strong> {m.user.full_name}
              {m.assigned_by && (
                <span className="ml-2 text-[12px] text-[var(--color-text-muted)]">
                  asignado por {m.assigned_by.full_name} el {formatDate(m.assigned_at)}
                </span>
              )}
            </span>
            {canManage && isManaged(m.process_role) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act((t) => processesApi.removeTeamMember(t, processId, m.public_id))}
                className="text-[12px] font-semibold text-red-600 underline underline-offset-4"
                aria-label={`Retirar a ${m.user.full_name} (${labelOf(m)})`}
              >
                Retirar
              </button>
            )}
          </li>
        ))}
        {tutors.length === 0 && <li className="text-[13px] text-[var(--color-text-muted)]">Este trámite aún no tiene tutor asignado.</li>}
      </ul>

      {canManage &&
        MANAGED_ROLES.map((role) => {
          const info = eligible[role]
          if (!info) return null
          const isTutor = role === 'tutor'
          const full = info.max_count > 0 && info.assigned_count >= info.max_count
          // El tutor se cambia (no se suma); un evaluador solo entra si hay cupo.
          const blocked = !isTutor && full
          const fieldId = `assign-${role}`
          return (
            <div key={role} className="mt-4 border-t border-[var(--color-border)] pt-3">
              <p className="text-[13px] font-semibold text-[var(--color-text)]">
                {info.role_label}{' '}
                <span className="font-normal text-[var(--color-text-muted)]" data-testid={`quota-${role}`}>
                  ({info.assigned_count} de {info.max_count})
                </span>
              </p>
              {info.max_count === 0 ? (
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Esta modalidad no usa {info.role_label.toLowerCase()}.</p>
              ) : blocked ? (
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]" role="status">
                  Cupo lleno: retira a uno para asignar otro.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label htmlFor={fieldId} className="sr-only">{`Persona para ${info.role_label.toLowerCase()}`}</label>
                  <select
                    id={fieldId}
                    value={selected[role] ?? ''}
                    onChange={(e) => setSelected((s) => ({ ...s, [role]: e.target.value }))}
                    className="min-w-[240px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)]"
                  >
                    <option value="">Selecciona una persona…</option>
                    {info.users.map((u) => (
                      <option key={u.public_id} value={u.public_id}>{u.full_name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selected[role] || busy}
                    onClick={() => {
                      const userId = selected[role]!
                      void act((t) =>
                        isTutor && full
                          ? processesApi.changeTutor(t, processId, userId)
                          : processesApi.addTeamMember(t, processId, userId, role),
                      )
                    }}
                    className="btn-primary px-4 py-2 text-[13px] font-bold disabled:opacity-50"
                  >
                    {isTutor && full ? `Cambiar ${info.role_label.toLowerCase()}` : `Asignar como ${info.role_label.toLowerCase()}`}
                  </button>
                  {info.users.length === 0 && (
                    <span className="text-[12px] text-[var(--color-text-muted)]">No hay personas elegibles en este momento.</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      {error && <p role="alert" className="mt-3 text-[13px] font-medium text-red-700">{error}</p>}
    </section>
  )
}
