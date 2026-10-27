import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui'
import { InstitutionalHeader } from './InstitutionalHeader'
import { InstitutionalFooter } from './InstitutionalFooter'
import { OpportunityCatalog } from './OpportunityCatalog'
import { modalityRouteSlug, projectModalities } from './projectCatalog.data'

export function ModalityOpportunitiesPage() {
  const { modalitySlug } = useParams<{ modalitySlug: string }>()
  const modality = projectModalities.find((item) => modalityRouteSlug(item.id) === modalitySlug)
  const currentYear = new Date().getFullYear()

  return (
    <div id="modality-page" className="projects-catalog min-h-screen bg-[#F4F6F8] text-[#172B3A]">
      <InstitutionalHeader />
      {modality ? <OpportunityCatalog modality={modality} /> : <main className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8"><h1 className="text-2xl font-bold text-[#073B57]">No encontramos esta modalidad</h1><p className="mt-2 text-sm text-[#526575]">Vuelve al catálogo para elegir una modalidad disponible.</p><Link to="/proyectos-de-grado" className="mt-6 inline-flex"><Button className="gap-2"><ArrowLeft size={16}/>Volver a las modalidades</Button></Link></main>}
      <InstitutionalFooter currentYear={currentYear} />
    </div>
  )
}
