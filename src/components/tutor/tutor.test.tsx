import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { STUDENT_NAV_GROUPS, TUTOR_NAV_GROUPS } from '@/constants'
import { isTutorWorkspaceUser } from '@/config/access'
import { homePathFor } from '@/config/roles'
import type { User } from '@/types'
import type { DeliverableOut, StageOut, WorkPlanOut } from '@/services/workplan.service'
import type { TutorOverviewOut, TutorProjectOut } from '@/services/tutor.service'

vi.mock('@/services/tutor.service', () => ({ tutorApi: { overview: vi.fn() } }))
vi.mock('@/services/processes.service', () => ({
  processesApi: { get: vi.fn(), team: vi.fn(), history: vi.fn(), teamCandidates: vi.fn(), addTeamMember: vi.fn(), removeTeamMember: vi.fn() },
}))
vi.mock('@/services/workplan.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/workplan.service')>()),
  workPlanApi: {
    get: vi.fn(), activity: vi.fn(), create: vi.fn(), updateDates: vi.fn(), publish: vi.fn(), createStage: vi.fn(), updateStage: vi.fn(),
    createDeliverable: vi.fn(), updateDeliverable: vi.fn(), uploadTemplate: vi.fn(), review: vi.fn(), listSubmissions: vi.fn(),
  },
}))

import { tutorApi } from '@/services/tutor.service'
import { processesApi } from '@/services/processes.service'
import { workPlanApi } from '@/services/workplan.service'
import { Sidebar } from '@/components/layout/Sidebar'
import { TutorPanel, TutorProjectsPage, TutorReviewsPage, TutorStatsPage } from './TutorPages'
import { ProjectExpediente } from './ProjectExpediente'
import { TeamPanel } from './TeamPanel'

const tutorUser: User = { id: 'tutor-1', name: 'Andres Consultor', initials: 'AC', email: 't@ucompensar.edu.co', role: 'tutor_investigador', institutionalRoles: ['Docente'], authMethod: 'sso' }
const studentUser: User = { id: 'student-1', name: 'Ana Estudiante', initials: 'AE', email: 'a@ucompensar.edu.co', role: 'estudiante', institutionalRoles: ['Estudiante'], authMethod: 'sso' }

const project = (overrides: Partial<TutorProjectOut> = {}): TutorProjectOut => ({
  process_public_id: 'p1',
  title: 'Detección de fallas',
  process_code: 'PROYECTO_INV-2026-ABC',
  student: { public_id: 'student-1', full_name: 'Ana Estudiante' },
  modality_name: 'Proyecto de investigación',
  process_state_code: 'RADICADO',
  process_state_name: 'Radicado',
  academic_semester: '2026-1',
  plan_status: 'publicado',
  current_stage: 'Formulación y planificación',
  progress: { total_required: 4, approved: 1, pending_review: 1, needs_corrections: 0, overdue: 0, percent: 25 },
  next_due_title: 'Metodología',
  next_due_date: '2026-04-15',
  pending_review_count: 1,
  corrections_count: 0,
  overdue_count: 0,
  official_completion: false,
  ...overrides,
})

const overview = (projects: TutorProjectOut[], stats: Partial<TutorOverviewOut['stats']> = {}): TutorOverviewOut => ({
  stats: {
    assigned_projects: projects.length,
    active_students: projects.length,
    pending_reviews: 1,
    due_soon: 2,
    needs_corrections: 1,
    overdue: 0,
    average_progress: 25,
    status_distribution: { pendiente: 1, disponible: 2, en_revision: 1, requiere_correcciones: 1, aprobado: 1 },
    ...stats,
  },
  projects,
  pending_reviews: [
    { process_public_id: 'p1', project_title: 'Detección de fallas', process_code: 'C', student: { public_id: 's', full_name: 'Ana Estudiante' }, deliverable_public_id: 'd1', deliverable_title: 'Propuesta inicial', submission_public_id: 'sub1', version: 2, submitted_at: '2026-03-10T10:00:00', due_date: '2026-03-20' },
  ],
  upcoming_deadlines: [{ process_public_id: 'p1', project_title: 'x', process_code: 'C', student: { public_id: 's', full_name: 'Ana Estudiante' }, deliverable_title: 'Metodología', due_date: '2026-04-15', status: 'disponible', is_overdue: false }],
})

