import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { makeUser } from '@/test/users'
import type { User } from '@/types'
import type { Expediente, StudentRow, TaskOut } from '@/services/monitoring.service'
import type { ProcessDetailOut, TeamMemberOut } from '@/services/processes.service'
import type { ProcessDocumentOut } from '@/services/documents.service'

vi.mock('@/services/monitoring.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/monitoring.service')>()),
  monitoringApi: { expediente: vi.fn(), students: vi.fn(), registerIntervention: vi.fn(), extend: vi.fn(), updateCommitment: vi.fn() },
}))
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
import { StudentTaskMonitoring } from '../StudentTaskMonitoring'
import { buildActivitiesCsv, buildDossierHtml, dossierFileName } from './dossierExport'
import { EXPEDIENTE_PATH, fileKind } from './dossierHelpers'

const tutor: User = makeUser(['docente'], { id: 't1', name: 'Ana Tutora', initials: 'AT', email: 't@u.co' })
const person = (id: string, name: string) => ({ public_id: id, email: `${id}@u.co`, full_name: name, role: { public_id: 'r', name: 'estudiante', description: null, active: true }, institutional_roles: [], active: true })

const row = (o: Partial<StudentRow> = {}): StudentRow => ({
  process_id: 'p1', process_code: 'TG-1', project_title: 'Sistema académico', modality_code: 'APL', modality_name: 'Proyecto aplicado',
  student_id: 's1', student_name: 'Juan Pérez', student_email: 'juan@u.co', tutor_name: 'Ana Tutora', assigned: 4, delivered: 1, pending: 3, overdue: 2,
  next_due: '2026-11-13', level: 'critico', last_intervention_at: null, open_commitments: 0, overdue_commitments: 0, group_alert: false, ...o,
})
const task = (o: Partial<TaskOut> = {}): TaskOut => ({
  assignment_id: 'a1', deliverable_id: 'd1', title: 'Propuesta inicial', stage: 'Formulación', assigned_at: '2026-10-01T10:00:00', original_due: '2026-10-31',
  effective_due: '2026-10-31', delivered_at: null, state: 'vencida', delivery_note: null, late_delivery: false, days_to_due: -5, escalate_group: true, extensions: [], ...o,
})
const expediente = (o: Partial<Expediente> = {}): Expediente => ({
  student: row(), completion_pct: 25, group_alert: false, group_overdue_students: [], tasks: [task()], interventions: [], commitments: [], ...o,
})
const process = (o: Partial<ProcessDetailOut> = {}): ProcessDetailOut => ({
  public_id: 'p1', process_code: 'TG-1', title: 'Diagnóstico y mejora de un proceso organizacional', student: person('s1', 'Juan Pérez'),
  modality: { public_id: 'm', code: 'APL', name: 'Proyecto aplicado' },
  state: { public_id: 'st', code: 'EN_CURSO', name: 'En desarrollo', description: null, is_final_state: false, is_initial_state: false },
  academic_semester: '2026-2', created_at: '2026-09-15T10:00:00', updated_at: null, closed_at: null, observations: 'Análisis y rediseño de un proceso para reducir tiempos.', my_process_roles: [], allowed_actions: [], ...o,
})
const member = (id: string, name: string, role: string): TeamMemberOut => ({ public_id: `m-${id}`, user: person(id, name), process_role: role, assigned_at: '2026-09-15T10:00:00', active: true })
const doc = (o: Partial<ProcessDocumentOut> = {}): ProcessDocumentOut => ({
  public_id: 'doc1', document_type: { public_id: 'dt', code: 'PROP', name: 'Propuesta', description: null }, file_name: 'Propuesta_inicial.pdf', version: 1,
  status: 'pendiente', download_url: '/files/firmado-viejo', uploaded_by: person('s1', 'Juan Pérez'), reviewed_by: null, uploaded_at: '2026-10-28T10:00:00', reviewed_at: null, comment: null, ...o,
})

