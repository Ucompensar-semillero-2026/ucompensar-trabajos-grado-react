import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { STUDENT_NAV_GROUPS } from '@/constants'
import type { User } from '@/types'
import type { DeliverableOut, WorkPlanOut } from '@/services/workplan.service'

vi.mock('@/services/processes.service', () => ({ processesApi: { list: vi.fn(), history: vi.fn() } }))
vi.mock('@/services/workplan.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/workplan.service')>()),
  workPlanApi: { get: vi.fn(), submit: vi.fn(), listSubmissions: vi.fn() },
}))
vi.mock('@/components/documentos/DocumentosSection', () => ({ DocumentosSection: () => <p>repositorio de revisión</p> }))

import { processesApi } from '@/services/processes.service'
import { workPlanApi } from '@/services/workplan.service'
import { DocumentsRoute } from './DocumentsRoute'
import { EntregablesSection } from './EntregablesSection'
import { MiProcesoSection } from './MiProcesoSection'

const student: User = {
  id: 'student-1',
  name: 'Ana Estudiante',
  initials: 'AE',
  email: 'ana@ucompensar.edu.co',
  role: 'estudiante',
  institutionalRoles: ['Estudiante'],
  authMethod: 'sso',
}

const proc = (id: string, title: string | null, studentId = student.id) => ({
  public_id: id,
  process_code: `CODE-${id}`,
  title,
  student: { public_id: studentId },
  modality: { public_id: 'm1', code: 'PROYECTO_INV', name: 'Proyecto de investigación' },
  state: { public_id: 's1', code: 'RADICADO', name: 'Radicado' },
  academic_semester: '2026-1',
  created_at: '2026-03-01T10:00:00',
  updated_at: null,
  closed_at: null,
})

function deliverable(overrides: Partial<DeliverableOut> = {}): DeliverableOut {
  return {
    public_id: 'd1',
    stage_public_id: 'st1',
    title: 'Propuesta inicial',
    instructions: 'Usa el formato institucional.',
    mandatory: true,
    applicable: true,
    active: true,
    sort_order: 0,
    due_date: '2026-03-20',
    depends_on_public_id: null,
    accepted_extensions: null,
    template_file_name: null,
    template_download_url: null,
    status: 'disponible',
    is_overdue: false,
    can_submit: true,
    submissions_count: 0,
    current_submission: null,
    ...overrides,
  }
}

function plan(deliverables: DeliverableOut[], overrides: Partial<WorkPlanOut> = {}): WorkPlanOut {
  const required = deliverables.filter((d) => d.mandatory && d.active && d.applicable)
  const approved = required.filter((d) => d.status === 'aprobado').length
  return {
    public_id: 'plan1',
    process_public_id: 'p1',
    process_title: 'Detección de fallas',
    status: 'publicado',
    start_date: '2026-02-02',
    target_end_date: '2026-12-04',
    template_code: null,
    published_at: '2026-02-10T10:00:00',
    stages: [
      { public_id: 'st1', name: 'Formulación y planificación', description: null, semester: 1, sort_order: 0, active: true, deliverables: deliverables.slice(0, 2) },
      { public_id: 'st2', name: 'Desarrollo y cierre', description: null, semester: 2, sort_order: 1, active: true, deliverables: deliverables.slice(2) },
    ],
    progress: {
      total_required: required.length,
      approved,
      pending_review: required.filter((d) => d.status === 'en_revision').length,
      needs_corrections: required.filter((d) => d.status === 'requiere_correcciones').length,
      overdue: required.filter((d) => d.is_overdue).length,
      percent: required.length ? Math.round((approved / required.length) * 1000) / 10 : 0,
    },
    process_state_code: 'RADICADO',
    process_state_name: 'Radicado',
    official_completion: false,
    can_manage: false,
    ...overrides,
  }
}

const submission = (overrides = {}) => ({
  public_id: 'sub1',
  version: 1,
  file_name: 'propuesta.pdf',
  status: 'en_revision' as const,
  student_comment: null,
  submitted_by: { public_id: student.id, full_name: student.name },
  submitted_at: '2026-03-10T10:00:00',
  download_url: 'https://files.example/propuesta.pdf?sig=1',
  reviews: [],
  ...overrides,
})

