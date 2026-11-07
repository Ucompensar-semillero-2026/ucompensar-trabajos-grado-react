import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { StudentRow, TaskOut } from '@/services/monitoring.service'

vi.mock('@/services/monitoring.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/monitoring.service')>()),
  monitoringApi: { students: vi.fn(), extend: vi.fn() },
}))

import { monitoringApi } from '@/services/monitoring.service'
import { ExtensionManager } from './ExtensionManager'
import { countByCategory, dueDistance, extensionCategory, stillOverdue } from './extensionHelpers'

const row = (o: Partial<StudentRow> = {}): StudentRow => ({
  process_id: 'p1', process_code: 'TG-1', project_title: 'P', modality_code: 'APL', modality_name: 'Aplicado', student_id: 's1', student_name: 'Juan Pérez',
  student_email: 'j@u.co', tutor_name: 'Ana', assigned: 4, delivered: 1, pending: 3, overdue: 1, next_due: null, level: 'moderado', last_intervention_at: null,
  open_commitments: 0, overdue_commitments: 0, group_alert: false, ...o,
})
const task = (id: string, title: string, state: TaskOut['state'], due: string | null, days: number | null, o: Partial<TaskOut> = {}): TaskOut => ({
  assignment_id: `a-${id}`, deliverable_id: id, title, stage: 'Etapa 1', assigned_at: '2026-10-01T10:00:00', original_due: due, effective_due: due,
  delivered_at: state === 'entregada' ? '2026-10-20T10:00:00' : null, state, delivery_note: null, late_delivery: false, days_to_due: days, escalate_group: true, extensions: [], ...o,
})
// Estados y días tal como los entrega el backend (hoy = 2026-11-06 en Bogotá).
const TASKS = [
  task('d1', 'Problema y objetivos', 'vencida', '2026-10-31', -6),
  task('d2', 'Antecedentes', 'por_vencer', '2026-11-08', 2),
  task('d3', 'Marco teórico', 'en_curso', '2026-12-01', 25),
  task('d4', 'Propuesta inicial', 'entregada', '2026-10-25', null),
  task('d5', 'Metodología', 'ampliada', '2026-12-10', 34, { extensions: [{ id: 'e', previous_due_date: '2026-12-01', days_added: 9, new_due_date: '2026-12-10', reason: 'x', observations: null, authorized_by: 'Ana', authorized_at: '2026-11-01T10:00:00', intervention_id: null }] }),
  task('d6', 'Anexo retirado', 'cancelada', '2026-11-20', null),
]

