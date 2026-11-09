import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { makeUser, modulesFor } from '@/test/users'
import { NAV_ITEMS, STUDENT_NAV_GROUPS, TUTOR_NAV_GROUPS } from '@/constants'
import type { User } from '@/types'
import type { CommitmentOut, Expediente, MonitoringSummary, MyMonitoring, StudentRow, TaskOut } from '@/services/monitoring.service'

vi.mock('@/services/monitoring.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/monitoring.service')>()),
  monitoringApi: {
    summary: vi.fn(), students: vi.fn(), expediente: vi.fn(), mine: vi.fn(), registerIntervention: vi.fn(), extend: vi.fn(),
    updateCommitment: vi.fn(), settings: vi.fn(), updateSettings: vi.fn(),
  },
}))

// El expediente carga además proceso, equipo, documentos y plan (cada uno con su propio manejo de errores).
vi.mock('@/services/processes.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/processes.service')>()),
  processesApi: { get: vi.fn(), team: vi.fn() },
}))
vi.mock('@/services/documents.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/documents.service')>()),
  documentsApi: { listForProcess: vi.fn() },
}))
vi.mock('@/services/workplan.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/workplan.service')>()),
  workPlanApi: { get: vi.fn() },
}))

import { monitoringApi } from '@/services/monitoring.service'
import { processesApi } from '@/services/processes.service'
import { documentsApi } from '@/services/documents.service'
import { workPlanApi } from '@/services/workplan.service'
import { useMonitoringBadge } from '@/hooks/useMonitoringBadge'
import { GroupRiskBanner, RiskLevelBadge, TaskNotes, TaskStatusBadge } from './monitoringUi'
import { RISK_META, TASK_STATE_META, formatDay, formatMoment } from './monitoringUi.utils'
import { TaskMonitoringDashboard } from './TaskMonitoringDashboard'
import { StudentTaskMonitoring } from './StudentTaskMonitoring'
import { TaskComplianceTimeline } from './TaskComplianceTimeline'
import { type InterventionForm, validateIntervention } from './intervention.utils'
import { previewDue } from './extension.utils'
import { TaskAlertSettings } from './TaskAlertSettings'
import { thresholdProblem } from './alertSettings.utils'
import { MyMonitoringPanel } from './MyMonitoringPanel'

const tutor: User = makeUser(['docente'], { id: 't1', name: 'Tutor', initials: 'T', email: 't@u.co' })
const coordinator: User = makeUser(['coordinador'], { id: 'c1', name: 'Coord', initials: 'C', email: 'c@u.co' })

const summary = (o: Partial<MonitoringSummary> = {}): MonitoringSummary => ({
  students: 4, al_dia: 1, atencion: 1, moderado: 1, critico: 1, groups_with_alert: 2, open_commitments: 3, overdue_commitments: 1, needing_attention: 3, ...o,
})

const row = (o: Partial<StudentRow> = {}): StudentRow => ({
  process_id: 'p1', process_code: 'TG-1', project_title: 'Sistema académico', modality_code: 'PROYECTO_INV', modality_name: 'Proyecto de investigación',
  student_id: 's1', student_name: 'Juan Pérez', student_email: 'juan@u.co', tutor_name: 'Ana Tutora', assigned: 6, delivered: 3, pending: 3, overdue: 2,
  next_due: '2026-11-13', level: 'moderado', last_intervention_at: '2026-11-02T15:00:00', open_commitments: 1, overdue_commitments: 0, group_alert: false, ...o,
})

const task = (o: Partial<TaskOut> = {}): TaskOut => ({
  assignment_id: 'a1', deliverable_id: 'd1', title: 'Entrega del planteamiento del problema', stage: 'Semestre 1', assigned_at: '2026-10-01T10:00:00',
  original_due: '2026-11-10', effective_due: '2026-11-10', delivered_at: null, state: 'vencida', delivery_note: null, late_delivery: false,
  days_to_due: -2, escalate_group: true, extensions: [], ...o,
})