function deliverable(o: Partial<DeliverableOut> = {}): DeliverableOut {
  return {
    public_id: 'd1', stage_public_id: 'st1', title: 'Propuesta inicial', instructions: null, mandatory: true, applicable: true, active: true,
    sort_order: 0, due_date: '2026-03-20', depends_on_public_id: null, accepted_extensions: null, template_file_name: null,
    template_download_url: null, status: 'disponible', is_overdue: false, can_submit: false, submissions_count: 0, current_submission: null, ...o,
  }
}
const stage = (deliverables: DeliverableOut[]): StageOut => ({ public_id: 'st1', name: 'Formulación', description: null, semester: 1, sort_order: 0, active: true, deliverables })
const plan = (deliverables: DeliverableOut[], o: Partial<WorkPlanOut> = {}): WorkPlanOut => ({
  public_id: 'plan1', process_public_id: 'p1', process_title: 'Detección de fallas', status: 'publicado', start_date: '2026-02-02', target_end_date: '2026-12-04',
  template_code: null, published_at: '2026-02-10T10:00:00', stages: [stage(deliverables)],
  progress: { total_required: deliverables.length, approved: 0, pending_review: 0, needs_corrections: 0, overdue: 0, percent: 0 },
  process_state_code: 'RADICADO', process_state_name: 'Radicado', official_completion: false, can_manage: true, ...o,
})
const submission = (o = {}) => ({
  public_id: 'sub1', version: 1, file_name: 'propuesta.pdf', status: 'en_revision' as const, student_comment: null,
  submitted_by: { public_id: 'student-1', full_name: 'Ana Estudiante' }, submitted_at: '2026-03-10T10:00:00',
  download_url: 'https://files.example/propuesta.pdf?sig=1', reviews: [], ...o,
})

