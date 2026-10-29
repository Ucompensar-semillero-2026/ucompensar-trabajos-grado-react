import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { MODULE_ROLES } from '@/config/access'
import { NAV_ITEMS } from '@/constants'
import type { AdminCalendarEvent, CalendarEvent, CalendarFacets } from '@/services/calendar.service'

vi.mock('@/services/calendar.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/calendar.service')>()),
  calendarApi: { events: vi.fn(), next: vi.fn() },
  calendarAdminApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), transition: vi.fn(), history: vi.fn(), periods: vi.fn(), createPeriod: vi.fn(), types: vi.fn(), modalities: vi.fn() },
}))

import { calendarAdminApi, calendarApi } from '@/services/calendar.service'
import { AcademicCalendar, upcomingEvents } from './AcademicCalendar'
import { dayKey, eventDays, formatEventDates, monthGrid, todayKey } from './calendarFormat'
import { CalendarioAcademico, toInput, validateForm, type EventForm } from '@/components/coordinacion/CalendarioAcademico'

const type = { id: 't1', code: 'recepcion_propuestas', name: 'Recepción de propuestas' }
const facets: CalendarFacets = {
  periods: [{ id: 'p1', code: '2099-1', name: 'Periodo 2099-1' }],
  modalities: [{ id: 'm1', code: 'PROYECTO_INV', name: 'Proyecto de investigación' }, { id: 'm2', code: 'PROYECTO_EMP', name: 'Proyecto de emprendimiento' }],
  types: [type],
}

function event(o: Partial<CalendarEvent> = {}): CalendarEvent {
  const today = todayKey()
  return {
    id: 'e1', title: 'Recepción de propuestas', description: 'Entrega tu propuesta.', event_type: type, period: facets.periods[0], modalities: [facets.modalities[0]],
    applies_to_all_modalities: false, starts_at: `${today}T00:00:00-05:00`, ends_at: null, all_day: true, dates_confirmed: true, date_kind: 'tentativa',
    date_note: null, status: 'publicado', timeline: 'en_curso', ...o,
  }
}
const pendingEvent = (o: Partial<CalendarEvent> = {}) => event({ id: 'e2', title: 'Sustentaciones', starts_at: null, ends_at: null, dates_confirmed: false, timeline: 'por_confirmar', applies_to_all_modalities: true, modalities: [], period: null, date_note: 'Segundo semestre', ...o })

function Probe() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

