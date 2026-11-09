import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { modulesFor } from '@/test/users'
import { criterion, evaluation, moment, totals } from '@/test/evaluationFixtures'
import type { User } from '@/types'
import type { EvaluationConfigPayload, EvaluationOut } from '@/services/evaluation.service'

vi.mock('@/services/evaluation.service', () => ({ evaluationApi: { get: vi.fn(), saveConfig: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), saveGrade: vi.fn(), history: vi.fn() } }))
vi.mock('@/services/workplan.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/workplan.service')>()),
  workPlanApi: { get: vi.fn() },
}))

import { evaluationApi } from '@/services/evaluation.service'
import { workPlanApi } from '@/services/workplan.service'
import { EvaluationPanel } from './EvaluationPanel'

const tutor: User = { id: 't1', name: 'Tutor Uno', initials: 'TU', email: 't@ucompensar.edu.co', roles: ['docente'], modules: modulesFor(['docente']) }

const manager = (over: Partial<EvaluationOut> = {}): EvaluationOut =>
  evaluation({ viewer: 'manager', can_configure: true, can_grade: true, published_totals: totals(), ...over })

const plan = {
  stages: [{ public_id: 's1', name: 'Formulación', deliverables: [
    { public_id: 'd1', stage_public_id: 's1', title: 'Propuesta inicial', active: true, status: 'disponible', due_date: '2026-03-02' },
    { public_id: 'd2', stage_public_id: 's1', title: 'Antecedentes', active: true, status: 'disponible', due_date: null },
  ] }],
}

/** Tres momentos 20/35/45 con una actividad cada uno; la primera ya calificada y publicada (4,5), la segunda en borrador (3,0), la tercera sin nota. */
const book = (over: Partial<EvaluationOut> = {}): EvaluationOut =>
  manager({
    status: 'publicada',
    moments: [
      moment('m1', 'Primer momento evaluativo', 20, [criterion('c1', 'Propuesta inicial', 100, { status: 'publicada', grade: 4.5, percent_obtained: 90, feedback: 'Buen marco teórico', contribution_to_moment: 4.5, contribution_to_total: 0.9, deliverable_public_id: 'd1' })], { moment_grade: 4.5, partial_average: 4.5, contribution_to_total: 0.9, graded_count: 1, pending_count: 0 }),
      moment('m2', 'Segundo momento evaluativo', 35, [criterion('c2', 'Antecedentes', 100, { status: 'borrador', grade: 3, percent_obtained: 60, contribution_to_total: 1.05, deliverable_public_id: 'd2' })], { moment_grade: 3, partial_average: 3, contribution_to_total: 1.05, graded_count: 1, pending_count: 0 }),
      moment('m3', 'Tercer momento evaluativo', 45, [criterion('c3', 'Documento final', 100, { status: 'sin_calificar' })], { graded_count: 0, pending_count: 1 }),
    ],
    totals: totals({ accumulated: 1.95, evaluated_percent: 55, graded_criteria: 2, pending_criteria: 1, total_criteria: 3 }),
    published_totals: totals({ accumulated: 0.9, evaluated_percent: 20, graded_criteria: 1, pending_criteria: 2, total_criteria: 3 }),
    ...over,
  })

async function show(report: EvaluationOut, url = '/') {
  vi.mocked(evaluationApi.get).mockResolvedValue(report)
  render(<MemoryRouter initialEntries={[url]}><EvaluationPanel processId="p1" /></MemoryRouter>)
  await screen.findByRole('region', { name: 'Configuración general de evaluación' }).catch(() => screen.findByText(/Periodo académico/))
}

const configCard = () => within(screen.getByRole('region', { name: 'Configuración general de evaluación' }))
const summary = () => within(screen.getByRole('region', { name: 'Resumen de calificación' }))
const gradebook = () => within(screen.getByRole('region', { name: 'Libro de calificaciones' }))

