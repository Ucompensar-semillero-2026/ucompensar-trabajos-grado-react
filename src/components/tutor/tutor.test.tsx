import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { STUDENT_NAV_GROUPS, TUTOR_NAV_GROUPS } from '@/constants'
import { hasModule, homePathFor } from '@/config/access'
import type { User } from '@/types'
import type { DeliverableOut, StageOut, WorkPlanOut } from '@/services/workplan.service'
import type { TutorOverviewOut, TutorProjectOut } from '@/services/tutor.service'
import type { EvaluationOut } from '@/services/evaluation.service'

vi.mock('@/services/tutor.service', () => ({ tutorApi: { overview: vi.fn() } }))
vi.mock('@/services/files.service', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/files.service')>()), fetchPreviewInfo: vi.fn() }))
vi.mock('@/components/documentos/VisorDocumento', () => ({ VisorDocumento: ({ file }: { file: { fileName: string } }) => <div data-testid="visor">vista previa de {file.fileName}</div> }))
vi.mock('@/services/evaluation.service', () => ({ evaluationApi: { get: vi.fn(), saveConfig: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), saveGrade: vi.fn(), history: vi.fn() } }))
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
import { fetchPreviewInfo } from '@/services/files.service'
import { evaluationApi } from '@/services/evaluation.service'
import { criterion, evaluation, moment, totals } from '@/test/evaluationFixtures'
import { buildFeed, dayTone, formatShort, ganttRange, markerTone, matchesDeliverable, monthGrid, nextDelivery, planYears, positionPct, stageBar, stageSummary } from './tutorUi.utils'
import { processesApi } from '@/services/processes.service'
import { workPlanApi } from '@/services/workplan.service'
import { Sidebar } from '@/components/layout/Sidebar'
import { TutorPanel, TutorProjectsPage, TutorReviewsPage, TutorStatsPage } from './TutorPages'
import { ProjectExpediente } from './ProjectExpediente'
import { makeUser, modulesFor } from '@/test/users'

const tutorUser: User = { id: 'tutor-1', name: 'Andres Consultor', initials: 'AC', email: 't@ucompensar.edu.co', roles: ['docente'], modules: modulesFor(['docente']) }
const studentUser: User = { id: 'student-1', name: 'Ana Estudiante', initials: 'AE', email: 'a@ucompensar.edu.co', roles: ['estudiante'], modules: modulesFor(['estudiante']) }

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
    sort_order: 0, due_date: '2026-03-20', depends_on_public_id: null, accepted_extensions: null, escalate_group: true, template_file_name: null,
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
      ['Principal', ['Inicio', 'Seguimiento de proyectos', 'Proyectos asignados']],
      ['Seguimiento académico', ['Entregables de estudiantes', 'Planes de trabajo', 'Fechas y compromisos', 'Estadísticas e informes', 'Notificaciones']],
      ['Ayuda', ['Ayuda y soporte']],
    ])
    expect(JSON.stringify(TUTOR_NAV_GROUPS)).not.toContain('Mi proceso de grado')
    expect(JSON.stringify(STUDENT_NAV_GROUPS)).not.toContain('Seguimiento de proyectos')
  })

  it('renders the tutor sidebar for a teacher and the student sidebar for a student', () => {
    const { unmount } = renderPage(<Sidebar user={tutorUser} onLogout={() => {}} />, '/tutor/proyectos/p1')
    expect(screen.getByRole('button', { name: 'Seguimiento de proyectos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Proyectos asignados' })).toHaveAttribute('aria-current', 'page') // el expediente pertenece a "Proyectos asignados"
    expect(screen.queryByRole('button', { name: 'Mi proceso de grado' })).not.toBeInTheDocument()
    unmount()

    renderPage(<Sidebar user={studentUser} onLogout={() => {}} />)
    expect(screen.getByRole('button', { name: 'Mi proceso de grado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Seguimiento de proyectos' })).not.toBeInTheDocument()
  })

  it('only a pure teacher gets the tutor workspace; coordination keeps its own menu and home', () => {
    // El espacio de trabajo lo decide el backend (modules de /auth/me); aquí se usa el espejo de pruebas.
    expect(hasModule(makeUser(['docente']), 'workspace-tutor')).toBe(true)
    for (const mixed of [['docente', 'coordinador'], ['docente', 'administrador'], ['docente', 'comite_grado'], ['estudiante']]) {
      expect(hasModule(makeUser(mixed), 'workspace-tutor')).toBe(false)
    }
    expect(homePathFor(modulesFor(['docente']))).toBe('/tutor')
    expect(homePathFor(modulesFor(['coordinador', 'docente']))).toBe('/dashboard')
    // Comité y externos inician en su propio panel de /dashboard.
    expect(homePathFor(modulesFor(['comite_grado']))).toBe('/dashboard')
    expect(homePathFor(modulesFor(['externo']))).toBe('/dashboard')
    expect(homePathFor(modulesFor(['consulta']))).toBe('/buscar')
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
    expect(await screen.findByText('Proyectos a tu cargo')).toBeInTheDocument()
    expect(tutorApi.overview).toHaveBeenCalledTimes(2)
  })

  it('renders real indicators and the projects table', async () => {
    vi.mocked(tutorApi.overview).mockResolvedValue(overview([project()]))
    renderPage(<TutorPanel />)

    const projectsCard = (await screen.findByText('Proyectos a tu cargo')).closest('.card') as HTMLElement
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

    const projectsCard = (await screen.findByText('Proyectos a tu cargo')).closest('.card') as HTMLElement
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
    expect(screen.getByRole('button', { name: /Revisar entrega/ })).toBeInTheDocument() // abre la revisión de la ENTREGA en un modal, no navega
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
  it('has an "Evaluación" tab that opens the moments and grades of the project, without a new menu entry', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    vi.mocked(evaluationApi.get).mockResolvedValue(evaluation({ viewer: 'manager', can_configure: true, can_grade: true, status: 'sin_configurar', published_totals: totals() }))
    renderExpediente('/tutor/proyectos/p1?tab=evaluacion')

    expect(await screen.findByRole('region', { name: 'Configuración general de evaluación' })).toBeInTheDocument() // una sola pantalla: configuración, resumen y libro
    expect(screen.getByRole('region', { name: 'Resumen de calificación' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Evaluación', selected: true })).toBeInTheDocument()
    expect(evaluationApi.get).toHaveBeenCalledWith('token', 'p1')
    expect(screen.getByRole('button', { name: /Cargar distribución sugerida/ })).toBeInTheDocument()
  })

  it('does not load the evaluation until the tab is opened', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    renderExpediente()

    await screen.findByRole('region', { name: 'Información del proyecto' })
    expect(evaluationApi.get).not.toHaveBeenCalled()
  })

  it('shows an access error for a project that is not visible (404)', async () => {
    vi.mocked(processesApi.get).mockRejectedValue(new ApiError(404, 'Trámite no encontrado'))
    vi.mocked(processesApi.team).mockRejectedValue(new ApiError(404, 'Trámite no encontrado'))
    renderExpediente()

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos este proyecto o no tienes acceso a él.')
  })

  it('summarises the real project, the tutor from the team and hides progress until the plan is published', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    renderExpediente()

    expect((await screen.findAllByText('Andres Consultor')).length).toBeGreaterThan(0)
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
    expect(await screen.findByText('Plan en borrador: el estudiante aún no lo ve.')).toBeInTheDocument()
  })

  it('requires an explicit confirmation to publish and then shows the plan as published', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable()], { status: 'borrador', published_at: null }))
    vi.mocked(workPlanApi.publish).mockResolvedValue(plan([deliverable()]))
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    await user.click(await screen.findByRole('button', { name: /Fechas y publicación/ })) // se abre en un panel
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

    await user.click(await screen.findByRole('button', { name: 'Editar Propuesta inicial' }))
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Fecha límite'), { target: { value: '2027-01-01' } })
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('posterior a la fecha objetivo')
    expect(vi.mocked(workPlanApi.updateDeliverable).mock.calls[0][3]).toMatchObject({ due_date: '2027-01-01' })
  })

  it('does not review inside the plan: «Revisar entrega» leads to the real submission and the form is not there', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable({ status: 'en_revision', submissions_count: 1, current_submission: submission() })]))
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    await user.click(await screen.findByRole('button', { name: 'Ver Propuesta inicial' }))
    expect(await screen.findByRole('button', { name: /Descargar entrega/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar entrega' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar entrega' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Observaciones para solicitar correcciones')).not.toBeInTheDocument()
  })

  it('uploads a private template for a deliverable', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable()]))
    vi.mocked(workPlanApi.uploadTemplate).mockResolvedValue(plan([deliverable({ template_file_name: 'formato.pdf', template_download_url: 'https://files.example/f.pdf' })]))
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    await user.click(await screen.findByRole('button', { name: 'Ver Propuesta inicial' }))
    const file = new File(['%PDF-1.7'], 'formato.pdf', { type: 'application/pdf' })
    await user.upload(await screen.findByLabelText('Subir plantilla para Propuesta inicial'), file)

    expect(workPlanApi.uploadTemplate).toHaveBeenCalledWith('token', 'p1', 'd1', file)
  })

  it('offers no editing controls to someone who is not the tutor of the project (the old ?tab=documentos link still lands on the unified tab)', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: { ...tutorUser, id: 'someone-else' } })
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable({ status: 'en_revision', submissions_count: 1, current_submission: submission() })], { can_manage: false }))
    renderExpediente('/tutor/proyectos/p1?tab=documentos')

    expect(await screen.findByText('Vista de consulta: solo el tutor asignado a este proyecto puede modificar el plan o revisar entregas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva etapa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Propuesta inicial' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver Propuesta inicial' }))
    expect(screen.queryByRole('button', { name: 'Revisar entrega' })).not.toBeInTheDocument()
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

describe('Resumen del proyecto (dashboard)', () => {
  const NOW = new Date(2026, 1, 20) // 20 feb 2026
  const withStages = (stages: StageOut[], o: Partial<WorkPlanOut> = {}): WorkPlanOut => ({ ...plan([], o), stages })

  it('picks the next delivery: the closest open deliverable not yet due, ignoring approved, inactive and dateless ones', () => {
    const p = withStages([
      stage([
        deliverable({ public_id: 'a', title: 'Aprobado', due_date: '2026-02-21', status: 'aprobado' }),
        deliverable({ public_id: 'b', title: 'Inactivo', due_date: '2026-02-22', active: false }),
        deliverable({ public_id: 'c', title: 'Sin fecha', due_date: null }),
        deliverable({ public_id: 'd', title: 'Lejano', due_date: '2026-04-01' }),
        deliverable({ public_id: 'e', title: 'Cercano', due_date: '2026-02-26', status: 'en_revision' }),
        deliverable({ public_id: 'f', title: 'Atrasado', due_date: '2026-02-10' }),
      ]),
    ])
    const next = nextDelivery(p, NOW)
    expect(next?.deliverable.title).toBe('Cercano')
    expect(next?.days).toBe(6)
    expect(next?.remaining).toBe('Faltan 6 días')
    expect(next?.stageName).toBe('Formulación')
  })

  it('falls back to the most overdue one when nothing is upcoming, and returns null with no pending dated deliverables or no plan', () => {
    const late = withStages([stage([deliverable({ title: 'Atrasado', due_date: '2026-02-10' }), deliverable({ public_id: 'z', title: 'Menos atrasado', due_date: '2026-02-18' })])])
    expect(nextDelivery(late, NOW)).toMatchObject({ overdue: true, remaining: 'Vencido hace 10 días' })
    expect(nextDelivery(withStages([stage([deliverable({ status: 'aprobado' })])]), NOW)).toBeNull()
    expect(nextDelivery(null, NOW)).toBeNull()
    expect(nextDelivery(withStages([stage([deliverable({ due_date: '2026-02-20' })])]), NOW)?.remaining).toBe('Vence hoy')
  })

  it('summarises a stage from its mandatory, active and applicable deliverables only', () => {
    const s = stage([
      deliverable({ public_id: '1', status: 'aprobado' }),
      deliverable({ public_id: '2', status: 'en_revision' }),
      deliverable({ public_id: '3', status: 'disponible' }),
      deliverable({ public_id: '4', mandatory: false, status: 'aprobado' }),
      deliverable({ public_id: '5', active: false, status: 'aprobado' }),
    ])
    expect(stageSummary(s)).toMatchObject({ total: 4, required: 3, approved: 1, percent: 33.3, state: { label: 'En desarrollo' } })
    expect(stageSummary(stage([deliverable({ status: 'disponible' })])).state.label).toBe('Pendiente')
    expect(stageSummary(stage([deliverable({ status: 'aprobado' })])).state.label).toBe('Completada')
    expect(stageSummary(stage([])).state.label).toBe('Sin obligatorios')
  })

  it('merges plan changes and process state changes, newest first, with a status chip taken from the real event', () => {
    const actor = { public_id: 'tutor-1', full_name: 'Andres Consultor' }
    const feed = buildFeed(
      [
        { public_id: 'e1', event_type: 'entrega_recibida', subject: 'Metodología', detail: null, actor, created_at: '2026-02-22T10:00:00' },
        { public_id: 'e2', event_type: 'entrega_revisada', subject: 'Antecedentes', detail: 'versión 1: aprobado', actor, created_at: '2026-02-15T10:00:00' },
        { public_id: 'e3', event_type: 'entrega_revisada', subject: 'Marco', detail: 'versión 1: requiere_correcciones', actor, created_at: '2026-02-16T10:00:00' },
      ],
      [{ public_id: 'h1', previous_state: null, new_state: { name: 'Radicado' }, user: actor, event_date: '2026-02-18T10:00:00', comment: null } as never]
    )
    expect(feed.map((f) => [f.title, f.chip])).toEqual([
      ['Entrega recibida · Metodología', 'En revisión'],
      ['Radicado', 'Radicado'],
      ['Entrega revisada · Marco', 'Correcciones'],
      ['Entrega revisada · Antecedentes', 'Aprobado'],
    ])
  })

  it('shows the KPIs, the stages, the next delivery and the activity from the real plan and opens the deliverable in its tab', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(
      withStages(
        [
          stage([
            deliverable({ public_id: 'a', title: 'Propuesta inicial', due_date: '2099-03-01', status: 'aprobado' }),
            deliverable({ public_id: 'b', title: 'Primer informe de avance', due_date: '2099-04-01', status: 'disponible' }),
          ]),
        ],
        { progress: { total_required: 2, approved: 1, pending_review: 1, needs_corrections: 0, overdue: 0, percent: 50 } }
      )
    )
    vi.mocked(workPlanApi.activity).mockResolvedValue([
      { public_id: 'e1', event_type: 'entrega_recibida', subject: 'Propuesta inicial', detail: null, actor: { public_id: 'student-1', full_name: 'Ana Estudiante' }, created_at: '2026-02-22T10:00:00' },
    ] as never)
    renderExpediente()

    const kpis = within(await screen.findByRole('region', { name: 'Indicadores del proyecto' }))
    expect(kpis.getByText('50 %')).toBeInTheDocument()
    expect(kpis.getByText('1 / 2')).toBeInTheDocument()
    expect(kpis.getByText('Primer informe de avance')).toBeInTheDocument() // próxima entrega
    const stages = within(screen.getByRole('list', { name: 'Avance por etapas' }))
    expect(stages.getByText('Formulación')).toBeInTheDocument()
    expect(stages.getByText(/1\/2 obligatorios aprobados · 1 pendientes/)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Actividad reciente' })).getByText('Entrega recibida · Propuesta inicial')).toBeInTheDocument()

    const next = within(screen.getByRole('region', { name: 'Próxima entrega' }))
    expect(next.getByText('Primer informe de avance')).toBeInTheDocument()
    await user.click(next.getByRole('button', { name: /Ver entregable/ }))
    expect(screen.getByRole('tab', { name: 'Plan de trabajo y entregables' })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('dialog')).getAllByRole('heading', { name: 'Primer informe de avance' }).length).toBeGreaterThan(0) // se abre el detalle del entregable real
  })

  it('shows tidy empty states (no next delivery, no activity) and no invented numbers when there is no plan', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    renderExpediente()

    expect(await screen.findByText('No hay entregas próximas')).toBeInTheDocument()
    expect(screen.getByText('Sin actividad registrada')).toBeInTheDocument()
    const kpis = within(screen.getByRole('region', { name: 'Indicadores del proyecto' }))
    expect(kpis.queryByText(/%/)).not.toBeInTheDocument()
    expect(kpis.getAllByText('—').length).toBeGreaterThanOrEqual(5)
  })
})

