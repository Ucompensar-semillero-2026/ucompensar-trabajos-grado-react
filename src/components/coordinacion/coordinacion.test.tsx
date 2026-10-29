import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'
import type { CoordinationPage, CoordinationProcessOut, CoordinationSummary } from '@/services/coordination.service'

vi.mock('@/services/coordination.service', () => ({ coordinationApi: { summary: vi.fn(), processes: vi.fn() } }))
vi.mock('@/services/processes.service', () => ({
  processesApi: { teamCandidates: vi.fn(), addTeamMember: vi.fn(), changeTutor: vi.fn(), team: vi.fn() },
}))
vi.mock('@/services/modalities.service', () => ({ modalitiesApi: { list: vi.fn() } }))
vi.mock('@/components/dashboard/DashboardSection', () => ({ DashboardSection: () => <p>tablero general</p> }))

import { coordinationApi } from '@/services/coordination.service'
import { processesApi } from '@/services/processes.service'
import { modalitiesApi } from '@/services/modalities.service'
import { Sidebar } from '@/components/layout/Sidebar'
import { AsignacionTutores } from './AsignacionTutores'
import { CoordinationDashboard } from './CoordinationDashboard'
import { DashboardRoute } from './DashboardRoute'

const coordinator: User = { id: 'coord-1', name: 'Diana Coordinadora', initials: 'DC', email: 'c@ucompensar.edu.co', role: 'coordinador', institutionalRoles: ['Coordinador'], authMethod: 'sso' }
const student: User = { id: 's1', name: 'Ana Estudiante', initials: 'AE', email: 'a@ucompensar.edu.co', role: 'estudiante', institutionalRoles: ['Estudiante'], authMethod: 'sso' }
const teacher: User = { id: 't1', name: 'Andres Consultor', initials: 'AC', email: 't@ucompensar.edu.co', role: 'tutor_investigador', institutionalRoles: ['Docente'], authMethod: 'sso' }

const summary = (o: Partial<CoordinationSummary> = {}): CoordinationSummary => ({
  registered_processes: 5, pending_tutor: 2, with_tutor: 3, active_students: 4, pending_reviews: 6, delayed_projects: 1, tutors_available: 7,
  state_distribution: [{ code: 'RADICADO', name: 'Radicado', count: 5 }], ...o,
})

const row = (o: Partial<CoordinationProcessOut> = {}): CoordinationProcessOut => ({
  process_public_id: 'p1', process_code: 'PROYECTO_INV-2026-AAA', title: 'Detección de fallas', student: { public_id: 's1', full_name: 'Ana Estudiante' },
  modality_name: 'Proyecto de investigación', process_state_code: 'RADICADO', process_state_name: 'Radicado', academic_semester: '2026-1',
  created_at: '2026-03-01T10:00:00', tutor: null, plan_status: 'sin_plan', current_stage: null, progress: null, next_due_title: null, next_due_date: null,
  pending_review_count: 0, corrections_count: 0, overdue_count: 0, official_completion: false, ...o,
})

const page = (items: CoordinationProcessOut[], total = items.length): CoordinationPage => ({ items, total, page: 1, page_size: 15 })

const candidate = (id: string, name: string, role = 'tutor_investigador', active = 0) => ({ public_id: id, full_name: name, email: `${id}@u.co`, role: { name: role }, active_projects: active })

const renderAt = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  useAppStore.setState({ currentUser: coordinator, isAuthenticated: true, accessToken: 'token' })
  vi.mocked(modalitiesApi.list).mockResolvedValue([{ public_id: 'm1', code: 'PROYECTO_INV', name: 'Proyecto de investigación' }])
  vi.mocked(processesApi.team).mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('menú de Coordinación', () => {
  it('shows "Asignación de tutores" to coordination only', () => {
    const { unmount } = renderAt(<Sidebar user={coordinator} onLogout={() => {}} />)
    expect(screen.getByRole('button', { name: 'Asignación de tutores' })).toBeInTheDocument()
    unmount()
    for (const other of [student, teacher]) {
      const view = renderAt(<Sidebar user={other} onLogout={() => {}} />)
      expect(screen.queryByRole('button', { name: 'Asignación de tutores' })).not.toBeInTheDocument()
      view.unmount()
    }
  })
})