function renderAt(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeEach(() => {
  useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
  vi.mocked(processesApi.list).mockResolvedValue([proc('p1', 'Detección de fallas')] as never)
  vi.mocked(processesApi.history).mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('menú del estudiante', () => {
  it('lists the approved entries with existing routes and without "Nuevo trámite"', () => {
    const entries = STUDENT_NAV_GROUPS.map((g) => [g.label, g.items.map((i) => [i.label, i.path ?? i.href])])
    expect(entries).toEqual([
      ['Principal', [['Inicio', '/dashboard'], ['Mi proceso de grado', '/mi-proceso'], ['Mis trámites', '/tramites']]],
      ['Seguimiento académico', [['Mis propuestas', '/mis-propuestas'], ['Documentos y entregables', '/documentos'], ['Notificaciones', '/notificaciones']]],
      ['Ayuda', [['Ayuda y soporte', 'https://ucompensar.edu.co/soporte-crm/']]],
    ])
  })
})

describe('Mi proceso de grado', () => {
  it('shows an informative empty state with a link to "Mis trámites" when there is no process', async () => {
    vi.mocked(processesApi.list).mockResolvedValue([])
    renderAt(<MiProcesoSection />)

    expect(await screen.findByText('Aún no tienes un proceso de grado activo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Mis trámites' })).toHaveAttribute('href', '/tramites')
    expect(workPlanApi.get).not.toHaveBeenCalled()
  })

  it('shows the processes the backend returns, including those where the student is a verified team member', async () => {
    vi.mocked(processesApi.list).mockResolvedValue([proc('x1', 'Proyecto grupal', 'otra-autora')] as never)
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable()], { process_title: 'Proyecto grupal' }))
    renderAt(<MiProcesoSection />)

    expect(await screen.findByRole('heading', { name: 'Proyecto grupal' })).toBeInTheDocument()
    expect(workPlanApi.get).toHaveBeenCalledWith('token', 'x1')
  })

  it('tells the student the plan is not published yet (404) without inventing data', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'El plan de trabajo aún no está publicado'))
    renderAt(<MiProcesoSection />)

    expect(await screen.findByText('Tu tutor aún no ha publicado el plan de trabajo')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows state, dates, progress from approved mandatory deliverables, stages by semester and history', async () => {
    vi.mocked(workPlanApi.get).mockResolvedValue(
      plan([
        deliverable({ public_id: 'd1', title: 'Propuesta inicial', status: 'aprobado', can_submit: false }),
        deliverable({ public_id: 'd2', title: 'Metodología', due_date: '2026-04-15' }),
        deliverable({ public_id: 'd3', title: 'Documento final', status: 'pendiente', can_submit: false, due_date: null }),
      ])
    )
    vi.mocked(processesApi.history).mockResolvedValue([
      { public_id: 'h1', previous_state: null, new_state: { public_id: 's1', code: 'RADICADO', name: 'Radicado' }, user: {}, event_date: '2026-03-01T10:00:00', comment: 'Creación de trámite' },
    ] as never)
    renderAt(<MiProcesoSection />)

    expect(await screen.findByRole('heading', { name: 'Detección de fallas' })).toBeInTheDocument()
    expect(screen.getByText(/1 de 3 entregables obligatorios aprobados/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33.3')
    expect(screen.getByRole('heading', { name: 'Semestre 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Semestre 2' })).toBeInTheDocument()
    expect(screen.getByText('Proceso en curso')).toBeInTheDocument()
    expect(screen.getAllByText('Sin fecha definida').length).toBeGreaterThan(0)
    expect(await screen.findByText('Creación de trámite')).toBeInTheDocument()
    // "Próximas entregas": solo lo que está disponible con fecha; el aprobado y el pendiente no aparecen.
    const upcoming = screen.getByRole('heading', { name: /Próximas entregas/ }).closest('div') as HTMLElement
    expect(within(upcoming).getByText('Metodología')).toBeInTheDocument()
    expect(within(upcoming).queryByText('Propuesta inicial')).not.toBeInTheDocument()
  })

  it('does not claim progress when nothing is mandatory', async () => {
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable({ mandatory: false })]))
    renderAt(<MiProcesoSection />)

    expect(await screen.findByText('Aún no hay entregables obligatorios publicados.')).toBeInTheDocument()
  })

  it('lets the student pick between processes and loads the plan of the selected one only', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.list).mockResolvedValue([proc('p1', 'Proyecto uno'), proc('p2', 'Proyecto dos')] as never)
    vi.mocked(workPlanApi.get).mockImplementation(async (_t, id) =>
      plan([deliverable({ title: id === 'p1' ? 'Entregable uno' : 'Entregable dos' })], { process_public_id: id, process_title: id === 'p1' ? 'Proyecto uno' : 'Proyecto dos' })
    )
    renderAt(<MiProcesoSection />)

    expect(await screen.findByRole('heading', { name: 'Proyecto uno' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Proceso de grado'), 'p2')

    expect(await screen.findByRole('heading', { name: 'Proyecto dos' })).toBeInTheDocument()
    expect(workPlanApi.get).toHaveBeenLastCalledWith('token', 'p2')
    expect(screen.queryByText('Entregable uno')).not.toBeInTheDocument()
  })
})

