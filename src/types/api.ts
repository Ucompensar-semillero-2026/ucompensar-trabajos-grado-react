// Tipos que más de un dominio necesita (ej. un ProcessOut trae un
// BackendUser y un ModalityOut). Lo específico de un solo dominio vive
// en su propio archivo de servicio, no acá.

export interface BackendUser {
  public_id: string
  email: string
  full_name: string
  role: { public_id: string; name: string; description: string | null; active: boolean }
  // App Roles de Entra ID sincronizados en el último login con Microsoft.
  // Vacío para cuentas que solo entran con credenciales.
  institutional_roles: string[]
  active: boolean
}

export interface ModalityOut {
  public_id: string
  code: string
  name: string
}

export interface PossibleStateOut {
  public_id: string
  code: string
  name: string
  description: string | null
  is_final_state: boolean
  is_initial_state: boolean
}

export interface RoleOut {
  public_id: string
  name: string
  description: string | null
  active: boolean
}
