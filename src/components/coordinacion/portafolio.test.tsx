import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'
import type { PortfolioItem, PortfolioPage, PortfolioSummary } from '@/services/coordination.service'
import { projectOffers } from '@/components/publico/projectCatalog.data'

vi.mock('@/services/coordination.service', () => ({ portfolioApi: { list: vi.fn(), summary: vi.fn() } }))

import { portfolioApi } from '@/services/coordination.service'
import { Sidebar } from '@/components/layout/Sidebar'
import { PortafolioProyectos } from './PortafolioProyectos'
import { ProjectDetail, safePortfolioReturn } from '@/components/publico/ProjectDetail'

const coordinator: User = { id: 'c1', name: 'Diana Coordinadora', initials: 'DC', email: 'c@ucompensar.edu.co', role: 'coordinador', institutionalRoles: ['Coordinador'], authMethod: 'sso' }
const student: User = { id: 's1', name: 'Ana Estudiante', initials: 'AE', email: 'a@ucompensar.edu.co', role: 'estudiante', institutionalRoles: ['Estudiante'], authMethod: 'sso' }
const teacher: User = { id: 't1', name: 'Andres Docente', initials: 'AD', email: 't@ucompensar.edu.co', role: 'tutor_investigador', institutionalRoles: ['Docente'], authMethod: 'sso' }

const item = (o: Partial<PortfolioItem> = {}): PortfolioItem => ({
  kind: 'proceso', public_id: 'p1', code: 'PROYECTO_INV-2026-AAA', title: 'Detección de fallas', modality_code: 'PROYECTO_INV',
  modality_name: 'Proyecto de investigación', holder: 'Ana Estudiante', tutor: { public_id: 'u1', full_name: 'Tomás Tutor' }, state_code: 'RADICADO',
  state_name: 'Radicado', category: 'en_proceso', created_at: '2026-03-01T10:00:00', updated_at: '2026-04-01T10:00:00', closed_at: null,
  plan_status: 'publicado', progress: { total_required: 4, approved: 2, pending_review: 0, needs_corrections: 0, overdue: 0, percent: 50 }, overdue: false, ...o,
})

const page = (items: PortfolioItem[], total = items.length): PortfolioPage => ({
  items, total, page: 1, page_size: 15,
  facets: { tutors: [{ public_id: 'u1', full_name: 'Tomás Tutor' }], modalities: [], states: [{ code: 'RADICADO', name: 'Radicado', count: 1 }] },
})

const summary = (o: Partial<PortfolioSummary> = {}): PortfolioSummary => ({
  proposals_to_evaluate: 3, pending_assignment: 4, pending_assignment_processes: 1, in_progress: 5, finished: 2, delayed: 1, total: 10, ...o,
})

const proposal = item({
  kind: 'propuesta', public_id: 'pr1', code: 'PROP-2026-0001', title: 'Idea de una estudiante', holder: 'Bea Estudiante (+1)', tutor: null,
  state_code: 'pendiente_revision', state_name: 'Pendiente de revisión', category: 'propuestas', plan_status: null, progress: null,
})

const renderPage = () => render(<MemoryRouter><PortafolioProyectos /></MemoryRouter>)
const available = projectOffers.filter((o) => o.status === 'Disponible')
const lastFilters = () => {
  const calls = vi.mocked(portfolioApi.list).mock.calls
  return calls[calls.length - 1][1]
}