describe('Dashboard de Coordinación', () => {
  it('shows the six indicators computed by the API and the shortcuts', async () => {
    vi.mocked(coordinationApi.summary).mockResolvedValue(summary())
    vi.mocked(coordinationApi.processes).mockResolvedValue(page([row()]))
    renderAt(<CoordinationDashboard />)

    const card = (label: string) => screen.getByText(label).closest('.card') as HTMLElement
    expect(await screen.findByText('Procesos registrados')).toBeInTheDocument()
    expect(within(card('Procesos registrados')).getByText('5')).toBeInTheDocument()
    expect(within(card('Pendientes de asignar tutor')).getByText('2')).toBeInTheDocument()
    expect(within(card('Con tutor activo')).getByText('3')).toBeInTheDocument()
    expect(within(card('Estudiantes activos')).getByText('4')).toBeInTheDocument()
    expect(within(card('Entregas por revisar')).getByText('6')).toBeInTheDocument()
    expect(within(card('Proyectos con retraso')).getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Asignación de tutores/ })).toHaveAttribute('href', '/coordinacion/asignacion')
    expect(screen.getByRole('link', { name: /Gestión de proyectos/ })).toHaveAttribute('href', '/tramites')
    expect(screen.getByRole('link', { name: /Seguimiento e informes/ })).toHaveAttribute('href', '/reportes')
    expect(coordinationApi.processes).toHaveBeenCalledWith('token', { assignment: 'sin_tutor', page_size: 5 })
  })

  it('shows zeros only when the API answered with an empty collection, with a clear empty state', async () => {
    vi.mocked(coordinationApi.summary).mockResolvedValue(summary({ registered_processes: 0, pending_tutor: 0, with_tutor: 0, active_students: 0, pending_reviews: 0, delayed_projects: 0, state_distribution: [] }))
    vi.mocked(coordinationApi.processes).mockResolvedValue(page([]))
    renderAt(<CoordinationDashboard />)

    expect(await screen.findByText('No hay procesos pendientes de tutor')).toBeInTheDocument()
    expect(screen.getByText(/Aún no hay procesos registrados/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error (not zeros) when the API fails, and retries', async () => {
    const user = userEvent.setup()
    vi.mocked(coordinationApi.summary).mockRejectedValueOnce(new ApiError(500, 'Error del servidor')).mockResolvedValue(summary())
    vi.mocked(coordinationApi.processes).mockResolvedValue(page([row()]))
    renderAt(<CoordinationDashboard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    expect(screen.queryByText('Procesos registrados')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Procesos registrados')).toBeInTheDocument()
  })

  it('/dashboard shows the coordination panel to coordinators and the general board to everyone else', async () => {
    vi.mocked(coordinationApi.summary).mockResolvedValue(summary())
    vi.mocked(coordinationApi.processes).mockResolvedValue(page([]))
    const { unmount } = renderAt(<DashboardRoute />)
    expect(await screen.findByText('Procesos registrados')).toBeInTheDocument()
    unmount()

    useAppStore.setState({ currentUser: student })
    renderAt(<DashboardRoute />)
    expect(screen.getByText('tablero general')).toBeInTheDocument()
  })
})

describe('Asignación de tutores', () => {
  it('lists real processes with the right action per row and the real indicators', async () => {
    vi.mocked(coordinationApi.summary).mockResolvedValue(summary())
    vi.mocked(coordinationApi.processes).mockResolvedValue(
      page([
        row(),
        row({ process_public_id: 'p2', process_code: 'PROYECTO_INV-2026-BBB', title: 'Redes', student: { public_id: 's2', full_name: 'Luis Pérez' }, tutor: { member_public_id: 'm9', public_id: 'u1', full_name: 'Andres Consultor' } }),
      ])
    )
    renderAt(<AsignacionTutores />)

    const table = within(await screen.findByRole('table'))
    expect(table.getByRole('button', { name: 'Asignar tutor de Ana Estudiante' })).toBeInTheDocument()
    expect(table.getByRole('button', { name: 'Cambiar tutor de Luis Pérez' })).toBeInTheDocument()
    expect(table.getByText('Andres Consultor')).toBeInTheDocument()
    expect(table.getByText('Sin tutor')).toBeInTheDocument()
    expect(table.getByRole('link', { name: 'Abrir expediente de Ana Estudiante' })).toHaveAttribute('href', '/coordinacion/proyectos/p1')
    expect(screen.getByText('Proyectos sin asignar').closest('.card')).toHaveTextContent('2')
    expect(screen.getByText('Tutores disponibles').closest('.card')).toHaveTextContent('7')
  })

  it('distinguishes an empty result from an API failure', async () => {
    const user = userEvent.setup()
    vi.mocked(coordinationApi.summary).mockResolvedValue(summary({ registered_processes: 0 }))
    vi.mocked(coordinationApi.processes).mockRejectedValueOnce(new ApiError(503, 'Servicio no disponible')).mockResolvedValue(page([]))
    renderAt(<AsignacionTutores />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Aún no hay procesos registrados')).toBeInTheDocument()
  })

  it('sends search, modality, state and assignment filters to the API and paginates', async () => {
    const user = userEvent.setup()
    vi.mocked(coordinationApi.summary).mockResolvedValue(summary())
    vi.mocked(coordinationApi.processes).mockResolvedValue(page([row()], 40))
    renderAt(<AsignacionTutores />)
    await screen.findByRole('table')

    await user.selectOptions(screen.getByLabelText('Filtrar por estado de asignación'), 'sin_tutor')
    await user.selectOptions(screen.getByLabelText('Filtrar por modalidad'), 'Proyecto de investigación')
    await user.selectOptions(screen.getByLabelText('Filtrar por estado del proceso'), 'RADICADO')
    await user.type(screen.getByLabelText('Buscar por código, proyecto o estudiante'), 'ana')
    await waitFor(() =>
      expect(coordinationApi.processes).toHaveBeenLastCalledWith('token', { search: 'ana', modality: 'Proyecto de investigación', state: 'RADICADO', assignment: 'sin_tutor', page: 1, page_size: 15 })
    )

    expect(screen.getByText(/página 1 de 3/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(vi.mocked(coordinationApi.processes).mock.lastCall?.[1]).toMatchObject({ page: 2 }))
  })

  describe('modal de asignación', () => {
    async function openModal(process = row()) {
      const user = userEvent.setup()
      vi.mocked(coordinationApi.summary).mockResolvedValue(summary())
      vi.mocked(coordinationApi.processes).mockResolvedValue(page([process]))
      renderAt(<AsignacionTutores />)
      await user.click(await screen.findByRole('button', { name: new RegExp(`${process.tutor ? 'Cambiar' : 'Asignar'} tutor de`) }))
      return { user, dialog: within(await screen.findByRole('dialog')) }
    }

    it('shows the project, the eligible teachers from the API with their load, and validates the selection', async () => {
      vi.mocked(processesApi.teamCandidates).mockResolvedValue([candidate('u1', 'Andres Consultor', 'tutor_consultor', 2), candidate('u2', 'Marta Docente')] as never)
      const { user, dialog } = await openModal()

      expect(dialog.getByText('Detección de fallas')).toBeInTheDocument()
      expect(dialog.getByText(/PROYECTO_INV-2026-AAA · Ana Estudiante · Proyecto de investigación/)).toBeInTheDocument()
      expect(await dialog.findByText('Andres Consultor')).toBeInTheDocument()
      expect(dialog.getByText('Tutor consultor')).toBeInTheDocument()
      expect(dialog.getByText('2 proyectos')).toBeInTheDocument()
      expect(dialog.getByText('0 proyectos')).toBeInTheDocument()
      expect(dialog.getByRole('button', { name: 'Confirmar asignación' })).toBeDisabled()

      await user.type(dialog.getByLabelText('Buscar docente'), 'marta')
      expect(dialog.queryByText('Andres Consultor')).not.toBeInTheDocument()
      expect(dialog.getByText('Marta Docente')).toBeInTheDocument()
    })

    it('assigns the selected teacher through POST /team, once, then re-reads the team and refreshes the table', async () => {
      vi.mocked(processesApi.teamCandidates).mockResolvedValue([candidate('u1', 'Andres Consultor')] as never)
      vi.mocked(processesApi.addTeamMember).mockResolvedValue({} as never)
      const { user, dialog } = await openModal()

      await user.click(await dialog.findByLabelText(/Andres Consultor/))
      const confirm = dialog.getByRole('button', { name: 'Confirmar asignación' })
      fireEvent.click(confirm)
      fireEvent.click(confirm)

      await waitFor(() => expect(processesApi.addTeamMember).toHaveBeenCalledTimes(1))
      expect(processesApi.addTeamMember).toHaveBeenCalledWith('token', 'p1', 'u1', 'tutor')
      await waitFor(() => expect(processesApi.team).toHaveBeenCalledWith('token', 'p1'))
      expect(await screen.findByRole('status')).toHaveTextContent('Tutor asignado correctamente para Ana Estudiante.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(vi.mocked(coordinationApi.processes).mock.calls.length).toBeGreaterThanOrEqual(2) // se volvió a consultar
    })

    it('keeps the dialog and the selection when the backend rejects the assignment', async () => {
      vi.mocked(processesApi.teamCandidates).mockResolvedValue([candidate('u1', 'Andres Consultor')] as never)
      vi.mocked(processesApi.addTeamMember).mockRejectedValue(new ApiError(422, 'Solo un docente puede ser tutor de un trámite'))
      const { user, dialog } = await openModal()

      await user.click(await dialog.findByLabelText(/Andres Consultor/))
      await user.click(dialog.getByRole('button', { name: 'Confirmar asignación' }))

      expect(await dialog.findByRole('alert')).toHaveTextContent('Solo un docente puede ser tutor')
      expect(dialog.getByLabelText(/Andres Consultor/)).toBeChecked()
      expect(dialog.getByRole('button', { name: 'Confirmar asignación' })).toBeEnabled()
    })

    it('changes the tutor through PUT /tutor and hides the current tutor from the candidates', async () => {
      vi.mocked(processesApi.teamCandidates).mockResolvedValue([candidate('u1', 'Andres Consultor', 'tutor_investigador', 1), candidate('u2', 'Marta Docente')] as never)
      vi.mocked(processesApi.changeTutor).mockResolvedValue({} as never)
      const { user, dialog } = await openModal(row({ tutor: { member_public_id: 'm9', public_id: 'u1', full_name: 'Andres Consultor' } }))

      expect(await dialog.findByText('Cambiar tutor')).toBeInTheDocument()
      expect(dialog.getByText(/Tutor actual: Andres Consultor/)).toBeInTheDocument()
      expect(dialog.queryByLabelText(/Andres Consultor/)).not.toBeInTheDocument()
      await user.click(dialog.getByLabelText(/Marta Docente/))
      await user.click(dialog.getByRole('button', { name: 'Confirmar asignación' }))

      await waitFor(() => expect(processesApi.changeTutor).toHaveBeenCalledWith('token', 'p1', 'u2'))
      expect(processesApi.addTeamMember).not.toHaveBeenCalled()
      expect(await screen.findByRole('status')).toHaveTextContent('Tutor cambiado correctamente')
    })

    it('shows a retry when the candidates cannot be loaded', async () => {
      vi.mocked(processesApi.teamCandidates).mockRejectedValueOnce(new ApiError(403, 'No autorizado')).mockResolvedValue([candidate('u1', 'Andres Consultor')] as never)
      const { user, dialog } = await openModal()

      expect(await dialog.findByRole('alert')).toHaveTextContent('No autorizado')
      await user.click(dialog.getByRole('button', { name: 'Reintentar' }))
      expect(await dialog.findByText('Andres Consultor')).toBeInTheDocument()
    })
  })
})