const renderPage = (ui: React.ReactElement, url = '/') => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>)
const renderExpediente = (url = '/tutor/proyectos/p1') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/tutor/proyectos/:processId" element={<ProjectExpediente />} /></Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  useAppStore.setState({ currentUser: tutorUser, isAuthenticated: true, accessToken: 'token' })
  vi.mocked(processesApi.get).mockResolvedValue({ public_id: 'p1', process_code: 'PROYECTO_INV-2026-ABC', title: 'Detección de fallas', student: { public_id: 'student-1', full_name: 'Ana Estudiante' }, modality: { name: 'Proyecto de investigación' }, state: { name: 'Radicado' }, closed_at: null } as never)
  vi.mocked(processesApi.team).mockResolvedValue([
    { public_id: 'm1', user: { public_id: 'student-1', full_name: 'Ana Estudiante' }, process_role: 'estudiante', assigned_at: '', active: true },
    { public_id: 'm2', user: { public_id: 'tutor-1', full_name: 'Andres Consultor' }, process_role: 'tutor', assigned_at: '', active: true },
  ] as never)
  vi.mocked(processesApi.history).mockResolvedValue([])
  vi.mocked(workPlanApi.activity).mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('menú y rol del tutor', () => {
  it('uses a different menu for tutors and students, with the approved entries', () => {
    expect(TUTOR_NAV_GROUPS.map((g) => [g.label, g.items.map((i) => i.label)])).toEqual([
      ['Principal', ['Panel del tutor']],
      ['Seguimiento académico', ['Mis proyectos asignados', 'Planes de trabajo', 'Plantillas y revisiones']],
      ['Análisis y comunicación', ['Estadísticas e informes', 'Notificaciones', 'Ayuda y soporte']],
    ])
    expect(JSON.stringify(TUTOR_NAV_GROUPS)).not.toContain('Mi proceso de grado')
    expect(JSON.stringify(STUDENT_NAV_GROUPS)).not.toContain('Panel del tutor')
  })

  it('renders the tutor sidebar for a teacher and the student sidebar for a student', () => {
    const { unmount } = renderPage(<Sidebar user={tutorUser} onLogout={() => {}} />, '/tutor/proyectos/p1')
    expect(screen.getByRole('button', { name: 'Panel del tutor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mis proyectos asignados' })).toHaveAttribute('aria-current', 'page') // el expediente pertenece a "Mis proyectos"
    expect(screen.queryByRole('button', { name: 'Mi proceso de grado' })).not.toBeInTheDocument()
    unmount()

    renderPage(<Sidebar user={studentUser} onLogout={() => {}} />)
    expect(screen.getByRole('button', { name: 'Mi proceso de grado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Panel del tutor' })).not.toBeInTheDocument()
  })

  it('only a pure teacher gets the tutor workspace; coordination keeps its own menu and home', () => {
    expect(isTutorWorkspaceUser({ institutionalRoles: ['Docente'] })).toBe(true)
    for (const mixed of [['Docente', 'Coordinador'], ['Docente', 'Administrador'], ['Docente', 'ComiteGrado'], ['Estudiante']] as const) {
      expect(isTutorWorkspaceUser({ institutionalRoles: [...mixed] })).toBe(false)
    }
    expect(homePathFor(['Docente'])).toBe('/tutor')
    expect(homePathFor(['Coordinador', 'Docente'])).toBe('/dashboard')
    expect(homePathFor(['ComiteGrado'])).toBe('/dashboard')
    expect(homePathFor(['Externo'])).toBe('/dashboard')
    expect(homePathFor(['Consulta/Biblioteca'])).toBe('/buscar')
  })
})