beforeEach(() => {
  useAppStore.setState({ currentUser: coordinator, isAuthenticated: true, accessToken: 'token' })
  vi.mocked(portfolioApi.summary).mockResolvedValue(summary())
  vi.mocked(portfolioApi.list).mockResolvedValue(page([item(), proposal]))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('menú', () => {
  it('shows «Portafolio de proyectos» to coordination only', () => {
    const { unmount } = render(<MemoryRouter><Sidebar user={coordinator} onLogout={() => {}} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Portafolio de proyectos' })).toBeInTheDocument()
    unmount()
    for (const other of [student, teacher]) {
      const view = render(<MemoryRouter><Sidebar user={other} onLogout={() => {}} /></MemoryRouter>)
      expect(screen.queryByRole('button', { name: 'Portafolio de proyectos' })).not.toBeInTheDocument()
      view.unmount()
    }
  })
})

describe('Portafolio de proyectos', () => {
  it('shows KPI cards from the API and offers counted from the static catalog', async () => {
    renderPage()
    const card = (label: string) => screen.getByText(label).closest('.card') as HTMLElement
    expect(await screen.findByText('Detección de fallas')).toBeInTheDocument()
    expect(within(card('Ofertas disponibles')).getByText(String(available.length))).toBeInTheDocument()
    expect(within(card('Propuestas por evaluar')).getByText('3')).toBeInTheDocument()
    expect(within(card('Pendientes de asignación')).getByText('4')).toBeInTheDocument()
    expect(within(card('Procesos en curso')).getByText('5')).toBeInTheDocument()
    expect(within(card('Procesos finalizados')).getByText('2')).toBeInTheDocument()
    expect(within(card('Procesos con retrasos')).getByText('1')).toBeInTheDocument()
  })

  it('differentiates offers, proposals and official processes in «Todos» and offers actions per type', async () => {
    renderPage()
    expect(await screen.findByText('Detección de fallas')).toBeInTheDocument()
    expect(screen.getAllByText('Oferta del catálogo').length).toBe(available.length)
    expect(screen.getByText('Propuesta estudiantil')).toBeInTheDocument()
    expect(screen.getByText('Proceso oficial')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: `Ver oferta ${available[0].title}` })).toHaveAttribute('href', `/proyectos-de-grado/${available[0].id}`)
    expect(screen.getByRole('link', { name: /Evaluar propuesta Idea de una estudiante/ })).toHaveAttribute('href', '/coordinacion/propuestas/pr1')
    expect(screen.getByRole('link', { name: /Abrir expediente de Detección de fallas/ })).toHaveAttribute('href', '/coordinacion/proyectos/p1')
    // Un proceso con tutor no ofrece «Asignar tutor»; el avance solo aparece en procesos con plan.
    expect(screen.queryByRole('link', { name: /Asignar tutor/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  })

  it('«Disponibles» lists catalog offers without querying persisted records', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Detección de fallas')
    vi.mocked(portfolioApi.list).mockClear()
    await user.click(screen.getByRole('tab', { name: 'Disponibles' }))

    expect(await screen.findAllByText('Oferta del catálogo')).toHaveLength(available.length)
    expect(screen.queryByText('Detección de fallas')).not.toBeInTheDocument()
    expect(portfolioApi.list).not.toHaveBeenCalled()
  })

  it('asks the backend for each category tab and shows «Asignar tutor» for processes without tutor', async () => {
    const user = userEvent.setup()
    vi.mocked(portfolioApi.list).mockResolvedValue(page([item({ category: 'por_asignar', tutor: null, progress: null, plan_status: 'sin_plan' })]))
    renderPage()
    await screen.findByText('Detección de fallas')
    await user.click(screen.getByRole('tab', { name: 'Por asignar' }))

    await waitFor(() => expect(lastFilters()).toMatchObject({ category: 'por_asignar' }))
    expect(await screen.findByRole('link', { name: /Asignar tutor a Detección de fallas/ })).toHaveAttribute('href', '/coordinacion/asignacion')
    expect(screen.getByText('Sin tutor')).toBeInTheDocument()
    expect(screen.queryByText('Oferta del catálogo')).not.toBeInTheDocument()

    vi.mocked(portfolioApi.list).mockResolvedValue(page([item({ category: 'finalizados', closed_at: '2026-05-01T00:00:00' })]))
    await user.click(screen.getByRole('tab', { name: 'Finalizados' }))
    await waitFor(() => expect(lastFilters()).toMatchObject({ category: 'finalizados' }))
    expect(await screen.findByRole('link', { name: /Ver cierre de Detección de fallas/ })).toBeInTheDocument()
  })

  it('applies search, type and state filters and excludes offers when they cannot match', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Detección de fallas')

    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'RADICADO')
    await waitFor(() => expect(lastFilters()).toMatchObject({ state: 'RADICADO' }))
    expect(screen.queryByText('Oferta del catálogo')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por tipo de registro'), 'proceso')
    await waitFor(() => expect(lastFilters()).toMatchObject({ kind: 'proceso' }))

    await user.type(screen.getByLabelText(/Buscar por código/), 'fallas')
    await waitFor(() => expect(lastFilters()).toMatchObject({ search: 'fallas' }))
  })

  it('shows a real empty state when the backend answers with no records', async () => {
    vi.mocked(portfolioApi.list).mockResolvedValue(page([]))
    vi.mocked(portfolioApi.summary).mockResolvedValue(summary({ proposals_to_evaluate: 0, in_progress: 0 }))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'En proceso' }))
    expect(await screen.findByText('No hay registros en esta categoría')).toBeInTheDocument()
    expect(screen.queryByText(/No se pudo cargar/)).not.toBeInTheDocument()
  })

  it('distinguishes a server error from an empty portfolio and allows retrying', async () => {
    vi.mocked(portfolioApi.list).mockRejectedValueOnce(new ApiError(500, 'Error interno del servidor'))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Error interno del servidor')).toBeInTheDocument()
    expect(screen.queryByText('No hay registros en esta categoría')).not.toBeInTheDocument()
    expect(within(screen.getByText('Propuestas por evaluar').closest('.card') as HTMLElement).getByText('—')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByText('Detección de fallas')).toBeInTheDocument()
  })
})