beforeEach(() => {
  useAppStore.setState({ currentUser: tutor, isAuthenticated: true, accessToken: 'token' })
  vi.mocked(workPlanApi.get).mockResolvedValue(plan as never)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('pantalla única de Evaluación', () => {
  it('shows the general configuration, the grade summary and the gradebook together, with no tabs and no grading controls', async () => {
    await show(book())

    expect(configCard().getByText('Define el porcentaje de cada momento evaluativo del proyecto.')).toBeInTheDocument()
    expect(summary().getByText('Nota publicada')).toBeInTheDocument()
    expect(gradebook().getByText('Ítem de calificación')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument() // ya no hay «Calificar» / «Configurar»
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument() // nada se califica aquí
    expect(screen.queryByRole('button', { name: /Aprobar|Solicitar correcciones|Guardar borrador|Publicar nota|Revisar entrega/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver el libro de calificaciones del proyecto/ })).toHaveAttribute('href', '/documentos/reporte-notas?proceso=p1')
  })
})

describe('Configuración general de evaluación', () => {
  it('lists each moment with its percentage and the total', async () => {
    await show(book())

    const rows = configCard().getAllByRole('row').map((r) => r.textContent)
    expect(rows).toEqual(['Momento evaluativoPorcentaje del proyecto', 'Primer momento evaluativo20 %', 'Segundo momento evaluativo35 %', 'Tercer momento evaluativo45 %', 'Total del proyecto100 %'])
  })

  it('edits the percentages, requires exactly 100 %, can be cancelled and saves only the moment percentages', async () => {
    const user = userEvent.setup()
    vi.mocked(evaluationApi.saveConfig).mockImplementation(async (_t, _p, payload: EvaluationConfigPayload) => book({ moments: book().moments.map((m, i) => ({ ...m, weight_percentage: payload.moments[i].weight_percentage })) }))
    await show(book({ status: 'borrador' }))

    await user.click(configCard().getByRole('button', { name: 'Editar configuración' }))
    const third = screen.getByLabelText('Porcentaje del momento 3')
    await user.clear(third)
    await user.type(third, '40')
    expect(configCard().getByRole('alert')).toHaveTextContent('Los momentos suman 95 %: deben sumar exactamente 100 %.')
    expect(configCard().getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await user.clear(third)
    await user.type(third, '-5')
    expect(configCard().getByRole('alert')).toHaveTextContent('entre 0 y 100')
    await user.clear(third)
    await user.type(third, '101')
    expect(configCard().getByRole('button', { name: 'Guardar' })).toBeDisabled()

    await user.click(configCard().getByRole('button', { name: 'Cancelar' }))
    expect(configCard().getByText('45 %')).toBeInTheDocument() // cancelar no cambia nada
    expect(evaluationApi.saveConfig).not.toHaveBeenCalled()

    await user.click(configCard().getByRole('button', { name: 'Editar configuración' }))
    await user.clear(screen.getByLabelText('Porcentaje del momento 1'))
    await user.type(screen.getByLabelText('Porcentaje del momento 1'), '25')
    await user.clear(screen.getByLabelText('Porcentaje del momento 3'))
    await user.type(screen.getByLabelText('Porcentaje del momento 3'), '40')
    expect(configCard().getByText('100 %', { selector: 'td' })).toBeInTheDocument()
    await user.click(configCard().getByRole('button', { name: 'Guardar' }))

    const payload = vi.mocked(evaluationApi.saveConfig).mock.calls[0][2]
    expect(payload.moments.map((m) => m.weight_percentage)).toEqual([25, 35, 40])
    expect(payload.moments.map((m) => m.criteria.map((c) => [c.name, c.weight_percentage, c.deliverable_public_id]))).toEqual([[['Propuesta inicial', 100, 'd1']], [['Antecedentes', 100, 'd2']], [['Documento final', 100, null]]]) // actividades y ponderaciones intactas
    expect(await configCard().findByText('Configuración guardada: la tabla ya usa los nuevos porcentajes.')).toBeInTheDocument()
    expect(configCard().getByText('25 %')).toBeInTheDocument()
  })

  it('shows the server error when saving is rejected and keeps what was typed', async () => {
    const user = userEvent.setup()
    vi.mocked(evaluationApi.saveConfig).mockRejectedValue(new ApiError(409, 'Ya hay notas publicadas: no se pueden agregar ni quitar momentos o criterios, ni cambiar sus porcentajes.'))
    await show(book({ status: 'borrador' }))

    await user.click(configCard().getByRole('button', { name: 'Editar configuración' }))
    await user.clear(screen.getByLabelText('Porcentaje del momento 1'))
    await user.type(screen.getByLabelText('Porcentaje del momento 1'), '30')
    await user.clear(screen.getByLabelText('Porcentaje del momento 3'))
    await user.type(screen.getByLabelText('Porcentaje del momento 3'), '35')
    await user.click(configCard().getByRole('button', { name: 'Guardar' }))

    expect(await configCard().findByText(/Ya hay notas publicadas/)).toBeInTheDocument()
    expect(screen.getByLabelText('Porcentaje del momento 1')).toHaveValue(30)
  })

  it('blocks editing the percentages once grades are published', async () => {
    await show(book({ has_published_grades: true }))

    expect(configCard().getByRole('button', { name: 'Editar configuración' })).toBeDisabled()
    expect(configCard().getByText(/Hay notas publicadas: los porcentajes y la estructura no se pueden cambiar/)).toBeInTheDocument()
    expect(configCard().getByRole('button', { name: 'Desactivar evaluación' })).toBeDisabled()
  })

  it('publishes the evaluation from the card only when nothing is missing, and says what is missing otherwise', async () => {
    const user = userEvent.setup()
    vi.mocked(evaluationApi.publish).mockResolvedValue(book())
    await show(book({ status: 'borrador', config_problems: ['El momento 3 no tiene criterios.'] }))

    expect(configCard().getByRole('button', { name: 'Publicar evaluación' })).toBeDisabled()
    expect(configCard().getByRole('list', { name: 'Pendientes para publicar' })).toHaveTextContent('El momento 3 no tiene criterios.')
    cleanup()

    await show(book({ status: 'borrador' }))
    await user.click(configCard().getByRole('button', { name: 'Publicar evaluación' }))
    expect(evaluationApi.publish).toHaveBeenCalledWith('token', 'p1')
    expect(await configCard().findByText(/Evaluación publicada/)).toBeInTheDocument()
    expect(configCard().getByRole('button', { name: 'Desactivar evaluación' })).toBeEnabled()
  })

  it('loads the suggested 20/35/45 distribution with the real plan deliverables when nothing is configured yet', async () => {
    const user = userEvent.setup()
    vi.mocked(evaluationApi.saveConfig).mockResolvedValue(book({ status: 'borrador' }))
    await show(manager({ status: 'sin_configurar', moments: [] }))

    expect(screen.getByText(/Todavía no hay momentos evaluativos configurados/)).toBeInTheDocument()
    await user.click(configCard().getByRole('button', { name: /Cargar distribución sugerida/ }))
    const payload = vi.mocked(evaluationApi.saveConfig).mock.calls[0][2]
    expect(payload.moments.map((m) => m.weight_percentage)).toEqual([20, 35, 45])
    expect(payload.moments[0].criteria.map((c) => c.deliverable_public_id)).toEqual(['d1', 'd2']) // solo entregables reales del plan
  })

  it('does not offer editing to someone who cannot configure (an evaluator)', async () => {
    await show(book({ can_configure: false }))

    expect(configCard().queryByRole('button', { name: 'Editar configuración' })).not.toBeInTheDocument()
    expect(configCard().queryByRole('button', { name: /Publicar evaluación|Desactivar evaluación/ })).not.toBeInTheDocument()
    expect(gradebook().getByText('Ítem de calificación')).toBeInTheDocument()
  })

  it('keeps the existing editor of activities and weights one click away, and never edits the deliverables themselves', async () => {
    const user = userEvent.setup()
    await show(book({ status: 'borrador' }))

    expect(screen.queryByRole('region', { name: 'Actividades y ponderaciones de cada momento' })).not.toBeInTheDocument()
    await user.click(configCard().getByRole('button', { name: 'Ajustar actividades y ponderaciones' }))
    const editor = within(screen.getByRole('region', { name: 'Actividades y ponderaciones de cada momento' }))
    expect(editor.getByLabelText('Porcentaje del criterio 1.1')).toBeInTheDocument()
    expect(editor.queryByRole('button', { name: /Crear entregable|Editar entregable/ })).not.toBeInTheDocument()
    await user.click(configCard().getByRole('button', { name: 'Ocultar actividades y ponderaciones' }))
    expect(screen.queryByRole('region', { name: 'Actividades y ponderaciones de cada momento' })).not.toBeInTheDocument()
  })
})

describe('Resumen de calificación', () => {
  it('shows the published grade, the one with drafts, the graded activities and the progress from the real totals', async () => {
    await show(book())

    expect(summary().getByText('Nota publicada').parentElement).toHaveTextContent('0.90 / 5.0')
    expect(summary().getByText('Nota con borradores').parentElement).toHaveTextContent('1.95 / 5.0')
    expect(summary().getByText('Actividades calificadas').parentElement).toHaveTextContent('2 / 3')
    expect(summary().getByText('Avance').parentElement).toHaveTextContent('66,7 %')
  })

  it('points to «Plan de trabajo y entregables» for the configuration of activities', async () => {
    await show(book())

    expect(summary().getByText(/La configuración de entregables, fechas y actividades se administra en/)).toBeInTheDocument()
    expect(summary().getByRole('link', { name: 'Plan de trabajo y entregables' })).toHaveAttribute('href', '/tutor/proyectos/p1?tab=plan')
  })

  it('shows dashes instead of inventing a progress when there are no activities', async () => {
    await show(manager({ status: 'sin_configurar', moments: [] }))

    expect(summary().getByText('Avance').parentElement).toHaveTextContent('—')
    expect(summary().getByText('Actividades calificadas').parentElement).toHaveTextContent('0 / 0')
  })
})

describe('Libro de calificaciones', () => {
  it('lays out every moment with its activities, weights, grade, range, percentage, feedback and contribution, plus the total of each moment', async () => {
    await show(book())

    const table = gradebook()
    for (const header of ['Ítem de calificación', 'Ponderación', 'Calificación (0–5)', 'Rango', 'Porcentaje', 'Retroalimentación', 'Aporte al total del proyecto']) {
      expect(table.getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
    const first = within(table.getByRole('rowgroup', { name: 'Primer momento evaluativo' }))
    expect(first.getByText(/20 % del proyecto/)).toBeInTheDocument()
    const activity = within(first.getByRole('row', { name: /Propuesta inicial/ }))
    expect(activity.getByText('100 %')).toBeInTheDocument() // ponderación dentro del momento
    expect(activity.getByText('4.5')).toBeInTheDocument()
    expect(activity.getByText('90 %')).toBeInTheDocument()
    expect(activity.getByText('Buen marco teórico')).toBeInTheDocument()
    expect(activity.getByText('0.90')).toBeInTheDocument() // aporte
    const total = within(first.getByRole('row', { name: /Total del momento/ }))
    expect(total.getByText('4.50')).toBeInTheDocument()
    expect(total.getByText('0.90')).toBeInTheDocument()
    expect(table.getAllByRole('row', { name: /Total del momento/ })).toHaveLength(3)
  })

  it('marks drafts as such, and shows a dash (never a zero) for activities and moments without a grade', async () => {
    await show(book())

    const second = within(gradebook().getByRole('rowgroup', { name: 'Segundo momento evaluativo' }))
    expect(within(second.getByRole('row', { name: /Antecedentes/ })).getByText('Borrador')).toBeInTheDocument()
    const third = within(gradebook().getByRole('rowgroup', { name: 'Tercer momento evaluativo' }))
    const pending = within(third.getByRole('row', { name: /Documento final/ }))
    expect(pending.getAllByText('—').length).toBeGreaterThanOrEqual(4)
    expect(pending.queryByText('0.0')).not.toBeInTheDocument()
    expect(within(third.getByRole('row', { name: /Tercer momento evaluativo/ })).getByText('Pendiente')).toBeInTheDocument()
    expect(within(third.getByRole('row', { name: /Total del momento/ })).getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })

  it('shows the final grade highlighted only when every activity is graded and published, and a partial figure otherwise', async () => {
    await show(book())
    const partial = within(screen.getByRole('status', { name: 'Nota final del proyecto' }))
    expect(partial.getByText(/Parcial: faltan actividades por calificar o publicar/)).toBeInTheDocument()
    expect(partial.getByText('—')).toBeInTheDocument()
    cleanup()

    await show(book({ published_totals: totals({ accumulated: 3.85, evaluated_percent: 100, graded_criteria: 3, pending_criteria: 0, total_criteria: 3, complete: true, calculated_final: 3.85 }) }))
    const done = within(screen.getByRole('status', { name: 'Nota final del proyecto' }))
    expect(done.getByText('3.85 / 5.0')).toBeInTheDocument()
    expect(done.getByText(/Suma de los aportes de los momentos evaluativos/)).toBeInTheDocument()
  })

  it('says there are no moments yet instead of showing an empty table', async () => {
    await show(manager({ status: 'sin_configurar', moments: [] }))

    expect(screen.queryByRole('region', { name: 'Libro de calificaciones' })).not.toBeInTheDocument()
    expect(screen.getByText(/Todavía no hay momentos evaluativos configurados/)).toBeInTheDocument()
  })

  it('shows the official final grade registered by Coordination when there is one', async () => {
    await show(book({ official_final_grade: { final_grade: 4.2, passed: true, registered_at: '2026-11-01T10:00:00' } }))

    expect(gradebook().getByText(/Nota final oficial registrada por Coordinación/)).toBeInTheDocument()
  })
})

describe('permisos y errores', () => {
  it('shows a read-only message when the person can neither configure nor grade', async () => {
    await show(evaluation({ can_configure: false, can_grade: false }))

    expect(screen.getByText(/Vista de consulta/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Libro de calificaciones' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver el libro de calificaciones del proyecto/ })).toBeInTheDocument()
  })

  it('reports a load failure with a way to retry', async () => {
    vi.mocked(evaluationApi.get).mockRejectedValue(new ApiError(500, 'Error interno del servidor'))
    render(<MemoryRouter><EvaluationPanel processId="p1" /></MemoryRouter>)

    expect(await screen.findByText(/Error interno del servidor/)).toBeInTheDocument()
  })

  it('works with no work plan yet', async () => {
    vi.mocked(workPlanApi.get).mockRejectedValue(new ApiError(404, 'Aún no hay un plan'))
    await show(book())

    await waitFor(() => expect(workPlanApi.get).toHaveBeenCalledWith('token', 'p1'))
    expect(gradebook().getByText('Ítem de calificación')).toBeInTheDocument()
  })
})