describe('Panel del tutor', () => {
  it('shows a useful empty state when nothing is assigned (no invented projects)', async () => {
    vi.mocked(tutorApi.overview).mockResolvedValue(overview([], { assigned_projects: 0, average_progress: null }))
    renderPage(<TutorPanel />)

    expect(await screen.findByText('Aún no tienes proyectos asignados')).toBeInTheDocument()
    expect(screen.getByText(/Ser docente no asigna proyectos por sí solo/)).toBeInTheDocument()
  })

  it('shows an error with a retry action when the API fails', async () => {
    const user = userEvent.setup()
    vi.mocked(tutorApi.overview).mockRejectedValueOnce(new ApiError(500, 'Error del servidor')).mockResolvedValue(overview([project()]))
    renderPage(<TutorPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Mis proyectos')).toBeInTheDocument()
    expect(tutorApi.overview).toHaveBeenCalledTimes(2)
  })

  it('renders real indicators and the projects table', async () => {
    vi.mocked(tutorApi.overview).mockResolvedValue(overview([project()]))
    renderPage(<TutorPanel />)

    const projectsCard = (await screen.findByText('Mis proyectos')).closest('.card') as HTMLElement
    const table = within(within(projectsCard).getByRole('table'))
    expect(table.getByText('Ana Estudiante')).toBeInTheDocument()
    expect(table.getByText('Detección de fallas')).toBeInTheDocument()
    expect(table.getByText('Proyecto de investigación')).toBeInTheDocument()
    expect(table.getByText('Formulación y planificación')).toBeInTheDocument()
    expect(table.getByText('25% · 1/4')).toBeInTheDocument()
    expect(table.getByRole('link', { name: /Ver proyecto de Ana Estudiante/ })).toHaveAttribute('href', '/tutor/proyectos/p1')
    expect(screen.getByText('Proyectos asignados')).toBeInTheDocument()
    expect(within(screen.getByText('Promedio de avance').closest('.card') as HTMLElement).getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('Proyectos asignados').closest('a')).toHaveAttribute('href', '/tutor/proyectos')
    expect(screen.getByText('Entregas por revisar', { selector: 'div' }).closest('a')).toHaveAttribute('href', '/tutor/revisiones')

    const progress = screen.getByRole('region', { name: 'Avance por proyecto' })
    expect(within(progress).getByRole('link', { name: /Ana Estudiante: 25%/ })).toHaveAttribute('href', '/tutor/proyectos/p1')
    expect(screen.getByRole('region', { name: 'Estado de los entregables' })).toBeInTheDocument()
  })

  it('does not show a misleading average when there is no published plan', async () => {
    vi.mocked(tutorApi.overview).mockResolvedValue(overview([project({ plan_status: 'borrador', progress: null, current_stage: null })], { average_progress: null }))
    renderPage(<TutorPanel />)

    const projectsCard = (await screen.findByText('Mis proyectos')).closest('.card') as HTMLElement
    expect(screen.getByText('Sin planes publicados con entregables obligatorios')).toBeInTheDocument()
    expect(within(projectsCard).getByText('Sin plan publicado')).toBeInTheDocument()
    expect(within(projectsCard).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('Ningún proyecto tiene todavía un plan publicado.')).toBeInTheDocument()
  })
})

describe('proyectos asignados: filtros', () => {
  it('filters by text, modality, stage and state', async () => {
    const user = userEvent.setup()
    vi.mocked(tutorApi.overview).mockResolvedValue(
      overview([
        project(),
        project({ process_public_id: 'p2', title: 'Redes neuronales', student: { public_id: 's2', full_name: 'Luis Pérez' }, modality_name: 'Pasantía', current_stage: 'Desarrollo y cierre', plan_status: 'sin_plan', progress: null, pending_review_count: 0 }),
      ])
    )
    renderPage(<TutorProjectsPage />)
    await screen.findByRole('table')
    expect(screen.getAllByRole('row')).toHaveLength(3)

    await user.type(screen.getByLabelText('Buscar por proyecto o estudiante'), 'redes')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText('Luis Pérez')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Buscar por proyecto o estudiante'))

    await user.selectOptions(screen.getByLabelText('Filtrar por modalidad'), 'Pasantía')
    expect(screen.queryByText('Ana Estudiante')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filtrar por modalidad'), '')

    await user.selectOptions(screen.getByLabelText('Filtrar por etapa'), 'Formulación y planificación')
    expect(screen.queryByText('Luis Pérez')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filtrar por etapa'), '')

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'revision')
    expect(screen.getByText('Ana Estudiante')).toBeInTheDocument()
    expect(screen.queryByText('Luis Pérez')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'sin_plan')
    expect(screen.queryByText('Ana Estudiante')).not.toBeInTheDocument()
  })
})

describe('revisiones y estadísticas', () => {
  it('lists pending reviews with a link to the project documents', async () => {
    vi.mocked(tutorApi.overview).mockResolvedValue(overview([project()]))
    renderPage(<TutorReviewsPage />)

    expect(await screen.findByText(/Propuesta inicial/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Revisar/ })).toHaveAttribute('href', '/tutor/proyectos/p1?tab=documentos')
  })

  it('shows the distribution and the official-completion caveat', async () => {
    vi.mocked(tutorApi.overview).mockResolvedValue(overview([project()]))
    renderPage(<TutorStatsPage />)

    expect(await screen.findByText('Estado de los entregables')).toBeInTheDocument()
    expect(screen.getByText(/no significa que el proceso de grado esté finalizado oficialmente/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Aprobado: 1 de 6/ })).toBeInTheDocument()
  })
})

