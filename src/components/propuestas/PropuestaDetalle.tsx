import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { LoadError } from '@/components/tutor/tutorUi'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { modalitiesApi } from '@/services/modalities.service'
import { processesApi, type TutorCandidate } from '@/services/processes.service'
import { MODALITY_LABELS, proposalsApi, type ConvertOut, type ProposalOut, type ReviewAction } from '@/services/proposals.service'
import { formatRelativeDate } from '@/utils/format'
import type { ModalityOut } from '@/types/api'
import { EVENT_LABELS, ProposalStatusBadge, inputClass } from './propuestasUi'

// Código de `modalities` que corresponde a cada modalidad sugerida (espejo de MODALITY_CODE_BY_SUGGESTION del backend).
const MODALITY_CODE: Record<string, string | null> = {
  semillero_investigacion: 'SEMILLERO_INV',
  proyecto_investigacion: 'PROYECTO_INV',
  emprendimiento: 'PROYECTO_EMP',
  desarrollo_tecnologico: 'PROYECTO_APL',
  por_definir: null,
}

const currentSemester = () => `${new Date().getFullYear()}-${new Date().getMonth() < 6 ? 1 : 2}`

export function PropuestaDetalle() {
  const { proposalId } = useParams<{ proposalId: string }>()
  const accessToken = useAppStore((s) => s.accessToken)
  const [proposal, setProposal] = useState<ProposalOut | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [comment, setComment] = useState('')
  const [pending, setPending] = useState<ReviewAction | null>(null)
  const [candidates, setCandidates] = useState<TutorCandidate[]>([])
  const [tutorId, setTutorId] = useState('')
  const [modalities, setModalities] = useState<ModalityOut[]>([])
  const [modalityId, setModalityId] = useState('')
  const [semester, setSemester] = useState(currentSemester())
  const [converted, setConverted] = useState<ConvertOut | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || !proposalId) return
    try {
      setProposal(await proposalsApi.get(accessToken, proposalId))
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la propuesta')
    }
  }, [accessToken, proposalId])

  useEffect(() => {
    void load()
  }, [load])

  // Candidatos y modalidades reales (API) solo cuando la propuesta está en la fase de tutor/conversión.
  const status = proposal?.status
  useEffect(() => {
    if (!accessToken || !proposal || !['aprobada', 'pendiente_tutor', 'tutor_asignado'].includes(proposal.status)) return
    processesApi.teamCandidates(accessToken).then(setCandidates).catch(() => setCandidates([]))
    modalitiesApi.list(accessToken).then(setModalities).catch(() => setModalities([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, status])

  useEffect(() => {
    if (proposal?.suggested_tutor) setTutorId((current) => current || proposal.suggested_tutor!.public_id)
  }, [proposal?.suggested_tutor])

  useEffect(() => {
    if (!proposal || modalityId) return
    const code = MODALITY_CODE[proposal.suggested_modality]
    const match = modalities.find((m) => m.code === code)
    if (match) setModalityId(match.public_id)
  }, [proposal, modalities, modalityId])

  if (loadError && !proposal) return <LoadError message={loadError} onRetry={() => void load()} />
  if (!proposal) return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando propuesta…</p>

  const act = async (action: (token: string) => Promise<ProposalOut | ConvertOut>) => {
    if (!accessToken || working.current) return
    working.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await action(accessToken)
      if ('process_public_id' in result && 'linked_members' in result) {
        setConverted(result)
        await load()
      } else {
        setProposal(result as ProposalOut)
      }
      setComment('')
      setPending(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción')
    } finally {
      working.current = false
      setBusy(false)
    }
  }

  const needsComment = pending === 'solicitar_informacion' || pending === 'rechazar'
  const run = (action: ReviewAction) => (action === 'solicitar_informacion' || action === 'rechazar' ? setPending(action) : void act((t) => proposalsApi.transition(t, proposal.public_id, action)))
  const canReview = ['pendiente_revision', 'en_evaluacion', 'requiere_informacion'].includes(proposal.status)
  const inTutorPhase = ['aprobada', 'pendiente_tutor', 'tutor_asignado'].includes(proposal.status)

  return (
    <div className="flex flex-col gap-5">
      <Link to="/coordinacion/propuestas" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0876B9] underline underline-offset-4"><ArrowLeft size={14} aria-hidden /> Volver a las propuestas</Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[24px] font-bold text-[var(--color-secondary)]">{proposal.title}</h2>
            <p className="text-[13px] text-[var(--color-text-muted)]">{proposal.code} · {MODALITY_LABELS[proposal.suggested_modality]} · de {proposal.author.full_name} · {formatRelativeDate(proposal.created_at)}</p>
          </div>
          <ProposalStatusBadge status={proposal.status} />
        </div>
        <div className="mt-4 grid gap-4 text-[14px] leading-relaxed">
          <div><h3 className="text-[15px] font-bold text-[var(--color-text)]">Problema o necesidad</h3><p className="whitespace-pre-line text-[var(--color-text-muted)]">{proposal.problem}</p></div>
          <div><h3 className="text-[15px] font-bold text-[var(--color-text)]">Solución y objetivos</h3><p className="whitespace-pre-line text-[var(--color-text-muted)]">{proposal.solution}</p></div>
          {proposal.expected_impact && <div><h3 className="text-[15px] font-bold text-[var(--color-text)]">Impacto esperado</h3><p className="whitespace-pre-line text-[var(--color-text-muted)]">{proposal.expected_impact}</p></div>}
        </div>
        <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
          <div><dt className="font-bold text-[var(--color-text-muted)]">Integrantes propuestos</dt>
            <dd>{proposal.members.length ? <ul>{proposal.members.map((m) => <li key={m.email}>{m.email} · {m.status === 'verificado' ? `verificado${m.full_name ? ` (${m.full_name})` : ''}` : 'sin confirmar'}</li>)}</ul> : 'Ninguno'}</dd></div>
          <div><dt className="font-bold text-[var(--color-text-muted)]">Docente sugerido</dt>
            <dd>{proposal.suggested_tutor_email ? `${proposal.suggested_tutor_email}${proposal.suggested_tutor ? ` · cuenta elegible: ${proposal.suggested_tutor.full_name}` : ' · sin cuenta elegible'}` : 'No propuso docente'}</dd></div>
          {proposal.assigned_tutor && <div><dt className="font-bold text-[var(--color-text-muted)]">Tutor confirmado</dt><dd>{proposal.assigned_tutor.full_name}</dd></div>}
          {proposal.decision_reason && <div><dt className="font-bold text-[var(--color-text-muted)]">Motivo de la decisión</dt><dd>{proposal.decision_reason}</dd></div>}
        </dl>
      </Card>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">{error}</p>}
      {converted && (
        <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Proceso <strong>{converted.process_code}</strong> creado. Integrantes vinculados: {converted.linked_members.length ? converted.linked_members.join(', ') : 'ninguno'}.
          {converted.unlinked_members.length > 0 && ` Sin vincular (no han confirmado su participación): ${converted.unlinked_members.join(', ')}.`}
        </p>
      )}

      {canReview && (
        <Card>
          <h3 className="mb-3 text-[18px] font-bold text-[var(--color-text)]">Evaluación</h3>
          <div className="flex flex-wrap gap-2">
            {proposal.status === 'pendiente_revision' && <Button type="button" size="sm" disabled={busy} onClick={() => run('iniciar_evaluacion')}>Iniciar evaluación</Button>}
            {proposal.status === 'en_evaluacion' && <Button type="button" size="sm" disabled={busy} onClick={() => run('aprobar')}>Aprobar</Button>}
            {proposal.status === 'en_evaluacion' && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run('solicitar_informacion')}>Solicitar información</Button>}
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run('rechazar')}>Rechazar</Button>
          </div>
          {needsComment && (
            <div className="mt-3 grid gap-2">
              <label className="text-[12px] font-semibold text-[var(--color-text-muted)]" htmlFor="decision-comment">
                {pending === 'rechazar' ? 'Motivo del rechazo (obligatorio)' : 'Observaciones para el autor (obligatorias)'}
              </label>
              <textarea id="decision-comment" rows={3} className={inputClass} value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={busy || !comment.trim()} onClick={() => void act((t) => proposalsApi.transition(t, proposal.public_id, pending as ReviewAction, comment))}>
                  {pending === 'rechazar' ? 'Confirmar rechazo' : 'Enviar solicitud'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setPending(null); setComment('') }}>Cancelar</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {inTutorPhase && (
        <Card>
          <h3 className="mb-1 text-[18px] font-bold text-[var(--color-text)]">{proposal.status === 'tutor_asignado' ? 'Cambiar tutor' : 'Confirmar tutor'}</h3>
          <p className="mb-3 text-[13px] text-[var(--color-text-muted)]">Solo cuentas existentes y elegibles. No se crean cuentas ni se asigna sin tu confirmación.</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="proposal-tutor">Docente</label>
            <select id="proposal-tutor" className={`${inputClass} max-w-sm`} value={tutorId} onChange={(e) => setTutorId(e.target.value)}>
              <option value="">Selecciona un docente…</option>
              {candidates.map((c) => <option key={c.public_id} value={c.public_id}>{c.full_name} · {c.active_projects} proyecto(s){c.public_id === proposal.suggested_tutor?.public_id ? ' · sugerido' : ''}</option>)}
            </select>
            <Button type="button" size="sm" disabled={busy || !tutorId} onClick={() => void act((t) => proposalsApi.assignTutor(t, proposal.public_id, tutorId))}>Confirmar tutor</Button>
          </div>
        </Card>
      )}

      {proposal.status === 'tutor_asignado' && (
        <Card>
          <h3 className="mb-1 text-[18px] font-bold text-[var(--color-text)]">Convertir en proceso de grado</h3>
          <p className="mb-3 text-[13px] text-[var(--color-text-muted)]">Crea el proceso oficial con el autor, el tutor y los integrantes verificados en una sola operación. Aprobar la propuesta no finaliza el proceso.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Modalidad oficial
              <select className={`${inputClass} min-w-[240px]`} value={modalityId} onChange={(e) => setModalityId(e.target.value)}>
                <option value="">Selecciona…</option>
                {modalities.map((m) => <option key={m.public_id} value={m.public_id}>{m.name}</option>)}
              </select>
            </label>
            <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Semestre académico
              <input className={`${inputClass} w-32`} value={semester} maxLength={10} onChange={(e) => setSemester(e.target.value)} />
            </label>
            <Button type="button" size="sm" disabled={busy || !modalityId || !semester.trim()} onClick={() => void act((t) => proposalsApi.convert(t, proposal.public_id, modalityId, semester.trim()))}>Convertir en proceso</Button>
          </div>
        </Card>
      )}

      {proposal.status === 'convertida' && proposal.process_public_id && (
        <p className="text-[13px]">Esta propuesta ya es un proceso: <Link to={`/coordinacion/proyectos/${proposal.process_public_id}`} className="font-bold text-[#0876B9] underline underline-offset-4">abrir el expediente del proyecto</Link>.</p>
      )}

      <Card>
        <h3 className="mb-3 text-[18px] font-bold text-[var(--color-text)]">Historial</h3>
        <ol className="flex flex-col gap-3">
          {[...proposal.events].reverse().map((e, i) => (
            <li key={i} className="border-l-2 border-[#0876B9] pl-3">
              <p className="text-[13px] font-semibold text-[var(--color-text)]">{EVENT_LABELS[e.event_type] ?? e.event_type}</p>
              {e.comment && <p className="whitespace-pre-line text-[12px] text-[var(--color-text-muted)]">{e.comment}</p>}
              <p className="text-[12px] text-[var(--color-text-muted)]">{e.actor.full_name} · {formatRelativeDate(e.created_at)}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
