import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lightbulb, MailCheck } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui'
import { LoadError } from '@/components/tutor/tutorUi'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import {
  MODALITY_LABELS,
  PROPOSAL_LIMITS,
  proposalsApi,
  type InvitationOut,
  type ProposalListItem,
  type ProposalOut,
  type SuggestedModality,
} from '@/services/proposals.service'
import { formatRelativeDate } from '@/utils/format'
import { EVENT_LABELS, ProposalStatusBadge, inputClass } from './propuestasUi'

function ProposalDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [detail, setDetail] = useState<ProposalOut | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', modality: 'por_definir' as SuggestedModality, problem: '', solution: '', impact: '', tutor: '', comment: '' })
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      const data = await proposalsApi.get(accessToken, id)
      setDetail(data)
      setForm({ title: data.title, modality: data.suggested_modality, problem: data.problem, solution: data.solution, impact: data.expected_impact ?? '', tutor: data.suggested_tutor_email ?? '', comment: '' })
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la propuesta')
    }
  }, [accessToken, id])

  useEffect(() => {
    void load()
  }, [load])

  if (error && !detail) return <LoadError message={error} onRetry={() => void load()} />
  if (!detail) return <p className="text-[13px] text-[var(--color-text-muted)]">Cargando…</p>

  const submit = async () => {
    if (!accessToken || sending.current) return
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      setDetail(
        await proposalsApi.update(accessToken, id, {
          title: form.title,
          suggested_modality: form.modality,
          problem: form.problem,
          solution: form.solution,
          expected_impact: form.impact.trim() || null,
          suggested_tutor_email: form.tutor.trim() || null,
          comment: form.comment.trim() || null,
        })
      )
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la actualización')
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  const feedback = detail.events.filter((e) => e.comment && ['solicitar_informacion', 'rechazar', 'aprobar'].includes(e.event_type))

  return (
    <div className="mt-3 flex flex-col gap-4 border-t border-[var(--color-border)] pt-4">
      {detail.status === 'rechazada' && detail.decision_reason && (
        <p role="status" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800"><strong>Motivo del rechazo:</strong> {detail.decision_reason}</p>
      )}
      {feedback.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Observaciones de Coordinación">
          {feedback.map((e, i) => (
            <li key={i} className="rounded-xl bg-[var(--color-bg)] px-4 py-3 text-[13px]">
              <p className="font-semibold text-[var(--color-text)]">{EVENT_LABELS[e.event_type]} · <span className="font-normal text-[var(--color-text-muted)]">{e.actor.full_name}, {formatRelativeDate(e.created_at)}</span></p>
              <p className="mt-0.5 whitespace-pre-line text-[var(--color-text-muted)]">{e.comment}</p>
            </li>
          ))}
        </ul>
      )}
      <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
        <div><dt className="font-bold text-[var(--color-text-muted)]">Integrantes propuestos</dt><dd>{detail.members.length ? detail.members.map((m) => `${m.email} (${m.status})`).join(', ') : 'Ninguno'}</dd></div>
        <div><dt className="font-bold text-[var(--color-text-muted)]">Tutor</dt><dd>{detail.assigned_tutor?.full_name ?? (detail.suggested_tutor_email ? `Sugerido: ${detail.suggested_tutor_email} (pendiente de confirmación)` : 'Lo asignará Coordinación')}</dd></div>
      </dl>
      {detail.process_public_id && (
        <p className="text-[13px]">Tu propuesta ya es un proceso de grado: <Link to="/mi-proceso" className="font-bold text-[#0876B9] underline underline-offset-4">ver Mi proceso de grado</Link>.</p>
      )}

      {detail.can_edit && (
        <form className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <h4 className="text-[16px] font-bold text-[var(--color-text)]">{detail.status === 'requiere_informacion' ? 'Responder y actualizar la propuesta' : 'Editar la propuesta'}</h4>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Título<input className={inputClass} value={form.title} maxLength={PROPOSAL_LIMITS.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Modalidad sugerida
            <select className={inputClass} value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value as SuggestedModality })}>
              {(Object.keys(MODALITY_LABELS) as SuggestedModality[]).map((k) => <option key={k} value={k}>{MODALITY_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Problema o necesidad<textarea rows={3} className={inputClass} value={form.problem} maxLength={PROPOSAL_LIMITS.text} onChange={(e) => setForm({ ...form, problem: e.target.value })} /></label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Solución y objetivos<textarea rows={3} className={inputClass} value={form.solution} maxLength={PROPOSAL_LIMITS.text} onChange={(e) => setForm({ ...form, solution: e.target.value })} /></label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Impacto esperado<textarea rows={2} className={inputClass} value={form.impact} maxLength={PROPOSAL_LIMITS.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} /></label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Correo del docente propuesto<input type="email" className={inputClass} value={form.tutor} onChange={(e) => setForm({ ...form, tutor: e.target.value })} /></label>
          <label className="text-[12px] font-semibold text-[var(--color-text-muted)]">Mensaje para Coordinación (opcional)<textarea rows={2} className={inputClass} value={form.comment} maxLength={1000} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={busy}>{busy ? 'Enviando…' : 'Enviar actualización'}</Button>
            {error && <p role="alert" className="text-[13px] font-medium text-red-700">{error}</p>}
          </div>
        </form>
      )}
    </div>
  )
}

