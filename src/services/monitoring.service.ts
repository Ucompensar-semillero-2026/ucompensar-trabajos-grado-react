import { authHeaders, request } from './http'

// Contrato de /api/monitoring/* (backend: app/domains/monitoring). Los cálculos de fechas, estados y niveles de riesgo
// son del backend; el frontend solo los presenta.

export type TaskState = 'pendiente' | 'en_curso' | 'entregada' | 'por_vencer' | 'vencida' | 'ampliada' | 'cancelada'
export type RiskLevel = 'al_dia' | 'atencion' | 'moderado' | 'critico'
export type DeliveryNote = 'fuera_plazo_original' | 'dentro_plazo_ampliado'
export type InterventionKind =
  | 'reunion_teams' | 'reunion_presencial' | 'retroalimentacion_individual' | 'retroalimentacion_grupal'
  | 'llamado_atencion' | 'compromiso_entrega' | 'seguimiento_extraordinario' | 'otro'
export type CommitmentStatus = 'pendiente' | 'en_seguimiento' | 'cumplido' | 'incumplido' | 'cancelado'

export interface MonitoringSummary {
  students: number
  al_dia: number
  atencion: number
  moderado: number
  critico: number
  groups_with_alert: number
  open_commitments: number
  overdue_commitments: number
  needing_attention: number
}

export interface StudentRow {
  process_id: string
  process_code: string
  project_title: string | null
  modality_code: string
  modality_name: string
  student_id: string
  student_name: string
  student_email: string
  tutor_name: string | null
  assigned: number
  delivered: number
  pending: number
  overdue: number
  next_due: string | null
  level: RiskLevel
  last_intervention_at: string | null
  open_commitments: number
  overdue_commitments: number
  group_alert: boolean
}

export interface StudentPage {
  items: StudentRow[]
  total: number
  page: number
  page_size: number
}

export interface ExtensionOut {
  id: string
  previous_due_date: string
  days_added: number
  new_due_date: string
  reason: string
  observations: string | null
  authorized_by: string
  authorized_at: string
  intervention_id: string | null
}

export interface TaskOut {
  assignment_id: string
  deliverable_id: string
  title: string
  stage: string
  assigned_at: string
  original_due: string | null
  effective_due: string | null
  delivered_at: string | null
  state: TaskState
  delivery_note: DeliveryNote | null
  late_delivery: boolean
  days_to_due: number | null
  escalate_group: boolean
  extensions: ExtensionOut[]
}

export interface CommitmentOut {
  id: string
  process_id: string
  student_id: string
  student_name: string
  description: string
  due_date: string
  status: CommitmentStatus
  is_overdue: boolean
  observations: string | null
  task_ids: string[]
  created_by: string
  created_at: string
}

export interface InterventionOut {
  id: string
  kind: InterventionKind
  mode: 'presencial' | 'virtual'
  occurred_at: string
  meeting_url: string | null
  observations: string | null
  difficulties: string | null
  student_id: string | null
  student_name: string | null
  task_ids: string[]
  created_by: string
  created_at: string
}

export interface Expediente {
  student: StudentRow
  completion_pct: number
  group_alert: boolean
  group_overdue_students: string[]
  tasks: TaskOut[]
  interventions: InterventionOut[]
  commitments: CommitmentOut[]
}

export interface GroupAlert {
  process_id: string
  project_title: string | null
  active: boolean
  message: string | null
}

export interface MyMonitoring {
  level: RiskLevel
  tasks: TaskOut[]
  commitments: CommitmentOut[]
  group_alerts: GroupAlert[]
}

export interface AlertSettings {
  attention_threshold: number
  moderate_threshold: number
  critical_threshold: number
  warning_days: number
  group_escalation_default: boolean
  notifications_enabled: boolean
  commitment_tracking_enabled: boolean
  timezone: string
  updated_at: string | null
  history: string[]
}

export type AlertSettingsInput = Omit<AlertSettings, 'timezone' | 'updated_at' | 'history'>

export interface StudentFilters {
  search?: string
  process_id?: string
  modality?: string
  level?: RiskLevel
  commitment?: CommitmentStatus | 'vencido'
  page?: number
  page_size?: number
}

export interface InterventionInput {
  process_id: string
  student_id: string | null
  kind: InterventionKind
  mode: 'presencial' | 'virtual'
  occurred_at: string
  meeting_url: string | null
  observations: string | null
  difficulties: string | null
  deliverable_ids: string[]
  commitments: Array<{ description: string; due_date: string; student_id?: string | null; deliverable_ids: string[]; observations?: string | null }>
}

export interface ExtensionInput {
  process_id: string
  student_ids: string[]
  deliverable_ids: string[]
  days: number
  reason: string
  observations?: string | null
  intervention_id?: string | null
}

const json = (body: unknown) => JSON.stringify(body)

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value))
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const monitoringApi = {
  summary: (token: string) => request<MonitoringSummary>('/monitoring/summary', { headers: authHeaders(token) }),
  students: (token: string, filters: StudentFilters = {}) =>
    request<StudentPage>(`/monitoring/students${query({ ...filters })}`, { headers: authHeaders(token) }),
  expediente: (token: string, processId: string, studentId: string) =>
    request<Expediente>(`/monitoring/processes/${processId}/students/${studentId}`, { headers: authHeaders(token) }),
  mine: (token: string) => request<MyMonitoring>('/monitoring/me', { headers: authHeaders(token) }),
  registerIntervention: (token: string, body: InterventionInput) =>
    request<InterventionOut>('/monitoring/interventions', { method: 'POST', headers: authHeaders(token), body: json(body) }),
  extend: (token: string, body: ExtensionInput) =>
    request<ExtensionOut[]>('/monitoring/extensions', { method: 'POST', headers: authHeaders(token), body: json(body) }),
  updateCommitment: (token: string, id: string, status: CommitmentStatus, observations?: string) =>
    request<CommitmentOut>(`/monitoring/commitments/${id}`, { method: 'PATCH', headers: authHeaders(token), body: json({ status, observations: observations ?? null }) }),
  settings: (token: string) => request<AlertSettings>('/monitoring/settings', { headers: authHeaders(token) }),
  updateSettings: (token: string, body: AlertSettingsInput) =>
    request<AlertSettings>('/monitoring/settings', { method: 'PUT', headers: authHeaders(token), body: json(body) }),
}
