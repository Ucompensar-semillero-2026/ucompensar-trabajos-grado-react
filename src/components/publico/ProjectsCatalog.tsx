import { useEffect, useRef } from 'react'
import {
  ArrowDown, BookOpenCheck, CircleHelp, LogIn, UsersRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { resetScrollToTop } from '@/utils/scrollLock'
import { PublicFlashNotice } from './PublicFlashNotice'
import { InstitutionalHeader } from './InstitutionalHeader'
import { HeroTechOverlay } from './HeroTechOverlay'
import { ModalityCards } from './OpportunityCatalog'
import { AcademicCalendar } from './calendar/AcademicCalendar'
import { InstitutionalFooter } from './InstitutionalFooter'
import { academicGuidanceResources } from './projectPlanning.data'
import campusPhoto from '@/assets/images/ucompensar-campus.jpg'

const guidanceIcons = [BookOpenCheck, UsersRound, CircleHelp] as const

function scrollToSection(id: string) {
  const section = document.getElementById(id)
  if (!section) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

export function ProjectsCatalog() {
  const currentYear = new Date().getFullYear()
  const navigate = useNavigate()
  const heroRef = useRef<HTMLElement>(null)

  // Al volver al catálogo (p. ej. desde la confirmación de una postulación) se parte siempre del inicio.
  useEffect(() => {
    resetScrollToTop()
  }, [])

  useEffect(() => {
    const hero = heroRef.current
    const modalities = document.getElementById('modalidades')
    if (!hero || !modalities) return

    let accumulatedDelta = 0
    let transitioning = false
    let accumulationTimer: number | undefined
    let transitionTimer: number | undefined

    const handleBoundaryWheel = (event: WheelEvent) => {
      if (transitioning || event.deltaY === 0) return

      const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1)
      const isMovingDownFromHero = event.currentTarget === hero && delta > 0
      const modalitiesStyle = window.getComputedStyle(modalities)
      const scrollMarginTop = Number.parseFloat(modalitiesStyle.scrollMarginTop) || 0
      const modalitiesStart = modalities.getBoundingClientRect().top + window.scrollY - scrollMarginTop
      const isMovingUpFromModalitiesStart = event.currentTarget === modalities
        && delta < 0
        && Math.abs(window.scrollY - modalitiesStart) <= 120

      if (!isMovingDownFromHero && !isMovingUpFromModalitiesStart) {
        accumulatedDelta = 0
        if (accumulationTimer !== undefined) window.clearTimeout(accumulationTimer)
        return
      }

      if (Math.sign(accumulatedDelta) !== Math.sign(delta)) accumulatedDelta = 0
      accumulatedDelta += delta
      if (accumulationTimer !== undefined) window.clearTimeout(accumulationTimer)
      accumulationTimer = window.setTimeout(() => { accumulatedDelta = 0 }, 140)
      if (Math.abs(accumulatedDelta) < 28) return

      const destination = isMovingDownFromHero ? modalities : hero
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      accumulatedDelta = 0
      if (accumulationTimer !== undefined) window.clearTimeout(accumulationTimer)
      transitioning = true
      event.preventDefault()
      destination.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
      transitionTimer = window.setTimeout(() => { transitioning = false }, reduceMotion ? 150 : 800)
    }

    hero.addEventListener('wheel', handleBoundaryWheel, { passive: false })
    modalities.addEventListener('wheel', handleBoundaryWheel, { passive: false })
    return () => {
      hero.removeEventListener('wheel', handleBoundaryWheel)
      modalities.removeEventListener('wheel', handleBoundaryWheel)
      if (accumulationTimer !== undefined) window.clearTimeout(accumulationTimer)
      if (transitionTimer !== undefined) window.clearTimeout(transitionTimer)
    }
  }, [])

  const scrollToModalities = () => scrollToSection('modalidades')

  return (
    <div className="projects-catalog min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <InstitutionalHeader />
      <PublicFlashNotice />
      <main>
        <section ref={heroRef} className="overflow-hidden bg-[var(--engineering-navy)] text-white">
          <div className="relative">
            <div className="engineering-hero-panel relative z-10 px-5 py-12 text-white sm:px-8 sm:py-16 md:absolute md:inset-y-0 md:left-0 md:flex md:w-[72%] md:items-center md:py-8 lg:pl-16 xl:w-[68%] xl:py-16">
              <div className="mx-auto w-full max-w-3xl">
                <p className="hero-reveal hero-reveal--label inline-flex rounded-full border border-white/90 bg-transparent px-4 py-2 text-[11px] font-bold uppercase tracking-[.2em] text-white">Oportunidades académicas</p>
                <span aria-hidden="true" className="hero-reveal hero-reveal--title mt-7 block h-1 w-16 rounded-full bg-[var(--engineering-teal)]" />
                <h1 className="engineering-hero-title hero-reveal hero-reveal--title mt-5 max-w-3xl font-display font-bold leading-[1.04] tracking-tight text-white">Encuentra el proyecto de grado que te llevará más lejos</h1>
                <p className="hero-reveal hero-reveal--description mt-7 max-w-2xl text-lg leading-8 text-white/90 sm:text-xl sm:leading-9">Explora las alternativas para desarrollar tu proyecto de grado, encuentra oportunidades que se ajusten a tus intereses y descubre el camino para culminar tu formación profesional.</p>
                <div className="hero-reveal hero-reveal--actions mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button size="lg" className="min-h-14 gap-2 px-7 text-[15px] text-[var(--engineering-navy)] transition-transform hover:-translate-y-0.5 hover:text-[var(--engineering-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={scrollToModalities}>Explorar modalidades <ArrowDown size={17} /></Button>
                </div>
              </div>
            </div>
            <HeroTechOverlay />
            <img src={campusPhoto} alt="Sede de UCompensar al anochecer, con su edificio y entorno urbano" className="block h-auto w-full" />
            <div className="relative z-20 mx-5 mb-6 flex flex-col gap-3 sm:mx-8 lg:absolute lg:right-6 lg:top-6 lg:mx-0 lg:mb-0 lg:w-[min(27%,24rem)] xl:right-8 xl:top-8">
              <aside aria-labelledby="catalog-login-title" className="rounded-2xl border border-white/20 bg-[#073B57]/95 p-5 text-white shadow-[0_16px_40px_rgba(0,0,0,0.24)] backdrop-blur-md sm:p-6 lg:p-5">
              <h2 id="catalog-login-title" className="text-lg font-bold leading-snug text-white sm:text-xl">¿Ya te postulaste a una oferta de proyecto de grado?</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/85">Consulta el estado de tu postulación, conoce los avances y realiza seguimiento a tu proceso académico desde el Portal de Trabajos de Grado.</p>
              <Button type="button" size="md" className="mt-4 min-h-11 w-full gap-2 bg-[#FF6B35] px-5 text-sm font-bold text-white hover:bg-[#F4511E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => navigate('/login')}><LogIn size={17} aria-hidden="true" />Ingresar al portal</Button>
            </aside>
            </div>
          </div>
        </section>

        <ModalityCards />

        <AcademicCalendar />

        <section className="px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl">
            <div className="rounded-3xl border border-[#DCE5E9] bg-gradient-to-br from-[#F2F7F9] via-white to-[#FFF4EC] p-6 sm:p-9"><div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#F4511E]">Orientación académica</p><h2 className="mt-2 text-3xl font-bold text-[#073B57] sm:text-4xl">¿Necesitas orientación para elegir tu modalidad?</h2><p className="mt-3 text-sm leading-relaxed text-[#435A69] sm:text-base">Consulta los lineamientos de tu programa académico y las orientaciones institucionales para conocer las condiciones, los requisitos y los pasos que corresponden a tu proceso de grado.</p></div><div className="mt-7 grid gap-4 md:grid-cols-3">{academicGuidanceResources.map(({ title, description }, index) => { const Icon = guidanceIcons[index]; return <article key={title} className="rounded-2xl border border-white bg-white/85 p-5 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1E8] text-[#F4511E]"><Icon size={21}/></span><h3 className="mt-4 font-bold text-[#073B57]">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[#526575]">{description}</p></article>})}</div></div>
          </div>
        </section>
      </main>

      <InstitutionalFooter currentYear={currentYear} />
    </div>
  )
}