const commitment = (o: Partial<CommitmentOut> = {}): CommitmentOut => ({
  id: 'k1', process_id: 'p1', student_id: 's1', student_name: 'Juan Pérez', description: 'Entregar el marco metodológico', due_date: '2026-11-13',
  status: 'pendiente', is_overdue: false, observations: null, task_ids: [], created_by: 'Ana Tutora', created_at: '2026-11-03T10:00:00', ...o,
})

const expediente = (o: Partial<Expediente> = {}): Expediente => ({
  student: row(), completion_pct: 50, group_alert: false, group_overdue_students: [], tasks: [task()], interventions: [], commitments: [commitment()], ...o,
})

beforeEach(() => {
  useAppStore.setState({ currentUser: tutor, isAuthenticated: true, accessToken: 'token' })
  vi.mocked(monitoringApi.summary).mockResolvedValue(summary())
  vi.mocked(monitoringApi.students).mockResolvedValue({ items: [row(), row({ student_id: 's2', student_name: 'María Gómez', level: 'al_dia', overdue: 0 })], total: 2, page: 1, page_size: 15 })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('estados visuales', () => {
  it('every task state has a color class, an icon and a text label (never color alone) following the approved palette', () => {
    const labels = Object.fromEntries(Object.entries(TASK_STATE_META).map(([k, v]) => [k, v.label]))
    expect(labels).toMatchObject({ pendiente: 'Pendiente', en_curso: 'En curso', entregada: 'Entregada', por_vencer: 'Por vencer', vencida: 'Vencida', ampliada: 'Plazo ampliado' })
    expect(TASK_STATE_META.pendiente.className).toContain('slate')
    expect(TASK_STATE_META.en_curso.className).toContain('blue')
    expect(TASK_STATE_META.entregada.className).toContain('green')
    expect(TASK_STATE_META.por_vencer.className).toContain('amber')
    expect(TASK_STATE_META.vencida.className).toContain('orange')
    expect(TASK_STATE_META.ampliada.className).toContain('violet')
    for (const meta of Object.values(TASK_STATE_META)) expect(meta.Icon).toBeTruthy()
  })

  it('risk levels keep the fixed colors: green, blue, amber, red', () => {
    expect(RISK_META.al_dia.className).toContain('green')
    expect(RISK_META.atencion.className).toContain('blue')
    expect(RISK_META.moderado.className).toContain('amber')
    expect(RISK_META.critico.className).toContain('red')
    render(<RiskLevelBadge level="critico" />)
    expect(screen.getByText('Riesgo crítico')).toBeInTheDocument()
  })

  it('shows the label with the effective due date, and explains late or extended deliveries', () => {
    render(<><TaskStatusBadge state="ampliada" dueDate="2026-11-13" /><TaskNotes task={task({ state: 'entregada', delivery_note: 'fuera_plazo_original' })} />
      <TaskNotes task={task({ state: 'entregada', delivery_note: 'dentro_plazo_ampliado' })} /><TaskNotes task={task({ state: 'ampliada', effective_due: '2026-11-13' })} /></>)
    expect(screen.getByText('Plazo ampliado')).toBeInTheDocument()
    expect(screen.getAllByText(/13 de nov de 2026/).length).toBeGreaterThan(0)
    expect(screen.getByText('Entregada fuera del plazo original')).toBeInTheDocument()
    expect(screen.getByText('Entregada dentro del plazo ampliado')).toBeInTheDocument()
  })

  it('formats calendar days without timezone drift and moments in Bogotá time', () => {
    expect(formatDay('2026-11-10')).toBe('10 de nov de 2026')
    expect(formatMoment('2026-11-11T03:00:00')).toMatch(/10 de nov de 2026/) // 03:00 UTC = 22:00 del 10 en Bogotá
    expect(formatDay(null)).toBe('—')
  })

  it('the group banner is generic for the team and names the origin only when culprits are provided', () => {
    const { rerender } = render(<GroupRiskBanner alert={{ active: true, message: 'El equipo tiene un incumplimiento pendiente de atención' }} />)
    expect(screen.getByText('Riesgo grupal crítico')).toBeInTheDocument()
    expect(screen.getByText('El equipo tiene un incumplimiento pendiente de atención')).toBeInTheDocument()
    expect(screen.queryByText(/Origen/)).not.toBeInTheDocument()
    rerender(<GroupRiskBanner alert={{ active: true, message: null }} culprits={['Juan Pérez']} />)
    expect(screen.getByText(/Origen: .*Juan Pérez/)).toBeInTheDocument()
    rerender(<GroupRiskBanner alert={{ active: false, message: null }} />)
    expect(screen.queryByText('Riesgo grupal crítico')).not.toBeInTheDocument()
  })
})

describe('línea de tiempo del cumplimiento', () => {
  it('shows original and effective dates, actual delivery, late flag and the extension history, independent per task', () => {
    render(<TaskComplianceTimeline tasks={[
      task({ state: 'ampliada', effective_due: '2026-11-13', extensions: [{ id: 'e1', previous_due_date: '2026-11-10', days_added: 3, new_due_date: '2026-11-13', reason: 'Enfermedad', observations: null, authorized_by: 'Ana Tutora', authorized_at: '2026-11-09T15:00:00', intervention_id: null }] }),
      task({ assignment_id: 'a2', deliverable_id: 'd2', title: 'Marco metodológico', state: 'entregada', delivered_at: '2026-11-12T15:00:00', late_delivery: true, delivery_note: 'fuera_plazo_original' }),
    ]} />)
    expect(screen.getAllByText('Fecha límite original')[0].nextElementSibling).toHaveTextContent('10 de nov de 2026')
    expect(screen.getAllByText('Fecha límite efectiva')[0].nextElementSibling).toHaveTextContent('13 de nov de 2026')
    expect(screen.getByText(/Enfermedad/)).toBeInTheDocument()
    expect(screen.getByText(/Autorizó Ana Tutora/)).toBeInTheDocument()
    expect(screen.getByText(/entrega tardía/)).toBeInTheDocument()
    expect(screen.getByText('Entregada fuera del plazo original')).toBeInTheDocument()
  })

  it('explains the empty state when the plan is not published', () => {
    render(<TaskComplianceTimeline tasks={[]} />)
    expect(screen.getByText(/plan de trabajo aún no está publicado/)).toBeInTheDocument()
  })
})

describe('tablero de seguimiento', () => {
  const renderDashboard = () => render(<MemoryRouter><TaskMonitoringDashboard /></MemoryRouter>)

  it('shows the backend KPIs, the student table and a card list for small screens', async () => {
    renderDashboard()
    expect(await screen.findByText('Estudiantes asignados')).toBeInTheDocument()
    const kpis = screen.getByRole('region', { name: 'Indicadores de seguimiento' }) ?? screen.getByLabelText('Indicadores de seguimiento')
    expect(within(kpis).getByText('Equipos con alerta grupal')).toBeInTheDocument()
    expect(within(kpis).getByText('Compromisos pendientes')).toBeInTheDocument()
    expect(within(kpis).getByText('1 vencidos')).toBeInTheDocument()
    const table = screen.getByRole('table')
    for (const column of ['Estudiante', 'Proyecto', 'Modalidad', 'Tutor', 'Asignadas', 'Entregadas', 'Pendientes', 'Vencidas', 'Próximo vencimiento', 'Nivel', 'Última intervención', 'Acciones']) {
      expect(within(table).getByRole('columnheader', { name: column })).toBeInTheDocument()
    }
    expect(within(table).getByText('Riesgo moderado')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Estudiantes' }).querySelectorAll('li')).toHaveLength(2) // vista de tarjetas
    expect(screen.getAllByRole('link', { name: /Abrir expediente de Juan Pérez/ })[0]).toHaveAttribute('href', '/seguimiento/p1/s1')
  })

  it('sends the filters to the API', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByRole('table')
    await user.selectOptions(screen.getByLabelText('Nivel de alerta'), 'critico')
    await waitFor(() => expect(monitoringApi.students).toHaveBeenLastCalledWith('token', expect.objectContaining({ level: 'critico', page: 1 })))
    await user.selectOptions(screen.getByLabelText('Estado del compromiso'), 'vencido')
    await waitFor(() => expect(monitoringApi.students).toHaveBeenLastCalledWith('token', expect.objectContaining({ level: 'critico', commitment: 'vencido' })))
    await user.type(screen.getByLabelText('Buscar estudiante'), 'maría')
    await waitFor(() => expect(monitoringApi.students).toHaveBeenLastCalledWith('token', expect.objectContaining({ search: 'maría' })))
    expect(screen.getByRole('option', { name: 'Proyecto de investigación' })).toBeInTheDocument() // opciones salen de los datos del backend
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => expect(monitoringApi.students).toHaveBeenLastCalledWith('token', { page: 1, page_size: 15 }))
  })

  it('shows an honest empty state and a retryable error (never made-up data)', async () => {
    const user = userEvent.setup()
    vi.mocked(monitoringApi.students).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 15 })
    vi.mocked(monitoringApi.summary).mockResolvedValue(summary({ students: 0 }))
    renderDashboard()
    expect(await screen.findByText('Todavía no hay estudiantes con seguimiento')).toBeInTheDocument()
    cleanup()
    vi.mocked(monitoringApi.summary).mockRejectedValueOnce(new ApiError(500, 'Error del servidor'))
    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(monitoringApi.summary).toHaveBeenCalledTimes(3))
  })

  it('only Coordinación sees the settings link', async () => {
    renderDashboard()
    await screen.findByRole('table')
    expect(screen.queryByRole('link', { name: /Configurar alertas/ })).not.toBeInTheDocument()
    cleanup()
    useAppStore.setState({ currentUser: coordinator })
    renderDashboard()
    expect(await screen.findByRole('link', { name: /Configurar alertas/ })).toHaveAttribute('href', '/seguimiento/configuracion')
  })
})