describe('Expediente del proyecto', () => {
  it('shows an access error for a project that is not visible (404)', async () => {
    vi.mocked(processesApi.get).mockRejectedValue(new ApiError(404, 'Trámite no encontrado'))
    vi.mocked(processesApi.team).mockRejectedValue(new ApiError(404, 'Trámite no encontrado'))
    renderExpediente()

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos este proyecto o no tienes acceso a él.')
  })

  it('summarises the real project, the tutor from the team and hides progress until the plan is published', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    renderExpediente()

    expect(await screen.findByText('Andres Consultor')).toBeInTheDocument()
    expect(screen.getAllByText('Ana Estudiante').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Plan sin crear')).toHaveLength(2) // inicio y fecha objetivo: nada inventado
    expect(screen.getByText(/Aún no hay un plan de trabajo: crea uno/)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('creates a plan from the template and shows it as a draft the student cannot see', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    vi.mocked(workPlanApi.create).mockResolvedValue(plan([deliverable()], { status: 'borrador', published_at: null }))
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    await user.type(await screen.findByLabelText('Fecha de inicio (opcional)'), '2026-02-02')
    await user.click(screen.getByRole('button', { name: 'Crear plan en borrador' }))

    expect(workPlanApi.create).toHaveBeenCalledWith('token', 'p1', { start_date: '2026-02-02', target_end_date: null, template: 'semillero_investigacion_dos_semestres' })
    expect(await screen.findByText('Borrador (el estudiante no lo ve)')).toBeInTheDocument()
  })

  it('requires an explicit confirmation to publish and then shows the plan as published', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable()], { status: 'borrador', published_at: null }))
    vi.mocked(workPlanApi.publish).mockResolvedValue(plan([deliverable()]))
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    const publish = await screen.findByRole('button', { name: /Publicar plan/ })
    expect(publish).toBeDisabled()
    await user.click(screen.getByLabelText('Confirmo que revisé las fechas y los entregables'))
    await user.click(publish)

    expect(workPlanApi.publish).toHaveBeenCalledWith('token', 'p1')
    expect(await screen.findByText('Plan publicado')).toBeInTheDocument()
  })

  it('edits a deliverable due date and shows the API error when the date is rejected', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable()]))
    vi.mocked(workPlanApi.updateDeliverable).mockRejectedValueOnce(new ApiError(422, 'La fecha límite no puede ser posterior a la fecha objetivo de finalización'))
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2027-01-01' } })
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('posterior a la fecha objetivo')
    expect(vi.mocked(workPlanApi.updateDeliverable).mock.calls[0][3]).toMatchObject({ due_date: '2027-01-01' })
  })

  it('approves a delivery that is waiting for review and reloads the plan', async () => {
    const user = userEvent.setup()
    const waiting = deliverable({ status: 'en_revision', submissions_count: 1, current_submission: submission() })
    vi.mocked(workPlanApi.get).mockResolvedValueOnce(plan([waiting])).mockResolvedValue(plan([deliverable({ status: 'aprobado', submissions_count: 1, current_submission: submission({ status: 'aprobado' }) })]))
    vi.mocked(workPlanApi.review).mockResolvedValue(submission({ status: 'aprobado' }) as never)
    renderExpediente('/tutor/proyectos/p1?tab=documentos')

    expect(await screen.findByRole('link', { name: /Descargar entrega/ })).toHaveAttribute('href', 'https://files.example/propuesta.pdf?sig=1')
    await user.click(screen.getByRole('button', { name: 'Aprobar entrega' }))

    expect(workPlanApi.review).toHaveBeenCalledWith('token', 'p1', 'sub1', 'aprobado', '')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprobar entrega' })).not.toBeInTheDocument())
  })

  it('requires observations to request corrections', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable({ status: 'en_revision', submissions_count: 1, current_submission: submission() })]))
    vi.mocked(workPlanApi.review).mockResolvedValue(submission({ status: 'requiere_correcciones' }) as never)
    renderExpediente('/tutor/proyectos/p1?tab=documentos')

    await user.click(await screen.findByRole('button', { name: 'Solicitar correcciones' }))
    const send = screen.getByRole('button', { name: 'Enviar solicitud de correcciones' })
    expect(send).toBeDisabled()
    await user.type(screen.getByLabelText('Observaciones para solicitar correcciones'), 'Falta el diseño muestral')
    await user.click(send)

    expect(workPlanApi.review).toHaveBeenCalledWith('token', 'p1', 'sub1', 'requiere_correcciones', 'Falta el diseño muestral')
  })

  it('uploads a private template for a deliverable', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable()]))
    vi.mocked(workPlanApi.uploadTemplate).mockResolvedValue(plan([deliverable({ template_file_name: 'formato.pdf', template_download_url: 'https://files.example/f.pdf' })]))
    renderExpediente('/tutor/proyectos/p1?tab=documentos')

    const file = new File(['%PDF-1.7'], 'formato.pdf', { type: 'application/pdf' })
    await user.upload(await screen.findByLabelText('Subir plantilla para Propuesta inicial'), file)

    expect(workPlanApi.uploadTemplate).toHaveBeenCalledWith('token', 'p1', 'd1', file)
  })

  it('offers no editing controls to someone who is not the tutor of the project', async () => {
    useAppStore.setState({ currentUser: { ...tutorUser, id: 'someone-else' } })
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable({ status: 'en_revision', submissions_count: 1, current_submission: submission() })], { can_manage: false }))
    renderExpediente('/tutor/proyectos/p1?tab=documentos')

    expect(await screen.findByText('Vista de consulta: solo el tutor asignado a este proyecto puede modificar el plan o revisar entregas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar entrega' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Subir plantilla para Propuesta inicial')).not.toBeInTheDocument()
  })

  it('shows the plan change log in the activity tab', async () => {
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable()]))
    vi.mocked(workPlanApi.activity).mockResolvedValue([
      { public_id: 'e1', event_type: 'entregable_editado', subject: 'Propuesta inicial', detail: 'fecha límite: 2026-03-20 → 2026-04-01', actor: { public_id: 'tutor-1', full_name: 'Andres Consultor' }, created_at: '2026-03-12T10:00:00' },
    ])
    renderExpediente('/tutor/proyectos/p1?tab=historial')

    expect(await screen.findByText('Entregable editado · Propuesta inicial')).toBeInTheDocument()
    expect(screen.getByText('fecha límite: 2026-03-20 → 2026-04-01')).toBeInTheDocument()
  })
})

