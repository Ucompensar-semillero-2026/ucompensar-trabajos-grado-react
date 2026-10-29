import { authHeaders, request } from './http'
import type { DeliverableStatus, PersonOut, ProgressOut } from './workplan.service'

// Contrato de GET /api/tutor/overview (backend: workplan/tutor_service.py).
// Solo devuelve proyectos donde la persona autenticada es tutora ACTIVA (process_team).

export type PlanStatus = 'sin_plan' | 'borrador' | 'publicado'

export interface TutorProjectOut {
  process_public_id: string
  title: string | null
  process_code: string
  student: PersonOut
  modality_name: string
  process_state_code: string
  process_state_name: string
  academic_semester: string
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

export interface PendingReviewOut {
  process_public_id: string
  project_title: string | null
  process_code: string
  student: PersonOut
  deliverable_public_id: string
  deliverable_title: string
  submission_public_id: string
  version: number
  submitted_at: string
  due_date: string | null
}

export interface UpcomingDeadlineOut {
  process_public_id: string
  project_title: string | null
  process_code: string
  student: PersonOut
  deliverable_title: string
  due_date: string
  status: DeliverableStatus
  is_overdue: boolean
}

export interface TutorStatsOut {
  assigned_projects: number
  active_students: number
  pending_reviews: number
  due_soon: number
  needs_corrections: number
  overdue: number
  average_progress: number | null
  status_distribution: Record<DeliverableStatus, number>
}

export interface TutorOverviewOut {
  stats: TutorStatsOut
  projects: TutorProjectOut[]
  pending_reviews: PendingReviewOut[]
  upcoming_deadlines: UpcomingDeadlineOut[]
}

export const tutorApi = {
  overview: (accessToken: string) => request<TutorOverviewOut>('/tutor/overview', { headers: authHeaders(accessToken) }),
}
