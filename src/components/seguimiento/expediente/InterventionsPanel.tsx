import { Activity, Handshake, MessageSquarePlus, Video } from 'lucide-react'
import type { Expediente } from '@/services/monitoring.service'
import { CommitmentManager } from '../CommitmentManager'
import { formatMoment } from '../monitoringUi.utils'
import { KIND_LABEL } from '../intervention.utils'
import { DossierCard, EmptyNote } from './dossierUi'

interface InterventionsPanelProps {
  expediente: Expediente
  token: string
  canAct: boolean
  onRegister: () => void
  onChanged: () => void
}

/** Intervenciones docentes y los compromisos acordados en ellas (cambiar el estado de un compromiso es del tutor). */
export function InterventionsPanel({ expediente, token, canAct, onRegister, onChanged }: InterventionsPanelProps) {
  return (
    <div className="space-y-4">
      <DossierCard
        title="Historial de intervenciones"
        Icon={Activity}
        titleId="exp-interventions-title"
        action={canAct ? (
          <button type="button" onClick={onRegister} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#062B4F] px-3 text-[12.5px] font-bold text-white transition-all hover:-translate-y-px hover:bg-[#031C34] hover:shadow-md">
            <MessageSquarePlus size={14} aria-hidden="true" />Nueva intervención
          </button>
        ) : undefined}
      >
        {expediente.interventions.length === 0 ? <EmptyNote>Todavía no hay intervenciones registradas.</EmptyNote> : (
          <ol className="space-y-3">
            {expediente.interventions.map((i) => (
              <li key={i.id} className="rounded-2xl border-2 border-[#1565C0]/20 bg-[#F2F6FC] p-4 text-[13px] dark:bg-white/5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-extrabold text-[var(--color-secondary)]">{KIND_LABEL[i.kind]} · {i.mode === 'virtual' ? 'Virtual' : 'Presencial'}</p>
                  {!i.student_name && <span className="rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white">Intervención grupal</span>}
                </div>
                <p className="text-[12px] text-[var(--color-text-muted)]">{formatMoment(i.occurred_at)} · Registró {i.created_by}</p>
                {i.meeting_url && (
                  <a href={i.meeting_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#1565C0] underline dark:text-sky-300">
                    <Video size={13} aria-hidden="true" />Enlace de la reunión
                  </a>
                )}
                {i.observations && <p className="mt-1.5">{i.observations}</p>}
                {i.difficulties && <p className="mt-1 text-[var(--color-text-muted)]"><strong>Dificultades:</strong> {i.difficulties}</p>}
              </li>
            ))}
          </ol>
        )}
      </DossierCard>
      <DossierCard title="Compromisos" Icon={Handshake} titleId="exp-commitments-title">
        <CommitmentManager commitments={expediente.commitments} token={token} onChanged={canAct ? onChanged : undefined} />
      </DossierCard>
    </div>
  )
}
