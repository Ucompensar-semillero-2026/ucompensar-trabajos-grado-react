// Funciones y constantes de TeacherInterventionModal.tsx que no son componentes (fast refresh de Vite).
import { type InterventionKind } from '@/services/monitoring.service'


export const KIND_LABEL: Record<InterventionKind, string> = {
  reunion_teams: 'Reunión por Teams', reunion_presencial: 'Reunión presencial', retroalimentacion_individual: 'Retroalimentación individual',
  retroalimentacion_grupal: 'Retroalimentación grupal', llamado_atencion: 'Llamado de atención académico', compromiso_entrega: 'Compromiso de entrega',
  seguimiento_extraordinario: 'Seguimiento extraordinario', otro: 'Otro',
}

/** `YYYY-MM-DDTHH:mm` en hora de Bogotá → ISO con desfase explícito. */
export function toBogotaIso(local: string): string {
  return `${local}:00-05:00`
}

export function validateIntervention(form: InterventionForm): string | null {
  if (!form.occurred) return 'Indica la fecha y hora de la intervención.'
  if (form.url.trim() && !/^https?:\/\//i.test(form.url.trim())) return 'El enlace de la reunión debe comenzar por https://'
  if (form.kind === 'reunion_teams' && form.mode !== 'virtual') return 'Una reunión por Teams es virtual.'
  if (!form.observations.trim() && form.commitments.length === 0) return 'Registra observaciones o al menos un compromiso.'
  for (const [i, c] of form.commitments.entries()) {
    if (c.description.trim().length < 5) return `Describe el compromiso ${i + 1} (mínimo 5 caracteres).`
    if (!c.due) return `Indica la fecha de cumplimiento del compromiso ${i + 1}.`
  }
  return null
}

export interface InterventionForm {
  kind: InterventionKind
  mode: 'presencial' | 'virtual'
  occurred: string
  url: string
  observations: string
  difficulties: string
  taskIds: string[]
  commitments: CommitmentDraft[]
}

export interface CommitmentDraft { description: string; due: string; taskIds: string[] }
