import { useState } from 'react'
import { ApiError } from '@/services/http'
import { monitoringApi, type CommitmentOut, type CommitmentStatus } from '@/services/monitoring.service'
import { formatDay } from './monitoringUi'

export const COMMITMENT_LABEL: Record<CommitmentStatus, string> = {
  pendiente: 'Pendiente', en_seguimiento: 'En seguimiento', cumplido: 'Cumplido', incumplido: 'Incumplido', cancelado: 'Cancelado',
}

interface Props {
  commitments: CommitmentOut[]
  token?: string | null
  /** Sin `onChanged` la lista es de solo lectura (estudiante, Coordinación). */
  onChanged?: () => void
}

/** Compromisos académicos. Un compromiso vencido es un indicador APARTE: no cuenta como tarea vencida. */
export function CommitmentManager({ commitments, token, onChanged }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const change = async (id: string, status: CommitmentStatus) => {
    if (!token || busy) return
    setBusy(id)
    setError(null)
    try {
      await monitoringApi.updateCommitment(token, id, status)
      onChanged?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el compromiso.')
    } finally {
      setBusy(null)
    }
  }

  if (commitments.length === 0) return <p className="text-[13px] text-[var(--color-text-muted)]">Sin compromisos registrados.</p>
  return (
    <div>
      {error && <p role="alert" className="mb-2 text-[12.5px] font-medium text-red-700">{error}</p>}
      <ul className="space-y-2">
        {commitments.map((c) => (
          <li key={c.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px]">
            <p className="font-semibold text-[var(--color-secondary)]">{c.description}</p>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
              Responsable: {c.student_name} · Fecha de cumplimiento: {formatDay(c.due_date)} · Estado: <strong>{COMMITMENT_LABEL[c.status]}</strong>
              {c.is_overdue && <strong className="ml-1 text-red-800">· Vencido sin cumplir</strong>}
            </p>
            {onChanged && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label htmlFor={`commitment-${c.id}`} className="sr-only">Estado del compromiso</label>
                <select id={`commitment-${c.id}`} aria-label={`Estado de: ${c.description}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[12.5px]" value={c.status} disabled={busy === c.id} onChange={(e) => void change(c.id, e.target.value as CommitmentStatus)}>
                  {(Object.keys(COMMITMENT_LABEL) as CommitmentStatus[]).map((s) => <option key={s} value={s}>{COMMITMENT_LABEL[s]}</option>)}
                </select>
                {busy === c.id && <span className="text-[12px]">Guardando…</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
