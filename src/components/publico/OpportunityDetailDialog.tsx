import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, X } from 'lucide-react'
import { lockScroll, resetScrollToTop } from '@/utils/scrollLock'
import { Badge, Button } from '@/components/ui'
import { Logo } from '@/components/ui/Logo'
import { SSOForm } from '@/components/auth/SSOForm'
import { useAuthFlow } from '@/components/auth/AuthFlowContext'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'
import { ApiError } from '@/services/http'
import type { PublicFlash } from '@/services/sessionFlash'
import { ApplicationError, applicationsService } from '@/services/applications.service'
import type { ApplicationResult } from '@/services/applications.service'
import type { ProjectModality, ProjectOffer } from './projectCatalog.data'
import type { ModalityGuidance } from './modalityGuidance.data'
import { OpportunityDetails } from './OpportunityDetails'
import { applicationReturnPath } from './applicationReturn'

type DialogStage = 'details' | 'confirm' | 'login' | 'confirmation'

// Marca que la sesión se abrió en Microsoft SOLO para postularse a esta
// oferta: al volver del redirect, la postulación la cierra aunque falle.
const APPLY_LOGIN_KEY = 'ucomp_apply_login_offer'

function takeApplyLoginMarker(offerId: string): boolean {
  try {
    const marked = sessionStorage.getItem(APPLY_LOGIN_KEY) === offerId
    sessionStorage.removeItem(APPLY_LOGIN_KEY)
    return marked
  } catch {
    return false
  }
}

function clearApplyLoginMarker() {
  try {
    sessionStorage.removeItem(APPLY_LOGIN_KEY)
  } catch {
    // sin sessionStorage no hay marca que limpiar
  }
}

interface OpportunityDetailDialogProps {
  offer: ProjectOffer
  modality: ProjectModality
  guidance: ModalityGuidance
  onClose: () => void
  /** Inicia la postulación apenas se abre el diálogo (sin pasar por el detalle). */
  autoApply?: boolean
}

function applicationErrorMessage(error: unknown): string {
  if (error instanceof ApplicationError) return error.message
  if (error instanceof ApiError) return error.message
  return 'No fue posible registrar la postulación. Revisa la conexión e inténtalo de nuevo.'
}

function registeredAtLabel(value: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
}

