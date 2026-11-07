// Funciones y constantes de ProposeProjectCta.tsx que no son componentes (fast refresh de Vite).
import type { SuggestedModality } from '@/services/proposals.service'


/**
 * Modalidades en las que se puede proponer un proyecto, con la modalidad sugerida que entiende el backend.
 * "Proyecto aplicado" corresponde al valor `desarrollo_tecnologico` de la API. Las demás modalidades no la habilitan.
 */
export const PROPOSAL_ENABLED_MODALITIES: Record<string, SuggestedModality> = {
  PROYECTO_INV: 'proyecto_investigacion',
  SEMILLERO_INV: 'semillero_investigacion',
  PROYECTO_EMP: 'emprendimiento',
  PROYECTO_APL: 'desarrollo_tecnologico',
}

export const suggestedModalityFor = (modalityId: string): SuggestedModality | null => PROPOSAL_ENABLED_MODALITIES[modalityId] ?? null
