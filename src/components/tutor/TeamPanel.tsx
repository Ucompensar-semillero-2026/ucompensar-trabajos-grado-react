import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { processesApi, type TeamMemberOut } from '@/services/processes.service'
import type { BackendUser } from '@/types/api'

const ROLE_LABEL: Record<string, string> = { estudiante: 'Estudiante', tutor: 'Tutor', evaluador: 'Evaluador' }
// Mismos roles que exige el backend para asignar (require_role en processes/router.py).
const ASSIGNER_ROLES = ['coordinador', 'administrativo']

/** Equipo del proceso. Coordinación y administración pueden asignar o retirar al tutor (acción explícita). */
export function TeamPanel({ processId }: { processId: string }) {
  const accessToken = useAppStore((s) => s.accessToken)
  const role = useAppStore((s) => s.currentUser?.role ?? '')
  const canAssign = ASSIGNER_ROLES.includes(role)
  const [team, setTeam] = useState<TeamMemberOut[]>([])
  const [candidates, setCandidates] = useState<BackendUser[]>([])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      setTeam(await processesApi.team(accessToken, processId))
      if (canAssign) setCandidates(await processesApi.teamCandidates(accessToken))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el equipo del proceso')
    }
  }, [accessToken, processId, canAssign])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (action: (token: string) => Promise<unknown>) => {
    if (!accessToken || busy) return
    setBusy(true)
    setError(null)
    try {
      await action(accessToken)
      setSelected('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
    } finally {
      setBusy(false)
    }
  }

  const tutors = team.filter((m) => m.process_role === 'tutor')
  const assignable = candidates.filter((c) => !tutors.some((t) => t.user.public_id === c.public_id))

  return (
    <section aria-labelledby="team-title" className="card p-4">
      <h2 id="team-title" className="text-[16px] font-bold text-[var(--color-text)]">Equipo del proceso</h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {team.map((m) => (
          <li key={m.public_id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span><strong>{ROLE_LABEL[m.process_role] ?? m.process_role}:</strong> {m.user.full_name}</span>
            {canAssign && m.process_role !== 'estudiante' && (
              <button type="button" disabled={busy} onClick={() => void act((t) => processesApi.removeTeamMember(t, processId, m.public_id))} className="text-[12px] font-semibold text-red-600 underline underline-offset-4">
                Retirar
              </button>
            )}
          </li>
        ))}
        {tutors.length === 0 && <li className="text-[13px] text-[var(--color-text-muted)]">Este proceso aún no tiene tutor asignado.</li>}
      </ul>
      {canAssign && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="tutor-candidate" className="sr-only">Docente a asignar como tutor</label>
          <select id="tutor-candidate" value={selected} onChange={(e) => setSelected(e.target.value)} className="min-w-[240px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)]">
            <option value="">Selecciona un docente…</option>
            {assignable.map((c) => (
              <option key={c.public_id} value={c.public_id}>{c.full_name}</option>
            ))}
          </select>
          <button type="button" disabled={!selected || busy} onClick={() => void act((t) => processesApi.addTeamMember(t, processId, selected, 'tutor'))} className="btn-primary px-4 py-2 text-[13px] font-bold disabled:opacity-50">
            Asignar como tutor
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[13px] font-medium text-red-700">{error}</p>}
    </section>
  )
}
