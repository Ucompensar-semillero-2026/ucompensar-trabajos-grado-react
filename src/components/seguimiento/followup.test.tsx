import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import { makeUser } from '@/test/users'
import type { User } from '@/types'
import type { MonitoringSummary, StudentRow } from '@/services/monitoring.service'

vi.mock('@/services/monitoring.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/monitoring.service')>()),
  monitoringApi: { summary: vi.fn(), students: vi.fn() },
}))

import { monitoringApi } from '@/services/monitoring.service'
import { TaskMonitoringDashboard } from './TaskMonitoringDashboard'
import { alertReasons, buildSlices, daysUntil, dueLabel, dueUrgency, pickUpcoming, rowsToCsv } from './monitoringHelpers'

const tutor: User = makeUser(['docente'], { id: 't1', name: 'Tutor', initials: 'T', email: 't@u.co' })

const summary = (o: Partial<MonitoringSummary> = {}): MonitoringSummary => ({
  students: 4, al_dia: 1, atencion: 1, moderado: 1, critico: 1, groups_with_alert: 1, open_commitments: 3, overdue_commitments: 1, needing_attention: 2, ...o,
})

const row = (o: Partial<StudentRow> = {}): StudentRow => ({
  process_id: 'p1', process_code: 'TG-1', project_title: 'Sistema académico', modality_code: 'PROYECTO_INV', modality_name: 'Proyecto de investigación',
  student_id: 's1', student_name: 'Juan Pérez', student_email: 'juan@u.co', tutor_name: 'Ana Tutora', assigned: 6, delivered: 3, pending: 3, overdue: 2,
  next_due: '2026-11-13', level: 'moderado', last_intervention_at: null, open_commitments: 1, overdue_commitments: 0, group_alert: false, ...o,
})

const rows = [
  row({ student_id: 's1', student_name: 'Juan Pérez', level: 'critico', overdue: 2, overdue_commitments: 1, group_alert: true }),
  row({ student_id: 's2', student_name: 'María Gómez', level: 'al_dia', overdue: 0, next_due: '2026-12-11' }),
]