describe('Equipo del proceso (asignación explícita)', () => {
  it('lets coordination assign a candidate as tutor and never offers it to non-assigners', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: { ...tutorUser, id: 'coord', role: 'coordinador', institutionalRoles: ['Coordinador'] } })
    vi.mocked(processesApi.team).mockResolvedValue([{ public_id: 'm1', user: { public_id: 'student-1', full_name: 'Ana Estudiante' }, process_role: 'estudiante', assigned_at: '', active: true }] as never)
    vi.mocked(processesApi.teamCandidates).mockResolvedValue([{ public_id: 'u9', full_name: 'Andres Consultor' }] as never)
    vi.mocked(processesApi.addTeamMember).mockResolvedValue({} as never)
    renderPage(<TeamPanel processId="p1" />)

    expect(await screen.findByText('Este proceso aún no tiene tutor asignado.')).toBeInTheDocument()
    await user.selectOptions(await screen.findByLabelText('Docente a asignar como tutor'), 'u9')
    await user.click(screen.getByRole('button', { name: 'Asignar como tutor' }))

    expect(processesApi.addTeamMember).toHaveBeenCalledWith('token', 'p1', 'u9', 'tutor')
  })

  it('hides the assignment controls from a teacher', async () => {
    renderPage(<TeamPanel processId="p1" />)

    expect(await screen.findByText(/Andres Consultor/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Docente a asignar como tutor')).not.toBeInTheDocument()
    expect(processesApi.teamCandidates).not.toHaveBeenCalled()
  })
})