describe('detalle de una oferta abierto desde el portafolio', () => {
  const offer = available[0]
  const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>
  const renderApp = (initial: Parameters<typeof MemoryRouter>[0]['initialEntries']) =>
    render(
      <MemoryRouter initialEntries={initial}>
        <Routes>
          <Route path="/coordinacion/portafolio" element={<><PortafolioProyectos /><Where /></>} />
          <Route path="/proyectos-de-grado/:offerId" element={<ProjectDetail />} />
          <Route path="/proyectos-de-grado/modalidad/:slug" element={<p>catálogo de la modalidad</p>} />
        </Routes>
      </MemoryRouter>
    )

  it('opens the right offer without public actions and returns to the portfolio keeping tab, filters and page', async () => {
    const user = userEvent.setup()
    renderApp(['/coordinacion/portafolio?tab=todos&q=' + offer.id + '&modality=' + offer.modalityId])
    await user.click(await screen.findByRole('link', { name: `Ver oferta ${offer.title}` }))

    expect(await screen.findByRole('heading', { level: 1, name: offer.title })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Postularme/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Volver a oportunidades')).not.toBeInTheDocument()
    expect(screen.getAllByText('Volver al portafolio').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Volver al portafolio' }))
    expect(await screen.findByTestId('where')).toHaveTextContent(`/coordinacion/portafolio?q=${offer.id}&modality=${offer.modalityId}`)
    expect(screen.getByLabelText(/Buscar por código/)).toHaveValue(offer.id)
    expect(screen.getByLabelText('Filtrar por modalidad')).toHaveValue(offer.modalityId)
  })

  it('direct access keeps working: a coordinator without navigation state still gets the safe fallback only when the origin is the portfolio', async () => {
    renderApp([{ pathname: `/proyectos-de-grado/${offer.id}`, state: { from: 'portafolio', returnTo: 'https://evil.example/x' } }])
    const back = (await screen.findAllByText('Volver al portafolio'))[0].closest('a')
    expect(back).toHaveAttribute('href', '/coordinacion/portafolio')
  })

  it('the public catalog keeps «Volver a oportunidades» and «Postularme» for anonymous visitors, students and forged state', async () => {
    useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
    renderApp([{ pathname: `/proyectos-de-grado/${offer.id}`, state: { from: 'portafolio', returnTo: '/coordinacion/portafolio' } }])
    expect(await screen.findByRole('button', { name: /Postularme/ })).toBeInTheDocument()
    expect(screen.getAllByText('Volver a oportunidades').length).toBeGreaterThan(0)
    expect(screen.queryByText('Volver al portafolio')).not.toBeInTheDocument()
  })

  it('only accepts the portfolio itself as a return target', () => {
    expect(safePortfolioReturn('/coordinacion/portafolio?tab=en_proceso&page=2')).toBe('/coordinacion/portafolio?tab=en_proceso&page=2')
    for (const bad of [undefined, 42, '/dashboard', '//evil.example', 'https://evil.example', '/coordinacion/portafolio-x', '/coordinacion/portafolio#x']) {
      expect(safePortfolioReturn(bad)).toBe('/coordinacion/portafolio')
    }
  })
})
