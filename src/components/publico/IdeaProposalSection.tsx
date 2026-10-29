import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { AuthFlowContext } from '@/components/auth/AuthFlowContext'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import type { PublicFlash } from '@/services/sessionFlash'
import { MODALITY_LABELS, PROPOSAL_LIMITS, proposalsApi, type ProposalOut, type SuggestedModality } from '@/services/proposals.service'

export const NOT_STUDENT_MESSAGE = 'Solo las cuentas con rol Estudiante pueden presentar propuestas'
export const PROPOSALS_CATALOG_PATH = '/proyectos-de-grado'
const DRAFT_KEY = 'ucomp_idea_draft'
// Envío en curso: se marca antes de ir a Microsoft y se CONSUME (se borra) antes de crear la propuesta, de modo que
// una recarga, el doble montaje de StrictMode o un reintento nunca la registren dos veces. Sin tokens ni credenciales.
const PENDING_KEY = 'ucomp_idea_pending'
const PENDING_TTL_MS = 10 * 60 * 1000

interface PendingSubmit {
  returnPath: string
  at: number
}

export function readPendingSubmit(): PendingSubmit | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const pending = JSON.parse(raw) as PendingSubmit
    return Date.now() - pending.at <= PENDING_TTL_MS ? pending : null
  } catch {
    return null
  }
}

export function clearPendingSubmit() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // nada que limpiar
  }
}

function markPendingSubmit(returnPath: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ returnPath, at: Date.now() } satisfies PendingSubmit))
  } catch {
    // sin sessionStorage el borrador no sobrevive a la redirección de Microsoft
  }
}

/** Consume la marca: devuelve true una sola vez. */
function takePendingSubmit(): boolean {
  const pending = readPendingSubmit()
  clearPendingSubmit()
  return pending !== null
}
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface Draft {
  title: string
  modality: SuggestedModality
  problem: string
  solution: string
  impact: string
  members: string[] // una fila por compañero; las filas vacías se ignoran al validar y enviar
  tutor: string
  confirm: boolean
  policy: boolean
}

const EMPTY: Draft = { title: '', modality: 'por_definir', problem: '', solution: '', impact: '', members: [''], tutor: '', confirm: false, policy: false }

function readDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return EMPTY
    const saved = JSON.parse(raw) as Partial<Omit<Draft, 'members'>> & { members?: string[] | string }
    // Borradores anteriores guardaban los correos como un único texto.
    const members = Array.isArray(saved.members) ? saved.members : typeof saved.members === 'string' ? splitEmails(saved.members) : []
    return { ...EMPTY, ...saved, members: members.length ? members.slice(0, PROPOSAL_LIMITS.maxMembers) : [''] }
  } catch {
    return EMPTY
  }
}

function saveDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // sin sessionStorage el formulario sigue funcionando; solo no sobrevive a la redirección de Microsoft
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // nada que limpiar
  }
}

const norm = (value: string) => value.trim().toLowerCase()
const splitEmails = (raw: string) => raw.split(/[\s,;]+/).map(norm).filter(Boolean)
const parseEmails = (rows: string[]) => rows.flatMap(splitEmails)

/** Error de cada fila (null si es válida o está vacía): formato, autor y duplicados sin distinguir mayúsculas. */
export function memberRowErrors(rows: string[], authorEmail: string | null): Array<string | null> {
  const seen = new Set<string>()
  return rows.map((row) => {
    const email = norm(row)
    if (!email) return null
    if (splitEmails(row).length > 1) return 'Escribe un solo correo por fila.'
    if (!EMAIL.test(email) || email.length > PROPOSAL_LIMITS.email) return 'El correo no tiene un formato válido.'
    if (authorEmail && email === norm(authorEmail)) return 'No agregues tu propio correo: tú ya eres el autor.'
    if (seen.has(email)) return 'Este correo está repetido.'
    seen.add(email)
    return null
  })
}

