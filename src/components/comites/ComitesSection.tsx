import { useEffect, useState } from 'react'
import { Card, Button, Badge , EmptyState} from '@/components/ui'
import { Select } from '@/components/ui/Input'
import { Gavel, Users, Vote, Lock } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import {
  committeesApi,
  type CommitteeOut,
  type CommitteeMemberOut,
  type CommitteeSessionOut,
  type ProcessSessionVoteOut,
  type VoteResult,
} from '@/services/committees.service'
import { processesApi, type ProcessOut } from '@/services/processes.service'

const VOTE_RESULTS: { value: VoteResult; label: string }[] = [
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'APLAZADO', label: 'Aplazado' },
  { value: 'EN_RECONSIDERACION', label: 'En reconsideración' },
]

export function ComitesSection() {
  const accessToken = useAppStore((s) => s.accessToken)

  const [committees, setCommittees] = useState<CommitteeOut[]>([])
  const [selected, setSelected] = useState<CommitteeOut | null>(null)
  const [members, setMembers] = useState<CommitteeMemberOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // No existe un endpoint para listar sesiones históricas de un comité
  // (GET /committees/{id}/sessions no existe en el backend) -- solo se
  // puede trabajar con la sesión recién creada en esta misma visita.
  const [activeSession, setActiveSession] = useState<CommitteeSessionOut | null>(null)
  const [votes, setVotes] = useState<ProcessSessionVoteOut[]>([])
  const [processes, setProcesses] = useState<ProcessOut[]>([])

  const [sessionForm, setSessionForm] = useState({
    minutesNumber: '',
    sessionDate: '',
    presidentId: '',
    secretaryId: '',
    quorumReached: true,
  })
  const [voteForm, setVoteForm] = useState({
    processId: '',
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    result: 'APROBADO' as VoteResult,
    observations: '',
  })
  const [isSubmittingSession, setIsSubmittingSession] = useState(false)
  const [isSubmittingVote, setIsSubmittingVote] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    setIsLoading(true)
    committeesApi
      .list(accessToken)
      .then(setCommittees)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los comités'))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  function selectCommittee(committee: CommitteeOut) {
    if (!accessToken) return
    setSelected(committee)
    setActiveSession(null)
    setVotes([])
    setActionError(null)
    committeesApi
      .listMembers(accessToken, committee.public_id)
      .then(setMembers)
      .catch(() => setMembers([]))
  }

  async function handleCreateSession() {
    if (!accessToken || !selected) return
    if (!sessionForm.minutesNumber.trim() || !sessionForm.sessionDate || !sessionForm.presidentId || !sessionForm.secretaryId) {
      setActionError('Completa acta, fecha, presidente y secretario.')
      return
    }
    setIsSubmittingSession(true)
    setActionError(null)
    try {
      const session = await committeesApi.createSession(accessToken, selected.public_id, {
        minutes_number: sessionForm.minutesNumber.trim(),
        session_date: sessionForm.sessionDate,
        president_public_id: sessionForm.presidentId,
        secretary_public_id: sessionForm.secretaryId,
        quorum_reached: sessionForm.quorumReached,
      })
      setActiveSession(session)
      const procs = await processesApi.list(accessToken)
      setProcesses(procs)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo crear la sesión')
    } finally {
      setIsSubmittingSession(false)
    }
  }

  async function handleRegisterVote() {
    if (!accessToken || !activeSession || !voteForm.processId) {
      setActionError('Selecciona un trámite para registrar el voto.')
      return
    }
    setIsSubmittingVote(true)
    setActionError(null)
    try {
      await committeesApi.registerVote(accessToken, activeSession.public_id, {
        process_public_id: voteForm.processId,
        votes_for: voteForm.votesFor,
        votes_against: voteForm.votesAgainst,
        votes_abstain: voteForm.votesAbstain,
        result: voteForm.result,
        observations: voteForm.observations.trim() || undefined,
      })
      const updated = await committeesApi.listVotes(accessToken, activeSession.public_id)
      setVotes(updated)
      setVoteForm({ processId: '', votesFor: 0, votesAgainst: 0, votesAbstain: 0, result: 'APROBADO', observations: '' })
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo registrar el voto')
    } finally {
      setIsSubmittingVote(false)
    }
  }

  async function handleCloseSession() {
    if (!accessToken || !activeSession) return
    setActionError(null)
    try {
      const closed = await committeesApi.closeSession(accessToken, activeSession.public_id)
      setActiveSession(closed)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo cerrar la sesión')
    }
  }

  if (error) {
    return <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
  }

  return (
    <div className="animate-in grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* Lista de comités */}
      <Card className="p-0 overflow-hidden h-fit">
        <div className="px-4 py-3.5 border-b border-[var(--color-border)] flex items-center gap-2">
          <Gavel size={16} className="text-[var(--color-primary)]" />
          <h2 className="text-[18px] font-bold tracking-tight text-[var(--color-text)]">Comités</h2>
        </div>
        {isLoading ? (
          <p className="px-4 py-6 text-[12px] text-[var(--color-text-dim)]">Cargando…</p>
        ) : committees.length === 0 ? (
          <EmptyState icon={Gavel} title="Aún no hay comités" description="Cuando se registre un comité, aparecerá aquí con sus sesiones." />
        ) : (
          <div className="p-2 flex flex-col gap-1">
            {committees.map((c) => (
              <button
                key={c.public_id}
                onClick={() => selectCommittee(c)}
                className={`text-left px-3 py-2.5 rounded-lg cursor-pointer border-none transition-all ${
                  selected?.public_id === c.public_id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                }`}
              >
                <div className="text-[12.5px] font-bold">{c.name}</div>
                <div className={`text-[10.5px] ${selected?.public_id === c.public_id ? 'text-white/70' : 'text-[var(--color-text-dim)]'}`}>
                  Quórum mínimo: {c.minimum_quorum}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Detalle del comité seleccionado */}
      <div className="flex flex-col gap-4">
        {!selected ? (
          <Card>
            <p className="text-[12.5px] text-[var(--color-text-dim)]">
              Selecciona un comité de la lista para ver sus miembros y gestionar sesiones.
            </p>
          </Card>
        ) : (
          <>
            {actionError && (
              <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{actionError}</p>
            )}

            {/* Miembros */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Users size={15} className="text-[var(--color-text-dim)]" />
                <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                  Miembros de {selected.name}
                </h3>
              </div>
              {members.length === 0 ? (
                <p className="text-[12px] text-[var(--color-text-dim)]">Sin miembros registrados.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {members.map((m) => (
                    <div key={m.public_id} className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg)] rounded-lg">
                      <span className="text-[12.5px] font-medium text-[var(--color-text)]">{m.user.full_name}</span>
                      <Badge variant="blue">{m.committee_role}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Sesión activa o formulario para crear una */}
            {!activeSession ? (
              <Card>
                <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
                  Iniciar nueva sesión
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">N.° de acta</label>
                    <input
                      value={sessionForm.minutesNumber}
                      onChange={(e) => setSessionForm((f) => ({ ...f, minutesNumber: e.target.value }))}
                      placeholder="ej. ACTA-2026-014"
                      className="field-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Fecha</label>
                    <input
                      type="date"
                      value={sessionForm.sessionDate}
                      onChange={(e) => setSessionForm((f) => ({ ...f, sessionDate: e.target.value }))}
                      className="field-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Presidente</label>
                    <Select
                      value={sessionForm.presidentId}
                      onChange={(e) => setSessionForm((f) => ({ ...f, presidentId: e.target.value }))}
                      className="w-full"
                    >
                      <option value="">Selecciona…</option>
                      {members.map((m) => (
                        <option key={m.public_id} value={m.user.public_id}>{m.user.full_name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Secretario</label>
                    <Select
                      value={sessionForm.secretaryId}
                      onChange={(e) => setSessionForm((f) => ({ ...f, secretaryId: e.target.value }))}
                      className="w-full"
                    >
                      <option value="">Selecciona…</option>
                      {members.map((m) => (
                        <option key={m.public_id} value={m.user.public_id}>{m.user.full_name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-4 text-[12px] text-[var(--color-text)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sessionForm.quorumReached}
                    onChange={(e) => setSessionForm((f) => ({ ...f, quorumReached: e.target.checked }))}
                  />
                  Se alcanzó el quórum mínimo
                </label>
                <Button className="font-bold" onClick={handleCreateSession} disabled={isSubmittingSession}>
                  {isSubmittingSession ? 'Creando…' : 'Iniciar sesión'}
                </Button>
              </Card>
            ) : (
              <>
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-[16px] font-bold text-[var(--color-text)]">Sesión {activeSession.minutes_number}</h3>
                      <p className="text-[11.5px] text-[var(--color-text-dim)]">
                        {activeSession.session_date} · Presidente: {activeSession.president.full_name} · Secretario: {activeSession.secretary.full_name}
                      </p>
                    </div>
                    {activeSession.closed ? (
                      <Badge variant="gray"><Lock size={10} className="inline mr-1" />Cerrada</Badge>
                    ) : (
                      <Button variant="outline" size="sm" className="font-bold" onClick={handleCloseSession}>
                        Cerrar sesión
                      </Button>
                    )}
                  </div>

                  {!activeSession.closed && (
                    <div className="pt-4 border-t border-[var(--color-border)]">
                      <h4 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                        Registrar voto sobre un trámite
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="sm:col-span-2">
                          <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Trámite</label>
                          <Select
                            value={voteForm.processId}
                            onChange={(e) => setVoteForm((f) => ({ ...f, processId: e.target.value }))}
                            className="w-full"
                          >
                            <option value="">Selecciona un trámite…</option>
                            {processes.map((p) => (
                              <option key={p.public_id} value={p.public_id}>
                                {p.process_code} — {p.student.full_name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Resultado</label>
                          <Select
                            value={voteForm.result}
                            onChange={(e) => setVoteForm((f) => ({ ...f, result: e.target.value as VoteResult }))}
                            className="w-full"
                          >
                            {VOTE_RESULTS.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">A favor</label>
                            <input type="number" min={0} value={voteForm.votesFor}
                              onChange={(e) => setVoteForm((f) => ({ ...f, votesFor: Number(e.target.value) }))}
                              className="field-input w-full" />
                          </div>
                          <div>
                            <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">En contra</label>
                            <input type="number" min={0} value={voteForm.votesAgainst}
                              onChange={(e) => setVoteForm((f) => ({ ...f, votesAgainst: Number(e.target.value) }))}
                              className="field-input w-full" />
                          </div>
                          <div>
                            <label className="text-[9.5px] font-bold text-neutral-muted uppercase tracking-wide block mb-1">Abstención</label>
                            <input type="number" min={0} value={voteForm.votesAbstain}
                              onChange={(e) => setVoteForm((f) => ({ ...f, votesAbstain: Number(e.target.value) }))}
                              className="field-input w-full" />
                          </div>
                        </div>
                      </div>
                      <Button size="sm" className="font-bold" onClick={handleRegisterVote} disabled={isSubmittingVote}>
                        <Vote size={13} /> {isSubmittingVote ? 'Registrando…' : 'Registrar voto'}
                      </Button>
                    </div>
                  )}
                </Card>

                {votes.length > 0 && (
                  <Card>
                    <h4 className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                      Votos registrados en esta sesión
                    </h4>
                    <div className="flex flex-col gap-2">
                      {votes.map((v) => (
                        <div key={v.public_id} className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-bg)] rounded-lg">
                          <span className="text-[12.5px] font-bold text-[var(--color-text)]">{v.process_code}</span>
                          <span className="text-[11px] text-[var(--color-text-dim)]">
                            {v.votes_for} a favor · {v.votes_against} en contra · {v.votes_abstain} abstención
                          </span>
                          <Badge variant={v.result === 'APROBADO' ? 'green' : v.result === 'RECHAZADO' ? 'red' : 'orange'}>
                            {v.result}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
