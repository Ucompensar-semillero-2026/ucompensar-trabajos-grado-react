import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import { makeUser } from '@/test/users'

vi.mock('@/services/processes.service', () => ({
  processesApi: { get: vi.fn(), list: vi.fn(), history: vi.fn(), team: vi.fn(), availableTransitions: vi.fn(), changeState: vi.fn() },
}))
// Trazabilidad también carga las entregas del plan; sin plan publicado responde 404.
vi.mock('@/services/workplan.service', async (importOriginal) => {
  const { ApiError } = await import('@/services/http')
  return {
    ...(await importOriginal<typeof import('@/services/workplan.service')>()),
    workPlanApi: { get: vi.fn().mockRejectedValue(new ApiError(404, 'Sin plan')) },
  }
})
vi.mock('@/services/documents.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/documents.service')>()),
  documentsApi: { checklist: vi.fn(), listForProcess: vi.fn(), upload: vi.fn(), review: vi.fn() },
}))
vi.mock('@/services/grading.service', () => ({ gradingApi: { listGrades: vi.fn(), getFinalGrade: vi.fn(), addGrade: vi.fn(), registerFinalGrade: vi.fn() } }))
vi.mock('@/services/modalities.service', () => ({ modalitiesApi: { get: vi.fn() } }))
// La pantalla de equipo tiene sus propias pruebas; aquí solo importa qué recibe.
vi.mock('@/components/tutor/TeamPanel', () => ({
  TeamPanel: ({ canManage }: { canManage: boolean }) => <p>equipo {canManage ? 'gestionable' : 'solo lectura'}</p>,
}))

import { processesApi } from '@/services/processes.service'
import { documentsApi } from '@/services/documents.service'
import { gradingApi } from '@/services/grading.service'
import { modalitiesApi } from '@/services/modalities.service'
import { TrazabilidadSection } from '@/components/trazabilidad/TrazabilidadSection'
import { CalificacionesSection } from '@/components/calificaciones/CalificacionesSection'
import { DocumentosSection } from '@/components/documentos/DocumentosSection'

const state = (code: string, name: string) => ({ public_id: `s-${code}`, code, name, description: null, is_final_state: false, is_initial_state: false })
const detail = (actions: string[], myRoles: string[] = []) => ({
  public_id: 'p1',
  process_code: 'SEMILLERO_INV-2026-AAA',
  title: 'Demo',
  student: { public_id: 'st', full_name: 'Ana Estudiante', email: 'a@u.co', active: true },
  modality: { public_id: 'm1', code: 'SEMILLERO_INV', name: 'Semillero' },
  state: state('DOCUMENTOS_PENDIENTES', 'Documentos pendientes'),
  academic_semester: '2026-2',
  created_at: '2026-10-01',
  updated_at: null,
  closed_at: null,
  my_process_roles: myRoles,
  allowed_actions: actions,
})

beforeEach(() => {
  useAppStore.getState().loginSuccess(makeUser(['coordinador']), 'token')
  vi.mocked(processesApi.history).mockResolvedValue([])
  vi.mocked(processesApi.team).mockResolvedValue([])
  vi.mocked(documentsApi.listForProcess).mockResolvedValue([])
  vi.mocked(documentsApi.checklist).mockResolvedValue([
    { document_type: { public_id: 'dt1', code: 'PLAN_TRABAJO', name: 'Plan de trabajo', description: null }, mandatory: true, note: null, document: null, checklist_status: 'faltante' },
  ] as never)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.getState().logout()
})

function renderTrazabilidad() {
  return render(
    <MemoryRouter initialEntries={['/trazabilidad/p1']}>
      <Routes><Route path="/trazabilidad/:processId" element={<TrazabilidadSection />} /></Routes>
    </MemoryRouter>,
  )
}

/** La pantalla abre en Historial; el checklist está en la pestaña Documentos. */
async function openDocumentsTab() {
  await userEvent.setup().click(await screen.findByRole('tab', { name: /Documentos/ }))
  expect(await screen.findByText('Plan de trabajo')).toBeInTheDocument()
}