export type IdeaField = 'title' | 'problem' | 'solution' | 'impact' | 'members' | 'tutor' | 'confirm' | 'policy'
export type IdeaErrors = Partial<Record<IdeaField, string>>

const FIELD_ORDER: IdeaField[] = ['title', 'problem', 'solution', 'impact', 'members', 'tutor', 'confirm', 'policy']
const FIELD_LABEL: Record<IdeaField, string> = {
  title: 'el título', problem: 'el problema o necesidad', solution: 'la propuesta de solución', impact: 'el impacto esperado',
  members: 'los correos de los compañeros', tutor: 'el correo del docente', confirm: 'la confirmación de la información', policy: 'el tratamiento de datos',
}

/**
 * Mismas reglas que valida FastAPI (que sigue siendo la autoridad). Obligatorios: título, problema, solución y las dos
 * confirmaciones. Opcionales: impacto, compañeros y docente (vacíos no bloquean; si se escriben, se valida el formato).
 * `consents: false` omite las confirmaciones (visitante anónimo que solo inicia sesión; se exigen al enviar).
 */
export function validateFields(draft: Draft, authorEmail: string | null, consents = true): IdeaErrors {
  const errors: IdeaErrors = {}
  if (draft.title.trim().length < 3) errors.title = 'Escribe un título de al menos 3 caracteres.'
  else if (draft.title.trim().length > PROPOSAL_LIMITS.title) errors.title = `El título admite máximo ${PROPOSAL_LIMITS.title} caracteres.`
  if (draft.problem.trim().length < 10) errors.problem = 'Describe el problema o la necesidad (mínimo 10 caracteres).'
  else if (draft.problem.length > PROPOSAL_LIMITS.text) errors.problem = `El problema admite máximo ${PROPOSAL_LIMITS.text} caracteres.`
  if (draft.solution.trim().length < 10) errors.solution = 'Describe tu propuesta de solución y objetivos (mínimo 10 caracteres).'
  else if (draft.solution.length > PROPOSAL_LIMITS.text) errors.solution = `La solución admite máximo ${PROPOSAL_LIMITS.text} caracteres.`
  if (draft.impact.length > PROPOSAL_LIMITS.impact) errors.impact = `El impacto esperado admite máximo ${PROPOSAL_LIMITS.impact} caracteres.`
  const rowErrors = memberRowErrors(draft.members, authorEmail)
  const firstBad = rowErrors.findIndex(Boolean)
  if (firstBad >= 0) errors.members = `Compañero ${firstBad + 1} («${norm(draft.members[firstBad])}»): ${rowErrors[firstBad]}`
  else if (parseEmails(draft.members).length > PROPOSAL_LIMITS.maxMembers) errors.members = `Puedes proponer como máximo ${PROPOSAL_LIMITS.maxMembers} compañeros.`
  const tutor = norm(draft.tutor)
  if (tutor && (!EMAIL.test(tutor) || tutor.length > PROPOSAL_LIMITS.email)) errors.tutor = 'El correo del docente propuesto no tiene un formato válido.'
  else if (tutor && authorEmail && tutor === norm(authorEmail)) errors.tutor = 'El docente propuesto no puede ser el propio autor.'
  if (consents) {
    if (!draft.confirm) errors.confirm = 'Confirma que la información es correcta y que tus compañeros conocen su participación.'
    if (!draft.policy) errors.policy = 'Debes aceptar el tratamiento de datos para enviar la propuesta.'
  }
  return errors
}

/** Primer error del formulario (en el orden en que se muestra) o null si es válido. */
export function validateIdea(draft: Draft, authorEmail: string | null): string | null {
  const errors = validateFields(draft, authorEmail)
  const first = FIELD_ORDER.find((field) => errors[field])
  return first ? errors[first]! : null
}

const fieldClass =
  'w-full rounded-xl border border-[#C9D6DF] bg-white px-4 py-3 text-[15px] text-[#172B3A] outline-none focus:border-[#0876B9] focus:ring-2 focus:ring-[#0876B9]/20'
