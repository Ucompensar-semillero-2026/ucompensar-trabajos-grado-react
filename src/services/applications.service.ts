import { getOfferCapacity, getOfferCapacityLabel } from '@/components/publico/projectCatalog.data'
import type { OfferCapacity, ProjectOffer } from '@/components/publico/projectCatalog.data'
import { modalitiesApi } from './modalities.service'
import { processesApi } from './processes.service'
import type { ProcessOut } from './processes.service'

export type ApplicationErrorCode = 'closed' | 'full' | 'modality_unavailable' | 'duplicate'

export class ApplicationError extends Error {
  constructor(readonly code: ApplicationErrorCode, message: string) {
    super(message)
    this.name = 'ApplicationError'
  }
}

export interface ApplicationResult {
  process: ProcessOut
}

// El modelo de trámites no tiene una columna para la oferta: se deja
// constancia de ella en `observations`, con un marcador estable que permite
// reconocer postulaciones previas a la misma oferta.
export function offerMarker(offer: ProjectOffer): string {
  return `[oferta:${offer.id}]`
}

export function buildApplicationObservations(offer: ProjectOffer): string {
  return `Postulación a la oferta «${offer.title}» ${offerMarker(offer)}`.slice(0, 500)
}

export function currentAcademicSemester(date: Date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() < 6 ? 1 : 2}`
}

export const applicationsService = {
  getCapacity(offer: ProjectOffer): OfferCapacity {
    return getOfferCapacity(offer)
  },

  getCapacityLabel(offer: ProjectOffer): string {
    const label = getOfferCapacityLabel(offer, this.getCapacity(offer))
    if (label === 'Cupos por confirmar') return 'Cupos demostrativos por confirmar'
    if (label === 'Cupos completos') return 'Cupos demostrativos completos'
    return `${label} · demostrativos`
  },

  isAtCapacity(offer: ProjectOffer): boolean {
    const capacity = this.getCapacity(offer)
    return capacity.kind === 'maximum'
      ? capacity.maxStudents === 0
      : capacity.kind === 'tracked' && capacity.availableSeats === 0
  },

  /**
   * Registra la postulación como un trámite real (POST /processes). El estudiante
   * lo fija el servidor a partir del token; aquí solo se envía modalidad, semestre
   * y la referencia a la oferta.
   */
  async apply(offer: ProjectOffer, accessToken: string, studentPublicId: string): Promise<ApplicationResult> {
    if (offer.status !== 'Disponible') {
      throw new ApplicationError('closed', 'Esta oportunidad no está disponible para postulaciones.')
    }
    if (this.isAtCapacity(offer)) {
      throw new ApplicationError('full', 'Esta oportunidad ya no tiene cupos disponibles.')
    }

    const modalities = await modalitiesApi.list(accessToken)
    const modality = modalities.find((item) => item.code === offer.modalityId)
    if (!modality) {
      throw new ApplicationError('modality_unavailable', 'La modalidad de esta oferta no está habilitada en el sistema.')
    }

    const marker = offerMarker(offer)
    const existing = (await processesApi.list(accessToken)).find(
      (process) => process.student.public_id === studentPublicId && process.observations?.includes(marker),
    )
    if (existing) {
      throw new ApplicationError('duplicate', `Ya te postulaste a esta oferta (trámite ${existing.process_code}).`)
    }

    const process = await processesApi.create(accessToken, {
      modality_public_id: modality.public_id,
      academic_semester: currentAcademicSemester(),
      observations: buildApplicationObservations(offer),
    })
    return { process }
  },
}