beforeEach(() => {
  vi.mocked(monitoringApi.students).mockResolvedValue({ items: [row(), row({ student_id: 's2', student_name: 'Carlos Ruiz' })], total: 2, page: 1, page_size: 100 })
  vi.mocked(monitoringApi.extend).mockResolvedValue([])
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

const renderModal = (onSaved = vi.fn()) => {
  render(<ExtensionManager token="token" student={row()} tasks={TASKS} onClose={vi.fn()} onSaved={onSaved} />)
  return onSaved
}
const item = (title: string) => screen.getByRole('checkbox', { name: new RegExp(title) }).closest('label') as HTMLElement

describe('clasificación de tareas para ampliar (estado del backend)', () => {
  it('usa el estado real y la misma elegibilidad que el backend', () => {
    expect(TASKS.map((t) => [t.deliverable_id, extensionCategory(t).category, extensionCategory(t).eligible])).toEqual([
      ['d1', 'vencida', true], ['d2', 'proxima', true], ['d3', 'en_plazo', true], ['d4', 'entregada', false], ['d5', 'en_plazo', true], ['d6', 'no_elegible', false],
    ])
    expect(extensionCategory(task('x', 'Sin fecha', 'pendiente', null, null))).toMatchObject({ category: 'no_elegible', eligible: false })
  })

  it('describe retraso y días restantes con los días que informa el backend', () => {
    expect(TASKS.map(dueDistance)).toEqual(['Vencida hace 6 días', 'Faltan 2 días', 'Faltan 25 días', null, 'Faltan 34 días', null])
    expect(dueDistance(task('h', 'Hoy', 'por_vencer', '2026-11-06', 0))).toBe('Vence hoy')
    expect(dueDistance(task('m', 'Mañana', 'por_vencer', '2026-11-07', 1))).toBe('Vence mañana')
    expect(dueDistance(task('y', 'Ayer', 'vencida', '2026-11-05', -1))).toBe('Vencida hace 1 día')
  })

  it('detecta las tareas que seguirían vencidas y los días mínimos', () => {
    expect(stillOverdue(TASKS.slice(0, 3), 3)).toMatchObject({ minimumDays: 6 })
    expect(stillOverdue(TASKS.slice(0, 3), 6).tasks).toHaveLength(0)
    expect(countByCategory(TASKS)).toEqual({ vencida: 1, proxima: 1, en_plazo: 2 })
  })
})

describe('modal «Ampliar plazo de entrega»', () => {
  it('muestra cada estado con su color, badge y distancia, y bloquea lo no elegible', async () => {
    renderModal()
    await screen.findByRole('checkbox', { name: 'Carlos Ruiz' })
    expect(within(item('Problema y objetivos')).getByText('Vencida')).toBeInTheDocument()
    expect(within(item('Problema y objetivos')).getByText('Vencida hace 6 días')).toBeInTheDocument()
    expect(item('Problema y objetivos').className).toContain('#DC2626')
    expect(within(item('Antecedentes')).getByText('Próxima a vencer')).toBeInTheDocument()
    expect(within(item('Antecedentes')).getByText('Faltan 2 días')).toBeInTheDocument()
    expect(item('Antecedentes').className).toContain('#F97316')
    expect(within(item('Marco teórico')).getByText('En plazo')).toBeInTheDocument()
    expect(item('Marco teórico').className).toContain('#2563EB')
    expect(within(item('Metodología')).getByText(/ya ampliada 1 vez/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Propuesta inicial/ })).toBeDisabled()
    expect(within(item('Propuesta inicial')).getByText('Ya se entregó: no se puede ampliar.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Anexo retirado/ })).toBeDisabled()
    const legend = screen.getByRole('list', { name: 'Leyenda de estados' })
    for (const l of ['Vencida', 'Próxima a vencer', 'En plazo', 'Entregada']) expect(within(legend).getByText(l)).toBeInTheDocument()
  })

  it('la selección se marca sin cambiar el estado y resume vencidas, próximas y en plazo', async () => {
    const user = userEvent.setup()
    renderModal()
    await screen.findByRole('checkbox', { name: 'Carlos Ruiz' })
    for (const t of ['Problema y objetivos', 'Antecedentes', 'Marco teórico']) await user.click(screen.getByRole('checkbox', { name: new RegExp(t) }))
    expect(item('Problema y objetivos').className).toContain('ring-2')
    expect(within(item('Problema y objetivos')).getByText('Vencida')).toBeInTheDocument() // el estado original se mantiene
    expect(within(item('Problema y objetivos')).getByText('Seleccionada')).toBeInTheDocument()
    expect(screen.getByText('3 seleccionadas')).toBeInTheDocument()
    expect(screen.getByText('1 vencida')).toBeInTheDocument()
    expect(screen.getByText('1 próxima a vencer')).toBeInTheDocument()
    expect(screen.getByText('1 en plazo')).toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'Resumen de la ampliación' })
    expect(within(summary).getByText('Del 3 de nov de 2026 al 4 de dic de 2026')).toBeInTheDocument() // 31 oct+3 … 1 dic+3
  })

  it('advierte al ampliar una vencida y avisa si los días no alcanzan (el backend la rechazaría)', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(await screen.findByRole('checkbox', { name: /Problema y objetivos/ }))
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('Vas a ampliar una tarea que ya está vencida.')
    expect(note).toHaveTextContent('«Problema y objetivos» seguiría vencida')
    expect(note).toHaveTextContent('concede al menos 6 días')
    await user.clear(screen.getByLabelText('Días adicionales (calendario)'))
    await user.type(screen.getByLabelText('Días adicionales (calendario)'), '10')
    expect(screen.getByRole('note')).not.toHaveTextContent('seguiría vencida')
    expect(within(item('Problema y objetivos')).getByText(/Nueva fecha → 10 de nov de 2026/)).toBeInTheDocument()
  })

  it('exige el motivo y envía al backend exactamente estudiantes, tareas, días, motivo y observaciones', async () => {
    const user = userEvent.setup()
    const onSaved = renderModal()
    await user.click(await screen.findByRole('checkbox', { name: 'Carlos Ruiz' }))
    await user.click(screen.getByRole('checkbox', { name: /Problema y objetivos/ }))
    await user.click(screen.getByRole('checkbox', { name: /Antecedentes/ }))
    await user.clear(screen.getByLabelText('Días adicionales (calendario)'))
    await user.type(screen.getByLabelText('Días adicionales (calendario)'), '7')
    await user.click(screen.getByRole('button', { name: 'Autorizar ampliación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El motivo es obligatorio.')
    expect(monitoringApi.extend).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), 'Incapacidad médica')
    await user.type(screen.getByLabelText('Observaciones (opcional)'), 'Soporte adjunto')
    await user.click(screen.getByRole('button', { name: 'Autorizar ampliación' }))
    await waitFor(() => expect(monitoringApi.extend).toHaveBeenCalledWith('token', {
      process_id: 'p1', student_ids: ['s1', 's2'], deliverable_ids: ['d1', 'd2'], days: 7, reason: 'Incapacidad médica', observations: 'Soporte adjunto',
    }))
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('muestra el error del backend y no cierra si la autorización falla', async () => {
    const { ApiError } = await import('@/services/http')
    vi.mocked(monitoringApi.extend).mockRejectedValueOnce(new ApiError(409, 'Carlos Ruiz ya entregó «Antecedentes»; no se puede ampliar'))
    const user = userEvent.setup()
    const onSaved = renderModal()
    await user.click(await screen.findByRole('checkbox', { name: /Antecedentes/ }))
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), 'Motivo válido')
    await user.click(screen.getByRole('button', { name: 'Autorizar ampliación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ya entregó')
    expect(onSaved).not.toHaveBeenCalled()
  })
})