export function OpportunityDetailDialog({
  offer,
  modality,
  guidance,
  onClose,
  autoApply = false,
}: OpportunityDetailDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const { loginWithMicrosoft, endSession, loginError } = useAuthFlow()
  const [stage, setStage] = useState<DialogStage>('details')
  const [applicant, setApplicant] = useState<User | null>(null)
  const [applicationResult, setApplicationResult] = useState<ApplicationResult | null>(null)
  const [applicationError, setApplicationError] = useState<string | null>(null)
  const [sessionState, setSessionState] = useState<'closing' | 'closed' | 'error'>('closing') // solo 'error' se muestra
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submissionInFlight = useRef(false)
  const autoApplied = useRef(false)

  // Tras registrar la postulación, la sesión se invalida en el servidor para que el portal vuelva a pedir credenciales.
  // La confirmación (datos mínimos, sin tokens) viaja con el cierre: si el logout de Microsoft recarga la app, el
  // catálogo la muestra una sola vez al volver.
  const confirmationRef = useRef<PublicFlash | null>(null)
  const closeSession = useCallback(async () => {
    setSessionState('closing')
    setSessionError(null)
    const flash = confirmationRef.current
    const error = await endSession(flash ? { reason: 'postulation_success', returnTo: '/proyectos-de-grado', flash } : undefined)
    setSessionError(error)
    setSessionState(error ? 'error' : 'closed')
  }, [endSession])

  // Registra el trámite en el backend; la confirmación solo se muestra si el servidor lo acepta.
  // `endOnFailure`: la sesión se abrió solo para postular, así que no debe quedar activa si falla.
  const submitApplication = useCallback(async (student: User, endOnFailure: boolean) => {
    if (submissionInFlight.current) return
    submissionInFlight.current = true
    setIsSubmitting(true)
    setApplicationError(null)
    try {
      const accessToken = useAppStore.getState().accessToken
      if (!accessToken) throw new ApplicationError('closed', 'La sesión no está disponible. Inicia sesión de nuevo.')
      const result = await applicationsService.apply(offer, accessToken, student.id)
      setApplicant(student)
      setApplicationResult(result)
      setStage('confirmation')
      // Solo tras la confirmación real del backend se prepara el cierre de sesión y la confirmación posterior.
      confirmationRef.current = {
        kind: 'application', offerTitle: offer.title, modality: modality.name, code: result.process.process_code,
        state: result.process.state.name, registeredAt: result.process.created_at,
      }
      void closeSession()
    } catch (error) {
      setApplicationError(applicationErrorMessage(error))
      if (endOnFailure) await endSession()
      setStage(endOnFailure ? 'login' : 'details')
    } finally {
      submissionInFlight.current = false
      setIsSubmitting(false)
    }
  }, [offer, modality.name, closeSession, endSession])

  // Sin sesión: se pide acceso con Microsoft y NO se registra nada. Con sesión: se pide una
  // confirmación explícita. Solo al volver de Microsoft (`fromReturn` + marca de esta oferta)
  // el registro continúa solo, porque el estudiante ya pidió postularse antes de salir.
  const handlePostulate = useCallback((fromReturn = false) => {
    setApplicationError(null)
    const session = useAppStore.getState()
    if (!(session.currentUser && session.accessToken)) {
      setStage('login')
      return
    }
    const returnedFromLogin = fromReturn && takeApplyLoginMarker(offer.id)
    if (returnedFromLogin) {
      void submitApplication(session.currentUser, true)
      return
    }
    clearApplyLoginMarker()
    setStage('confirm')
  }, [offer.id, submitApplication])

  const handleConfirmApplication = () => {
    const session = useAppStore.getState()
    if (!session.currentUser || !session.accessToken) {
      setStage('login')
      return
    }
    void submitApplication(session.currentUser, false)
  }

  const handleReturnToCatalog = () => {
    clearApplyLoginMarker()
    onClose()
    navigate('/proyectos-de-grado')
    resetScrollToTop()
  }

  const handleMicrosoftLogin = () => {
    try {
      sessionStorage.setItem(APPLY_LOGIN_KEY, offer.id)
    } catch {
      // Sin sessionStorage la sesión simplemente queda abierta tras postular.
    }
    void loginWithMicrosoft(applicationReturnPath(offer.id))
  }

  const returnFromLogin = useCallback(() => {
    if (autoApply) onClose()
    else setStage('details')
  }, [autoApply, onClose])

  useEffect(() => {
    if (!autoApply || autoApplied.current) return
    autoApplied.current = true
    handlePostulate(true)
  }, [autoApply, handlePostulate])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const page = document.querySelector<HTMLElement>('.projects-catalog')
    const unlockScroll = lockScroll()

    page?.setAttribute('inert', '')
    closeButtonRef.current?.focus({ preventScroll: true })

    return () => {
      page?.removeAttribute('inert')
      unlockScroll()
      // preventScroll: devolver el foco no debe desplazar la página
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (stage === 'login' || stage === 'confirm') returnFromLogin()
        else onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0)
      if (focusableElements.length === 0) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, returnFromLogin, stage])

  useEffect(() => {
    if (stage !== 'details') closeButtonRef.current?.focus({ preventScroll: true })
  }, [stage])

  const closeOrReturn = stage === 'login' || stage === 'confirm' ? returnFromLogin : onClose
  const title = stage === 'details' ? offer.title : stage === 'confirmation' ? 'Postulación registrada' : stage === 'confirm' ? 'Confirma tu postulación' : 'Inicia sesión para postularte'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061F2D]/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeOrReturn() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="opportunity-dialog-title" className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:max-h-[90vh] sm:rounded-3xl">
        <header className="relative flex shrink-0 items-start justify-between gap-5 overflow-hidden bg-gradient-to-r from-[#073B57] via-[#145B78] to-[#F4511E] px-5 py-5 text-white sm:px-8 sm:py-7">
          <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-20 h-52 w-52 rounded-full border-[18px] border-white/10" />
          <div className="relative z-10 min-w-0">
            {stage === 'details' ? <>
              <div className="flex flex-wrap items-center gap-2"><Badge variant="orange">{offer.status}</Badge><span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">{modality.name}</span></div>
              <p className="mt-4 text-xs font-semibold text-white/75">{offer.area}</p>
              <h2 id="opportunity-dialog-title" className="mt-1 text-xl font-bold leading-tight sm:text-2xl">{title}</h2>
            </> : <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5"><Logo size="sm" /></span><div><p className="text-xs font-semibold text-white/75">{stage === 'confirmation' || stage === 'confirm' ? 'UCompensar · Proyectos de grado' : 'Acceso institucional'}</p><h2 id="opportunity-dialog-title" className="mt-1 text-xl font-bold">{title}</h2></div></div>}
          </div>
          <button ref={closeButtonRef} type="button" aria-label={stage === 'login' || stage === 'confirm' ? 'Cancelar la postulación' : 'Cerrar detalle de oportunidad'} onClick={closeOrReturn} className="relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><X size={20} aria-hidden="true" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {stage === 'details' && <OpportunityDetails offer={offer} modality={modality} guidance={guidance} />}

          {stage === 'confirm' && <section className="mx-auto max-w-lg p-6 sm:p-9" aria-labelledby="application-confirm-title">
            <h3 id="application-confirm-title" className="text-center text-2xl font-bold text-[#073B57]">¿Confirmas tu postulación?</h3>
            <p className="mt-3 text-center text-sm leading-relaxed text-[#526575]">Vas a postularte a la oferta <strong className="text-[#073B57]">«{offer.title}»</strong> ({modality.name}). La postulación se registrará con tu cuenta institucional.</p>
            {applicationError && <p role="alert" className="mt-4 text-center text-sm font-medium text-red-700">{applicationError}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button type="button" variant="outline" className="min-h-11 border-[#073B57]/25 text-[#073B57]" disabled={isSubmitting} onClick={returnFromLogin}>Cancelar</Button>
              <Button type="button" className="min-h-11 bg-[#FF6B35] px-5 text-white hover:bg-[#F4511E]" disabled={isSubmitting} onClick={handleConfirmApplication}>{isSubmitting ? 'Registrando…' : 'Confirmar postulación'}</Button>
            </div>
          </section>}

          {stage === 'login' && <section className="mx-auto max-w-md p-6 sm:p-9" aria-labelledby="application-login-title">
            <div className="mb-6 flex justify-center"><Logo size="md" /></div>
            <h3 id="application-login-title" className="text-center text-2xl font-bold text-[#073B57]">Inicia sesión</h3>
            <p className="mt-2 mb-6 text-center text-sm leading-relaxed text-[#526575]">Accede con tu cuenta institucional de Microsoft para postularte a «{offer.title}». Al volver, tu postulación se registra automáticamente.</p>
            <SSOForm onMicrosoftLogin={handleMicrosoftLogin} error={applicationError ?? loginError} />
            {!autoApply && <button type="button" onClick={returnFromLogin} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#073B57] hover:text-[#F4511E]"><ArrowLeft size={16} aria-hidden="true" />Volver a la oportunidad</button>}
          </section>}

          {stage === 'confirmation' && applicationResult && applicant && <section className="mx-auto max-w-2xl p-6 sm:p-9" aria-labelledby="application-success-title">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF7F1] text-[#15804B]"><CheckCircle2 size={38} aria-hidden="true" /></div>
            <h3 id="application-success-title" className="mt-5 text-center text-2xl font-extrabold text-[#073B57] sm:text-3xl">¡Te has postulado correctamente!</h3>
            <p className="mt-3 text-center text-sm leading-relaxed text-[#526575]">Hola, <strong className="text-[#073B57]">{applicant.name}</strong>. Tu postulación a «{offer.title}» se registró correctamente en el sistema y la verás en «Mis trámites» cuando inicies sesión.</p>
            <dl className="mt-7 grid gap-3 rounded-2xl border border-[#DCE5E9] bg-gradient-to-br from-[#F4F8FA] to-[#FFF7F1] p-5 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2"><dt className="text-xs font-semibold text-[#60727F]">Oferta</dt><dd className="mt-1 font-bold text-[#073B57]">{offer.title}</dd></div>
              <div><dt className="text-xs font-semibold text-[#60727F]">Estudiante</dt><dd className="mt-1 text-sm font-semibold text-[#073B57]">{applicant.name}</dd></div>
              <div><dt className="text-xs font-semibold text-[#60727F]">Modalidad</dt><dd className="mt-1 text-sm font-semibold text-[#073B57]">{modality.name}</dd></div>
              {offer.area && <div><dt className="text-xs font-semibold text-[#60727F]">Área académica</dt><dd className="mt-1 text-sm font-semibold text-[#073B57]">{offer.area}</dd></div>}
              <div><dt className="text-xs font-semibold text-[#60727F]">Código del trámite</dt><dd className="mt-1 break-all font-mono text-xs text-[#073B57]">{applicationResult.process.process_code}</dd></div>
              <div><dt className="text-xs font-semibold text-[#60727F]">Estado</dt><dd className="mt-1 text-sm font-bold text-[#15804B]">{applicationResult.process.state.name}</dd></div>
              <div><dt className="text-xs font-semibold text-[#60727F]">Fecha de registro</dt><dd className="mt-1 text-sm text-[#073B57]">{registeredAtLabel(applicationResult.process.created_at)}</dd></div>
            </dl>
            <div role="status" aria-live="polite" className="mt-5 text-center text-xs leading-5 text-[#526575]">
              {sessionState === 'error' && <span role="alert" className="text-red-700">No se pudo cerrar tu sesión: {sessionError}. Tu sesión sigue activa.{' '}<button type="button" onClick={() => void closeSession()} className="font-semibold underline">Reintentar cierre de sesión</button></span>}
            </div>
          </section>}
        </div>

        {stage === 'details' && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[#E5E9EC] bg-white px-5 py-4 sm:px-8">
          {applicationError && <p role="alert" className="mr-auto text-sm font-medium text-red-700">{applicationError}</p>}
          <Button type="button" variant="outline" className="min-h-11 border-[#073B57]/25 text-[#073B57]" onClick={onClose}>Cerrar</Button>
          {offer.status === 'Disponible' && (applicationsService.isAtCapacity(offer) ? <Button type="button" disabled className="min-h-11 bg-[#D8DEE2] text-[#526575]">Cupos completos</Button> : <Button type="button" className="min-h-11 bg-[#FF6B35] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#F4511E]" onClick={() => handlePostulate()}>Postularme <ArrowRight size={16} aria-hidden="true" /></Button>)}
        </footer>}

        {stage === 'login' && <footer className="flex shrink-0 justify-end border-t border-[#E5E9EC] bg-white px-5 py-4 sm:px-8"><Button type="button" variant="outline" className="min-h-11 border-[#073B57]/25 text-[#073B57]" disabled={isSubmitting} onClick={returnFromLogin}>{autoApply ? 'Cancelar' : 'Volver a la oportunidad'}</Button></footer>}

        {stage === 'confirmation' && applicationResult && <footer className="flex shrink-0 justify-end border-t border-[#E5E9EC] bg-white px-5 py-4 sm:px-8">
          <Button type="button" className="min-h-11 bg-[#FF6B35] px-4 text-white hover:bg-[#F4511E]" onClick={handleReturnToCatalog}>Volver al catálogo <ArrowRight size={16} aria-hidden="true" /></Button>
        </footer>}
      </div>
    </div>,
    document.body,
  )
}

