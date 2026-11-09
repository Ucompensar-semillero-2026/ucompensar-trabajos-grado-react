// Tipos que más de un dominio necesita (ej. un ProcessOut trae un
// BackendUser y un ModalityOut). Lo específico de un solo dominio vive
// en su propio archivo de servicio, no acá.

export interface BackendUser {
  public_id: string
  email: string
  full_name: string
  /** @deprecated Obsoleto en el backend: usar `roles` y `modules` de GET /auth/me. */
  role?: { public_id: string; name: string; description: string | null; active: boolean } | null
  /** @deprecated App Roles sin traducir: usar `roles` de GET /auth/me. */
  institutional_roles?: string[]
  active: boolean
}

/** GET /auth/me: única fuente de roles y módulos (docs/ROLES-DISENO.md, contrato 6.1). */
export interface MeOut extends BackendUser {
  roles: string[]
  modules: string[]
  /** Minutos sin actividad tras los que el servidor cierra la sesión. */
  idle_timeout_minutes?: number
  /** Ley 1581: ¿ya aceptó la política vigente? (ver PrivacyConsentDialog) */
  privacy_accepted?: boolean
  privacy_policy_version?: string
  privacy_policy_url?: string
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
