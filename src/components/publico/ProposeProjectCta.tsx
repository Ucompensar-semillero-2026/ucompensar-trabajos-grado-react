import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Lightbulb, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { lockScroll } from '@/utils/scrollLock'
import type { SuggestedModality } from '@/services/proposals.service'
import { clearPendingSubmit, IdeaProposalSection, readPendingSubmit } from './IdeaProposalSection'
import type { ProjectModality } from './projectCatalog.data'

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

function ProposeProjectDialog({ modality, suggested, returnPath, onClose }: { modality: ProjectModality; suggested: SuggestedModality; returnPath: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const page = document.querySelector<HTMLElement>('.projects-catalog')
    const unlockScroll = lockScroll()
    page?.setAttribute('inert', '')
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      page?.removeAttribute('inert')
      unlockScroll()
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )).filter((element) => element.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061F2D]/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="idea-title" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:max-h-[90vh] sm:rounded-3xl">
        <header className="relative flex shrink-0 items-start justify-between gap-5 overflow-hidden bg-gradient-to-r from-[#073B57] via-[#145B78] to-[#F4511E] px-5 py-5 text-white sm:px-8 sm:py-6">
          <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-20 h-52 w-52 rounded-full border-[18px] border-white/10" />
          <div className="relative z-10 min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-white/80"><Lightbulb size={15} aria-hidden="true" /> {modality.name}</p>
            <h2 id="idea-title" className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">Propón tu proyecto de grado</h2>
          </div>
          <button ref={closeRef} type="button" aria-label="Cerrar formulario de propuesta" onClick={onClose} className="relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-8">
          <IdeaProposalSection modality={suggested} returnPath={returnPath} onDone={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Bloque «Proponer mi proyecto» de la página de una modalidad habilitada; abre el formulario como modal sobre ella. */
export function ProposeProjectCta({ modality }: { modality: ProjectModality }) {
  const { pathname } = useLocation()
  const suggested = suggestedModalityFor(modality.id)
  // Al volver de Microsoft con un envío en curso para esta página, el modal se reabre con el borrador restaurado.
  const [open, setOpen] = useState(() => readPendingSubmit()?.returnPath === pathname)
  if (!suggested) return null

  const close = () => {
    clearPendingSubmit() // cerrar el modal cancela cualquier envío que estuviera esperando a Microsoft
    setOpen(false)
  }

  return (
    <>
      <section aria-labelledby="propose-project-title" className="relative isolate mt-10 overflow-hidden rounded-3xl border border-[#145B78]/30 bg-[radial-gradient(ellipse_at_88%_18%,rgba(255,107,53,0.24),transparent_34%),linear-gradient(110deg,#073B57_0%,#0B4865_58%,#124D64_100%)] px-6 py-8 text-white shadow-[0_18px_42px_rgba(7,59,87,0.16)] sm:px-9 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-12">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="relative z-10 max-w-3xl">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[#FF9A68]"><Lightbulb size={15} aria-hidden="true" /> ¿Tienes tu propia idea?</p>
          <h2 id="propose-project-title" className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">Propón tu proyecto en esta modalidad</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">Comparte tu idea, sola o con compañeros, para que Coordinación la evalúe y te oriente sobre cómo desarrollarla.</p>
        </div>
        <Button type="button" size="lg" onClick={() => setOpen(true)} className="relative z-10 mt-6 min-h-12 shrink-0 gap-2 bg-[#FF6B35] px-6 text-sm font-bold text-white hover:bg-[#F4511E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:mt-0">
          <Lightbulb size={17} aria-hidden="true" /> Proponer mi proyecto
        </Button>
      </section>
      {open && <ProposeProjectDialog modality={modality} suggested={suggested} returnPath={pathname} onClose={close} />}
    </>
  )
}
