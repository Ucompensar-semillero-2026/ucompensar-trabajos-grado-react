import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationBell } from './NotificationBell'
import { NOTIFICATIONS_POLL_MS } from '@/hooks/useNotificationFeed'
import { notificationsApi, type NotificationOut } from '@/services/notifications.service'
import { useAppStore } from '@/stores/app.store'
import { timeAgo } from '@/utils/format'

vi.mock('@/services/notifications.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/notifications.service')>()),
  notificationsApi: { summary: vi.fn(), listMine: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), listForProcess: vi.fn() },
}))

const api = vi.mocked(notificationsApi)

const n = (id: string, o: Partial<NotificationOut> = {}): NotificationOut => ({
  public_id: id, subject: `Aviso ${id}`, body: `Detalle ${id}`, sent: true, sent_at: null, send_error: null,
  created_at: new Date(Date.now() - 2 * 3600_000).toISOString().replace('Z', ''), read_at: null, link: '/documentos', category: 'general', ...o,
})

function renderBell() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="*" element={<NotificationBell className="btn" />} />
      </Routes>
      <Routes>
        <Route path="/documentos" element={<p>Pantalla Mis tareas</p>} />
        <Route path="/notificaciones" element={<p>Pantalla Notificaciones</p>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAppStore.setState({ accessToken: 'token' })
  api.markRead.mockResolvedValue(n('x'))
  api.markAllRead.mockResolvedValue({ marked: 2 })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
  useAppStore.setState({ accessToken: null })
})

describe('campana', () => {
  it('muestra cuántas no leídas hay', async () => {
    api.summary.mockResolvedValue({ unread: 3, latest_unread: [n('a'), n('b'), n('c')] })
    renderBell()

    expect(await screen.findByRole('button', { name: 'Notificaciones: 3 sin leer' })).toHaveTextContent('3')
  })

  it('el panel lista los avisos y al abrir uno lo marca leído y lleva a su pantalla', async () => {
    // Después de marcarla, el servidor ya responde 0 sin leer.
    api.summary.mockResolvedValueOnce({ unread: 1, latest_unread: [n('a')] }).mockResolvedValue({ unread: 0, latest_unread: [] })
    api.listMine.mockResolvedValue([n('a', { category: 'alerta', subject: 'Tarea por vencer' }), n('b', { read_at: '2026-11-07T10:00:00' })])
    renderBell()

    fireEvent.click(await screen.findByRole('button', { name: 'Notificaciones: 1 sin leer' }))
    expect(api.listMine).toHaveBeenCalledWith('token', 10)
    fireEvent.click(await screen.findByText('Tarea por vencer'))

    expect(api.markRead).toHaveBeenCalledWith('token', 'a')
    expect(await screen.findByText('Pantalla Mis tareas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument()
  })

  it('«Marcar todo como leído» deja la campana en cero', async () => {
    api.summary.mockResolvedValueOnce({ unread: 2, latest_unread: [n('a'), n('b')] }).mockResolvedValue({ unread: 0, latest_unread: [] })
    api.listMine.mockResolvedValue([n('a'), n('b')])
    renderBell()

    fireEvent.click(await screen.findByRole('button', { name: 'Notificaciones: 2 sin leer' }))
    fireEvent.click(await screen.findByRole('button', { name: /Marcar todo como leído/ }))

    expect(api.markAllRead).toHaveBeenCalledWith('token')
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument()
  })

  it('sin avisos lo dice', async () => {
    api.summary.mockResolvedValue({ unread: 0, latest_unread: [] })
    api.listMine.mockResolvedValue([])
    renderBell()

    fireEvent.click(await screen.findByRole('button', { name: 'Notificaciones' }))
    expect(await screen.findByText('No tienes notificaciones.')).toBeInTheDocument()
  })
})

describe('aviso emergente', () => {
  it('aparece solo para avisos que llegan después de entrar, y se va solo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.summary
      .mockResolvedValueOnce({ unread: 1, latest_unread: [n('viejo')] })
      .mockResolvedValue({ unread: 2, latest_unread: [n('nuevo', { subject: 'Entrega revisada' }), n('viejo')] })
    renderBell()
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Aviso viejo')).not.toBeInTheDocument()

    await act(async () => void vi.advanceTimersByTime(NOTIFICATIONS_POLL_MS))

    expect(await screen.findByText('Entrega revisada')).toBeInTheDocument()
    expect(screen.queryByText('Aviso viejo')).not.toBeInTheDocument()
    await act(async () => void vi.advanceTimersByTime(8000))
    expect(screen.queryByText('Entrega revisada')).not.toBeInTheDocument()
  })

  it('sin sesión no consulta nada', () => {
    useAppStore.setState({ accessToken: null })
    renderBell()
    expect(api.summary).not.toHaveBeenCalled()
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-11-08T15:00:00Z')
  it.each([
    ['2026-11-08T14:59:40', 'ahora'],
    ['2026-11-08T14:55:00', 'hace 5 min'],
    ['2026-11-08T13:00:00', 'hace 2 h'],
    ['2026-11-07T12:00:00', 'ayer'],
    ['2026-11-05T15:00:00', 'hace 3 d'],
  ])('%s → %s', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected)
  })
})
