import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2,
  ClipboardCheck, FileText, FlaskConical, Globe2, Microscope, Network,
  Presentation, Rocket, Route, Search, UsersRound, Wrench,
} from 'lucide-react'
import { Badge, Button, Card, Input } from '@/components/ui'
import { modalityRouteSlug, projectModalities, projectOffers } from './projectCatalog.data'
import { applicationsService } from '@/services/applications.service'
import type { ProjectModality, ProjectOffer } from './projectCatalog.data'
import { modalityGuidance } from './modalityGuidance.data'
import { OpportunityDetailDialog } from './OpportunityDetailDialog'

function OfferCapacityBadge({ offer }: { offer: ProjectOffer }) {
  const label = applicationsService.getCapacityLabel(offer)
  const quantity = label.match(/^(\d+)\s+(.+)$/)

  return (
    <span aria-label={`Capacidad y cupos: ${label}`} className="relative z-10 inline-flex max-w-[48%] shrink-0 items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-2.5 py-1.5 text-[10px] font-bold leading-tight text-[#073B57] shadow-sm sm:max-w-[52%]">
      <UsersRound size={14} className="shrink-0 text-[#F4511E]" aria-hidden="true" />
      <span className="text-center">{quantity ? <><strong className="text-[#F4511E]">{quantity[1]}</strong> {quantity[2]}</> : label}</span>
    </span>
  )
}

const modalityIcons = [
  Microscope, Rocket, Presentation, UsersRound, Network,
  FlaskConical, Wrench, BookOpenCheck, Globe2, Route,
] as const

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('es-CO').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function modalityOpportunitiesPath(modalityId: string): string {
  return `/proyectos-de-grado/modalidad/${modalityRouteSlug(modalityId)}`
}

