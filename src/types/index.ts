import type { ModuleKey } from '@/config/access'

// ─── Navigation ──────────────────────────────────────────────
export type NavSection =
  | 'dashboard'
  | 'proceso'
  | 'mis-propuestas'
  | 'propuestas'
  | 'asignacion'
  | 'portafolio'
  | 'calendario'
  | 'seguimiento'
  | 'mis-fechas'
  | 'tutor'
  | 'tutor-proyectos'
  | 'tutor-planes'
  | 'tutor-revisiones'
  | 'tutor-estadisticas'
  | 'tramites'
  | 'nuevo'
  | 'buscar'
  | 'trazabilidad'
  | 'documentos'
  | 'reportes'
  | 'comites'
  | 'administrativo'
  | 'externo'
  | 'calificaciones'
  | 'notificaciones'

// ─── Auth ─────────────────────────────────────────────────────

export type AuthStep = {
  label: string
  status: 'pending' | 'loading' | 'done'
}

export interface User {
  id: string
  name: string
  initials: string
  email: string
  // Códigos institucionales de GET /auth/me (solo para mostrarlos; ver config/roles.ts).
  roles: string[]
  // Módulos de GET /auth/me: lo único que decide menú y rutas (ver config/access.ts).
  modules: ModuleKey[]
  // Autorización de tratamiento de datos (Ley 1581), de GET /auth/me. Sin este dato no se pide nada.
  privacy?: { accepted: boolean; version: string; url: string }
}

// ─── Tramite ──────────────────────────────────────────────────
export type TramiteEstado =
  | 'borrador'
  | 'en-revision'
  | 'aprobado-consejo'
  | 'completado'
  | 'docs-faltantes'

export type TramiteModalidad =
  | 'Proyecto de grado'
  | 'Pasantía'
  | 'Homologación'
  | 'Emprendimiento'
  | 'Intercambio intl.'
  | 'Semillero'
  | 'Monografía'

export interface Tramite {
  id: string
  cedula: string
  estudiante: string
  modalidad: TramiteModalidad
  programa: string
  estado: TramiteEstado
  semestre: string
  updatedAt: string
  documentos: DocumentoTramite[]
}

export interface DocumentoTramite {
  id: string
  nombre: string
  estado: 'cargado' | 'pendiente' | 'sin-cargar'
}

// ─── Documento ────────────────────────────────────────────────
export type DocumentoTipo =
  | 'Anteproyecto'
  | 'Acta consejo'
  | 'Carta aval'
  | 'Paz y salvo'
  | 'Resolución'

export interface Documento {
  id: string
  nombre: string
  estudiante: string
  tipo: DocumentoTipo
  fecha: string
  url?: string
}

// ─── Timeline ─────────────────────────────────────────────────
export interface TimelineEvent {
  id: string
  titulo: string
  autor: string
  fecha: string
  status: 'done' | 'active'
}

// ─── Metrics ─────────────────────────────────────────────────
export interface Metric {
  label: string
  value: string | number
  sub: string
  subColor?: string
  accent?: 'orange' | 'green'
}