beforeEach(() => {
  useAppStore.setState({ currentUser: tutor, isAuthenticated: true, accessToken: 'token' })
  vi.mocked(monitoringApi.summary).mockResolvedValue(summary())
  vi.mocked(monitoringApi.students).mockResolvedValue({ items: rows, total: 2, page: 1, page_size: 15 })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('lógica del tablero', () => {
  it('reparte el donut según los conteos reales y los porcentajes suman el total', () => {
    const slices = buildSlices(summary({ students: 8, al_dia: 4, atencion: 2, moderado: 1, critico: 1 }))
    expect(slices.map((s) => [s.level, s.count, s.percent])).toEqual([['al_dia', 4, 50], ['atencion', 2, 25], ['moderado', 1, 13], ['critico', 1, 13]])
    expect(slices[0].length).toBeGreaterThan(slices[1].length)
    expect(slices[1].offset).toBeGreaterThan(slices[0].offset)
  })

  it('sin estudiantes no dibuja segmentos ni divide entre cero', () => {
    const slices = buildSlices(summary({ students: 0, al_dia: 0, atencion: 0, moderado: 0, critico: 0 }))
    expect(slices.every((s) => s.length === 0 && s.percent === 0)).toBe(true)
  })

  it('un solo nivel ocupa el círculo completo, sin hueco', () => {
    const [al_dia] = buildSlices(summary({ students: 2, al_dia: 2, atencion: 0, moderado: 0, critico: 0 }))
    expect(al_dia.percent).toBe(100)
    expect(al_dia.length).toBeCloseTo(2 * Math.PI * 52, 5)
  })

  it('calcula la urgencia por días de calendario y la describe sin ambigüedad', () => {
    expect(daysUntil('2026-11-13', '2026-11-10')).toBe(3)
    expect(daysUntil('2026-11-09', '2026-11-10')).toBe(-1)
    expect([-1, 0, 3, 4, 7, 8].map(dueUrgency)).toEqual(['vencida', 'urgente', 'urgente', 'pronto', 'pronto', 'holgada'])
    expect([-3, -1, 0, 1, 8].map(dueLabel)).toEqual(['Vencida hace 3 días', 'Vencida hace 1 día', 'Vence hoy', 'Vence mañana', 'Vence en 8 días'])
  })

  it('elige los vencimientos más próximos y descarta lo que no tiene fecha o no tiene pendientes', () => {
    const items = pickUpcoming([
      row({ student_id: 'a', next_due: '2026-12-01' }),
      row({ student_id: 'b', next_due: '2026-11-11' }),
      row({ student_id: 'c', next_due: null }),
      row({ student_id: 'd', next_due: '2026-11-05', pending: 0 }),
    ], '2026-11-10')
    expect(items.map((i) => i.row.student_id)).toEqual(['b', 'a'])
    expect(items.map((i) => i.days)).toEqual([1, 21])
    const many = pickUpcoming(Array.from({ length: 9 }, (_, i) => row({ student_id: `s${i}`, next_due: `2026-11-${11 + i}` })), '2026-11-10')
    expect(many).toHaveLength(5)
  })

  it('explica la alerta solo con campos reales de la fila', () => {
    expect(alertReasons(row({ overdue: 2, overdue_commitments: 1, group_alert: true }))).toEqual(['2 tareas vencidas', '1 compromiso vencido', 'Alerta grupal'])
    expect(alertReasons(row({ overdue: 1, overdue_commitments: 0, group_alert: false }))).toEqual(['1 tarea vencida'])
    expect(alertReasons(row({ overdue: 0, overdue_commitments: 0, group_alert: false }))).toEqual([])
  })

  it('exporta CSV con BOM, escapa comillas y usa el texto de cada nivel', () => {
    const csv = rowsToCsv([row({ student_name: 'Ana "la mejor"', level: 'critico', tutor_name: null })])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"Ana ""la mejor"""')
    expect(csv).toContain('"Riesgo crítico"')
    expect(csv.split('\r\n')).toHaveLength(2)
  })
})

describe('pantalla de seguimiento rediseñada', () => {
  const renderDashboard = () => render(<MemoryRouter><TaskMonitoringDashboard /></MemoryRouter>)

  it('muestra un esqueleto accesible mientras carga', () => {
    vi.mocked(monitoringApi.summary).mockReturnValue(new Promise(() => {}))
    vi.mocked(monitoringApi.students).mockReturnValue(new Promise(() => {}))
    renderDashboard()
    expect(screen.getByRole('status', { name: 'Cargando seguimiento' })).toBeInTheDocument()
  })

  it('destaca la alerta crítica en la tarjeta y en la fila, con sus motivos reales', async () => {
    renderDashboard()
    const kpis = await screen.findByRole('region', { name: 'Indicadores de seguimiento' })
    expect(within(kpis).getByText('1 estudiante necesita intervención')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Prioridad')).toBeInTheDocument()
    expect(within(table).getByText('2 tareas vencidas · 1 compromiso vencido · Alerta grupal')).toBeInTheDocument()
  })

  it('la tarjeta de riesgo crítico filtra la lista y vuelve a quitar el filtro', async () => {
    const user = userEvent.setup()
    renderDashboard()
    const kpis = await screen.findByRole('region', { name: 'Indicadores de seguimiento' })
    const card = within(kpis).getByRole('button', { name: /Riesgo crítico/ })
    expect(card).toHaveAttribute('aria-pressed', 'false')
    await user.click(card)
    await waitFor(() => expect(monitoringApi.students).toHaveBeenLastCalledWith('token', expect.objectContaining({ level: 'critico', page: 1 })))
    expect(screen.getByLabelText('Nivel de alerta')).toHaveValue('critico')
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Indicadores de seguimiento' })).getByRole('button', { name: /Riesgo crítico/ })).toHaveAttribute('aria-pressed', 'true'))
    await user.click(within(screen.getByRole('region', { name: 'Indicadores de seguimiento' })).getByRole('button', { name: /Riesgo crítico/ }))
    await waitFor(() => expect(monitoringApi.students).toHaveBeenLastCalledWith('token', expect.not.objectContaining({ level: 'critico' })))
  })

  it('la leyenda del gráfico filtra por nivel y refleja cantidades y porcentajes reales', async () => {
    const user = userEvent.setup()
    vi.mocked(monitoringApi.summary).mockResolvedValue(summary({ students: 8, al_dia: 4, atencion: 2, moderado: 1, critico: 1 }))
    renderDashboard()
    const legend = await screen.findByRole('list', { name: 'Leyenda de niveles de alerta' })
    expect(within(legend).getByRole('button', { name: /Al día.*50% \(4\)/ })).toBeInTheDocument()
    expect(within(legend).getByRole('button', { name: /Atención inicial.*25% \(2\)/ })).toBeInTheDocument()
    expect(within(legend).getByRole('button', { name: /Riesgo crítico.*13% \(1\)/ })).toBeInTheDocument()
    await user.click(within(legend).getByRole('button', { name: /Riesgo moderado/ }))
    await waitFor(() => expect(monitoringApi.students).toHaveBeenLastCalledWith('token', expect.objectContaining({ level: 'moderado' })))
  })

  it('lista los próximos vencimientos con enlace al expediente', async () => {
    renderDashboard()
    const list = await screen.findByRole('list', { name: 'Próximos vencimientos' })
    const links = within(list).getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/seguimiento/p1/s1')
  })

  it('exporta lo que se ve y confirma la descarga', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:seguimiento')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: 'Exportar' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:seguimiento')
    expect(await screen.findByRole('status')).toHaveTextContent('Archivo descargado')
    click.mockRestore()
  })
})