describe('Documentos y entregables', () => {
  const findCard = (title: string) => screen.getByRole('heading', { name: title }).closest('article') as HTMLElement

  it('renders the template download, instructions and due date, and offers "Subir documento"', async () => {
    vi.mocked(workPlanApi.get).mockResolvedValue(
      plan([deliverable({ template_file_name: 'formato.pdf', template_download_url: 'https://files.example/formato.pdf?sig=9' })])
    )
    renderAt(<EntregablesSection />)

    const card = within(await screen.findByRole('heading', { name: 'Propuesta inicial' }).then((h) => h.closest('article') as HTMLElement))
    expect(card.getByText(/Usa el formato institucional/)).toBeInTheDocument()
    expect(card.getByRole('link', { name: /Descargar plantilla/ })).toHaveAttribute('href', 'https://files.example/formato.pdf?sig=9')
    expect(card.getByRole('link', { name: /Descargar plantilla/ })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(card.getByRole('button', { name: 'Subir documento' })).toBeEnabled()
    expect(card.getByText('Disponible para entregar')).toBeInTheDocument()
    expect(card.getByText('Obligatorio')).toBeInTheDocument()
  })

  it('blocks a deliverable that depends on another one and says which', async () => {
    vi.mocked(workPlanApi.get).mockResolvedValue(
      plan([
        deliverable({ public_id: 'd1', title: 'Primer informe' }),
        deliverable({ public_id: 'd2', title: 'Ejecución', status: 'pendiente', can_submit: false, depends_on_public_id: 'd1' }),
      ])
    )
    renderAt(<EntregablesSection />)

    await screen.findByRole('heading', { name: 'Ejecución' })
    const card = within(findCard('Ejecución'))
    expect(card.queryByRole('button', { name: /Subir documento|Reemplazar entrega/ })).not.toBeInTheDocument()
    expect(card.getByText('Se habilita cuando se apruebe «Primer informe».')).toBeInTheDocument()
  })

  it('uploads a deliverable once, reloads from the API and never shows it as approved', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get)
      .mockResolvedValueOnce(plan([deliverable()]))
      .mockResolvedValue(plan([deliverable({ status: 'en_revision', submissions_count: 1, current_submission: submission() })]))
    vi.mocked(workPlanApi.submit).mockResolvedValue(submission() as never)
    renderAt(<EntregablesSection />)

    await screen.findByRole('heading', { name: 'Propuesta inicial' })
    const file = new File(['%PDF-1.7'], 'propuesta.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Seleccionar archivo para Propuesta inicial'), file)

    await waitFor(() => expect(workPlanApi.submit).toHaveBeenCalledTimes(1))
    expect(workPlanApi.submit).toHaveBeenCalledWith('token', 'p1', 'd1', file)
    const card = within(findCard('Propuesta inicial'))
    expect(await card.findByText('En revisión')).toBeInTheDocument()
    expect(card.queryByText('Aprobado')).not.toBeInTheDocument()
    expect(card.getByText('Entrega registrada. Quedó en revisión por tu tutor.')).toBeInTheDocument()
    expect(card.getByRole('button', { name: 'Reemplazar entrega' })).toBeInTheDocument()
    expect(card.getByRole('link', { name: /Descargar mi entrega/ })).toHaveAttribute('href', 'https://files.example/propuesta.pdf?sig=1')
    // Subir un archivo no suma al avance: solo cuenta lo aprobado por el tutor.
    expect(screen.getByText(/entregables obligatorios aprobados/).textContent).toMatch(/^0\s*de\s*1/)
  })

  it('ignores a second selection while the first upload is in flight', async () => {
    let resolveSubmit: (v: unknown) => void = () => {}
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable()]))
    vi.mocked(workPlanApi.submit).mockReturnValue(new Promise((r) => (resolveSubmit = r)) as never)
    renderAt(<EntregablesSection />)

    await screen.findByRole('heading', { name: 'Propuesta inicial' })
    const input = screen.getByLabelText('Seleccionar archivo para Propuesta inicial')
    const file = new File(['%PDF-1.7'], 'a.pdf')
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.change(input, { target: { files: [file] } })
    resolveSubmit(submission())

    await waitFor(() => expect(workPlanApi.submit).toHaveBeenCalledTimes(1))
  })

  it('rejects a disallowed format before calling the API', async () => {
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable({ accepted_extensions: ['.docx'] })]))
    renderAt(<EntregablesSection />)

    await screen.findByRole('heading', { name: 'Propuesta inicial' })
    fireEvent.change(screen.getByLabelText('Seleccionar archivo para Propuesta inicial'), { target: { files: [new File(['x'], 'malware.exe')] } })

    expect(await screen.findByText(/Formato no permitido. Usa: \.docx/)).toBeInTheDocument()
    expect(workPlanApi.submit).not.toHaveBeenCalled()
  })

  it('shows the server error and does not pretend the delivery was registered', async () => {
    vi.mocked(workPlanApi.get).mockResolvedValue(plan([deliverable()]))
    vi.mocked(workPlanApi.submit).mockRejectedValue(new ApiError(409, 'Este entregable ya fue aprobado'))
    renderAt(<EntregablesSection />)

    await screen.findByRole('heading', { name: 'Propuesta inicial' })
    fireEvent.change(screen.getByLabelText('Seleccionar archivo para Propuesta inicial'), { target: { files: [new File(['%PDF'], 'a.pdf')] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Este entregable ya fue aprobado')
    expect(screen.queryByText('Entrega registrada. Quedó en revisión por tu tutor.')).not.toBeInTheDocument()
  })

  it('shows the tutor\'s observations and allows a replacement when corrections are requested', async () => {
    const user = userEvent.setup()
    const reviewed = submission({
      status: 'requiere_correcciones',
      reviews: [{ public_id: 'r1', decision: 'requiere_correcciones', comment: 'Falta el diseño muestral', reviewer: { public_id: 't', full_name: 'Prof. Tutor' }, created_at: '2026-03-12T10:00:00' }],
    })
    vi.mocked(workPlanApi.get).mockResolvedValue(
      plan([deliverable({ status: 'requiere_correcciones', submissions_count: 1, current_submission: reviewed })])
    )
    renderAt(<EntregablesSection />)

    await screen.findByRole('heading', { name: 'Propuesta inicial' })
    const card = within(findCard('Propuesta inicial'))
    expect(card.getByRole('button', { name: 'Reemplazar entrega' })).toBeEnabled()
    expect(card.queryByText('Falta el diseño muestral')).not.toBeInTheDocument()
    await user.click(card.getByRole('button', { name: /Ver observaciones \(1\)/ }))
    expect(card.getByText('Falta el diseño muestral')).toBeInTheDocument()
    expect(card.getByText(/Prof\. Tutor/)).toBeInTheDocument()
  })

  it('offers no upload for an approved deliverable and loads the history on demand', async () => {
    const user = userEvent.setup()
    vi.mocked(workPlanApi.get).mockResolvedValue(
      plan([deliverable({ status: 'aprobado', can_submit: false, submissions_count: 2, current_submission: submission({ status: 'aprobado', version: 2 }) })])
    )
    vi.mocked(workPlanApi.listSubmissions).mockResolvedValue([submission({ version: 2, status: 'aprobado' }), submission({ public_id: 'sub0', version: 1, status: 'requiere_correcciones' })] as never)
    renderAt(<EntregablesSection />)

    await screen.findByRole('heading', { name: 'Propuesta inicial' })
    const card = within(findCard('Propuesta inicial'))
    expect(card.queryByRole('button', { name: /Subir documento|Reemplazar entrega/ })).not.toBeInTheDocument()
    expect(card.getByText('Entrega aprobada por tu tutor')).toBeInTheDocument()

    await user.click(card.getByRole('button', { name: /Historial \(2\)/ }))
    expect(await card.findByText('v1')).toBeInTheDocument()
    expect(workPlanApi.listSubmissions).toHaveBeenCalledWith('token', 'p1', 'd1')
  })

  it('shows an empty state when the tutor has not published anything', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'no publicado'))
    renderAt(<EntregablesSection />)

    expect(await screen.findByText('Tu tutor aún no ha publicado entregables')).toBeInTheDocument()
  })
})

describe('ruta /documentos', () => {
  it('shows the deliverables page to students and keeps the document repository for other roles', async () => {
    vi.mocked(processesApi.list).mockResolvedValue([])
    const { unmount } = renderAt(<DocumentsRoute />)
    expect(await screen.findByText('Aún no tienes entregables')).toBeInTheDocument()
    unmount()

    useAppStore.setState({ currentUser: { ...student, role: 'coordinador', institutionalRoles: ['Coordinador'] } })
    renderAt(<DocumentsRoute />)
    expect(screen.getByText('repositorio de revisión')).toBeInTheDocument()
  })
})