export function MisPropuestas() {
  const accessToken = useAppStore((s) => s.accessToken)
  const [items, setItems] = useState<ProposalListItem[] | null>(null)
  const [invitations, setInvitations] = useState<InvitationOut[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      const [mine, invited] = await Promise.all([proposalsApi.mine(accessToken), proposalsApi.invitations(accessToken)])
      setItems(mine)
      setInvitations(invited)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus propuestas')
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  const confirm = async (id: string) => {
    if (!accessToken || confirming) return
    setConfirming(id)
    try {
      await proposalsApi.confirmMembership(accessToken, id)
      setNotice('Confirmaste tu participación en la propuesta.')
      await load()
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'No se pudo confirmar tu participación')
    } finally {
      setConfirming(null)
    }
  }

  if (error && !items) return <LoadError message={error} onRetry={() => void load()} />
  if (!items) return <p className="px-2 py-8 text-[13px] text-[var(--color-text-muted)]">Cargando tus propuestas…</p>

  const pendingInvitations = invitations.filter((i) => i.member_status === 'propuesto')

  return (
    <div className="flex flex-col gap-5">
      {notice && <p role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] font-medium text-[var(--color-text)]">{notice}</p>}

      {pendingInvitations.length > 0 && (
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-[18px] font-bold text-[var(--color-text)]"><MailCheck size={18} aria-hidden /> Invitaciones a propuestas</h2>
          <ul className="divide-y divide-[var(--color-border)]">
            {pendingInvitations.map((i) => (
              <li key={i.proposal_public_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--color-text)]">{i.title}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{i.code} · propuesta de {i.author.full_name}</p>
                </div>
                <Button type="button" size="sm" disabled={confirming !== null} onClick={() => void confirm(i.proposal_public_id)}>Confirmar mi participación</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[18px] font-bold text-[var(--color-text)]">Mis propuestas</h2>
          <Link to="/proyectos-de-grado#modalidades" className="text-[13px] font-bold text-[#0876B9] underline underline-offset-4">Presentar una idea</Link>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={Lightbulb} title="Aún no has presentado propuestas" description="Si tienes una idea para tu proyecto de grado, preséntala en el catálogo y Coordinación la evaluará." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((p) => (
              <li key={p.public_id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-[18px] font-bold text-[var(--color-secondary)]">{p.title}</p>
                    <p className="text-[12px] text-[var(--color-text-muted)]">{p.code} · {MODALITY_LABELS[p.suggested_modality]} · enviada {formatRelativeDate(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProposalStatusBadge status={p.status} />
                    <button type="button" aria-expanded={openId === p.public_id} onClick={() => setOpenId(openId === p.public_id ? null : p.public_id)} className="text-[13px] font-semibold text-[#0876B9] underline underline-offset-4">
                      {openId === p.public_id ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  </div>
                </div>
                {openId === p.public_id && <ProposalDetail id={p.public_id} onChanged={() => void load()} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