export function ModalityCards() {
  const offersByModality = useMemo(
    () => projectOffers.reduce<Record<string, number>>((counts, offer) => {
      counts[offer.modalityId] = (counts[offer.modalityId] ?? 0) + 1
      return counts
    }, {}),
    [],
  )

  return (
    <section id="modalidades" className="scroll-mt-6 px-5 pb-10 pt-8 sm:px-8 sm:pb-12 sm:pt-10">
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-4xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-primary)]">Encuentra tu camino</p><h2 className="mt-2 text-3xl font-bold leading-tight text-[var(--color-secondary)] sm:text-4xl">Explora las modalidades de grado</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)] sm:text-base">Encuentra la alternativa que mejor se adapte a tus intereses, fortalezas y objetivos profesionales.</p></div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--engineering-navy)]/10 bg-white px-4 py-2 text-xs font-bold text-[var(--color-secondary)] shadow-sm"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#FF6B35]" />{projectModalities.length} modalidades</span>
        </div>
        <div className="grid gap-5 overflow-visible px-1 py-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {projectModalities.map((modality, index) => {
            const Icon = modalityIcons[index % modalityIcons.length]
            const count = offersByModality[modality.id] ?? 0
            return (
              <Card key={modality.id} className="group relative flex min-h-[24rem] flex-col overflow-visible rounded-[1.6rem] border border-[#F0D9CB] border-t-[3px] border-t-[#FF6B35] bg-white p-0 shadow-[0_8px_26px_rgba(7,59,87,0.09)] transition duration-300 ease-out hover:z-10 hover:scale-[1.025] hover:shadow-[0_18px_38px_rgba(7,59,87,0.16)] hover:ring-2 hover:ring-[#FF6B35]/40 hover:ring-offset-2 focus-within:z-10 focus-within:ring-2 focus-within:ring-[#FF6B35] motion-reduce:transform-none motion-reduce:transition-none">
                <div className={`modality-card-art modality-card-art--${index % 2 === 0 ? 'warm' : 'cool'} relative isolate flex h-48 shrink-0 items-center justify-center overflow-hidden rounded-t-[1.48rem] transition duration-300 group-hover:brightness-105 group-hover:saturate-125 motion-reduce:transition-none`}>
                  <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full border border-[#F4511E]/20 transition-transform duration-300 group-hover:translate-x-2 group-hover:-translate-y-1 motion-reduce:transform-none before:absolute before:inset-5 before:rounded-full before:border before:border-white/90 after:absolute after:inset-12 after:rounded-full after:bg-[#FF6B35]/15 before:transition-transform before:duration-300 group-hover:before:rotate-12 motion-reduce:before:transform-none" />
                  <div aria-hidden="true" className="pointer-events-none absolute bottom-4 left-5 right-5 h-px bg-gradient-to-r from-transparent via-[#F4511E]/25 to-transparent" />
                  <div aria-hidden="true" className="absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-white/90 shadow-[0_12px_30px_rgba(7,59,87,0.14)] transition duration-300 ease-out group-hover:-translate-y-[58%] group-hover:scale-110 motion-reduce:transform-none"><Icon size={72} strokeWidth={1.55} className={`drop-shadow-[0_3px_5px_rgba(7,59,87,0.12)] ${index % 2 === 0 ? 'text-[#F4511E]' : 'text-[#073B57]'}`} /><span aria-hidden="true" className="absolute bottom-5 right-5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#FF6B35] shadow-sm" /></div>
                  <span className="absolute bottom-4 right-5 rounded-full border border-[#F4511E]/15 bg-white/80 px-2.5 py-1 text-[10px] font-bold tracking-[.12em] text-[#073B57]">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="relative flex flex-1 flex-col rounded-b-[1.6rem] bg-white px-5 pb-5 pt-4 sm:px-6">
                  <div className="absolute -top-3 left-6 h-6 w-12 -skew-x-12 rounded-t-md bg-white" aria-hidden="true" />
                  <div className="relative z-[1] flex items-center justify-between gap-2"><span className="max-w-[70%] truncate text-[10px] font-semibold uppercase tracking-[.1em] text-[#60727F]">{modality.id}</span>{count > 0 ? <span className="shrink-0 rounded-full bg-[#FF6B35]/15 px-2.5 py-1 text-[10px] font-bold text-[#073B57]">{count} {count === 1 ? 'oportunidad' : 'oportunidades'}</span> : <span className="shrink-0 rounded-full bg-[#F4F6F8] px-2.5 py-1 text-[10px] font-bold text-[#526575]">Próximamente</span>}</div>
                  <h3 className="mt-3 text-xl font-bold leading-tight text-[#172B3A]">{modality.name}</h3>
                  {modality.description?.trim() && <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-[#526575]">{modality.description.trim()}</p>}
                  <Link to={modalityOpportunitiesPath(modality.id)} target="_blank" rel="noopener noreferrer" aria-label={`Explorar modalidad: ${modality.name}; se abre en una pestaña nueva`} className="mt-auto inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-[#FF6B35] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition duration-300 hover:bg-[#F4511E] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B35]">Explorar modalidad <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" /></Link>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const modalityDescriptions: Record<string, string> = {
  PROYECTO_INV: 'Explora propuestas de investigación, conoce sus objetivos y encuentra oportunidades para desarrollar tus habilidades analíticas y aportar a preguntas de interés académico.',
  PROYECTO_EMP: 'Conoce propuestas que conectan ideas, necesidades y modelos de negocio para explorar iniciativas de emprendimiento e innovación.',
  PROYECTO_CONS: 'Consulta proyectos orientados al análisis de retos organizacionales y a la formulación de recomendaciones para distintos servicios y procesos.',
  PROYECTO_SOC: 'Descubre propuestas que abordan necesidades comunitarias mediante iniciativas de intervención e innovación social.',
  SEMILLERO_INV: 'Explora proyectos vinculados con procesos de investigación y desarrollo de conocimiento en comunidad académica.',
  PASANTIA_INV: 'Consulta oportunidades para acercarte a experiencias de investigación y aplicar conocimientos en contextos académicos.',
  PROYECTO_APL: 'Conoce proyectos que proponen soluciones aplicadas a retos de procesos, servicios y transformación tecnológica.',
  CURSO_PROF: 'Explora alternativas de profundización para ampliar conocimientos en áreas relacionadas con tu formación.',
  INMERSION_INTL: 'Consulta oportunidades de inmersión y conexión con experiencias académicas en contextos internacionales.',
  COTERMINAL: 'Conoce oportunidades que articulan trayectorias de formación y permiten explorar una continuidad académica.',
}

interface OpportunityCatalogProps {
  modality: ProjectModality
}

export function OpportunityCatalog({ modality }: OpportunityCatalogProps) {
  const [search, setSearch] = useState('')
  const [selectedOffer, setSelectedOffer] = useState<ProjectOffer | null>(null)
  const guidance = modalityGuidance[modality.id]
  const offers = useMemo(
    () => projectOffers.filter((offer) => offer.modalityId === modality.id),
    [modality.id],
  )
  const filteredOffers = useMemo(() => {
    const query = normalizeSearch(search)
    if (!query) return offers
    return offers.filter((offer) => normalizeSearch([offer.title, offer.description, offer.objective, offer.area, ...offer.keywords].join(' ')).includes(query))
  }, [offers, search])

  return (
    <>
      <main id="modality-page-content" className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 2xl:max-w-screen-2xl">
        <Link to="/proyectos-de-grado" className="inline-flex items-center gap-2 text-sm font-semibold text-[#073B57] transition hover:text-[#F4511E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35]"><ArrowLeft size={16}/>Volver a las modalidades</Link>
        <header className="mt-8 flex flex-wrap items-end justify-between gap-5 rounded-3xl bg-gradient-to-br from-[#073B57] via-[#145B78] to-[#F4511E] p-6 text-white shadow-lg sm:p-9">
          <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-white/75">Modalidades de grado</p><h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{modality.name}</h1><p className="mt-4 text-sm leading-relaxed text-white/90 sm:text-base">{modalityDescriptions[modality.id] ?? 'Explora las oportunidades disponibles para esta modalidad de grado.'}</p></div>
          <div className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 backdrop-blur-sm"><span className="text-2xl font-bold">{offers.length}</span><span className="ml-2 text-sm font-semibold">{offers.length === 1 ? 'oportunidad disponible' : 'oportunidades disponibles'}</span></div>
        </header>

        <section aria-label={`Oportunidades de ${modality.name}`} className="mt-10">
          <div className="mb-5 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#F4511E]">Explora opciones</p><h2 className="mt-2 text-2xl font-bold text-[#073B57]">Oportunidades disponibles</h2><p className="mt-2 text-sm leading-relaxed text-[#526575]">Revisa las propuestas asociadas a esta modalidad y sus detalles antes de iniciar un proceso.</p></div>
          {offers.length > 0 ? <>
            <div className="relative max-w-2xl"><label htmlFor="modality-opportunity-search" className="mb-2 block text-sm font-semibold text-[#073B57]">Buscar oportunidades</label><div className="relative"><Search size={18} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#60727F]"/><Input id="modality-opportunity-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, área o palabra clave" className="min-h-12 pl-11 pr-4"/></div></div>
            {filteredOffers.length > 0 ? <div className="mt-6 grid auto-rows-fr gap-5 md:grid-cols-2 xl:grid-cols-3">{filteredOffers.map((offer) => <Card key={offer.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#DCE5E9] bg-white p-0 shadow-[0_8px_26px_rgba(7,59,87,0.08)] transition duration-300 hover:-translate-y-1 hover:border-[#FF6B35]/50 hover:shadow-[0_18px_38px_rgba(7,59,87,0.14)] motion-reduce:transform-none motion-reduce:transition-none"><div className="relative flex min-h-24 items-center gap-4 overflow-hidden bg-gradient-to-br from-[#073B57] via-[#145B78] to-[#F4511E] px-5 py-4 text-white"><div aria-hidden="true" className="absolute -right-5 -top-12 h-36 w-36 rounded-full border-[18px] border-white/10"/><span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#F4511E]"><CheckCircle2 size={24}/></span><div className="relative z-10 min-w-0 flex-1"><p className="text-xs font-semibold text-white/75">{offer.area}</p>{offer.status && <Badge variant="orange" className="mt-2">{offer.status}</Badge>}</div><OfferCapacityBadge offer={offer} /></div><div className="flex flex-1 flex-col p-5 sm:p-6"><h3 className="text-xl font-bold leading-snug text-[var(--color-secondary)]">{offer.title}</h3><p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">{offer.description}</p>{offer.objective && <p className="mt-3 rounded-xl bg-[#FFF5EF] p-3 text-sm leading-relaxed text-[#435A69]"><strong className="text-[#073B57]">Objetivo:</strong> {offer.objective}</p>}<div className="mt-auto pt-4"><div className="flex flex-wrap gap-1.5">{offer.keywords.map((keyword) => <span key={keyword} className="rounded-full bg-[#F4F6F8] px-2.5 py-1 text-[10px] font-semibold text-[#435A69]">{keyword}</span>)}</div><button type="button" onClick={() => setSelectedOffer(offer)} aria-label={`Ver detalles de ${offer.title}`} className="mt-5 inline-flex min-h-11 w-full items-center justify-between rounded-xl bg-[#FF6B35] px-4 py-2.5 text-left text-sm font-bold text-white transition hover:bg-[#F4511E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B35]">Ver detalles <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true"/></button></div></div></Card>)}</div> : <Card className="mt-6 flex flex-col items-center px-6 py-10 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0E8] text-[#F4511E]"><Search size={25}/></span><h3 className="mt-4 text-lg font-bold text-[#073B57]">No encontramos oportunidades con esos términos</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#526575]">Prueba con otras palabras o revisa nuevamente las oportunidades de esta modalidad.</p><Button type="button" variant="outline" className="mt-5 border-[#073B57]/25 text-[#073B57]" onClick={() => setSearch('')}>Limpiar búsqueda</Button></Card>}
          </> : <Card className="flex flex-col items-center px-6 py-10 text-center sm:py-12"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0E8] text-[#F4511E]"><Search size={25}/></span><h3 className="mt-4 text-xl font-bold text-[#073B57]">No hay oportunidades disponibles</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#526575]">En este momento no hay propuestas disponibles para esta modalidad. Puedes consultar los requisitos, conocer las características de esta opción y volver más adelante para revisar nuevas oportunidades.</p><Link to="/proyectos-de-grado" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF6B35] px-5 text-sm font-bold text-white transition hover:bg-[#F4511E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B35]">Volver a las modalidades <ArrowLeft size={16} aria-hidden="true"/></Link></Card>}
        </section>

        <section aria-labelledby="modality-requirements-title" className="mt-9 rounded-2xl border border-[#DCE5E9] bg-white p-5 shadow-[0_8px_24px_rgba(7,59,87,0.05)] sm:p-7">
          <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#F4511E]">Orientación para tu proyecto</p><h2 id="modality-requirements-title" className="mt-2 text-2xl font-bold text-[#073B57]">¿Qué necesitas para esta modalidad?</h2><p className="mt-2 text-sm leading-relaxed text-[#526575]">Revisa estos aspectos de preparación y confirma con tu programa académico las condiciones vigentes para la modalidad que elegiste.</p></div>
          <div className="mt-7 grid gap-8 lg:grid-cols-2 lg:gap-12">
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#073B57]"><ClipboardCheck size={19} className="text-[#F4511E]" aria-hidden="true"/>Requisitos para participar</h3>
              <p className="mt-1 text-xs font-medium text-[#60727F]">Aspectos que conviene revisar</p>
              <ul className="mt-4 space-y-3">{guidance.requirementsToReview.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#526575]"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#145B78]" aria-hidden="true"/>{item}</li>)}</ul>
            </section>
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#073B57]"><FileText size={19} className="text-[#F4511E]" aria-hidden="true"/>Documentos que debes preparar</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#60727F]">Lista orientativa. Los documentos y requisitos definitivos dependen de los lineamientos académicos aplicables.</p>
              <ul className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">{guidance.documentsToPrepare.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#526575]"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#F4511E]" aria-hidden="true"/>{item}</li>)}</ul>
            </section>
          </div>
        </section>

        <section className="mt-12 border-t border-[#DCE5E9] pb-4 pt-8" aria-labelledby="before-start-title">
          <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#F4511E]">Organiza tu siguiente paso</p><h2 id="before-start-title" className="mt-2 text-2xl font-bold text-[#073B57]">Antes de iniciar tu proceso</h2><p className="mt-2 text-sm leading-relaxed text-[#526575]">Revisa las condiciones de la modalidad elegida, confirma los requisitos de tu programa académico y prepara la documentación relacionada con la oportunidad que te interesa.</p></div>
          <ul className="mt-6 grid gap-5 md:grid-cols-3">
            <li className="flex items-start gap-3 border-l-2 border-[#FF6B35] pl-4"><ClipboardCheck size={20} className="mt-0.5 shrink-0 text-[#145B78]" aria-hidden="true"/><div><h3 className="text-sm font-bold text-[#073B57]">Consulta los requisitos</h3><p className="mt-1 text-sm leading-relaxed text-[#526575]">Revisa las condiciones específicas de la oportunidad antes de comenzar.</p></div></li>
            <li className="flex items-start gap-3 border-l-2 border-[#FF6B35] pl-4"><FileText size={20} className="mt-0.5 shrink-0 text-[#145B78]" aria-hidden="true"/><div><h3 className="text-sm font-bold text-[#073B57]">Prepara tus documentos</h3><p className="mt-1 text-sm leading-relaxed text-[#526575]">Organiza los soportes relacionados con la modalidad y las actividades previstas.</p></div></li>
            <li className="flex items-start gap-3 border-l-2 border-[#FF6B35] pl-4"><CalendarDays size={20} className="mt-0.5 shrink-0 text-[#145B78]" aria-hidden="true"/><div><h3 className="text-sm font-bold text-[#073B57]">Verifica las fechas</h3><p className="mt-1 text-sm leading-relaxed text-[#526575]">Consulta los plazos publicados para identificar los periodos de participación disponibles.</p></div></li>
          </ul>
        </section>
      </main>
      {selectedOffer && <OpportunityDetailDialog offer={selectedOffer} modality={modality} guidance={guidance} onClose={() => setSelectedOffer(null)} />}
    </>
  )
}