const labelClass = 'mb-1.5 block text-sm font-semibold text-[#073B57]'

interface IdeaProposalSectionProps {
  /** Modalidad precargada (la de la página desde la que se abrió el modal). */
  modality?: SuggestedModality
  /** Ruta a la que Microsoft devuelve al estudiante para restaurar el borrador. */
  returnPath?: string
  /** Cierra el contenedor (modal) antes de volver al catálogo. */
  onDone?: () => void
}

export function IdeaProposalSection({ modality, returnPath = PROPOSALS_CATALOG_PATH, onDone }: IdeaProposalSectionProps = {}) {
  const flow = useContext(AuthFlowContext)
  const navigate = useNavigate()
  const accessToken = useAppStore((s) => s.accessToken)
  const user = useAppStore((s) => s.currentUser)
  const isStudent = user?.role === 'estudiante'
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = readDraft()
    return modality ? { ...saved, modality } : saved
  })
  // true cuando la sesión se acaba de abrir en ESTE envío: permite reintentar tras un error del servidor sin repetir el login.
  const freshlyAuthenticated = useRef(false)
  const [error, setError] = useState<string | null>(null) // errores del servidor, de rol o de red
  const [attempted, setAttempted] = useState(false)
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const [showMemberErrors, setShowMemberErrors] = useState(false)
  const [memberNotice, setMemberNotice] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const submitting = useRef(false)
  const [created, setCreated] = useState<ProposalOut | null>(null)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value }
      saveDraft(next)
      return next
    })
  }

  const memberErrors = memberRowErrors(draft.members, user?.email ?? null)
  // Tras el primer intento de envío los errores se recalculan con cada cambio, así desaparecen al corregirlos.
  const fieldErrors: IdeaErrors = attempted ? validateFields(draft, user?.email ?? null, Boolean(user)) : {}
  const missing = FIELD_ORDER.filter((field) => fieldErrors[field])

  const editMember = (index: number, value: string) => {
    setMemberNotice(null)
    set('members', draft.members.map((row, i) => (i === index ? value : row)))
  }

  /** Reparte varios correos entre filas (al pegar o al salir del campo) respetando el máximo; lo que no cabe se informa sin perder lo demás. */
  const distributeMembers = (index: number, value: string) => {
    const tokens = splitEmails(value)
    setMemberNotice(null)
    if (tokens.length < 2) return editMember(index, value)
    const before = draft.members.slice(0, index)
    const after = draft.members.slice(index + 1)
    const room = Math.max(PROPOSAL_LIMITS.maxMembers - before.length - after.length, 1)
    const kept = tokens.slice(0, room)
    if (tokens.length > room) {
      setMemberNotice(`Solo caben ${PROPOSAL_LIMITS.maxMembers} compañeros: no se agregaron ${tokens.slice(room).join(', ')}.`)
    }
    set('members', [...before, ...kept, ...after])
  }
  const addMember = () => {
    if (draft.members.length < PROPOSAL_LIMITS.maxMembers) set('members', [...draft.members, ''])
  }
  const removeMember = (index: number) => {
    setMemberNotice(null)
    set('members', draft.members.length > 1 ? draft.members.filter((_, i) => i !== index) : draft.members)
  }

  // Enviar SIEMPRE pasa por Microsoft (no se asume una sesión previa). El borrador y la ruta de retorno se guardan en
  // sessionStorage; al volver autenticado, el efecto de abajo valida el rol y crea la propuesta una sola vez.
  const signIn = () => {
    if (submitting.current) return
    setError(null)
    setAttempted(true)
    if (Object.keys(validateFields(draft, user?.email ?? null)).length > 0) return setShowMemberErrors(true)
    if (!flow) return setError('El inicio de sesión con Microsoft no está disponible en este momento. Inténtalo de nuevo más tarde.')
    saveDraft(draft)
    markPendingSubmit(returnPath)
    void flow.loginWithMicrosoft(returnPath)
  }

  // Vuelta de Microsoft: con identidad lista se valida el rol y se envía; si Microsoft devolvió un error (p. ej. el
  // usuario canceló), se informa y el borrador sigue intacto. La marca se consume antes de crear para no duplicar.
  useEffect(() => {
    if (!readPendingSubmit()) return
    if (user && accessToken) {
      if (!takePendingSubmit()) return
      freshlyAuthenticated.current = true
      void submit()
    } else if (flow?.loginError) {
      takePendingSubmit()
      setError(flow.loginError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken, flow?.loginError])

  const submit = async () => {
    if (!accessToken || !user || submitting.current) return
    setAttempted(true)
    setError(null)
    // El rol sale de /auth/me (BD + App Roles de Entra), no del navegador. Sin rol Estudiante NO se llama al servicio de creación.
    if (!isStudent) return setError(NOT_STUDENT_MESSAGE)
    if (Object.keys(validateFields(draft, user.email)).length > 0) return setShowMemberErrors(true)
    submitting.current = true
    setSending(true)
    setError(null)
    try {
      const result = await proposalsApi.create(accessToken, {
        title: draft.title.trim(),
        suggested_modality: draft.modality,
        problem: draft.problem.trim(),
        solution: draft.solution.trim(),
        expected_impact: draft.impact.trim() || null,
        member_emails: parseEmails(draft.members),
        suggested_tutor_email: norm(draft.tutor) || null,
        confirm_information: draft.confirm,
        accept_data_policy: draft.policy,
      })
      clearDraft()
      clearPendingSubmit()
      setDraft(EMPTY)
      const confirmation: PublicFlash = { kind: 'proposal', code: result.code, title: result.title }
      setShowMemberErrors(false)
      setAttempted(false)
      setCreated(result) // solo se muestra tras la confirmación real del backend
      // La propuesta ya está persistida: se cierra la sesión en silencio y se vuelve al catálogo, donde la confirmación se
      // restaura una sola vez. Si el cierre falla, la sesión sigue activa y la confirmación permanece visible aquí.
      void flow?.endSession({ reason: 'proposal_success', returnTo: PROPOSALS_CATALOG_PATH, flash: confirmation }).then((message) => setSessionNotice(message))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la propuesta. Revisa la conexión e inténtalo de nuevo.')
    } finally {
      submitting.current = false
      setSending(false)
    }
  }

  return (
    <section aria-labelledby="idea-title">
      <div>
        <p className="text-[15px] leading-relaxed text-[#526575]">
          Si ya tienes una propuesta, solo tuya o con compañeros, compártela. Coordinación la evaluará y te orientará. Una propuesta no es todavía un proceso oficial de grado.
        </p>

        {created ? (
          <div role="status" className="mt-8 rounded-2xl border border-[#BFE3CF] bg-[#EAF7F1] p-6">
            <p className="flex items-center gap-2 text-lg font-bold text-[#15804B]"><CheckCircle2 size={22} aria-hidden="true" /> Recibimos tu propuesta</p>
            <p className="mt-2 text-[15px] text-[#173B2A]">
              Código <strong>{created.code}</strong>. Quedó en estado «Pendiente de revisión». Coordinación la revisará y podrás seguir su estado desde «Mis propuestas» cuando inicies sesión.
            </p>
            {sessionNotice && <p role="alert" className="mt-2 text-sm font-medium text-red-700">No se pudo cerrar tu sesión: {sessionNotice}. Tu propuesta sí quedó registrada; cierra la sesión desde el portal.</p>}
            <Button type="button" className="mt-4 min-h-11 bg-[#FF6B35] px-4 text-white hover:bg-[#F4511E]" onClick={() => { onDone?.(); navigate(PROPOSALS_CATALOG_PATH) }}>
              Volver a proyectos de grado <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <form
            className="mt-8 grid gap-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (user && freshlyAuthenticated.current) void submit()
              else signIn()
            }}
          >
            <div>
              <label htmlFor="idea-title-input" className={labelClass}>Título de la propuesta</label>
              <input id="idea-title-input" aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? "idea-error-title" : undefined} className={fieldClass} maxLength={PROPOSAL_LIMITS.title} value={draft.title} onChange={(e) => set('title', e.target.value)} />
              {fieldErrors.title && <p id="idea-error-title" className="mt-1 text-xs font-medium text-red-700">{fieldErrors.title}</p>}
            </div>
            <div>
              <label htmlFor="idea-modality" className={labelClass}>Modalidad sugerida</label>
              <select id="idea-modality" className={fieldClass} value={draft.modality} onChange={(e) => set('modality', e.target.value as SuggestedModality)}>
                {(Object.keys(MODALITY_LABELS) as SuggestedModality[]).map((key) => <option key={key} value={key}>{MODALITY_LABELS[key]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="idea-problem" className={labelClass}>Problema o necesidad que buscas resolver</label>
              <textarea id="idea-problem" aria-invalid={Boolean(fieldErrors.problem)} aria-describedby={fieldErrors.problem ? "idea-error-problem" : undefined} rows={4} className={fieldClass} maxLength={PROPOSAL_LIMITS.text} value={draft.problem} onChange={(e) => set('problem', e.target.value)} />
              {fieldErrors.problem && <p id="idea-error-problem" className="mt-1 text-xs font-medium text-red-700">{fieldErrors.problem}</p>}
            </div>
            <div>
              <label htmlFor="idea-solution" className={labelClass}>Propuesta de solución y objetivos</label>
              <textarea id="idea-solution" aria-invalid={Boolean(fieldErrors.solution)} aria-describedby={fieldErrors.solution ? "idea-error-solution" : undefined} rows={4} className={fieldClass} maxLength={PROPOSAL_LIMITS.text} value={draft.solution} onChange={(e) => set('solution', e.target.value)} />
              {fieldErrors.solution && <p id="idea-error-solution" className="mt-1 text-xs font-medium text-red-700">{fieldErrors.solution}</p>}
            </div>
            <div>
              <label htmlFor="idea-impact" className={labelClass}>Impacto esperado (opcional)</label>
              <textarea id="idea-impact" aria-invalid={Boolean(fieldErrors.impact)} aria-describedby={fieldErrors.impact ? "idea-error-impact" : undefined} rows={3} className={fieldClass} maxLength={PROPOSAL_LIMITS.impact} value={draft.impact} onChange={(e) => set('impact', e.target.value)} />
              {fieldErrors.impact && <p id="idea-error-impact" className="mt-1 text-xs font-medium text-red-700">{fieldErrors.impact}</p>}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <fieldset className="min-w-0">
                <legend className={labelClass}>Correos institucionales de tus compañeros (opcional)</legend>
                <ul className="grid gap-2">
                  {draft.members.map((email, index) => {
                    const rowError = showMemberErrors ? memberErrors[index] : null
                    return (
                      <li key={index}>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="email"
                            autoComplete="off"
                            aria-label={`Correo del compañero ${index + 1}`}
                            aria-invalid={Boolean(rowError)}
                            aria-describedby={rowError ? `idea-member-error-${index}` : undefined}
                            className={`${fieldClass} ${rowError ? 'border-red-400' : ''}`}
                            placeholder="nombre@ucompensar.edu.co"
                            value={email}
                            onChange={(e) => editMember(index, e.target.value)}
                            onPaste={(e) => {
                              // Un <input> de una línea descartaría los saltos de línea: se lee el texto del portapapeles.
                              const text = e.clipboardData.getData('text')
                              if (splitEmails(text).length < 2) return
                              e.preventDefault()
                              const { value, selectionStart, selectionEnd } = e.currentTarget
                              distributeMembers(index, `${value.slice(0, selectionStart ?? value.length)} ${text} ${value.slice(selectionEnd ?? value.length)}`)
                            }}
                            onBlur={() => {
                              if (splitEmails(email).length > 1) distributeMembers(index, email)
                              setShowMemberErrors(true)
                            }}
                          />
                          {draft.members.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Quitar compañero ${index + 1}`}
                              onClick={() => removeMember(index)}
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#C9D6DF] text-[#60727F] transition-colors hover:border-[#FF6B35] hover:text-[#F4511E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0876B9]/30"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        {rowError && <p id={`idea-member-error-${index}`} className="mt-1 text-xs font-medium text-red-700">{rowError}</p>}
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={addMember}
                    disabled={draft.members.length >= PROPOSAL_LIMITS.maxMembers}
                    className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-bold text-[#F4511E] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0876B9]/30 disabled:cursor-not-allowed disabled:text-[#8A9AA6] disabled:no-underline"
                  >
                    <Plus size={15} aria-hidden="true" /> Agregar integrante
                  </button>
                  <span className="text-xs text-[#60727F]">{draft.members.length} de {PROPOSAL_LIMITS.maxMembers} compañeros como máximo (sin contarte a ti)</span>
                </div>
                {showMemberErrors && fieldErrors.members && memberErrors.every((e) => !e) && <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.members}</p>}
                {memberNotice && <p role="status" className="mt-1 text-xs font-medium text-[#B4400F]">{memberNotice}</p>}
                <p className="mt-1 text-xs text-[#60727F]">Puedes pegar varios correos separados por comas, punto y coma o saltos de línea. No se crean cuentas: cada persona debe iniciar sesión y confirmar su participación.</p>
              </fieldset>
              <div>
                <label htmlFor="idea-tutor" className={labelClass}>Correo del docente propuesto (opcional)</label>
                <input id="idea-tutor" type="email" aria-invalid={Boolean(fieldErrors.tutor)} aria-describedby={fieldErrors.tutor ? "idea-error-tutor" : undefined} className={fieldClass} maxLength={PROPOSAL_LIMITS.email} value={draft.tutor} onChange={(e) => set('tutor', e.target.value)} />
                {fieldErrors.tutor && <p id="idea-error-tutor" className="mt-1 text-xs font-medium text-red-700">{fieldErrors.tutor}</p>}
                  <p className="mt-1 text-xs text-[#60727F]">Coordinación confirma el tutor; si no propones uno, ella lo asignará.</p>
              </div>
            </div>
            <label className="flex items-start gap-3 text-sm text-[#172B3A]">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#FF6B35]" checked={draft.confirm} onChange={(e) => set('confirm', e.target.checked)} />
              Confirmo que la información es correcta y que los integrantes indicados conocen su participación.
            </label>
            {fieldErrors.confirm && <p className="-mt-3 text-xs font-medium text-red-700">{fieldErrors.confirm}</p>}
            <label className="flex items-start gap-3 text-sm text-[#172B3A]">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#FF6B35]" checked={draft.policy} onChange={(e) => set('policy', e.target.checked)} />
              Acepto el tratamiento de mis datos personales conforme a la política institucional de UCompensar.
            </label>
            {fieldErrors.policy && <p className="-mt-3 text-xs font-medium text-red-700">{fieldErrors.policy}</p>}

            {missing.length > 0 && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                Revisa el formulario: falta o debes corregir {missing.map((field) => FIELD_LABEL[field]).join(', ')}.
              </p>
            )}
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={sending} className="min-h-12 bg-[#FF6B35] px-7 font-bold text-white hover:bg-[#F4511E]">
                {sending ? 'Enviando…' : 'Enviar propuesta'}
              </Button>
              <p className="text-sm text-[#526575]">Al enviar se te pedirá iniciar sesión con tu cuenta institucional de Microsoft. Tu borrador se conserva mientras lo haces.</p>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
