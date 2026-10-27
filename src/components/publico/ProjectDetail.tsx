import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card } from '@/components/ui'
import { InstitutionalHeader } from './InstitutionalHeader'
import { OpportunityDetails } from './OpportunityDetails'
import { OpportunityDetailDialog } from './OpportunityDetailDialog'
import { applicationsService } from '@/services/applications.service'
import { modalityGuidance } from './modalityGuidance.data'
import { modalityRouteSlug, projectModalities, projectOffers } from './projectCatalog.data'

export function ProjectDetail() {
  const { offerId } = useParams<{ offerId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  // ?postular=1: se vuelve de Microsoft (ver applicationReturnPath) y se
  // retoma la postulación sin que el estudiante tenga que volver a pulsar.
  const [showApplicationFlow, setShowApplicationFlow] = useState(() => searchParams.get('postular') === '1')

  useEffect(() => {
    if (searchParams.has('postular')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])
  const offer = projectOffers.find((item) => item.id === offerId)
  const modality = projectModalities.find((item) => item.id === offer?.modalityId)
  const modalityPath = modality ? `/proyectos-de-grado/modalidad/${modalityRouteSlug(modality.id)}` : '/proyectos-de-grado'

  return (
    <div className="projects-catalog min-h-screen bg-[#F4F6F8] text-[#172B3A]">
      <InstitutionalHeader />
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <Link to={modalityPath} className="inline-flex items-center gap-2 text-sm font-semibold text-[#073B57] hover:text-[#F4511E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35]">
          <ArrowLeft size={16} /> Volver a oportunidades
        </Link>
        {offer && modality ? (
          <>
            <header className="mt-8 rounded-3xl bg-gradient-to-br from-[#073B57] via-[#145B78] to-[#F4511E] p-6 text-white shadow-lg sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="orange">{offer.status}</Badge><span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">{modality.name}</span></div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-white/75">{offer.area}</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{offer.title}</h1>
            </header>
            <div className="mt-6 rounded-2xl border border-[#DCE5E9] bg-white shadow-sm"><OpportunityDetails offer={offer} modality={modality} guidance={modalityGuidance[modality.id]} /></div>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
              <Link to={modalityPath}><Button variant="outline" className="border-[#073B57]/25 text-[#073B57]">Volver a oportunidades</Button></Link>
              {offer.status === 'Disponible' && (applicationsService.isAtCapacity(offer) ? <Button type="button" disabled className="min-h-11 bg-[#D8DEE2] text-[#526575]">Cupos completos</Button> : <Button type="button" className="min-h-11 bg-[#FF6B35] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#F4511E]" onClick={() => setShowApplicationFlow(true)}>Postularme <ArrowRight size={16} aria-hidden="true" /></Button>)}
            </div>
          </>
        ) : (
          <Card className="mt-8 p-8 text-center"><h1 className="text-2xl font-bold text-[#073B57]">No encontramos esta oportunidad</h1><p className="mt-2 text-sm text-slate-600">Puede que el enlace ya no esté disponible.</p><Link to="/proyectos-de-grado" className="mt-5 inline-flex"><Button>Volver a modalidades</Button></Link></Card>
        )}
      </main>
      {showApplicationFlow && offer && modality && <OpportunityDetailDialog offer={offer} modality={modality} guidance={modalityGuidance[modality.id]} autoApply onClose={() => setShowApplicationFlow(false)} />}
    </div>
  )
}