describe('expediente del estudiante', () => {
  const renderExpediente = () => render(
    <MemoryRouter initialEntries={['/seguimiento/p1/s1']}>
      <Routes><Route path="/seguimiento/:processId/:studentId" element={<StudentTaskMonitoring />} /></Routes>
    </MemoryRouter>
  )

  beforeEach(() => {
    vi.mocked(processesApi.get).mockRejectedValue(new ApiError(403, 'Sin acceso'))
    vi.mocked(processesApi.team).mockResolvedValue([])
    vi.mocked(documentsApi.listForProcess).mockResolvedValue([])
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Sin plan'))
  })

  it('shows student data, compliance summary, timeline, commitments and interventions', async () => {
    vi.mocked(monitoringApi.expediente).mockResolvedValue(expediente({
      interventions: [{ id: 'i1', kind: 'reunion_teams', mode: 'virtual', occurred_at: '2026-11-02T15:00:00', meeting_url: 'https://teams.microsoft.com/x', observations: 'Se revisó el avance', difficulties: null, student_id: 's1', student_name: 'Juan Pérez', task_ids: [], created_by: 'Ana Tutora', created_at: '2026-11-02T15:00:00' }],
    }))
    renderExpediente()
    expect(await screen.findByRole('heading', { name: 'Juan Pérez' })).toBeInTheDocument()
    expect(monitoringApi.expediente).toHaveBeenCalledWith('token', 'p1', 's1')
    expect(screen.getByText('juan@u.co')).toBeInTheDocument()
    expect(screen.getByText('Cumplimiento')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Entrega del planteamiento del problema')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('tab', { name: /Intervenciones/ }))
    expect(screen.getByText('Entregar el marco metodológico')).toBeInTheDocument()
    expect(screen.getByText(/Reunión por Teams · Virtual/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Enlace de la reunión' })).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('shows the group risk banner naming the origin to the tutor, without altering the individual counts', async () => {
    vi.mocked(monitoringApi.expediente).mockResolvedValue(expediente({ student: row({ student_name: 'Carlos Ruiz', overdue: 0, level: 'al_dia', group_alert: true }), group_alert: true, group_overdue_students: ['Juan Pérez'] }))
    renderExpediente()
    expect(await screen.findByText('Riesgo grupal crítico')).toBeInTheDocument()
    expect(screen.getByText(/Origen: .*Juan Pérez/)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Identificación del estudiante' })).getByText('Al día')).toBeInTheDocument() // el nivel individual de Carlos no cambia
  })

  it('lets the tutor register interventions and extend deadlines; Coordinación only supervises', async () => {
    const user = userEvent.setup()
    vi.mocked(monitoringApi.expediente).mockResolvedValue(expediente())
    renderExpediente()
    await user.click(await screen.findByRole('button', { name: /Registrar intervención/ }))
    expect(screen.getByRole('dialog', { name: 'Registrar intervención académica' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: /Ampliar plazo/ }))
    expect(screen.getByRole('dialog', { name: 'Ampliar plazo de entrega' })).toBeInTheDocument()
    cleanup()

    useAppStore.setState({ currentUser: coordinator })
    renderExpediente()
    await screen.findByRole('heading', { name: 'Juan Pérez' })
    expect(screen.queryByRole('button', { name: /Registrar intervención/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ampliar plazo/ })).not.toBeInTheDocument()
  })

  it('submits an intervention with Teams link, a related task and a commitment', async () => {
    const user = userEvent.setup()
    vi.mocked(monitoringApi.expediente).mockResolvedValue(expediente())
    vi.mocked(monitoringApi.registerIntervention).mockResolvedValue({ id: 'i1' } as never)
    renderExpediente()
    await user.click(await screen.findByRole('button', { name: /Registrar intervención/ }))
    await user.type(screen.getByLabelText('Fecha y hora (Bogotá)'), '2026-11-04T10:00')
    await user.type(screen.getByLabelText('Enlace de la reunión (opcional)'), 'https://teams.microsoft.com/l/meetup-join/abc')
    await user.type(screen.getByLabelText('Observaciones y retroalimentación'), 'Se acordó priorizar el planteamiento')
    await user.click(screen.getByRole('checkbox', { name: 'Entrega del planteamiento del problema' }))
    await user.click(screen.getByRole('button', { name: /Agregar compromiso/ }))
    await user.type(screen.getByLabelText('Compromiso 1'), 'Entregar el marco metodológico')
    await user.type(screen.getByLabelText('Fecha de cumplimiento'), '2026-11-13')
    await user.click(screen.getByRole('button', { name: 'Guardar seguimiento' }))
    await waitFor(() => expect(monitoringApi.registerIntervention).toHaveBeenCalledTimes(1))
    const body = vi.mocked(monitoringApi.registerIntervention).mock.calls[0][1]
    expect(body).toMatchObject({ process_id: 'p1', student_id: 's1', kind: 'reunion_teams', mode: 'virtual', occurred_at: '2026-11-04T10:00:00-05:00', deliverable_ids: ['d1'] })
    expect(body.commitments[0]).toMatchObject({ description: 'Entregar el marco metodológico', due_date: '2026-11-13' })
    expect(await screen.findByText('Intervención registrada.')).toBeInTheDocument()
  })

  it('submits an extension for the selected team members and tasks and shows the preview of the new date', async () => {
    const user = userEvent.setup()
    vi.mocked(monitoringApi.expediente).mockResolvedValue(expediente())
    vi.mocked(monitoringApi.students).mockResolvedValue({ items: [row(), row({ student_id: 's2', student_name: 'Carlos Ruiz' })], total: 2, page: 1, page_size: 100 })
    vi.mocked(monitoringApi.extend).mockResolvedValue([])
    renderExpediente()
    await user.click(await screen.findByRole('button', { name: /Ampliar plazo/ }))
    await user.click(await screen.findByRole('checkbox', { name: 'Carlos Ruiz' }))
    await user.click(screen.getByRole('checkbox', { name: /Entrega del planteamiento del problema/ }))
    expect(screen.getByText(/→ 13 de nov de 2026/)).toBeInTheDocument() // 10 nov + 3 días
    await user.click(screen.getByRole('button', { name: 'Autorizar ampliación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El motivo es obligatorio') // sin motivo no se envía
    expect(monitoringApi.extend).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), 'Dificultades de acceso')
    await user.click(screen.getByRole('button', { name: 'Autorizar ampliación' }))
    await waitFor(() => expect(monitoringApi.extend).toHaveBeenCalledWith('token', expect.objectContaining({ process_id: 'p1', student_ids: ['s1', 's2'], deliverable_ids: ['d1'], days: 3, reason: 'Dificultades de acceso' })))
  })

  it('lets the tutor change a commitment status', async () => {
    const user = userEvent.setup()
    vi.mocked(monitoringApi.expediente).mockResolvedValue(expediente())
    vi.mocked(monitoringApi.updateCommitment).mockResolvedValue(commitment({ status: 'cumplido' }))
    renderExpediente()
    await user.click(await screen.findByRole('tab', { name: /Intervenciones/ }))
    await user.selectOptions(await screen.findByLabelText('Estado de: Entregar el marco metodológico'), 'cumplido')
    await waitFor(() => expect(monitoringApi.updateCommitment).toHaveBeenCalledWith('token', 'k1', 'cumplido'))
  })

  it('shows a retryable error when the expediente is forbidden or missing', async () => {
    vi.mocked(monitoringApi.expediente).mockRejectedValueOnce(new ApiError(404, 'Proyecto no encontrado'))
    renderExpediente()
    expect(await screen.findByRole('alert')).toHaveTextContent('Proyecto no encontrado')
  })
})

describe('reglas de los formularios', () => {
  const base: InterventionForm = { kind: 'reunion_teams', mode: 'virtual', occurred: '2026-11-04T10:00', url: '', observations: 'Algo', difficulties: '', taskIds: [], commitments: [] }

  it('validates the intervention form like the backend', () => {
    expect(validateIntervention(base)).toBeNull()
    expect(validateIntervention({ ...base, occurred: '' })).toMatch(/fecha y hora/)
    expect(validateIntervention({ ...base, url: 'javascript:alert(1)' })).toMatch(/https/)
    expect(validateIntervention({ ...base, mode: 'presencial' })).toMatch(/Teams es virtual/)
    expect(validateIntervention({ ...base, observations: '' })).toMatch(/observaciones/)
    expect(validateIntervention({ ...base, commitments: [{ description: 'ab', due: '', taskIds: [] }] })).toMatch(/compromiso 1/)
  })

  it('previews extension dates in calendar days without an arbitrary cap', () => {
    expect(previewDue('2026-11-10', 3)).toBe('2026-11-13')
    expect(previewDue('2026-11-10', 90)).toBe('2027-02-08')
  })

  it('validates the alert thresholds order', () => {
    expect(thresholdProblem(1, 2, 3)).toBeNull()
    expect(thresholdProblem(0, 2, 3)).toBeTruthy()
    expect(thresholdProblem(2, 2, 3)).toBeTruthy()
    expect(thresholdProblem(1, 3, 3)).toBeTruthy()
  })
})

describe('configuración de alertas', () => {
  const settings = { attention_threshold: 1, moderate_threshold: 2, critical_threshold: 3, warning_days: 3, group_escalation_default: true, notifications_enabled: true, commitment_tracking_enabled: true, timezone: 'America/Bogota', updated_at: null, history: ['2026-11-01 10:00 · Coord: warning_days: 2 → 3'] }

  it('loads the values from the backend, blocks illogical thresholds and saves valid ones', async () => {
    const user = userEvent.setup()
    vi.mocked(monitoringApi.settings).mockResolvedValue(settings)
    vi.mocked(monitoringApi.updateSettings).mockResolvedValue({ ...settings, warning_days: 5 })
    useAppStore.setState({ currentUser: coordinator })
    render(<MemoryRouter><TaskAlertSettings /></MemoryRouter>)
    expect(await screen.findByLabelText('Riesgo crítico (tareas vencidas)')).toHaveValue(3)
    expect(screen.getByText('America/Bogota')).toBeInTheDocument()
    expect(screen.getByText(/warning_days: 2 → 3/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Riesgo crítico (tareas vencidas)'))
    await user.type(screen.getByLabelText('Riesgo crítico (tareas vencidas)'), '2')
    expect(screen.getByRole('alert')).toHaveTextContent('riesgo crítico debe requerir más')
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()

    await user.clear(screen.getByLabelText('Riesgo crítico (tareas vencidas)'))
    await user.type(screen.getByLabelText('Riesgo crítico (tareas vencidas)'), '4')
    await user.clear(screen.getByLabelText('Días para advertir vencimiento'))
    await user.type(screen.getByLabelText('Días para advertir vencimiento'), '5')
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    await waitFor(() => expect(monitoringApi.updateSettings).toHaveBeenCalledWith('token', expect.objectContaining({ critical_threshold: 4, warning_days: 5 })))
    expect(await screen.findByText('Configuración guardada.')).toBeInTheDocument()
  })
})

describe('vista del estudiante', () => {
  const mine = (o: Partial<MyMonitoring> = {}): MyMonitoring => ({ level: 'atencion', tasks: [task({ state: 'ampliada', effective_due: '2026-11-13' })], commitments: [commitment()], group_alerts: [], ...o })

  it('shows own tasks, extended dates and commitments, and only a generic group indicator', async () => {
    vi.mocked(monitoringApi.mine).mockResolvedValue(mine({ group_alerts: [{ process_id: 'p1', project_title: 'Sistema', active: true, message: 'El equipo tiene un incumplimiento pendiente de atención' }] }))
    render(<MemoryRouter><MyMonitoringPanel /></MemoryRouter>)
    expect(await screen.findByText('Atención inicial')).toBeInTheDocument()
    expect(screen.getByText('Plazo ampliado')).toBeInTheDocument()
    expect(screen.getByText('Entregar el marco metodológico')).toBeInTheDocument()
    expect(screen.getByText('Riesgo grupal crítico')).toBeInTheDocument()
    expect(screen.queryByText(/Origen:/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Estado de:/)).not.toBeInTheDocument() // el estudiante no cambia compromisos
  })

  it('shows an error with retry', async () => {
    vi.mocked(monitoringApi.mine).mockRejectedValueOnce(new ApiError(500, 'Error del servidor'))
    render(<MemoryRouter><MyMonitoringPanel /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
  })
})

describe('menú y contador', () => {
  it('adds "Seguimiento y alertas" to the tutor and coordination menus, and "Mis fechas" to the student menu', () => {
    const tutorItems = TUTOR_NAV_GROUPS.flatMap((g) => g.items)
    expect(tutorItems.map((i) => i.label)).toEqual(expect.arrayContaining(['Proyectos asignados', 'Planes de trabajo', 'Entregables de estudiantes', 'Fechas y compromisos']))
    expect(tutorItems.find((i) => i.key === 'seguimiento')).toMatchObject({ path: '/seguimiento' })
    expect(NAV_ITEMS.find((i) => i.id === 'seguimiento')).toMatchObject({ label: 'Seguimiento y alertas', path: '/seguimiento' })
    expect(STUDENT_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === 'mis-fechas')).toMatchObject({ path: '/mis-fechas' })
  })

  it('the backend exposes the module only to tutors and coordination; students get their own panel', () => {
    expect(modulesFor(['docente'])).toContain('seguimiento')
    expect(modulesFor(['coordinador'])).toContain('seguimiento')
    expect(modulesFor(['estudiante'])).not.toContain('seguimiento')
    expect(modulesFor(['estudiante'])).toContain('mis-fechas')
    expect(modulesFor(['docente'])).not.toContain('mis-fechas')
  })

  it('the badge counts unique students from the backend and is absent when disabled or on failure', async () => {
    const { result } = renderHook(() => useMonitoringBadge(true))
    await waitFor(() => expect(result.current).toBe(3))
    expect(monitoringApi.summary).toHaveBeenCalledTimes(1)
    const off = renderHook(() => useMonitoringBadge(false))
    expect(off.result.current).toBeNull()
    vi.mocked(monitoringApi.summary).mockRejectedValueOnce(new ApiError(500, 'x'))
    const failing = renderHook(() => useMonitoringBadge(true))
    await waitFor(() => expect(monitoringApi.summary).toHaveBeenCalledTimes(2))
    expect(failing.result.current).toBeNull()
  })
})