beforeEach(() => {
  useAppStore.setState({ currentUser: tutor, isAuthenticated: true, accessToken: 'token' })
  vi.mocked(monitoringApi.expediente).mockResolvedValue(expediente())
  vi.mocked(processesApi.get).mockResolvedValue(process())
  vi.mocked(processesApi.team).mockResolvedValue([member('s1', 'Juan Pérez', 'estudiante'), member('s2', 'Ana Estudiante', 'estudiante'), member('t1', 'Ana Tutora', 'tutor')])
  vi.mocked(documentsApi.listForProcess).mockResolvedValue([doc()])
  vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Sin plan'))
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

const renderAt = (path = '/seguimiento/p1/s1') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/seguimiento/:processId/:studentId" element={<StudentTaskMonitoring />} /></Routes>
  </MemoryRouter>,
)

describe('lógica del expediente', () => {
  it('reconoce solo la ruta del expediente como página con encabezado propio', () => {
    expect(EXPEDIENTE_PATH.test('/seguimiento/p1/s1')).toBe(true)
    expect(EXPEDIENTE_PATH.test('/seguimiento')).toBe(false)
    expect(EXPEDIENTE_PATH.test('/seguimiento/configuracion')).toBe(false)
  })

  it('identifica el tipo de archivo por la extensión', () => {
    expect(fileKind('a.PDF').label).toBe('PDF')
    expect(fileKind('plan.docx').label).toBe('DOC')
    expect(fileKind('sin-extension').label).toBe('SIN-')
  })

  it('exporta las actividades en CSV con los estados del backend', () => {
    const csv = buildActivitiesCsv(expediente({ tasks: [task(), task({ assignment_id: 'a2', title: 'Marco "teórico"', state: 'entregada', delivered_at: '2026-10-20T10:00:00' })] }))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"Vencida"')
    expect(csv).toContain('"Marco ""teórico"""')
    expect(csv.split('\r\n')).toHaveLength(3)
    expect(dossierFileName('Juan Pérez', 'actividades', new Date('2026-11-06T12:00:00Z'))).toBe('actividades-juan-perez-2026-11-06.csv')
  })

  it('el expediente HTML escapa el contenido y declara lo que no se pudo cargar (no inventa)', () => {
    const html = buildDossierHtml({
      expediente: expediente({ student: row({ student_name: 'Ana <script>' }) }), process: process(), team: null, documents: [], plan: null, generatedBy: 'Ana Tutora',
    })
    expect(html).toContain('Ana &lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('Diagnóstico y mejora de un proceso organizacional')
    expect(html).toContain('El equipo no disponible')
    expect(html).toContain('El plan de trabajo no disponible')
    expect(html).toContain('Sin documentos cargados.')
  })
})

describe('pantalla del expediente', () => {
  it('muestra identificación, el proyecto con su descripción y estado reales, los cinco indicadores y el panel lateral', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { name: 'Expediente del estudiante' })).toBeInTheDocument()
    const identity = screen.getByRole('region', { name: 'Identificación del estudiante' })
    expect(within(identity).getByRole('heading', { name: 'Juan Pérez' })).toBeInTheDocument()
    expect(within(identity).getByText('Riesgo crítico')).toBeInTheDocument()
    const hero = screen.getByRole('region', { name: 'Proyecto de grado' })
    expect(await within(hero).findByText('Diagnóstico y mejora de un proceso organizacional')).toBeInTheDocument()
    expect(within(hero).getByText('Análisis y rediseño de un proceso para reducir tiempos.')).toBeInTheDocument()
    expect(within(hero).getByText('En desarrollo')).toBeInTheDocument()
    const metrics = screen.getByRole('region', { name: 'Resumen de cumplimiento' })
    for (const label of ['Actividades asignadas', 'Entregadas', 'Pendientes', 'Vencidas', 'Cumplimiento']) expect(within(metrics).getByText(label)).toBeInTheDocument()
    expect(within(metrics).getByText('25%')).toBeInTheDocument()
    const aside = screen.getByRole('complementary', { name: 'Resumen del proyecto' })
    expect(await within(aside).findByText('Ana Estudiante')).toBeInTheDocument()
    expect(within(aside).getByText('Titular')).toBeInTheDocument() // el estudiante a nombre de quien está el proceso
    expect(within(aside).getByText('Propuesta_inicial.pdf')).toBeInTheDocument()
  })

  it('las siete pestañas cambian el contenido y el plan ausente se explica sin inventar', async () => {
    const user = userEvent.setup()
    renderAt()
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((t) => t.textContent?.replace(/\d+$/, ''))).toEqual(['Historial de actividades', 'Plan de trabajo', 'Entregables', 'Documentos', 'Intervenciones', 'Alertas', 'Equipo'])
    expect(screen.getByRole('tab', { name: /Historial/ })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: /Plan de trabajo/ }))
    expect(await screen.findByText('El proyecto aún no tiene un plan de trabajo publicado.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Alertas/ }))
    expect(screen.getByText('Tareas vencidas (1)')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Equipo/ }))
    expect(within(screen.getByRole('tabpanel')).getByText(/Ana Tutora/)).toBeInTheDocument()
  })

  it('descarga un documento pidiendo antes un enlace firmado vigente', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.mocked(documentsApi.listForProcess).mockResolvedValueOnce([doc()]).mockResolvedValueOnce([doc({ download_url: 'https://r2.example/firmado-nuevo' })])
    renderAt()
    await user.click(await screen.findByRole('button', { name: 'Descargar Propuesta_inicial.pdf' }))
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(documentsApi.listForProcess).toHaveBeenCalledTimes(2)
    expect((click.mock.contexts[0] as HTMLAnchorElement).href).toBe('https://r2.example/firmado-nuevo')
    click.mockRestore()
  })

  it('descargar y exportar generan archivos reales y confirman la acción', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderAt()
    await user.click(await screen.findByRole('button', { name: /Descargar expediente/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Expediente descargado')
    await user.click(screen.getByRole('button', { name: /Exportar/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Historial exportado: 1 actividad.')
    expect(createObjectURL).toHaveBeenCalledTimes(2)
    expect((click.mock.contexts[1] as HTMLAnchorElement).download).toMatch(/^actividades-juan-perez-\d{4}-\d{2}-\d{2}\.csv$/)
    click.mockRestore()
  })

  it('al abrir otro expediente no muestra datos del anterior, aunque su respuesta llegue tarde', async () => {
    let resolveFirst: (e: Expediente) => void = () => {}
    vi.mocked(monitoringApi.expediente)
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockResolvedValueOnce(expediente({ student: row({ student_id: 's2', student_name: 'Carlos Ruiz', level: 'al_dia', overdue: 0 }) }))
    let go: (path: string) => void = () => {}
    function Nav() { go = useNavigate(); return null }
    render(
      <MemoryRouter initialEntries={['/seguimiento/p1/s1']}>
        <Nav />
        <Routes><Route path="/seguimiento/:processId/:studentId" element={<StudentTaskMonitoring />} /></Routes>
      </MemoryRouter>,
    )
    act(() => go('/seguimiento/p1/s2'))
    expect(await screen.findByRole('heading', { name: 'Carlos Ruiz' })).toBeInTheDocument()
    await act(async () => resolveFirst(expediente()))
    expect(screen.queryByRole('heading', { name: 'Juan Pérez' })).not.toBeInTheDocument()
    expect(monitoringApi.expediente).toHaveBeenLastCalledWith('token', 'p1', 's2')
  })

  it('Coordinación ve el expediente pero no puede registrar intervenciones ni ampliar plazos', async () => {
    useAppStore.setState({ currentUser: makeUser(['coordinador'], { id: 't1', name: 'Ana Tutora', initials: 'AT', email: 't@u.co' }) })
    renderAt()
    await screen.findByRole('heading', { name: 'Juan Pérez' })
    expect(screen.queryByRole('button', { name: /Registrar intervención/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ampliar plazo/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar expediente/ })).toBeEnabled()
  })
})
