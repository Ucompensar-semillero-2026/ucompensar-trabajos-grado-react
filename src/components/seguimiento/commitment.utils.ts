// Funciones y constantes de CommitmentManager.tsx que no son componentes (fast refresh de Vite).
import { type CommitmentStatus } from '@/services/monitoring.service'


export const COMMITMENT_LABEL: Record<CommitmentStatus, string> = {
  pendiente: 'Pendiente', en_seguimiento: 'En seguimiento', cumplido: 'Cumplido', incumplido: 'Incumplido', cancelado: 'Cancelado',
}
