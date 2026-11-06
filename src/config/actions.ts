// Acciones sobre un trámite: GET /processes/{id} -> `allowed_actions`
// (docs/ROLES-DISENO.md, contrato 6.1). El backend las calcula con la misma
// regla que valida cada endpoint; aquí solo se pregunta si la acción está.
// Una acción que el frontend no conoce se ignora.

export const KNOWN_ACTIONS = [
  'upload_document',
  'review_document',
  'grade',
  'register_final_grade',
  'manage_team',
  'manage_work_plan',
  'submit_deliverable',
  'change_state',
  'register_external_approval',
  'sign_administrative_approval',
] as const

export type ProcessAction = (typeof KNOWN_ACTIONS)[number]

const KNOWN = new Set<string>(KNOWN_ACTIONS)

export function knownActions(actions: readonly string[] | undefined): ProcessAction[] {
  return [...new Set((actions ?? []).filter((a): a is ProcessAction => KNOWN.has(a)))]
}

export function can(detail: { allowed_actions?: readonly string[] } | null | undefined, action: ProcessAction): boolean {
  return knownActions(detail?.allowed_actions).includes(action)
}