describe('Plan de trabajo y entregables (pestaña unificada)', () => {
  const two = (): WorkPlanOut => ({
    ...plan([], { progress: { total_required: 4, approved: 1, pending_review: 1, needs_corrections: 0, overdue: 1, percent: 25 } }),
    stages: [
      {
        public_id: 'st1', name: 'Formulación', description: 'Definición del problema.', semester: 1, sort_order: 0, active: true,
        deliverables: [
          deliverable({ public_id: 'a', stage_public_id: 'st1', title: 'Propuesta inicial', due_date: '2099-03-05', status: 'aprobado' }),
          deliverable({ public_id: 'b', stage_public_id: 'st1', title: 'Metodología', due_date: '2099-03-22', status: 'en_revision', submissions_count: 1, current_submission: submission() }),
          deliverable({ public_id: 'c', stage_public_id: 'st1', title: 'Antecedentes o estado del arte', due_date: '2020-01-10', status: 'disponible', is_overdue: true }),
          deliverable({ public_id: 'o', stage_public_id: 'st1', title: 'Bitácora', mandatory: false, due_date: null, status: 'pendiente' }),
        ],
      },
      {
        public_id: 'st2', name: 'Desarrollo y cierre', description: null, semester: 2, sort_order: 1, active: true,
        deliverables: [deliverable({ public_id: 'd', stage_public_id: 'st2', title: 'Documento final', due_date: '2099-09-01', status: 'pendiente' })],
      },
    ],
  })

  it('shows the project card, the general indicators and the first stage with its real deliverables', async () => {
    vi.mocked(workPlanApi.get).mockResolvedValue(two())
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    const header = within(await screen.findByRole('region', { name: 'Información del proyecto' }))
    expect(header.getByText('Detección de fallas')).toBeInTheDocument()
    expect(header.getByText('Ana Estudiante')).toBeInTheDocument()
    expect(header.getByText('Andres Consultor')).toBeInTheDocument()
    expect(header.getByText('Radicado')).toBeInTheDocument()
    const kpi = within(screen.getByRole('region', { name: 'Indicadores del plan' }))
    expect(kpi.getByText('25 %')).toBeInTheDocument()
    expect(kpi.getByText('1 de 4 entregables aprobados')).toBeInTheDocument()
    expect(kpi.getByText('Etapas').previousElementSibling).toHaveTextContent('2')
    expect(kpi.getByText('Entregables').previousElementSibling).toHaveTextContent('5')
    expect(kpi.getByText('Aprobados').previousElementSibling).toHaveTextContent('1')
    expect(kpi.getByText('Por revisar').previousElementSibling).toHaveTextContent('1')
    expect(kpi.getByText('Vencidos').previousElementSibling).toHaveTextContent('1')
    expect(screen.getByRole('heading', { name: 'Formulación' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entregables de la etapa (4)' })).toBeInTheDocument()
    const list = within(screen.getByRole('list', { name: 'Entregables de la etapa' }))
    expect(list.getAllByRole('listitem')).toHaveLength(4)
    expect(list.getByText('Vencido')).toBeInTheDocument()
  })

  it('switches the deliverables when another stage is selected and keeps the old tab links working', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(two())
    renderExpediente('/tutor/proyectos/p1?tab=documentos')

    expect(await screen.findByRole('heading', { name: 'Formulación' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Etapa 2: Desarrollo y cierre' }))
    expect(screen.getByRole('heading', { name: 'Desarrollo y cierre' })).toBeInTheDocument()
    const list = within(screen.getByRole('list', { name: 'Entregables de la etapa' }))
    expect(list.getAllByRole('listitem')).toHaveLength(1)
    expect(list.getByText('Documento final')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Etapa 2: Desarrollo y cierre' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('searches by name (ignoring accents) and filters by state and by mandatory, with its own empty message', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(two())
    renderExpediente('/tutor/proyectos/p1?tab=plan')
    const rows = () => within(screen.getByRole('list', { name: 'Entregables de la etapa' })).queryAllByRole('listitem')

    await user.type(await screen.findByLabelText('Buscar entregable'), 'metodologia')
    expect(rows()).toHaveLength(1)
    await user.clear(screen.getByLabelText('Buscar entregable'))
    await user.type(screen.getByLabelText('Buscar entregable'), 'zzz')
    expect(screen.getByText('Ningún entregable coincide con la búsqueda o los filtros.')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Buscar entregable'))
    expect(rows()).toHaveLength(4)

    await user.click(screen.getByRole('button', { name: /Filtrar/ }))
    await user.selectOptions(screen.getByLabelText('Estado'), 'vencido')
    expect(rows()).toHaveLength(1)
    await user.selectOptions(screen.getByLabelText('Estado'), 'todos')
    await user.click(screen.getByLabelText('Solo obligatorios'))
    expect(rows()).toHaveLength(3) // «Bitácora» es opcional
  })

  it('switches between the table and the cards view', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(two())
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    expect(await screen.findByRole('button', { name: 'Vista de tabla' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Vista de tarjetas' }))
    expect(screen.getByRole('button', { name: 'Vista de tarjetas' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('list', { name: 'Entregables de la etapa' })).getAllByRole('listitem')).toHaveLength(4)
  })

  it('offers only the actions that apply from the row menu and opens the detail panel', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(two())
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    await user.click(await screen.findByRole('button', { name: 'Más acciones de Propuesta inicial' }))
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Ver detalle', 'Editar entregable']) // sin entrega no hay nada que revisar
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Más acciones de Metodología' }))
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Ver detalle', 'Editar entregable', 'Revisar entrega (calificar o pedir correcciones)', 'Ver archivo, versiones y decisiones',
    ])
    await user.click(screen.getByRole('menuitem', { name: /Revisar entrega/ }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('button', { name: 'Revisar entrega' })).toBeInTheDocument()
  })

  it('shows the next delivery across the whole plan and opens it in its own stage', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(two())
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    const next = within(await screen.findByRole('region', { name: 'Próxima entrega' }))
    expect(next.getByText('Metodología')).toBeInTheDocument() // la más cercana sin aprobar y sin vencer
    await user.click(next.getByRole('button', { name: /Ver entregable/ }))
    expect(within(screen.getByRole('dialog')).getAllByText('Metodología').length).toBeGreaterThan(0)
  })

  it('says so when every deliverable is approved and when the plan has none', async () => {
    const approved = two()
    approved.stages.forEach((s) => s.deliverables.forEach((d) => { d.status = 'aprobado'; d.is_overdue = false }))
    vi.mocked(workPlanApi.get).mockResolvedValue(approved)
    const { unmount } = renderExpediente('/tutor/proyectos/p1?tab=plan')
    expect(await screen.findByText('Todos los entregables del plan están aprobados.')).toBeInTheDocument()
    unmount()

    vi.mocked(workPlanApi.get).mockResolvedValue({ ...two(), stages: [] })
    renderExpediente('/tutor/proyectos/p1?tab=plan')
    expect(await screen.findByText('El plan todavía no tiene entregables.')).toBeInTheDocument()
    expect(screen.getByText(/El plan aún no tiene etapas/)).toBeInTheDocument()
  })

  it('marks the calendar with the real due dates of the selected stage and lists the deliverables of a picked day', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(two())
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    const calendar = within(await screen.findByRole('region', { name: 'Calendario de entregas' }))
    expect(calendar.getByText('Marzo 2099')).toBeInTheDocument() // mes de la próxima entrega de la etapa
    expect(calendar.getByRole('button', { name: /5 de marzo de 2099: 1 entregable/ })).toBeInTheDocument()
    expect(calendar.getByRole('button', { name: /22 de marzo de 2099: 1 entregable/ })).toBeInTheDocument()
    await user.click(calendar.getByRole('button', { name: /22 de marzo de 2099/ }))
    const day = within(calendar.getByRole('list', { name: 'Entregables de la fecha seleccionada' }))
    await user.click(day.getByRole('button', { name: 'Metodología' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    await user.click(calendar.getByRole('button', { name: 'Mes siguiente' }))
    expect(calendar.getByText('Abril 2099')).toBeInTheDocument()
    expect(calendar.queryByRole('button', { name: /de marzo de 2099/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Etapa 2: Desarrollo y cierre' }))
    expect(within(screen.getByRole('region', { name: 'Calendario de entregas' })).getByText('Septiembre 2099')).toBeInTheDocument()
  })

  it('asks for confirmation before deactivating a stage and sends the real update', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(two())
    vi.mocked(workPlanApi.updateStage).mockResolvedValue({ ...two(), stages: two().stages.map((s) => (s.public_id === 'st1' ? { ...s, active: false } : s)) })
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    await user.click(await screen.findByRole('button', { name: 'Desactivar etapa' }))
    expect(workPlanApi.updateStage).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Sí, desactivar' }))
    expect(workPlanApi.updateStage).toHaveBeenCalledWith('token', 'p1', 'st1', { active: false })
    expect(await screen.findByText('Etapa desactivada. Sus entregables se conservan.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activar etapa' })).toBeInTheDocument()
  })

  it('creates a stage and a deliverable through the existing services', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(two())
    vi.mocked(workPlanApi.createStage).mockResolvedValue(two())
    vi.mocked(workPlanApi.createDeliverable).mockResolvedValue(two())
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    await user.click(await screen.findByRole('button', { name: 'Nueva etapa' }))
    await user.type(screen.getByLabelText('Nombre de la nueva etapa'), 'Divulgación')
    await user.click(screen.getByRole('button', { name: 'Crear etapa' }))
    expect(workPlanApi.createStage).toHaveBeenCalledWith('token', 'p1', { name: 'Divulgación', semester: 1 })

    await user.click(screen.getByRole('button', { name: 'Agregar entregable' }))
    await user.type(screen.getByLabelText('Título del entregable'), 'Póster')
    await user.click(screen.getByRole('button', { name: 'Crear entregable' }))
    expect(workPlanApi.createDeliverable).toHaveBeenCalledWith('token', 'p1', 'st1', { title: 'Póster', due_date: null, mandatory: true })
  })

  it('still offers the plan creation form when the project has no plan yet', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    expect(await screen.findByRole('button', { name: 'Crear plan en borrador' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Información del proyecto' })).toBeInTheDocument()
  })

  it('has pure helpers for the search, the month grid and the day colours', () => {
    const d = (o: Partial<DeliverableOut>) => deliverable(o)
    expect(matchesDeliverable(d({ title: 'Metodología' }), 'METODOLOGIA', 'todos', false)).toBe(true)
    expect(matchesDeliverable(d({ status: 'aprobado', is_overdue: true }), '', 'vencido', false)).toBe(false) // aprobado nunca cuenta como vencido
    expect(matchesDeliverable(d({ mandatory: false }), '', 'todos', true)).toBe(false)
    const grid = monthGrid(2027, 1) // febrero de 2027 empieza en lunes y tiene 28 días
    expect(grid).toHaveLength(28)
    expect(grid[0]).toEqual({ date: '2027-02-01', day: 1 })
    expect(monthGrid(2026, 9).filter((c) => c.date).length).toBe(31)
    expect(monthGrid(2026, 9)[0].date).toBeNull() // octubre de 2026 empieza en jueves: huecos antes
    expect(dayTone([d({ status: 'en_revision' })], null)).toBe('review')
    expect(dayTone([d({ status: 'en_revision' }), d({ is_overdue: true })], null)).toBe('overdue')
    expect(dayTone([d({ public_id: 'n' })], 'n')).toBe('next')
    expect(dayTone([d({})], 'zz')).toBe('other')
  })
})

describe('Barra del proyecto y adaptación al estado', () => {
  it('shows every student of the project as a chip next to the project name, in every tab, and keeps "Volver" above it', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    vi.mocked(processesApi.team).mockResolvedValue([
      { public_id: 'm1', user: { public_id: 'student-1', full_name: 'Ana Estudiante' }, process_role: 'estudiante', assigned_at: '', active: true },
      { public_id: 'm3', user: { public_id: 'student-2', full_name: 'Luis Estudiante' }, process_role: 'estudiante', assigned_at: '', active: true },
      { public_id: 'm4', user: { public_id: 'student-3', full_name: 'Retirada Antes' }, process_role: 'estudiante', assigned_at: '', active: false },
      { public_id: 'm2', user: { public_id: 'tutor-1', full_name: 'Andres Consultor' }, process_role: 'tutor', assigned_at: '', active: true },
    ] as never)
    renderExpediente('/tutor/proyectos/p1?tab=historial')

    const bar = within(await screen.findByRole('region', { name: 'Información del proyecto' }))
    expect(bar.getByText('Estudiantes (2)')).toBeInTheDocument()
    expect(within(bar.getByRole('list', { name: 'Estudiantes del proyecto' })).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['Ana Estudiante', 'Luis Estudiante'])
    expect(bar.getByText('Detección de fallas')).toBeInTheDocument()
    expect(bar.getByText('Proyecto de investigación')).toBeInTheDocument()
    expect(bar.getByText('Radicado')).toBeInTheDocument()
    const back = screen.getByRole('link', { name: /Volver a mis proyectos/ })
    expect(back.compareDocumentPosition(screen.getByRole('region', { name: 'Información del proyecto' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Historial de actividad' })).toHaveAttribute('aria-selected', 'true')
  })

  it('does not present deliveries as upcoming when the project is cancelled', async () => {
    vi.mocked(processesApi.get).mockResolvedValue({ public_id: 'p1', process_code: 'X', title: 'Detección de fallas', student: { public_id: 'student-1', full_name: 'Ana Estudiante' }, modality: { name: 'Proyecto de investigación' }, state: { name: 'Cancelado' }, academic_semester: '2026-2', closed_at: null } as never)
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable({ due_date: '2099-03-05' })]))
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    const next = within(await screen.findByRole('region', { name: 'Próxima entrega' }))
    expect(next.getByText(/El proyecto está «Cancelado»/)).toBeInTheDocument()
    expect(next.queryByRole('button', { name: /Ver entregable/ })).not.toBeInTheDocument()
  })
})

describe('Cronograma (Gantt, tabla y calendario)', () => {
  const sched = (): WorkPlanOut => ({
    ...plan([], { start_date: '2099-01-10', target_end_date: '2099-09-30', progress: { total_required: 4, approved: 1, pending_review: 1, needs_corrections: 0, overdue: 1, percent: 25 } }),
    stages: [
      {
        public_id: 'st1', name: 'Formulación', description: null, semester: 1, sort_order: 0, active: true,
        deliverables: [
          deliverable({ public_id: 'a', stage_public_id: 'st1', title: 'Propuesta inicial', due_date: '2099-02-05', status: 'aprobado' }),
          deliverable({ public_id: 'b', stage_public_id: 'st1', title: 'Metodología', due_date: '2099-03-22', status: 'en_revision', submissions_count: 1, current_submission: submission() }),
          deliverable({ public_id: 'c', stage_public_id: 'st1', title: 'Antecedentes', due_date: '2020-01-10', status: 'disponible', is_overdue: true }),
        ],
      },
      {
        public_id: 'st2', name: 'Desarrollo y cierre', description: null, semester: 2, sort_order: 1, active: true,
        deliverables: [deliverable({ public_id: 'd', stage_public_id: 'st2', title: 'Documento final', due_date: '2099-09-01', status: 'pendiente' })],
      },
    ],
  })

  it('computes the range, the positions and the stage bars from the real plan dates', () => {
    const p = sched()
    const range = ganttRange({ ...p, stages: p.stages.slice(1) }, 'todo', new Date(2099, 0, 1))! // sin el entregable de 2020
    expect(range.months[0].label).toBe('Ene 2099')
    expect(range.months).toHaveLength(9) // de enero (inicio del plan) a septiembre (última fecha)
    expect(positionPct(range, '2099-01-01')).toBe(0)
    expect(positionPct(range, '2098-12-31')).toBeNull() // fuera del rango
    expect(positionPct(range, '2099-10-01')).toBeNull()
    const mid = positionPct(range, '2099-05-16')!
    expect(mid).toBeGreaterThan(40)
    expect(mid).toBeLessThan(60)
    const bar = stageBar(range, p.stages[1])!
    expect(bar.left).toBeGreaterThan(80) // una sola fecha (1 sep): barra mínima
    expect(bar.width).toBeGreaterThan(0)
    expect(ganttRange({ ...p, stages: [], start_date: null, target_end_date: null }, 'todo')).toBeNull() // sin fechas reales no se inventa un rango
    expect(ganttRange(p, 2099)!.months).toHaveLength(12)
    expect(ganttRange(p, 'hoy', new Date(2026, 10, 8))!.months[0].label).toBe('Nov 2026')
    expect(planYears(p)).toEqual([2020, 2099])
    expect(formatShort('2026-10-31')).toBe('31 oct 2026')
  })

  it('colours the milestones: approved, overdue, in review, next and pending', () => {
    const d = (o: Partial<DeliverableOut>) => deliverable(o)
    expect(markerTone(d({ status: 'aprobado', is_overdue: true }), null)).toBe('approved')
    expect(markerTone(d({ is_overdue: true }), null)).toBe('overdue')
    expect(markerTone(d({ status: 'en_revision' }), null)).toBe('review')
    expect(markerTone(d({ public_id: 'n' }), 'n')).toBe('next')
    expect(markerTone(d({}), null)).toBe('pending')
  })

  it('shows the indicators, the stage rows, one milestone per deliverable and every deliverable of the project in the table', async () => {
    vi.mocked(workPlanApi.get).mockResolvedValue(sched())
    renderExpediente('/tutor/proyectos/p1?tab=cronograma')

    const kpi = within(await screen.findByRole('region', { name: 'Indicadores del cronograma' }))
    expect(kpi.getByText('Avance del cronograma')).toBeInTheDocument()
    expect(kpi.getByText('25 %')).toBeInTheDocument()
    expect(kpi.getByText('1 de 4 entregables aprobados')).toBeInTheDocument()
    expect(kpi.getByText('Entregables').previousElementSibling).toHaveTextContent('4')
    expect(kpi.getByText('En revisión').previousElementSibling).toHaveTextContent('1')
    expect(kpi.getByText('Vencidos').previousElementSibling).toHaveTextContent('1')

    const gantt = within(screen.getByRole('group', { name: 'Cronograma del proyecto' }))
    expect(gantt.getByRole('button', { name: 'Etapa 1: Formulación' })).toBeInTheDocument()
    expect(gantt.getByRole('button', { name: 'Etapa 2: Desarrollo y cierre' })).toBeInTheDocument()
    expect(gantt.getByRole('button', { name: /Propuesta inicial, 05 feb 2099, Aprobado/ })).toBeInTheDocument()
    expect(gantt.getByRole('button', { name: /Metodología, 22 mar 2099, En revisión/ })).toBeInTheDocument()
    expect(gantt.getByRole('button', { name: /Antecedentes, 10 ene 2020, Vencido/ })).toBeInTheDocument()

    const table = within(screen.getByRole('list', { name: 'Entregables del proyecto' }))
    expect(table.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('heading', { name: /Entregables del proyecto \(4\)/ })).toBeInTheDocument()
    expect(table.getAllByText('Formulación').length).toBe(3) // chip de etapa por fila
  })

  it('filters the table, the calendar and the next delivery when a stage is selected in the Gantt, and clears it', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(sched())
    renderExpediente('/tutor/proyectos/p1?tab=cronograma')

    const gantt = within(await screen.findByRole('group', { name: 'Cronograma del proyecto' }))
    await user.click(gantt.getByRole('button', { name: 'Etapa 2: Desarrollo y cierre' }))
    expect(within(screen.getByRole('list', { name: 'Entregables del proyecto' })).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Mostrando 1 de 4 entregables · etapa «Desarrollo y cierre».')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Próxima entrega' })).getByText('Documento final')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Calendario de entregas' })).getByText('Septiembre 2099')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(within(screen.getByRole('list', { name: 'Entregables del proyecto' })).getAllByRole('listitem')).toHaveLength(4)
    expect(within(screen.getByRole('region', { name: 'Próxima entrega' })).getByText('Metodología')).toBeInTheDocument()
  })

  it('searches and filters by state, and the stage filter of the table is the same selection as the Gantt', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(sched())
    renderExpediente('/tutor/proyectos/p1?tab=cronograma')
    const rows = () => within(screen.getByRole('list', { name: 'Entregables del proyecto' })).queryAllByRole('listitem')

    await user.type(await screen.findByLabelText('Buscar entregable'), 'documento')
    expect(rows()).toHaveLength(1)
    await user.clear(screen.getByLabelText('Buscar entregable'))
    await user.click(screen.getByRole('button', { name: /Filtrar/ }))
    await user.selectOptions(screen.getByLabelText('Estado'), 'vencido')
    expect(rows()).toHaveLength(1)
    await user.selectOptions(screen.getByLabelText('Estado'), 'todos')
    await user.selectOptions(screen.getByLabelText('Etapa'), 'st2')
    expect(rows()).toHaveLength(1)
    expect(within(screen.getByRole('group', { name: 'Cronograma del proyecto' })).getByRole('button', { name: 'Etapa 2: Desarrollo y cierre' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('highlights a milestone, shows its information and opens its detail and its edition', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(sched())
    renderExpediente('/tutor/proyectos/p1?tab=cronograma')

    await user.click(await screen.findByRole('button', { name: /Metodología, 22 mar 2099/ }))
    const info = within(screen.getByRole('status', { name: 'Entregable seleccionado' }))
    expect(info.getByText('Metodología')).toBeInTheDocument()
    expect(info.getByText(/Formulación · 22 mar 2099/)).toBeInTheDocument()
    await user.click(info.getByRole('button', { name: 'Ver detalle' }))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revisar entrega' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await user.click(info.getByRole('button', { name: /Editar/ }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Fecha límite')).toBeInTheDocument()
  })

  it('offers no edition to someone who is not the tutor', async () => {
    useAppStore.setState({ currentUser: { ...tutorUser, id: 'someone-else' } })
    vi.mocked(workPlanApi.get).mockResolvedValue({ ...sched(), can_manage: false })
    const user = userEvent.setup()
    renderExpediente('/tutor/proyectos/p1?tab=cronograma')

    await user.click(await screen.findByRole('button', { name: /Metodología, 22 mar 2099/ }))
    const info = within(screen.getByRole('status', { name: 'Entregable seleccionado' }))
    expect(info.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Metodología' })).not.toBeInTheDocument()
  })

  it('changes the range, enlarges the Gantt in a dialog and marks today only when it falls inside the range', async () => {
    const user = userEvent.setup()
    const soon = new Date()
    soon.setDate(soon.getDate() + 20)
    const iso = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`
    const p = sched()
    p.stages[1].deliverables[0].due_date = iso
    vi.mocked(workPlanApi.get).mockResolvedValue(p)
    renderExpediente('/tutor/proyectos/p1?tab=cronograma')

    await screen.findByRole('group', { name: 'Cronograma del proyecto' })
    expect(screen.getByRole('img', { name: 'Hoy' })).toBeInTheDocument() // el rango «todo» cubre desde 2020 hasta 2099
    await user.selectOptions(screen.getByLabelText('Rango del cronograma'), '2099')
    expect(screen.queryByRole('img', { name: 'Hoy' })).not.toBeInTheDocument() // hoy no está en 2099
    await user.click(screen.getByRole('button', { name: 'Ampliar cronograma' }))
    expect(within(screen.getByRole('dialog')).getByRole('group', { name: 'Cronograma del proyecto' })).toBeInTheDocument()
  })

  it('says so when the plan has no dates or no plan at all, and adapts the next delivery of a cancelled project', async () => {
    const empty = sched()
    empty.stages.forEach((s) => s.deliverables.forEach((d) => { d.due_date = null }))
    empty.start_date = null
    empty.target_end_date = null
    vi.mocked(workPlanApi.get).mockResolvedValue(empty)
    const { unmount } = renderExpediente('/tutor/proyectos/p1?tab=cronograma')
    expect(await screen.findByText(/Aún no hay fechas en el plan/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ampliar cronograma' })).toBeDisabled()
    unmount()

    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    const second = renderExpediente('/tutor/proyectos/p1?tab=cronograma')
    expect(await screen.findByText('Aún no hay un plan de trabajo para este proyecto.')).toBeInTheDocument()
    second.unmount()

    vi.mocked(processesApi.get).mockResolvedValue({ public_id: 'p1', process_code: 'X', title: 'Detección de fallas', student: { public_id: 'student-1', full_name: 'Ana Estudiante' }, modality: { name: 'Proyecto de investigación' }, state: { name: 'Cancelado' }, academic_semester: '2026-2', closed_at: null } as never)
    vi.mocked(workPlanApi.get).mockResolvedValue(sched())
    renderExpediente('/tutor/proyectos/p1?tab=cronograma')
    expect(await screen.findByText(/El proyecto está «Cancelado»/)).toBeInTheDocument()
  })
})

describe('Bandeja «Entregables de estudiantes»', () => {
  const rich = () => {
    const o = overview([project()])
    o.pending_reviews = [
      { ...o.pending_reviews[0], stage_name: 'Formulación y planificación', submitted_by: { public_id: 's2', full_name: 'Luis Estudiante' }, team_students: [{ public_id: 's', full_name: 'Ana Estudiante' }, { public_id: 's2', full_name: 'Luis Estudiante' }] },
      { ...o.pending_reviews[0], deliverable_public_id: 'd2', deliverable_title: 'Metodología', submission_public_id: 'sub2', version: 1, stage_name: 'Desarrollo y cierre', project_title: 'Otro proyecto', submitted_by: { public_id: 's9', full_name: 'Marta Otra' }, team_students: [{ public_id: 's9', full_name: 'Marta Otra' }] },
    ]
    return o
  }

  it('lists each received delivery with its project, stage, who delivered it, team, version, dates and state', async () => {
    vi.mocked(tutorApi.overview).mockResolvedValue(rich())
    renderPage(<TutorReviewsPage />)

    const list = within(await screen.findByRole('list', { name: 'Entregas por revisar' }))
    const first = within(list.getAllByRole('listitem')[0])
    expect(first.getByText(/Propuesta inicial/)).toBeInTheDocument()
    expect(first.getByText(/versión 2/)).toBeInTheDocument()
    expect(first.getByText(/Etapa: Formulación y planificación/)).toBeInTheDocument()
    expect(first.getByText('Luis Estudiante', { selector: 'strong' })).toBeInTheDocument() // quien hizo ESTA entrega
    expect(first.getByText(/Integrantes: Ana Estudiante, Luis Estudiante/)).toBeInTheDocument()
    expect(first.getByText(/fecha límite/)).toBeInTheDocument()
    expect(first.getByText('En revisión')).toBeInTheDocument()
    expect(first.getByRole('button', { name: /Revisar entrega/ })).toBeInTheDocument() // abre el modal: ya no es un enlace a otra página
    expect(screen.queryByRole('link', { name: /Revisar entrega/ })).not.toBeInTheDocument()
  })

  it('searches by deliverable, project, stage or student and keeps the search in the URL', async () => {
    vi.mocked(tutorApi.overview).mockResolvedValue(rich())
    const user = userEvent.setup()
    renderPage(<TutorReviewsPage />, '/tutor/revisiones?q=marta')

    const rows = () => within(screen.getByRole('list', { name: 'Entregas por revisar' })).queryAllByRole('listitem')
    expect(await screen.findByLabelText('Buscar entrega')).toHaveValue('marta')
    expect(rows()).toHaveLength(1)
    await user.clear(screen.getByLabelText('Buscar entrega'))
    expect(rows()).toHaveLength(2)
    await user.type(screen.getByLabelText('Buscar entrega'), 'formulacion')
    expect(rows()).toHaveLength(1)
    await user.clear(screen.getByLabelText('Buscar entrega'))
    await user.type(screen.getByLabelText('Buscar entrega'), 'zzz')
    expect(screen.getByText('Ninguna entrega coincide con la búsqueda.')).toBeInTheDocument()
  })
})

describe('Revisión de entrega en ventana modal', () => {
  const reviewOf = (o: Record<string, unknown> = {}) => ({ public_id: 'r1', decision: 'requiere_correcciones' as const, comment: 'Falta el marco teórico', reviewer: { public_id: 'tutor-1', full_name: 'Andres Consultor' }, created_at: '2026-03-05T10:00:00', ...o })
  const v1 = () => submission({ public_id: 'sub0', version: 1, file_name: 'v1.pdf', status: 'requiere_correcciones', reviews: [reviewOf()], submitted_at: '2026-03-01T10:00:00' })
  const v2 = (o = {}) => submission({ public_id: 'sub1', version: 2, file_name: 'metodologia_v2.xlsx', student_comment: 'Corregí el marco teórico', submitted_at: '2026-03-10T10:00:00', ...o })
  const gradingReport = (over: Partial<EvaluationOut> = {}, crit: Record<string, unknown> = {}) =>
    evaluation({
      viewer: 'manager', can_configure: true, can_grade: true, status: 'publicada', published_totals: totals(),
      moments: [moment('m1', 'Contextualización', 20, [criterion('c1', 'Trabajo escrito', 60, { deliverable_public_id: 'd1', status: 'sin_calificar', ...crit })])],
      ...over,
    })
  const setup = (current = v2(), planOver: Partial<WorkPlanOut> = {}) => {
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable({ status: 'en_revision', submissions_count: 2, current_submission: current })], planOver))
    vi.mocked(workPlanApi.listSubmissions).mockResolvedValue([v1(), current] as never)
    vi.mocked(processesApi.team).mockResolvedValue([
      { public_id: 'm1', user: { public_id: 'student-1', full_name: 'Ana Estudiante' }, process_role: 'estudiante', assigned_at: '', active: true },
      { public_id: 'm3', user: { public_id: 'student-2', full_name: 'Luis Estudiante' }, process_role: 'estudiante', assigned_at: '', active: true },
      { public_id: 'm2', user: { public_id: 'tutor-1', full_name: 'Andres Consultor' }, process_role: 'tutor', assigned_at: '', active: true },
    ] as never)
  }
  const openFromInbox = async (user: ReturnType<typeof userEvent.setup>) => {
    vi.mocked(tutorApi.overview).mockResolvedValue(overview([project()]))
    renderPage(<TutorReviewsPage />)
    await user.click(await screen.findByRole('button', { name: /Revisar entrega/ }))
    return within(await screen.findByRole('dialog', { name: 'Revisión de entrega' }))
  }

  beforeEach(() => {
    vi.mocked(evaluationApi.get).mockResolvedValue(gradingReport())
    vi.mocked(fetchPreviewInfo).mockResolvedValue({ mode: 'inline', file_url: '/api/x', embed_url: null, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1258291, file_name: 'metodologia_v2.xlsx', message: null })
  })

  it('opens centered over the list (no new page), keeps the list behind and closes with X or Escape', async () => {
    const user = userEvent.setup()
    setup()
    const modal = await openFromInbox(user)

    expect(modal.getByRole('heading', { name: 'Revisión de entrega' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Entregas por revisar' })).toBeInTheDocument() // el listado sigue detrás
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog', { name: 'Revisión de entrega' })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Entregas por revisar' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Revisar entrega/ }))
    await screen.findByRole('dialog', { name: 'Revisión de entrega' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Revisión de entrega' })).not.toBeInTheDocument()
  })

  it('shows the real delivery: state, version, stage, dates, punctuality, the whole group, the project and the file', async () => {
    const user = userEvent.setup()
    setup()
    const modal = await openFromInbox(user)

    const head = within(await modal.findByRole('region', { name: 'Entrega en revisión' }))
    expect(head.getByRole('heading', { name: 'Propuesta inicial' })).toBeInTheDocument()
    expect(head.getByText('Versión 2')).toBeInTheDocument()
    expect(head.getByText(/Entregable de la etapa: Formulación/)).toBeInTheDocument()
    expect(head.getByText(/10 mar 2026/)).toBeInTheDocument() // fecha de entrega
    expect(head.getByText('20 mar 2026')).toBeInTheDocument() // fecha límite
    expect(head.getByText('Entrega puntual')).toBeInTheDocument()

    const group = within(modal.getByRole('region', { name: 'Grupo y proyecto' }))
    expect(group.getByText('Grupo de estudiantes (2)')).toBeInTheDocument()
    expect(within(group.getByRole('list', { name: 'Estudiantes del grupo' })).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['AEAna Estudiante', 'LELuis Estudiante'])
    expect(group.getByText('Detección de fallas')).toBeInTheDocument()
    expect(group.getByText('Proyecto de investigación')).toBeInTheDocument()

    const file = within(modal.getByRole('region', { name: 'Entrega del estudiante' }))
    expect(file.getByText('metodologia_v2.xlsx')).toBeInTheDocument()
    expect(await file.findByText(/XLSX · 1\.2 MB/)).toBeInTheDocument()
    expect(file.getByRole('button', { name: 'Ver archivo' })).toBeInTheDocument()
    expect(file.getByRole('button', { name: /Descargar original/ })).toBeInTheDocument()
    expect(file.getByTestId('visor')).toHaveTextContent('metodologia_v2.xlsx') // vista previa del archivo real
    expect(file.getByText(/Versiones \(2\)/)).toBeInTheDocument()
    expect(file.getByText(/Requiere correcciones por Andres Consultor: Falta el marco teórico/)).toBeInTheDocument()
  })

  it('marks a late delivery and says so when the file is not available', async () => {
    const user = userEvent.setup()
    setup(v2({ file_missing: true, submitted_at: '2026-04-02T10:00:00' }))
    const modal = await openFromInbox(user)

    expect(await modal.findByText('Entrega tardía')).toBeInTheDocument()
    expect(modal.getByText(/El archivo de esta versión no está disponible/)).toBeInTheDocument()
    expect(modal.queryByTestId('visor')).not.toBeInTheDocument()
  })

  it('computes the contribution with the real weights and validates the grade between 0 and 5', async () => {
    const user = userEvent.setup()
    setup()
    const modal = await openFromInbox(user)

    const grading = within(await modal.findByRole('region', { name: 'Calificación del entregable' }))
    expect(grading.getByText('12,00 %')).toBeInTheDocument() // aporte al proyecto: 20 % del momento × 60 % del criterio
    expect(grading.getByText('Trabajo escrito')).toBeInTheDocument()
    const publish = modal.getByRole('button', { name: 'Publicar calificación' })
    expect(publish).toBeDisabled() // sin nota no se publica
    const input = grading.getByLabelText('Nota (0 a 5)')
    await user.type(input, '4.5')
    expect(grading.getByText('Equivale a un aporte de 10,80 % sobre la nota final del proyecto.')).toBeInTheDocument()
    expect(publish).toBeEnabled()
    await user.clear(input)
    await user.type(input, '6')
    expect(grading.getByRole('alert')).toHaveTextContent('entre 0 y 5')
    expect(publish).toBeDisabled()
    await user.clear(input)
    await user.type(input, '3.25')
    expect(grading.getByRole('alert')).toHaveTextContent('un solo decimal')
    expect(grading.getByText('0 / 500')).toBeInTheDocument()
    await user.type(grading.getByLabelText(/Retroalimentación para el estudiante/), 'Buen trabajo')
    expect(grading.getByText('12 / 500')).toBeInTheDocument()
  })

  it('saves a draft through the evaluation service and keeps the modal open', async () => {
    const user = userEvent.setup()
    setup()
    vi.mocked(evaluationApi.saveGrade).mockResolvedValue(gradingReport({}, { status: 'borrador', grade: 4.5, feedback: 'Pertinente' }))
    const modal = await openFromInbox(user)

    await user.type(await modal.findByLabelText('Nota (0 a 5)'), '4.5')
    await user.type(modal.getByLabelText(/Retroalimentación para el estudiante/), 'Pertinente')
    await user.click(modal.getByRole('button', { name: 'Guardar borrador' }))

    expect(evaluationApi.saveGrade).toHaveBeenCalledWith('token', 'p1', 'c1', { grade: 4.5, feedback: 'Pertinente', publish: false, mode: 'grupal', student_public_id: null, confirm_mode_change: false })
    expect(await modal.findByText('Borrador guardado. El estudiante aún no lo ve.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Revisión de entrega' })).toBeInTheDocument()
  })

  it('publishes only after confirming, once, refreshes the list and closes when it succeeds', async () => {
    const user = userEvent.setup()
    setup()
    vi.mocked(evaluationApi.saveGrade).mockResolvedValue(gradingReport({}, { status: 'publicada', grade: 4.5 }))
    const modal = await openFromInbox(user)
    const callsBefore = vi.mocked(tutorApi.overview).mock.calls.length

    await user.type(await modal.findByLabelText('Nota (0 a 5)'), '4.5')
    await user.click(modal.getByRole('button', { name: 'Publicar calificación' }))
    expect(evaluationApi.saveGrade).not.toHaveBeenCalled() // primero se confirma
    expect(modal.getByRole('alertdialog')).toHaveTextContent('¿Publicar la calificación? El estudiante podrá consultar la nota y la retroalimentación.')
    const confirm = within(modal.getByRole('alertdialog')).getByRole('button', { name: 'Sí, confirmar' })
    await user.click(confirm)
    await user.click(confirm) // doble clic

    expect(evaluationApi.saveGrade).toHaveBeenCalledTimes(1)
    expect(evaluationApi.saveGrade).toHaveBeenCalledWith('token', 'p1', 'c1', { grade: 4.5, feedback: null, publish: true, mode: 'grupal', student_public_id: null, confirm_mode_change: false })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Revisión de entrega' })).not.toBeInTheDocument())
    expect(vi.mocked(tutorApi.overview).mock.calls.length).toBeGreaterThan(callsBefore) // el listado se actualiza sin recargar la página
  })

  it('keeps the modal open and shows the error when publishing fails', async () => {
    const user = userEvent.setup()
    setup()
    vi.mocked(evaluationApi.saveGrade).mockRejectedValue(new ApiError(409, 'La evaluación todavía no está publicada'))
    const modal = await openFromInbox(user)

    await user.type(await modal.findByLabelText('Nota (0 a 5)'), '4')
    await user.click(modal.getByRole('button', { name: 'Publicar calificación' }))
    await user.click(within(modal.getByRole('alertdialog')).getByRole('button', { name: 'Sí, confirmar' }))

    expect(await modal.findByRole('alert')).toHaveTextContent('La evaluación todavía no está publicada')
    expect(screen.getByRole('dialog', { name: 'Revisión de entrega' })).toBeInTheDocument()
  })

  it('requires the feedback to ask for corrections, registers it with the review service and closes', async () => {
    const user = userEvent.setup()
    setup()
    vi.mocked(workPlanApi.review).mockResolvedValue(v2({ status: 'requiere_correcciones' }) as never)
    const modal = await openFromInbox(user)

    await user.click(await modal.findByRole('button', { name: 'Solicitar correcciones' }))
    const dialog = within(modal.getByRole('alertdialog'))
    expect(dialog.getByRole('button', { name: 'Sí, confirmar' })).toBeDisabled()
    expect(dialog.getByText(/Escribe en la retroalimentación qué debe corregir/)).toBeInTheDocument()
    await user.type(modal.getByLabelText(/Retroalimentación para el estudiante/), 'Falta el diseño muestral')
    await user.click(dialog.getByRole('button', { name: 'Sí, confirmar' }))

    expect(workPlanApi.review).toHaveBeenCalledWith('token', 'p1', 'sub1', 'requiere_correcciones', 'Falta el diseño muestral')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Revisión de entrega' })).not.toBeInTheDocument())
  })

  it('has no separate «Aprobar entrega» action: the three actions are save draft, publish and ask for corrections', async () => {
    const user = userEvent.setup()
    setup()
    const modal = await openFromInbox(user)

    await modal.findByRole('button', { name: 'Publicar calificación' })
    expect(modal.queryByRole('button', { name: /Aprobar/ })).not.toBeInTheDocument()
    const bar = modal.getAllByRole('button').map((b) => (b.textContent ?? '').trim()).filter((t) => /borrador|Publicar|correcciones/.test(t))
    expect(bar).toEqual(['Guardar borrador', 'Publicar calificación', 'Solicitar correcciones'])
    expect(workPlanApi.review).not.toHaveBeenCalled()
  })

  it('explains why grading is unavailable: no criterion, evaluation not published, or an older version', async () => {
    const user = userEvent.setup()
    setup()
    vi.mocked(evaluationApi.get).mockResolvedValue(gradingReport({ moments: [] }))
    const first = await openFromInbox(user)
    expect(await first.findByText(/no está asociado a ningún criterio de evaluación/)).toBeInTheDocument()
    expect(first.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled()
    expect(first.getByRole('button', { name: 'Publicar calificación' })).toBeDisabled()
    expect(first.getByRole('button', { name: 'Solicitar correcciones' })).toBeEnabled() // la revisión del archivo no depende de la evaluación
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    vi.mocked(evaluationApi.get).mockResolvedValue(gradingReport({ status: 'borrador' }))
    await user.click(screen.getByRole('button', { name: /Revisar entrega/ }))
    expect(await screen.findByText(/La evaluación todavía no está publicada: publica su configuración/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    vi.mocked(evaluationApi.get).mockRejectedValue(new ApiError(503, 'La evaluación todavía no está disponible'))
    await user.click(screen.getByRole('button', { name: /Revisar entrega/ }))
    expect(await screen.findByText('No se pudo consultar la evaluación del proyecto en este momento.')).toBeInTheDocument()
  })

  it('lets the tutor look at an older version (read-only) and come back to the current one', async () => {
    const user = userEvent.setup()
    setup()
    const modal = await openFromInbox(user)

    await user.click(await modal.findByRole('button', { name: 'Ver esta versión' }))
    expect(within(modal.getByRole('region', { name: 'Entrega en revisión' })).getByText('Versión 1 (anterior)')).toBeInTheDocument()
    expect(modal.getByText(/Estás viendo una versión anterior: la versión actual es la 2/)).toBeInTheDocument()
    expect(modal.getByRole('button', { name: 'Solicitar correcciones' })).toBeDisabled()
    expect(modal.getByLabelText('Nota (0 a 5)')).toBeDisabled()
    await user.click(modal.getByRole('button', { name: 'Ir a la versión actual' }))
    expect(within(modal.getByRole('region', { name: 'Entrega en revisión' })).getByText('Versión 2')).toBeInTheDocument()
  })

  it('is read-only for someone who is not the tutor of the project', async () => {
    const user = userEvent.setup()
    setup(v2(), { can_manage: false })
    vi.mocked(evaluationApi.get).mockResolvedValue(gradingReport({ can_grade: false }))
    const modal = await openFromInbox(user)

    expect(await modal.findByText(/Vista de consulta: solo el tutor asignado/)).toBeInTheDocument()
    expect(modal.getByRole('button', { name: 'Solicitar correcciones' })).toBeDisabled()
    expect(modal.getByRole('button', { name: 'Publicar calificación' })).toBeDisabled()
  })

  it('shows an error with a retry when the delivery cannot be loaded', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    const modal = await openFromInbox(user)

    expect(await modal.findByRole('alert')).toHaveTextContent('No encontramos esta entrega o no tienes acceso a ella.')
    expect(modal.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('opens from the project tabs without leaving the tab: plan, and also the schedule', async () => {
    const user = userEvent.setup()
    setup()
    renderExpediente('/tutor/proyectos/p1?tab=plan')

    await user.click(await screen.findByRole('button', { name: 'Ver Propuesta inicial' }))
    await user.click(await screen.findByRole('button', { name: 'Revisar entrega' }))
    expect(await screen.findByRole('dialog', { name: 'Revisión de entrega' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Plan de trabajo y entregables' })).toHaveAttribute('aria-selected', 'true') // la pestaña no cambia
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog', { name: 'Revisión de entrega' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Plan de trabajo y entregables' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Calificación individual o grupal en la revisión', () => {
  const ana = { public_id: 'student-1', full_name: 'Ana Estudiante' }
  const luis = { public_id: 'student-2', full_name: 'Luis Estudiante' }
  const sg = (p: typeof ana, status: 'sin_calificar' | 'borrador' | 'publicada' = 'sin_calificar', grade: number | null = null, feedback: string | null = null) => ({
    student_public_id: p.public_id, student_name: p.full_name, status, grade, feedback, published_at: null,
  })
  const report = (crit: Record<string, unknown> = {}, students = [ana, luis]) =>
    evaluation({
      viewer: 'manager', can_configure: true, can_grade: true, status: 'publicada', published_totals: totals(), students,
      moments: [moment('m1', 'Contextualización', 20, [criterion('c1', 'Trabajo escrito', 60, { deliverable_public_id: 'd1', status: 'sin_calificar', ...crit })])],
    })
  const current = () => submission({ public_id: 'sub1', version: 1, file_name: 'a.pdf', submitted_at: '2026-03-10T10:00:00' })
  const open = async (user: ReturnType<typeof userEvent.setup>, rep: EvaluationOut, people = [ana, luis]) => {
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable({ status: 'en_revision', submissions_count: 1, current_submission: current() })]))
    vi.mocked(workPlanApi.listSubmissions).mockResolvedValue([current()] as never)
    vi.mocked(processesApi.team).mockResolvedValue([
      ...people.map((p, i) => ({ public_id: `m${i}`, user: p, process_role: 'estudiante', assigned_at: '', active: true })),
      { public_id: 'mt', user: { public_id: 'tutor-1', full_name: 'Andres Consultor' }, process_role: 'tutor', assigned_at: '', active: true },
    ] as never)
    vi.mocked(evaluationApi.get).mockResolvedValue(rep)
    vi.mocked(tutorApi.overview).mockResolvedValue(overview([project()]))
    renderPage(<TutorReviewsPage />)
    await user.click(await screen.findByRole('button', { name: /Revisar entrega/ }))
    return within(await screen.findByRole('dialog', { name: 'Revisión de entrega' }))
  }
  beforeEach(() => {
    vi.mocked(fetchPreviewInfo).mockResolvedValue({ mode: 'inline', file_url: '/api/x', embed_url: null, mime: 'application/pdf', size: 212000, file_name: 'a.pdf', message: null })
  })

  it('shows two functional cards, Individual and Grupal, with the one in use marked, when the project has several students', async () => {
    const user = userEvent.setup()
    const modal = await open(user, report())

    const group = within(await modal.findByRole('radiogroup', { name: 'Tipo de calificación' }))
    expect(group.getByRole('radio', { name: 'Grupal' })).toHaveAttribute('aria-checked', 'true')
    expect(group.getByRole('radio', { name: 'Individual' })).toHaveAttribute('aria-checked', 'false')
    expect(group.getByText('Califica a cada estudiante por separado')).toBeInTheDocument()
    expect(group.getByText('Asigna una misma calificación a todos los integrantes del grupo')).toBeInTheDocument()
    // grupal: sin selector de estudiante, con la indicación de que se aplica a todos
    expect(modal.queryByLabelText('Estudiante a calificar')).not.toBeInTheDocument()
    expect(modal.getByText(/Una sola nota y una sola retroalimentación para todos los integrantes/)).toHaveTextContent('Ana Estudiante, Luis Estudiante')
    await user.click(group.getByRole('radio', { name: 'Individual' }))
    expect(group.getByRole('radio', { name: 'Individual' })).toHaveAttribute('aria-checked', 'true') // sin notas guardadas el cambio no pide confirmar
    expect(modal.getByLabelText('Estudiante a calificar')).toBeInTheDocument()
  })

  it('does not show groups when the project has a single student', async () => {
    const user = userEvent.setup()
    const modal = await open(user, report({}, [ana]), [ana])

    await modal.findByLabelText('Nota (0 a 5)')
    expect(modal.queryByRole('radiogroup', { name: 'Tipo de calificación' })).not.toBeInTheDocument()
    expect(modal.queryByText(/Una sola nota y una sola retroalimentación/)).not.toBeInTheDocument()
  })

  it('grades each student separately in individual mode, each with their own grade and feedback, without reusing one for all', async () => {
    const user = userEvent.setup()
    // Servidor simulado con memoria: lo guardado vuelve a aparecer al releer la evaluación.
    const store: Record<string, ReturnType<typeof sg>> = { 'student-1': sg(ana), 'student-2': sg(luis) }
    const current = () => report({ grading_mode: 'individual', student_grades: [store['student-1'], store['student-2']] })
    vi.mocked(evaluationApi.saveGrade).mockImplementation(async (_t, _p, _c, payload) => {
      const who = payload.student_public_id as string
      store[who] = { ...store[who], status: 'borrador', grade: payload.grade, feedback: payload.feedback ?? null }
      return current()
    })
    const modal = await open(user, report())
    vi.mocked(evaluationApi.get).mockImplementation(async () => current())

    await user.click(await modal.findByRole('radio', { name: 'Individual' }))
    await user.type(modal.getByLabelText('Nota (0 a 5)'), '4')
    await user.type(modal.getByLabelText(/Retroalimentación para el estudiante/), 'Bien')
    await user.click(modal.getByRole('button', { name: 'Guardar borrador' }))
    expect(evaluationApi.saveGrade).toHaveBeenLastCalledWith('token', 'p1', 'c1', { grade: 4, feedback: 'Bien', publish: false, mode: 'individual', student_public_id: 'student-1', confirm_mode_change: false })
    expect(await modal.findByText('Borrador guardado. El estudiante aún no lo ve.')).toBeInTheDocument()

    await user.selectOptions(modal.getByLabelText('Estudiante a calificar'), 'student-2')
    expect(modal.getByLabelText('Nota (0 a 5)')).toHaveValue(null) // la nota de Ana no se reutiliza para Luis
    expect(modal.getByLabelText(/Retroalimentación para el estudiante/)).toHaveValue('')
    await user.type(modal.getByLabelText('Nota (0 a 5)'), '3');
    await user.click(modal.getByRole('button', { name: 'Guardar borrador' }))
    expect(evaluationApi.saveGrade).toHaveBeenLastCalledWith('token', 'p1', 'c1', { grade: 3, feedback: null, publish: false, mode: 'individual', student_public_id: 'student-2', confirm_mode_change: false })

    const chips = within(modal.getByRole('list', { name: 'Estado de calificación por estudiante' }))
    expect(chips.getByRole('button', { name: /Ana Estudiante.*Borrador · 4/ })).toBeInTheDocument()
    expect(chips.getByRole('button', { name: /Luis Estudiante.*Borrador · 3/ })).toBeInTheDocument()
  })

  it('loads what is already saved for each student when the criterion is graded individually', async () => {
    const user = userEvent.setup()
    const modal = await open(user, report({ grading_mode: 'individual', student_grades: [sg(ana, 'publicada', 4.5, 'Excelente'), sg(luis, 'borrador', 3, 'Mejorar')] }))

    expect(await modal.findByRole('radio', { name: 'Individual' })).toHaveAttribute('aria-checked', 'true')
    expect(modal.getByLabelText('Estudiante a calificar')).toHaveValue('student-2') // empieza por quien aún no tiene nota publicada
    expect(modal.getByLabelText('Nota (0 a 5)')).toHaveValue(3)
    expect(modal.getByLabelText(/Retroalimentación para el estudiante/)).toHaveValue('Mejorar')
    await user.click(within(modal.getByRole('list', { name: 'Estado de calificación por estudiante' })).getByRole('button', { name: /Ana Estudiante/ }))
    expect(modal.getByLabelText('Nota (0 a 5)')).toHaveValue(4.5)
    expect(modal.getByLabelText(/Retroalimentación para el estudiante/)).toHaveValue('Excelente')
  })

  it('asks for confirmation before changing the mode when grades are saved, keeps them, and sends the confirmation when saving', async () => {
    const user = userEvent.setup()
    vi.mocked(evaluationApi.saveGrade).mockImplementation(async () => report({ grading_mode: 'individual', group_grade: { grade: 4, feedback: 'Grupo', status: 'borrador', published_at: null }, student_grades: [sg(ana, 'borrador', 3), sg(luis)] }))
    const modal = await open(user, report({ group_grade: { grade: 4, feedback: 'Grupo', status: 'borrador', published_at: null }, grade: 4, feedback: 'Grupo', status: 'borrador' }))

    expect(await modal.findByLabelText('Nota (0 a 5)')).toHaveValue(4)
    await user.click(modal.getByRole('radio', { name: 'Individual' }))
    const ask = within(modal.getByRole('alertdialog', { name: 'Confirmar cambio de modalidad' }))
    expect(ask.getByText(/Las notas grupales guardadas se conservan, pero dejan de contar/)).toBeInTheDocument()
    await user.click(ask.getByRole('button', { name: 'Cancelar' }))
    expect(modal.getByRole('radio', { name: 'Grupal' })).toHaveAttribute('aria-checked', 'true')
    expect(modal.getByLabelText('Nota (0 a 5)')).toHaveValue(4) // nada se tocó

    await user.click(modal.getByRole('radio', { name: 'Individual' }))
    await user.click(within(modal.getByRole('alertdialog', { name: 'Confirmar cambio de modalidad' })).getByRole('button', { name: 'Sí, cambiar' }))
    expect(modal.getByRole('radio', { name: 'Individual' })).toHaveAttribute('aria-checked', 'true')
    expect(modal.getByLabelText('Nota (0 a 5)')).toHaveValue(null) // la nota grupal no se copia a los estudiantes
    await user.type(modal.getByLabelText('Nota (0 a 5)'), '3')
    await user.click(modal.getByRole('button', { name: 'Guardar borrador' }))
    expect(evaluationApi.saveGrade).toHaveBeenLastCalledWith('token', 'p1', 'c1', { grade: 3, feedback: null, publish: false, mode: 'individual', student_public_id: 'student-1', confirm_mode_change: true })
  })

  it('blocks switching the mode once grades are published', async () => {
    const user = userEvent.setup()
    const modal = await open(user, report({ grading_mode: 'individual', student_grades: [sg(ana, 'publicada', 4), sg(luis)] }))

    expect(await modal.findByRole('radio', { name: 'Grupal' })).toBeDisabled()
    expect(modal.getByRole('radio', { name: 'Individual' })).toBeEnabled()
  })

  it('publishes a group grade for every member, after a confirmation that says so', async () => {
    const user = userEvent.setup()
    vi.mocked(evaluationApi.saveGrade).mockResolvedValue(report({ status: 'publicada', grade: 4 }))
    const modal = await open(user, report())

    await user.type(await modal.findByLabelText('Nota (0 a 5)'), '4')
    await user.click(modal.getByRole('button', { name: 'Publicar calificación' }))
    expect(modal.getByRole('alertdialog')).toHaveTextContent('¿Publicar la calificación? El estudiante podrá consultar la nota y la retroalimentación. Se aplicará a todos los integrantes del grupo.')
    await user.click(within(modal.getByRole('alertdialog')).getByRole('button', { name: 'Sí, confirmar' }))
    expect(evaluationApi.saveGrade).toHaveBeenCalledWith('token', 'p1', 'c1', { grade: 4, feedback: null, publish: true, mode: 'grupal', student_public_id: null, confirm_mode_change: false })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Revisión de entrega' })).not.toBeInTheDocument())
  })

  it('publishes an individual grade for one student only, keeps the window open for the rest and closes when everyone has theirs', async () => {
    const user = userEvent.setup()
    vi.mocked(evaluationApi.saveGrade)
      .mockResolvedValueOnce(report({ grading_mode: 'individual', student_grades: [sg(ana, 'publicada', 4), sg(luis)] }))
      .mockResolvedValueOnce(report({ grading_mode: 'individual', student_grades: [sg(ana, 'publicada', 4), sg(luis, 'publicada', 3)] }))
    const modal = await open(user, report({ grading_mode: 'individual', student_grades: [sg(ana), sg(luis)] }))

    await user.type(await modal.findByLabelText('Nota (0 a 5)'), '4')
    await user.click(modal.getByRole('button', { name: 'Publicar calificación' }))
    expect(modal.getByRole('alertdialog')).toHaveTextContent('Solo se publica la de Ana Estudiante.')
    await user.click(within(modal.getByRole('alertdialog')).getByRole('button', { name: 'Sí, confirmar' }))
    expect(evaluationApi.saveGrade).toHaveBeenLastCalledWith('token', 'p1', 'c1', { grade: 4, feedback: null, publish: true, mode: 'individual', student_public_id: 'student-1', confirm_mode_change: false })

    expect(await modal.findByText('Calificación publicada para Ana Estudiante. Faltan: Luis Estudiante.')).toBeInTheDocument() // la ventana sigue abierta
    expect(modal.getByLabelText('Estudiante a calificar')).toHaveValue('student-2') // pasa al siguiente integrante
    await user.type(modal.getByLabelText('Nota (0 a 5)'), '3')
    await user.click(modal.getByRole('button', { name: 'Publicar calificación' }))
    await user.click(within(modal.getByRole('alertdialog')).getByRole('button', { name: 'Sí, confirmar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Revisión de entrega' })).not.toBeInTheDocument())
  })

  it('asks for corrections without touching any grade, whatever the mode', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.review).mockResolvedValue(current() as never)
    const modal = await open(user, report({ grading_mode: 'individual', student_grades: [sg(ana), sg(luis)] }))

    await user.type(await modal.findByLabelText(/Retroalimentación para el estudiante/), 'Falta la metodología')
    await user.click(modal.getByRole('button', { name: 'Solicitar correcciones' }))
    await user.click(within(modal.getByRole('alertdialog')).getByRole('button', { name: 'Sí, confirmar' }))
    expect(workPlanApi.review).toHaveBeenCalledWith('token', 'p1', 'sub1', 'requiere_correcciones', 'Falta la metodología')
    expect(evaluationApi.saveGrade).not.toHaveBeenCalled()
  })
})
