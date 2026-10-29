import { Badge } from '@/components/ui'
import { STATUS_LABELS, type ProposalStatus } from '@/services/proposals.service'

const VARIANT: Record<ProposalStatus, 'gray' | 'blue' | 'orange' | 'red' | 'green'> = {
  pendiente_revision: 'gray',
  en_evaluacion: 'blue',
  requiere_informacion: 'orange',
  aprobada: 'green',
  pendiente_tutor: 'orange',
  tutor_asignado: 'green',
  rechazada: 'red',
  convertida: 'green',
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
}

export const EVENT_LABELS: Record<string, string> = {
  propuesta_enviada: 'Propuesta enviada',
  iniciar_evaluacion: 'Evaluación iniciada',
  solicitar_informacion: 'Información solicitada al autor',
  aprobar: 'Propuesta aprobada',
  rechazar: 'Propuesta rechazada',
  actualizada_por_autor: 'Actualizada por el autor',
  participacion_confirmada: 'Participación confirmada',
  tutor_asignado: 'Tutor asignado',
  convertida_en_proceso: 'Convertida en proceso',
}

export const inputClass =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]'
