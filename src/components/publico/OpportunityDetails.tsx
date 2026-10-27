import { CalendarDays, CheckCircle2, Tag, UsersRound } from 'lucide-react'
import { applicationsService } from '@/services/applications.service'
import type { ProjectModality, ProjectOffer } from './projectCatalog.data'
import type { ModalityGuidance } from './modalityGuidance.data'

interface OpportunityDetailsProps {
  offer: ProjectOffer
  modality: ProjectModality
  guidance: ModalityGuidance
}

function formatDate(value?: string): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(date)
}

function DetailList({ title, items, suggested = false }: { title: string; items: string[]; suggested?: boolean }) {
  if (items.length === 0) return null
  return (
    <section>
      <h3 className="font-bold text-[#073B57]">{title}</h3>
      {suggested && <p className="mt-1 text-xs leading-relaxed text-[#60727F]">Son referencias para preparar el proceso; confirma las condiciones vigentes con tu programa académico.</p>}
      <ul className="mt-3 space-y-2">
        {items.map((item) => <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-[#526575]"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#F4511E]" aria-hidden="true" />{item}</li>)}
      </ul>
    </section>
  )
}

export function OpportunityDetails({ offer, modality, guidance }: OpportunityDetailsProps) {
  const openDate = formatDate(offer.openDate)
  const closeDate = formatDate(offer.closeDate)
  const hasAdditionalInfo = offer.workMode || openDate || closeDate || offer.contact
  const documentsToPrepare = guidance.documentsToPrepare
  const capacity = applicationsService.getCapacity(offer)
  const occupancyPercent = capacity.kind === 'tracked'
    ? Math.round((capacity.occupiedSeats / capacity.maxStudents) * 100)
    : undefined

  return (
    <div className="space-y-7 p-5 sm:p-7">
      <section>
        <h2 className="text-lg font-bold text-[#073B57]">Presentación</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#526575]">{offer.description}</p>
        {offer.problem && <div className="mt-5"><h3 className="font-bold text-[#073B57]">Problema o necesidad</h3><p className="mt-1 text-sm leading-relaxed text-[#526575]">{offer.problem}</p></div>}
        {offer.objective && <div className="mt-5"><h3 className="font-bold text-[#073B57]">Objetivo general</h3><p className="mt-1 text-sm leading-relaxed text-[#526575]">{offer.objective}</p></div>}
        {offer.scope && <div className="mt-5"><h3 className="font-bold text-[#073B57]">Alcance</h3><p className="mt-1 text-sm leading-relaxed text-[#526575]">{offer.scope}</p></div>}
        {offer.expectedProducts?.length ? <DetailList title="Actividades o resultados esperados" items={offer.expectedProducts} /> : null}
      </section>

      {(offer.audience || offer.recommendedKnowledge?.length || offer.skills?.length) && <section className="border-t border-[#E5E9EC] pt-6">
        <h2 className="text-lg font-bold text-[#073B57]">Perfil académico relacionado</h2>
        {offer.audience && <p className="mt-2 text-sm leading-relaxed text-[#526575]">{offer.audience}</p>}
        {offer.recommendedKnowledge?.length ? <DetailList title="Conocimientos relacionados" items={offer.recommendedKnowledge} /> : null}
        {offer.skills?.length ? <div className="mt-5"><DetailList title="Habilidades por desarrollar" items={offer.skills} /></div> : null}
      </section>}

      <section className="border-t border-[#E5E9EC] pt-6">
        <h2 className="text-lg font-bold text-[#073B57]">Requisitos para participar</h2>
        <p className="mt-1 text-xs leading-relaxed text-[#60727F]">Revisa estos aspectos generales con tu programa académico. Las condiciones definitivas dependen de los lineamientos aplicables a la modalidad.</p>
        <div className="mt-4"><DetailList title="Aspectos que conviene revisar" items={guidance.requirementsToReview} /></div>
        {offer.requirements?.length ? <div className="mt-5"><DetailList title="Requisitos específicos de la oportunidad" items={offer.requirements} /></div> : null}
      </section>

      {Boolean(offer.requiredDocuments?.length || documentsToPrepare.length) && <section className="border-t border-[#E5E9EC] pt-6">
        {offer.requiredDocuments?.length ? <DetailList title="Documentos requeridos para esta oportunidad" items={offer.requiredDocuments} /> : null}
        <div className={offer.requiredDocuments?.length ? 'mt-5' : ''}><DetailList title="Documentos para preparar" items={documentsToPrepare} suggested /></div>
      </section>}

      <section className="border-t border-[#E5E9EC] pt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#073B57]"><UsersRound size={19} className="text-[#F4511E]" aria-hidden="true"/>Disponibilidad de cupos</h2>
        {capacity.kind === 'tracked' ? <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#F4F6F8] p-4"><p className="text-xs font-semibold text-[#60727F]">Capacidad máxima</p><p className="mt-1 text-xl font-extrabold text-[#073B57]">{capacity.maxStudents} <span className="text-sm font-semibold">{capacity.maxStudents === 1 ? 'estudiante' : 'estudiantes'}</span></p></div>
          <div className="rounded-xl bg-[#F4F6F8] p-4"><p className="text-xs font-semibold text-[#60727F]">Cupos demostrativos ocupados</p><p className="mt-1 text-xl font-extrabold text-[#073B57]">{capacity.occupiedSeats}</p></div>
          <div className="rounded-xl bg-[#FFF1E8] p-4"><p className="text-xs font-semibold text-[#8D3719]">Cupos demostrativos disponibles</p><p className="mt-1 text-xl font-extrabold text-[#F4511E]">{capacity.availableSeats} <span className="text-sm font-semibold">{capacity.availableSeats === 1 ? 'cupo' : 'cupos'}</span></p>{capacity.availableSeats === 0 && <p className="mt-1 text-xs font-bold text-[#8D3719]">Cupos demostrativos completos</p>}</div>
        </div> : capacity.kind === 'maximum' ? <div className="mt-4"><p className="text-sm font-semibold text-[#073B57]">Capacidad máxima demostrativa: {capacity.maxStudents} {capacity.maxStudents === 1 ? 'estudiante' : 'estudiantes'}</p>{capacity.maxStudents === 0 && <p className="mt-1 text-sm font-bold text-[#F4511E]">Cupos demostrativos completos</p>}</div> : <p className="mt-3 text-sm font-semibold text-[#526575]">Cupos demostrativos por confirmar</p>}
        {capacity.kind === 'tracked' && occupancyPercent !== undefined && <div className="mt-4"><div className="mb-1 flex items-center justify-between text-xs text-[#60727F]"><span>Ocupación del proyecto</span><span>{occupancyPercent}%</span></div><div role="progressbar" aria-label="Ocupación del proyecto" aria-valuemin={0} aria-valuemax={capacity.maxStudents} aria-valuenow={capacity.occupiedSeats} className="h-2.5 overflow-hidden rounded-full bg-[#E8EDF0]"><div className="h-full rounded-full bg-gradient-to-r from-[#FF6B35] to-[#F4511E] transition-[width]" style={{ width: `${occupancyPercent}%` }} /></div></div>}
        {capacity.minStudents !== undefined && <p className="mt-3 text-sm text-[#526575]"><strong className="text-[#073B57]">Tamaño mínimo del equipo:</strong> {capacity.minStudents} {capacity.minStudents === 1 ? 'estudiante' : 'estudiantes'}</p>}
      </section>

      {(hasAdditionalInfo || offer.keywords.length > 0) && <section className="border-t border-[#E5E9EC] pt-6">
        {hasAdditionalInfo && <><h2 className="text-lg font-bold text-[#073B57]">Información adicional</h2><div className="mt-3 space-y-2 text-sm leading-relaxed text-[#526575]">{offer.workMode && <p><strong className="text-[#073B57]">Modalidad de trabajo:</strong> {offer.workMode}</p>}{(openDate || closeDate) && <p className="flex items-start gap-2"><CalendarDays size={17} className="mt-0.5 shrink-0 text-[#F4511E]" aria-hidden="true"/><span>{openDate && <>Apertura: {openDate}</>}{openDate && closeDate && ' · '}{closeDate && <>Cierre: {closeDate}</>}</span></p>}{offer.contact && <p><strong className="text-[#073B57]">Contacto:</strong> {offer.contact}</p>}</div></>}
        {offer.keywords.length > 0 && <div className={hasAdditionalInfo ? 'mt-5' : ''}><h3 className="flex items-center gap-2 text-sm font-bold text-[#073B57]"><Tag size={16} className="text-[#F4511E]" aria-hidden="true"/>Temas relacionados</h3><div className="mt-3 flex flex-wrap gap-2">{offer.keywords.map((keyword) => <span key={keyword} className="rounded-full bg-[#F4F6F8] px-3 py-1.5 text-xs font-semibold text-[#435A69]">{keyword}</span>)}</div></div>}
        <p className="sr-only">Modalidad: {modality.name}</p>
      </section>}
    </div>
  )
}