describe('Trazabilidad: botones según el backend', () => {
  it('los cambios de estado salen de available-transitions', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.get).mockResolvedValue(detail(['change_state', 'upload_document', 'manage_team']) as never)
    vi.mocked(processesApi.availableTransitions).mockResolvedValue([state('EN_EJECUCION', 'En ejecucion'), state('CANCELADO', 'Cancelado')])
    vi.mocked(processesApi.changeState).mockResolvedValue({} as never)
    renderTrazabilidad()

    await user.click(await screen.findByRole('button', { name: /En ejecucion/ }))
    expect(screen.getByRole('button', { name: /Cancelado/ })).toBeInTheDocument()
    expect(processesApi.changeState).toHaveBeenCalledWith('token', 'p1', 's-EN_EJECUCION')
    expect(processesApi.availableTransitions).toHaveBeenCalledWith('token', 'p1')
  })

  it('sin estados disponibles no muestra botones de cambio de estado', async () => {
    vi.mocked(processesApi.get).mockResolvedValue(detail([]) as never)
    vi.mocked(processesApi.availableTransitions).mockResolvedValue([])
    renderTrazabilidad()

    await openDocumentsTab()
    expect(screen.queryByRole('button', { name: /En ejecucion/ })).not.toBeInTheDocument()
  })

  it('gestionar el equipo depende de manage_team', async () => {
    vi.mocked(processesApi.get).mockResolvedValue(detail(['manage_team']) as never)
    vi.mocked(processesApi.availableTransitions).mockResolvedValue([])
    renderTrazabilidad()
    expect(await screen.findByText('equipo gestionable')).toBeInTheDocument()
    cleanup()

    vi.mocked(processesApi.get).mockResolvedValue(detail([]) as never)
    renderTrazabilidad()
    expect(await screen.findByText('equipo solo lectura')).toBeInTheDocument()
  })

  it('sube documentos el estudiante del trámite (my_process_roles) con upload_document', async () => {
    // Estudiante del trámite con upload_document: ve el botón.
    vi.mocked(processesApi.get).mockResolvedValue(detail(['upload_document'], ['estudiante']) as never)
    vi.mocked(processesApi.availableTransitions).mockResolvedValue([])
    renderTrazabilidad()
    await openDocumentsTab()
    expect(screen.getByRole('button', { name: /Cargar documento/ })).toBeInTheDocument()
    cleanup()

    // Coordinación (sin rol en el trámite) o sin la acción: no lo ve.
    for (const [actions, roles] of [[['upload_document', 'manage_team'], []], [[], ['estudiante']]] as const) {
      vi.mocked(processesApi.get).mockResolvedValue(detail([...actions], [...roles]) as never)
      renderTrazabilidad()
      await openDocumentsTab()
      expect(screen.queryByRole('button', { name: /Cargar documento/ })).not.toBeInTheDocument()
      cleanup()
    }
  })

  it('revisar documentos depende de review_document (coordinación o el tutor del trámite)', async () => {
    const pending = {
      public_id: 'd1', file_name: 'plan.pdf', download_url: '#', version: 1, status: 'pendiente', uploaded_at: '2026-10-20T10:00:00',
      document_type: { public_id: 'dt1', code: 'PLAN_TRABAJO', name: 'Plan de trabajo', description: null },
    }
    vi.mocked(documentsApi.listForProcess).mockResolvedValue([pending] as never)
    vi.mocked(processesApi.availableTransitions).mockResolvedValue([])

    // El tutor del trámite con review_document: ve "Revisar documentos" aunque no gestione el equipo.
    vi.mocked(processesApi.get).mockResolvedValue(detail(['review_document'], ['tutor']) as never)
    renderTrazabilidad()
    expect(await screen.findByRole('button', { name: /Revisar documentos \(1\)/ })).toBeInTheDocument()
    expect(screen.getByText('equipo solo lectura')).toBeInTheDocument()
    cleanup()

    // Sin review_document (p. ej. un evaluador): no.
    vi.mocked(processesApi.get).mockResolvedValue(detail([], ['evaluador']) as never)
    renderTrazabilidad()
    expect(await screen.findByText('equipo solo lectura')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Revisar documentos/ })).not.toBeInTheDocument()
  })
})

describe('Calificaciones: formulario según allowed_actions', () => {
  beforeEach(() => {
    vi.mocked(processesApi.list).mockResolvedValue([detail([])] as never)
    vi.mocked(gradingApi.listGrades).mockResolvedValue([])
    vi.mocked(gradingApi.getFinalGrade).mockRejectedValue(new Error('sin nota'))
    vi.mocked(modalitiesApi.get).mockResolvedValue({ criteria: [{ public_id: 'c1', name: 'Trabajo escrito', weight_percentage: 20 }] } as never)
  })

  async function choose() {
    const user = userEvent.setup()
    render(<MemoryRouter><CalificacionesSection /></MemoryRouter>)
    await user.selectOptions(await screen.findByRole('combobox'), 'p1')
  }

  it('el tutor o evaluador ve el formulario de notas', async () => {
    vi.mocked(processesApi.get).mockResolvedValue(detail(['grade'], ['tutor']) as never)
    await choose()
    expect(await screen.findByRole('button', { name: 'Registrar' })).toBeInTheDocument()
    expect(screen.queryByText('Registrar calificación final')).not.toBeInTheDocument()
  })

  it('quien no tiene grade ve el aviso, y la nota final solo con register_final_grade', async () => {
    vi.mocked(processesApi.get).mockResolvedValue(detail(['register_final_grade']) as never)
    await choose()
    expect(await screen.findByText('Solo el tutor o un evaluador asignado a este trámite puede registrar notas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar' })).not.toBeInTheDocument()
    expect(await screen.findByText('Registrar calificación final')).toBeInTheDocument()
  })
})

describe('Documentos: revisar depende del trámite de cada documento', () => {
  it('ofrece aprobar solo en los trámites con review_document', async () => {
    const doc = (id: string) => ({
      public_id: id, file_name: `${id}.pdf`, download_url: '#', version: 1, status: 'pendiente', uploaded_at: '2026-10-20T10:00:00',
      document_type: { public_id: 'dt1', code: 'PLAN_TRABAJO', name: 'Plan de trabajo', description: null },
    })
    vi.mocked(processesApi.list).mockResolvedValue([detail([]), { ...detail([]), public_id: 'p2' }] as never)
    vi.mocked(documentsApi.listForProcess).mockImplementation(async (_t, id) => [doc(`doc-${id}`)] as never)
    vi.mocked(processesApi.get).mockImplementation(async (_t, id) => detail(id === 'p1' ? ['review_document'] : []) as never)
    render(<MemoryRouter><DocumentosSection /></MemoryRouter>)

    expect(await screen.findByText('doc-p1.pdf')).toBeInTheDocument()
    expect(screen.getByText('doc-p2.pdf')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Aprobar/ })).toHaveLength(1)
  })
})
