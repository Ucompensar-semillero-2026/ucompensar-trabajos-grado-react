// Funciones y constantes de IdeaProposalSection.tsx que no son componentes (fast refresh de Vite).
import { PROPOSAL_LIMITS, type SuggestedModality } from '@/services/proposals.service'

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

// Envío en curso: se marca antes de ir a Microsoft y se CONSUME (se borra) antes de crear la propuesta, de modo que
// una recarga, el doble montaje de StrictMode o un reintento nunca la registren dos veces. Sin tokens ni credenciales.
export const PENDING_KEY = 'ucomp_idea_pending'

export const PENDING_TTL_MS = 10 * 60 * 1000

export interface PendingSubmit {
  returnPath: string
  at: number
}

export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface Draft {
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

export const norm = (value: string) => value.trim().toLowerCase()

export const splitEmails = (raw: string) => raw.split(/[\s,;]+/).map(norm).filter(Boolean)

export const parseEmails = (rows: string[]) => rows.flatMap(splitEmails)

export type IdeaErrors = Partial<Record<IdeaField, string>>

export const FIELD_ORDER: IdeaField[] = ['title', 'problem', 'solution', 'impact', 'members', 'tutor', 'confirm', 'policy']

export type IdeaField = 'title' | 'problem' | 'solution' | 'impact' | 'members' | 'tutor' | 'confirm' | 'policy'