beforeEach(() => {
  vi.mocked(calendarApi.events).mockResolvedValue({ items: [event(), pendingEvent()], facets })
  vi.mocked(calendarApi.next).mockResolvedValue({ event: event(), only_pending_dates: false, published_total: 2 })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

const renderCalendar = () => render(<MemoryRouter initialEntries={['/proyectos-de-grado']}><AcademicCalendar /><Probe /></MemoryRouter>)
const dayButton = (day: string) => screen.getByRole('button', { name: new RegExp(`^${longDayName(day)}`, 'i') })
const longDayName = (day: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${day}T12:00:00Z`))
const ready = () => screen.findByRole('heading', { name: 'Próximos eventos' })

describe('calendario académico integrado en /proyectos-de-grado', () => {
  it('shows the heading, the description and the events of the API, with no «Ver calendario» button', async () => {
    renderCalendar()
    expect(screen.getByRole('heading', { name: 'Calendario académico' })).toBeInTheDocument()
    expect(screen.getByText('Consulta las fechas importantes de convocatorias, proyectos de grado y actividades académicas de tu programa')).toBeInTheDocument()
    await ready()
    expect(calendarApi.events).toHaveBeenCalledTimes(1)
    expect(calendarApi.events).toHaveBeenCalledWith() // sin filtros complejos
    expect(calendarApi.next).not.toHaveBeenCalled() // un solo calendario, sin resumen duplicado
    expect(screen.queryByRole('button', { name: /Ver calendario/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ver calendario/ })).not.toBeInTheDocument()
  })

  it('highlights today, marks days with events accessibly and shows the selected day events with their badges', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    const button = dayButton(todayKey())
    expect(button).toHaveAttribute('aria-current', 'date')
    expect(button).toHaveAccessibleName(/\(hoy\), 1 evento/)
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText('Recepción de propuestas').length).toBeGreaterThan(1)
    expect(screen.getByText('Entrega tu propuesta.')).toBeInTheDocument()
    expect(screen.getAllByText('Fecha tentativa').length).toBeGreaterThan(0) // nunca se presenta como oficial
    expect(screen.getAllByText('En curso').length).toBeGreaterThan(0)
  })

  it('shows general events (no modality) next to modality events on the same day', async () => {
    const today = todayKey()
    vi.mocked(calendarApi.events).mockResolvedValue({
      items: [event({ id: 'g', title: 'Evento general', applies_to_all_modalities: true, modalities: [] }), event({ id: 'm', title: 'Evento de modalidad' })],
      facets,
    })
    renderCalendar()
    await ready()
    expect(dayButton(today)).toHaveAccessibleName(/2 eventos/)
    expect(screen.getAllByText('Evento general').length).toBeGreaterThan(0)
    expect(screen.getByText('Todas las modalidades')).toBeInTheDocument()
    expect(screen.getByText(/Proyecto de investigación/)).toBeInTheDocument()
  })

  it('a multi-day event appears on every day of its interval', async () => {
    const days = ['2099-03-10', '2099-03-11', '2099-03-12']
    expect(eventDays(event({ starts_at: '2099-03-10T00:00:00-05:00', ends_at: '2099-03-12T00:00:00-05:00' }))).toEqual(days)
    const today = todayKey()
    const start = new Date(`${today}T12:00:00Z`)
    const next = new Date(start.getTime() + 86_400_000).toISOString().slice(0, 10)
    vi.mocked(calendarApi.events).mockResolvedValue({ items: [event({ title: 'Convocatoria abierta', starts_at: `${today}T00:00:00-05:00`, ends_at: `${next}T00:00:00-05:00` })], facets })
    renderCalendar()
    await ready()
    expect(dayButton(today)).toHaveAccessibleName(/1 evento/)
    if (next.slice(0, 7) === today.slice(0, 7)) expect(dayButton(next)).toHaveAccessibleName(/1 evento/)
  })

  it('navigates months and returns to the current one', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await ready()
    const title = () => screen.getByRole('group', { name: /^Días de / }).getAttribute('aria-label')
    const start = title()
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(title()).not.toBe(start)
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await user.click(screen.getByRole('button', { name: 'Mes actual' }))
    expect(title()).toBe(start)
  })

  it('lists upcoming events chronologically, skipping finished ones and keeping pending dates apart', () => {
    const mk = (id: string, title: string, day: string, timeline: CalendarEvent['timeline']) => event({ id, title, timeline, starts_at: `${day}T00:00:00-05:00` })
    const { dated, pending } = upcomingEvents([
      mk('c', 'Tercero', '2099-05-01', 'proximo'), mk('f', 'Ya pasó', '2000-01-01', 'finalizado'), mk('a', 'Primero', '2099-03-01', 'en_curso'),
      mk('b', 'Segundo', '2099-04-01', 'proximo'), pendingEvent(),
    ])
    expect(dated.map((e) => e.title)).toEqual(['Primero', 'Segundo', 'Tercero'])
    expect(pending.map((e) => e.title)).toEqual(['Sustentaciones'])
  })

  it('shows pending dates as «por confirmar», never as an exact day', async () => {
    renderCalendar()
    expect(await screen.findByRole('heading', { name: 'Fechas por confirmar' })).toBeInTheDocument()
    expect(screen.getByText('Fecha por confirmar · Segundo semestre')).toBeInTheDocument()
  })

  it('shows the empty state only when the API answered with no events', async () => {
    vi.mocked(calendarApi.events).mockResolvedValue({ items: [], facets })
    renderCalendar()
    expect(await screen.findByText('Todavía no hay fechas académicas publicadas para este periodo')).toBeInTheDocument()
  })

  it('shows loading first', () => {
    vi.mocked(calendarApi.events).mockReturnValue(new Promise(() => {}))
    renderCalendar()
    expect(screen.getByRole('status', { name: 'Cargando el calendario' })).toBeInTheDocument()
  })

  it('an HTTP 500 is a server error, not a lost connection nor an empty list; Reintentar repeats the real request', async () => {
    const user = userEvent.setup()
    vi.mocked(calendarApi.events).mockRejectedValueOnce(new ApiError(500, 'Error interno del servidor'))
    renderCalendar()
    expect(await screen.findByText('No se pudo cargar el calendario')).toBeInTheDocument()
    expect(screen.getByText(/Estamos teniendo un problema al consultar la información/)).toBeInTheDocument()
    expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument()
    expect(screen.queryByText(/Todavía no hay fechas académicas/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await ready()
    expect(calendarApi.events).toHaveBeenCalledTimes(2)
  })

  it('a real network failure shows the offline state and invents no events', async () => {
    vi.mocked(calendarApi.events).mockRejectedValueOnce(new ApiError(0, 'No se pudo conectar con el servidor'))
    renderCalendar()
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    expect(screen.getByText(/Revisa tu conexión a internet/)).toBeInTheDocument()
    expect(screen.queryByText('Recepción de propuestas')).not.toBeInTheDocument()
  })

  it('the old standalone route redirects to the catalog and no independent calendar page remains', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf-8')
    expect(app).toContain('<Route path="/proyectos-de-grado/calendario" element={<Navigate to="/proyectos-de-grado#calendario" replace />} />')
    expect(app).not.toContain('ProcessCalendarPage')
  })
})

describe('formato de fechas (hora de Bogotá)', () => {
  it('builds Monday-first month grids and multi-day ranges', () => {
    const weeks = monthGrid({ year: 2099, month: 3 })
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks.flat().filter(Boolean)).toHaveLength(31)
    const multi = event({ starts_at: '2099-03-10T00:00:00-05:00', ends_at: '2099-03-12T00:00:00-05:00' })
    expect(eventDays(multi)).toEqual(['2099-03-10', '2099-03-11', '2099-03-12'])
    expect(eventDays(pendingEvent())).toEqual([])
  })

  it('uses the Bogotá day regardless of the browser zone and never invents a day for pending dates', () => {
    expect(dayKey('2099-03-10T23:30:00-05:00')).toBe('2099-03-10')
    expect(formatEventDates(event({ starts_at: '2099-03-10T00:00:00-05:00' }))).toMatch(/10 de marzo de 2099/)
    expect(formatEventDates(pendingEvent({ date_note: null }))).toBe('Fecha por confirmar')
  })
})

describe('administración del calendario', () => {
  const coordinator = { id: 'c1', name: 'Diana', initials: 'D', email: 'd@u.co', role: 'coordinador', institutionalRoles: ['Coordinador'], authMethod: 'sso' } as never
  const adminEvent = (o: Partial<AdminCalendarEvent> = {}): AdminCalendarEvent => ({ ...event(), status: 'borrador', published_at: null, created_at: '2099-01-01T00:00:00', updated_at: null, created_by: 'Diana', updated_by: null, ...o })

  beforeEach(() => {
    useAppStore.setState({ currentUser: coordinator, isAuthenticated: true, accessToken: 'token' })
    vi.mocked(calendarAdminApi.types).mockResolvedValue([{ ...type, description: null, sort_order: 10, active: true }])
    vi.mocked(calendarAdminApi.periods).mockResolvedValue([])
    vi.mocked(calendarAdminApi.modalities).mockResolvedValue(facets.modalities)
    vi.mocked(calendarAdminApi.list).mockResolvedValue({ items: [adminEvent()], total: 1, page: 1, page_size: 20 })
  })

  it('only Coordinación and Administración get the module and the menu entry', () => {
    expect(MODULE_ROLES.calendario).toEqual(['Coordinador', 'Administrador'])
    expect(MODULE_ROLES.calendario).not.toContain('Estudiante')
    expect(NAV_ITEMS.find((item) => item.id === 'calendario')?.path).toBe('/coordinacion/calendario')
  })

  it('lists the events with their administrative state and offers the allowed actions', async () => {
    render(<MemoryRouter><CalendarioAcademico /></MemoryRouter>)
    expect(await screen.findByText('Recepción de propuestas')).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getByText('Borrador')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicar Recepción de propuestas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Retirar/ })).not.toBeInTheDocument() // un borrador no se retira
  })

  it('warns before publishing an event with pending dates and calls the real transition endpoint', async () => {
    const user = userEvent.setup()
    vi.mocked(calendarAdminApi.list).mockResolvedValue({ items: [adminEvent({ ...pendingEvent(), status: 'borrador' })], total: 1, page: 1, page_size: 20 })
    vi.mocked(calendarAdminApi.transition).mockResolvedValue(adminEvent({ ...pendingEvent(), status: 'publicado' }))
    render(<MemoryRouter><CalendarioAcademico /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Publicar Sustentaciones' }))
    expect(screen.getByRole('alert')).toHaveTextContent('no están confirmadas')
    await user.click(screen.getByRole('button', { name: /Confirmar: publicar/ }))
    await waitFor(() => expect(calendarAdminApi.transition).toHaveBeenCalledWith('token', 'e2', 'publicar', ''))
  })

  it('requires a reason to cancel', async () => {
    const user = userEvent.setup()
    vi.mocked(calendarAdminApi.list).mockResolvedValue({ items: [adminEvent({ status: 'publicado' })], total: 1, page: 1, page_size: 20 })
    render(<MemoryRouter><CalendarioAcademico /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Cancelar Recepción de propuestas' }))
    await user.click(screen.getByRole('button', { name: /Confirmar: cancelar/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Indica el motivo')
    expect(calendarAdminApi.transition).not.toHaveBeenCalled()
  })

  it('validates the form like the backend and creates the event as a draft with the real endpoint', async () => {
    const user = userEvent.setup()
    vi.mocked(calendarAdminApi.create).mockResolvedValue(adminEvent())
    render(<MemoryRouter><CalendarioAcademico /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /Nuevo evento/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar como borrador' }))
    expect(await screen.findByText(/título de al menos 3/)).toBeInTheDocument()
    expect(calendarAdminApi.create).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Título'), 'Recepción de propuestas')
    await user.selectOptions(screen.getByLabelText('Tipo de proceso'), 't1')
    await user.click(screen.getByRole('button', { name: 'Guardar como borrador' }))
    await waitFor(() => expect(calendarAdminApi.create).toHaveBeenCalledTimes(1))
    // Fechas sin confirmar: no se envía ningún día exacto.
    expect(vi.mocked(calendarAdminApi.create).mock.calls[0][1]).toMatchObject({ dates_confirmed: false, starts_at: null, ends_at: null, date_kind: 'tentativa', modality_ids: [] })
  })

  it('the create/edit modal is a body-level dialog capped to the viewport with its own scroll, fixed header and fixed actions', async () => {
    const user = userEvent.setup()
    const view = render(<MemoryRouter><CalendarioAcademico /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /Nuevo evento/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo evento' })

    // Montado en <body>, fuera del layout: ningún ancestro puede recortarlo ni desplazarlo.
    expect(view.container.contains(dialog)).toBe(false)
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(dialog.className).toContain('max-h-[96dvh]')
    expect(dialog.className).toContain('sm:max-h-[90dvh]')
    expect(dialog.className).toContain('sm:w-[min(1100px,96vw)]')
    expect(dialog.className).toContain('min-h-0')
    const body = within(dialog).getByTestId('modal-body')
    expect(body.className).toMatch(/overflow-y-auto/)
    expect(body.className).toMatch(/min-h-0/)
    expect(dialog.className).toMatch(/overflow-hidden/)

    // Encabezado y acciones viven fuera del área desplazable.
    expect(body.contains(within(dialog).getByRole('heading', { name: 'Nuevo evento' }))).toBe(false)
    expect(body.contains(within(dialog).getByRole('button', { name: 'Guardar como borrador' }))).toBe(false)
    expect(body.contains(within(dialog).getByRole('button', { name: 'Cancelar' }))).toBe(false)
  })

  it('keeps every form field reachable inside the scrollable body', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><CalendarioAcademico /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /Nuevo evento/ }))
    const body = screen.getByTestId('modal-body')
    for (const label of ['Título', 'Descripción (opcional)', 'Tipo de proceso', 'Periodo académico', 'Código del periodo', 'Nombre del periodo', 'Inicio', 'Cierre (opcional)', 'Nota sobre la fecha (opcional)']) {
      expect(within(body).getByLabelText(label)).toBeInTheDocument()
    }
    expect(within(body).getByRole('button', { name: 'Crear periodo' })).toBeInTheDocument()
    expect(within(body).getByText('Modalidades a las que aplica')).toBeInTheDocument()
    expect(within(body).getByLabelText('Proyecto de investigación')).toBeInTheDocument()
    expect(within(body).getByLabelText('Las fechas están confirmadas')).toBeInTheDocument()
    expect(within(body).getByLabelText('Evento de día completo (sin hora)')).toBeInTheDocument()
    expect(within(body).getByLabelText('Tentativa')).toBeInTheDocument()
    expect(within(body).getByLabelText('Oficial')).toBeInTheDocument()
  })

  it('places the preview after the form in the normal flow (stacked on small screens, a second column on wide ones), never absolute', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><CalendarioAcademico /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /Nuevo evento/ }))
    const form = document.getElementById('calendar-event-form') as HTMLElement
    const preview = screen.getByRole('complementary', { name: 'Previsualización' })
    expect(form.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy() // debajo del formulario
    expect(form.contains(preview)).toBe(false)
    expect(preview.className.split(/\s+/)).not.toEqual(expect.arrayContaining(['absolute']))
    expect(preview.className.split(/\s+/)).not.toContain('fixed')
    expect(preview.className).toContain('lg:sticky')
    expect(preview.parentElement?.className).toContain('lg:grid-cols-')
    expect(preview.parentElement?.className).not.toMatch(/(^|\s)grid-cols-/) // una sola columna por defecto
    expect(within(preview).getByText('Así lo verá el estudiante')).toBeInTheDocument()
  })

  it('locks the page scroll while open, restores it on close, closes with Escape and keeps focus inside', async () => {
    const user = userEvent.setup()
    document.body.style.overflow = ''
    render(<MemoryRouter><CalendarioAcademico /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /Nuevo evento/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo evento' })
    expect(document.body.style.overflow).toBe('hidden')
    expect(dialog.contains(document.activeElement)).toBe(true)

    for (let i = 0; i < 80; i++) await user.tab() // recorre todo el formulario: el foco nunca sale
    expect(dialog.contains(document.activeElement)).toBe(true)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('the footer actions work (submit from outside the scrolling body) and typed data survives a window resize', async () => {
    const user = userEvent.setup()
    vi.mocked(calendarAdminApi.create).mockResolvedValue(adminEvent())
    render(<MemoryRouter><CalendarioAcademico /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /Nuevo evento/ }))
    await user.type(screen.getByLabelText('Título'), 'Cierre de postulaciones')
    await user.selectOptions(screen.getByLabelText('Tipo de proceso'), 't1')

    window.innerWidth = 360
    window.innerHeight = 500
    window.dispatchEvent(new Event('resize'))
    expect(screen.getByLabelText('Título')).toHaveValue('Cierre de postulaciones')

    await user.click(screen.getByRole('button', { name: 'Guardar como borrador' }))
    await waitFor(() => expect(calendarAdminApi.create).toHaveBeenCalledTimes(1))
    expect(vi.mocked(calendarAdminApi.create).mock.calls[0][1]).toMatchObject({ title: 'Cierre de postulaciones', event_type_id: 't1' })

    await user.click(await screen.findByRole('button', { name: /Nuevo evento/ }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('form rules: official needs confirmed dates, confirmed needs a start, end cannot precede start', () => {
    const base: EventForm = { title: 'Evento', description: '', event_type_id: 't1', academic_period_id: '', modality_ids: [], allDay: true, datesConfirmed: false, dateKind: 'tentativa', start: '', end: '', dateNote: '' }
    expect(validateForm(base)).toEqual({})
    expect(validateForm({ ...base, dateKind: 'oficial' }).kind).toBeTruthy()
    expect(validateForm({ ...base, datesConfirmed: true }).start).toBeTruthy()
    expect(validateForm({ ...base, datesConfirmed: true, start: '2099-03-10', end: '2099-03-09' }).end).toBeTruthy()
    expect(toInput({ ...base, datesConfirmed: true, start: '2099-03-10', end: '2099-03-12' })).toMatchObject({ starts_at: '2099-03-10T00:00:00-05:00', ends_at: '2099-03-12T00:00:00-05:00' })
    expect(toInput({ ...base, start: '2099-03-10' }).starts_at).toBeNull()
  })
})

