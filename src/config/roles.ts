// Roles institucionales: SOLO para mostrarlos (Topbar, Sidebar). Los códigos
// vienen de GET /auth/me -> `roles`; los permisos NO se deciden con ellos sino
// con `modules` y `allowed_actions` (config/access.ts, config/actions.ts).
// Este archivo es el único que puede nombrar roles (regla de lint en
// eslint.config.js).

const ROLE_LABELS: Record<string, string> = {
  estudiante: 'Estudiante',
  docente: 'Docente',
  coordinador: 'Coordinación',
  comite_grado: 'Comité de grado',
  administrador: 'Administración',
  consulta: 'Consulta / Biblioteca',
  externo: 'Externo',
}

/** Nombres legibles de los roles; un código desconocido se muestra tal cual. */
export function roleLabels(codes: readonly string[]): string[] {
  return codes.map((code) => ROLE_LABELS[code] ?? code)
}

export const NO_ACCESS_PATH = '/sin-acceso'
