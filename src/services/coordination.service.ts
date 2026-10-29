import { authHeaders, request } from './http'
import type { PersonOut, ProgressOut } from './workplan.service'
import type { PlanStatus } from './tutor.service'

// Contrato de /api/coordination/* (backend: workplan/coordination_*). Solo coordinación y administración.

export interface TutorRefOut {
  member_public_id: string
  public_id: string
  full_name: string
}

export interface CoordinationProcessOut {
  process_public_id: string
  process_code: string
  title: string | null
  student: PersonOut
  modality_name: string
  process_state_code: string
  process_state_name: string
  academic_semester: string
  created_at: string
  tutor: TutorRefOut | null
  plan_status: PlanStatus
  current_stage: string | null
  progress: ProgressOut | null
  next_due_title: string | null
  next_due_date: string | null
  pending_review_count: number
  corrections_count: number
  overdue_count: number
  official_completion: boolean
}

export interface CoordinationPage {
  items: CoordinationProcessOut[]
  total: number
  page: number
  page_size: number
}

export interface CoordinationSummary {
  registered_processes: number
  pending_tutor: number
  with_tutor: number
  active_students: number
  pending_reviews: number
  delayed_projects: number
  tutors_available: number
  state_distribution: Array<{ code: string; name: string; count: number }>
}

export interface CoordinationFilters {
  search?: string
  modality?: string
  state?: string
  assignment?: 'sin_tutor' | 'con_tutor' | ''
  page?: number
  page_size?: number
}

export const coordinationApi = {
  summary: (accessToken: string) => request<CoordinationSummary>('/coordination/summary', { headers: authHeaders(accessToken) }),

  processes: (accessToken: string, filters: CoordinationFilters = {}) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && value !== null) params.set(key, String(value))
    }
    const query = params.toString()
    return request<CoordinationPage>(`/coordination/processes${query ? `?${query}` : ''}`, { headers: authHeaders(accessToken) })
  },
}

// ── Portafolio (backend: workplan/portfolio_service). Solo propuestas y procesos persistidos. ──
// Las ofertas del catálogo público son datos estáticos del frontend: este contrato NO las incluye.

export type PortfolioCategory = 'propuestas' | 'por_asignar' | 'en_proceso' | 'finalizados' | 'archivadas'

export interface PortfolioItem {
  kind: 'propuesta' | 'proceso'
  public_id: string
  code: string
  title: string
  modality_code: string | null
  modality_name: string
  holder: string
  tutor: PersonOut | null
  state_code: string
  state_name: string
  category: PortfolioCategory
  created_at: string
  updated_at: string
  closed_at: string | null
  plan_status: PlanStatus | null
  progress: ProgressOut | null
  overdue: boolean
}

export interface PortfolioPage {
  items: PortfolioItem[]
  total: number
  page: number
  page_size: number
  facets: {
    tutors: PersonOut[]
    modalities: Array<{ code: string; name: string }>
    states: Array<{ code: string; name: string; count: number }>
  }
}

export interface PortfolioSummary {
  proposals_to_evaluate: number
  pending_assignment: number
  pending_assignment_processes: number
  in_progress: number
  finished: number
  delayed: number
  total: number
}

export interface PortfolioFilters {
  category?: PortfolioCategory | ''
  kind?: 'propuesta' | 'proceso' | ''
  search?: string
  modality?: string
  state?: string
  tutor?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export const portfolioApi = {
  summary: (accessToken: string) => request<PortfolioSummary>('/coordination/portfolio/summary', { headers: authHeaders(accessToken) }),

  list: (accessToken: string, filters: PortfolioFilters = {}) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && value !== null) params.set(key, String(value))
    }
    const query = params.toString()
    return request<PortfolioPage>(`/coordination/portfolio${query ? `?${query}` : ''}`, { headers: authHeaders(accessToken) })
  },
}
