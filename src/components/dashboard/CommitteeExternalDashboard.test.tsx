import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'
import type { WorkPlanOut } from '@/services/workplan.service'

vi.mock('@/services/processes.service', () => ({ processesApi: { list: vi.fn() } }))
vi.mock('@/services/committees.service', () => ({ committeesApi: { list: vi.fn() } }))
vi.mock('@/services/external.service', () => ({ externalApi: { listEntities: vi.fn() } }))
vi.mock('@/services/workplan.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/workplan.service')>()),
  workPlanApi: { get: vi.fn() },
}))

import { processesApi } from '@/services/processes.service'
import { committeesApi } from '@/services/committees.service'
import { externalApi } from '@/services/external.service'
import { workPlanApi } from '@/services/workplan.service'
import { CommitteeDashboard } from './CommitteeDashboard'
import { ExternalDashboard } from './ExternalDashboard'

const committeeUser: User = { id: 'c1', name: 'Marta Comité', initials: 'MC', email: 'm@ucompensar.edu.co', role: 'consejo_facultad', institutionalRoles: ['ComiteGrado'], authMethod: 'sso' }
const externalUser: User = { id: 'e1', name: 'Pedro Empresa', initials: 'PE', email: 'p@empresa.co', role: 'empresa_cliente', institutionalRoles: ['Externo'], authMethod: 'sso' }

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

const proc = (id: string, state: string, o: Record<string, unknown> = {}) => ({
  public_id: id, process_code: `CODE-${id}`, title: `Proyecto ${id}`,
  student: { public_id: `s-${id}`, full_name: `Estudiante ${id}` },
  modality: { public_id: 'm1', code: 'PROYECTO_INV', name: 'Proyecto de investigación' },
  state: { public_id: state, code: state, name: state === 'EN_REVISION_COMITE_FACULTAD' ? 'En revisión del comité' : state, description: null, is_final_state: state === 'FINALIZADO', is_initial_state: false },
  academic_semester: '2026-2', created_at: daysAgo(60), updated_at: daysAgo(1), closed_at: null, ...o,
})

const renderAt = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('Dashboard del comité de grado', () => {
  beforeEach(() => {
    useAppStore.setState({ currentUser: committeeUser, isAuthenticated: true, accessToken: 'token' })
    vi.mocked(committeesApi.list).mockResolvedValue([
      { public_id: 'k1', code: 'CF', name: 'Comité de facultad', description: null, minimum_quorum: 3, active: true },
      { public_id: 'k2', code: 'OLD', name: 'Antiguo', description: null, minimum_quorum: 3, active: false },
    ])
  })

  it('lists what awaits the committee, oldest first, plus the overall picture', async () => {
    vi.mocked(processesApi.list).mockResolvedValue([
      proc('a', 'EN_REVISION_COMITE_FACULTAD', { updated_at: daysAgo(3) }),
      proc('b', 'EN_REVISION_COMITE_FACULTAD', { updated_at: daysAgo(20) }),
      proc('c', 'EN_EJECUCION'),
      proc('d', 'FINALIZADO'),
    ] as never)
    renderAt(<CommitteeDashboard />)

    const card = (label: string) => screen.getByText(label).closest('.card') as HTMLElement
    expect(within(await screen.findByText('Esperan decisión del comité').then((el) => el.closest('.card') as HTMLElement)).getByText('2')).toBeInTheDocument()
    expect(within(card('Esperan decisión del comité')).getByText(/20 días sin movimiento/)).toBeInTheDocument()
    expect(within(card('Trámites activos')).getByText('3')).toBeInTheDocument()
    expect(within(card('Finalizados')).getByText('1')).toBeInTheDocument()
    expect(await within(card('Comités activos')).findByText('1')).toBeInTheDocument()

    const pending = screen.getByText('Pendientes de decisión').closest('.card') as HTMLElement
    const items = within(pending).getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatch(/Proyecto b.*sin movimiento hace 20 días/)
    expect(within(pending).getAllByRole('link', { name: 'Ver trámite' })[0]).toHaveAttribute('href', '/trazabilidad/b')
    expect(screen.getByRole('region', { name: 'Trámites activos por estado' })).toBeInTheDocument()
  })

  it('shows a clear empty state and a retry on error', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.list).mockRejectedValueOnce(new ApiError(500, 'Error del servidor')).mockResolvedValue([])
    renderAt(<CommitteeDashboard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay trámites esperando al comité')).toBeInTheDocument()
  })
})

describe('Dashboard de externos', () => {
  beforeEach(() => {
    useAppStore.setState({ currentUser: externalUser, isAuthenticated: true, accessToken: 'token' })
    vi.mocked(externalApi.listEntities).mockResolvedValue([{ public_id: 'x', name: 'Empresa Aliada SAS', entity_type: 'empresa', tax_id: null, representative: null, representative_position: null, email: null, phone: null, address: null, active: true }] as never)
  })

  it('explains how to get linked when the person has no projects', async () => {
    vi.mocked(processesApi.list).mockResolvedValue([])
    renderAt(<ExternalDashboard />)
    expect(await screen.findByText(/Hola, Pedro\. Aún no participas en ningún proyecto/)).toBeInTheDocument()
  })

  it('shows each project with its progress, or says the plan is not published yet', async () => {
    vi.mocked(processesApi.list).mockResolvedValue([proc('a', 'EN_EJECUCION'), proc('b', 'EN_EJECUCION')] as never)
    vi.mocked(workPlanApi.get).mockImplementation(async (_t, id) => {
      if (id === 'b') throw new ApiError(404, 'El plan de trabajo aún no está publicado')
      return {
        stages: [{ public_id: 'st', name: 'Etapa', description: null, semester: 1, sort_order: 0, active: true, deliverables: [
          { public_id: 'd1', title: 'Metodología', active: true, applicable: true, mandatory: true, due_date: '2026-11-02', status: 'disponible', is_overdue: false },
        ] }],
        progress: { total_required: 4, approved: 1, pending_review: 0, needs_corrections: 0, overdue: 0, percent: 25 },
      } as unknown as WorkPlanOut
    })
    renderAt(<ExternalDashboard />)

    const first = (await screen.findByText('Proyecto a')).closest('.card') as HTMLElement
    expect(within(first).getByText('25% · 1/4')).toBeInTheDocument()
    expect(within(first).getByText('Metodología')).toBeInTheDocument()
    const second = screen.getByText('Proyecto b').closest('.card') as HTMLElement
    expect(within(second).getByText('El plan de trabajo aún no está publicado.')).toBeInTheDocument()
    expect(await screen.findByText(/Empresa Aliada SAS/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a avales' })).toHaveAttribute('href', '/externo')
  })
})
