import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'
import type { CalendarEvent } from '@/services/calendar.service'
import type { DeliverableOut, WorkPlanOut } from '@/services/workplan.service'

vi.mock('@/services/processes.service', () => ({ processesApi: { list: vi.fn() } }))
vi.mock('@/services/workplan.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/workplan.service')>()),
  workPlanApi: { get: vi.fn() },
}))
vi.mock('@/services/calendar.service', () => ({ calendarApi: { events: vi.fn() } }))

import { processesApi } from '@/services/processes.service'
import { workPlanApi } from '@/services/workplan.service'
import { calendarApi } from '@/services/calendar.service'
import { StudentDashboard } from './StudentDashboard'

const student: User = { id: 'student-1', name: 'Ana Estudiante', initials: 'AE', email: 'ana@ucompensar.edu.co', role: 'estudiante', institutionalRoles: ['Estudiante'], authMethod: 'sso' }

const proc = {
  public_id: 'p1', process_code: 'CODE-p1', title: 'Detección de fallas', student: { public_id: student.id },
  modality: { public_id: 'm1', code: 'PROYECTO_INV', name: 'Proyecto de investigación' },
  state: { public_id: 's1', code: 'EN_EJECUCION', name: 'En ejecución' },
  academic_semester: '2026-2', created_at: '2026-03-01T10:00:00', updated_at: null, closed_at: null,
}

const deliverable = (o: Partial<DeliverableOut> = {}): DeliverableOut => ({
  public_id: 'd1', stage_public_id: 'st1', title: 'Propuesta inicial', instructions: null, mandatory: true, applicable: true, active: true,
  sort_order: 0, due_date: '2026-11-20', depends_on_public_id: null, accepted_extensions: null, template_file_name: null,
  template_download_url: null, status: 'disponible', is_overdue: false, can_submit: true, submissions_count: 0, current_submission: null, ...o,
})

function plan(stage1: DeliverableOut[], stage2: DeliverableOut[], o: Partial<WorkPlanOut> = {}): WorkPlanOut {
  const all = [...stage1, ...stage2]
  const approved = all.filter((d) => d.status === 'aprobado').length
  return {
    public_id: 'plan1', process_public_id: 'p1', process_title: 'Detección de fallas', status: 'publicado', start_date: '2026-02-02',
    target_end_date: '2026-12-04', template_code: null, published_at: '2026-02-10T10:00:00',
    stages: [
      { public_id: 'st1', name: 'Formulación', description: null, semester: 1, sort_order: 0, active: true, deliverables: stage1 },
      { public_id: 'st2', name: 'Desarrollo', description: null, semester: 1, sort_order: 1, active: true, deliverables: stage2 },
    ],
    progress: {
      total_required: all.length, approved, pending_review: all.filter((d) => d.status === 'en_revision').length,
      needs_corrections: all.filter((d) => d.status === 'requiere_correcciones').length, overdue: all.filter((d) => d.is_overdue).length,
      percent: Math.round((approved / all.length) * 100),
    },
    process_state_code: 'EN_EJECUCION', process_state_name: 'En ejecución', official_completion: false, can_manage: false, ...o,
  }
}

const event = (o: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1', title: 'Sustentaciones', description: null, event_type: { id: 't', code: 'SUST', name: 'Sustentación' }, period: null,
  modalities: [], applies_to_all_modalities: true, starts_at: '2026-11-29T08:00:00-05:00', ends_at: null, all_day: true,
  dates_confirmed: true, date_kind: 'oficial', date_note: null, status: 'publicado', timeline: 'proximo', ...o,
})

const renderDashboard = () => render(<MemoryRouter><StudentDashboard /></MemoryRouter>)

beforeEach(() => {
  useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
  vi.mocked(calendarApi.events).mockResolvedValue({ items: [], facets: { periods: [], modalities: [], types: [] } })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('Dashboard del estudiante', () => {
  it('invites a student without a process to explore options instead of showing empty charts', async () => {
    vi.mocked(processesApi.list).mockResolvedValue([])
    renderDashboard()

    expect(await screen.findByText(/Hola, Ana\. Aún no tienes un proceso de grado/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver opciones de grado' })).toHaveAttribute('href', '/proyectos-de-grado')
    expect(screen.getByRole('link', { name: 'Mis propuestas' })).toHaveAttribute('href', '/mis-propuestas')
  })

  it('shows progress, the current stage, what is due first and the dates for the student modality', async () => {
    vi.mocked(processesApi.list).mockResolvedValue([proc] as never)
    vi.mocked(workPlanApi.get).mockResolvedValue(
      plan(
        [deliverable({ status: 'aprobado', can_submit: false }), deliverable({ public_id: 'd2', title: 'Marco teórico', status: 'aprobado', can_submit: false })],
        [
          deliverable({ public_id: 'd3', title: 'Metodología', due_date: '2026-11-02' }),
          deliverable({ public_id: 'd4', title: 'Informe de avance', due_date: '2026-10-01', is_overdue: true }),
        ]
      )
    )
    vi.mocked(calendarApi.events).mockResolvedValue({
      items: [
        event(),
        event({ id: 'e2', title: 'Solo pasantías', applies_to_all_modalities: false, modalities: [{ id: 'x', code: 'PASANTIA_INV', name: 'Pasantía' }] }),
        event({ id: 'e3', title: 'Comité de investigación', applies_to_all_modalities: false, modalities: [{ id: 'y', code: 'PROYECTO_INV', name: 'Proyecto' }], starts_at: '2026-11-15T08:00:00-05:00' }),
        event({ id: 'e4', title: 'Ya pasó', timeline: 'finalizado' }),
      ],
      facets: { periods: [], modalities: [], types: [] },
    })
    renderDashboard()

    expect(await screen.findByRole('img', { name: 'Avance de tu plan: 50%' })).toBeInTheDocument()
    expect(screen.getByText('2 de 4 entregables obligatorios aprobados')).toBeInTheDocument()
    expect(screen.getByText(/1 entrega vencida/)).toBeInTheDocument()

    const current = screen.getByText('Desarrollo', { selector: 'p' }).closest('li') as HTMLElement
    expect(current).toHaveAttribute('aria-current', 'step')
    expect(within(screen.getByText('Formulación', { selector: 'p' }).closest('li') as HTMLElement).getByText('Completada')).toBeInTheDocument()

    const todo = screen.getByText('Lo que te toca ahora').closest('.card') as HTMLElement
    const items = within(todo).getAllByRole('listitem').map((li) => li.textContent)
    expect(items[0]).toMatch(/Informe de avance.*Vencida/) // lo vencido primero
    expect(items[1]).toMatch(/Metodología/)
    expect(within(todo).getAllByRole('link', { name: /Subir entrega/ })[0]).toHaveAttribute('href', '/documentos')

    expect(await screen.findByText('Sustentaciones')).toBeInTheDocument()
    expect(screen.getByText('Comité de investigación')).toBeInTheDocument()
    expect(screen.queryByText('Solo pasantías')).not.toBeInTheDocument()
    expect(screen.queryByText('Ya pasó')).not.toBeInTheDocument()
  })

  it('explains that the plan is not published yet and still shows the calendar', async () => {
    vi.mocked(processesApi.list).mockResolvedValue([proc] as never)
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'No existe'))
    vi.mocked(calendarApi.events).mockResolvedValue({ items: [event()], facets: { periods: [], modalities: [], types: [] } })
    renderDashboard()

    expect(await screen.findByText('Tu tutor aún no ha publicado el plan de trabajo')).toBeInTheDocument()
    expect(await screen.findByText('Sustentaciones')).toBeInTheDocument()
  })
})
