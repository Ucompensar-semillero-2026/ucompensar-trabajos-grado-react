import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIdleLogout } from './useIdleLogout'
import { IdleWarningDialog } from '@/components/auth/IdleWarningDialog'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { resetActivityReports } from '@/services/activity'
import { resetIdleClock, setIdleTimeoutMinutes } from '@/services/idleClock'
import { authHeaders, request } from '@/services/http'
import { markIdleLogout, peekIdleLogout } from '@/services/sessionFlash'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'

const MIN = 60_000

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

function mockServer(activityStatus = 204, detail = '') {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    activityStatus === 204 ? ({ ok: true, status: 204, json: async () => null } as Response) : json(activityStatus, { detail }),
  )
}

const activityCalls = (fetch: ReturnType<typeof mockServer>) =>
  fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/activity'))

beforeEach(() => {
  vi.useFakeTimers()
  resetIdleClock()
  resetActivityReports()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe('useIdleLogout', () => {
  it('cierra la sesión a los 15 minutos sin tocar nada, avisando 2 minutos antes', () => {
    mockServer()
    const onTimeout = vi.fn()
    const { result } = renderHook(() => useIdleLogout(true, onTimeout))

    act(() => void vi.advanceTimersByTime(12 * MIN + 59_000))
    expect(result.current.secondsLeft).toBeNull()

    act(() => void vi.advanceTimersByTime(2_000))
    expect(result.current.secondsLeft).toBe(119)
    expect(onTimeout).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(2 * MIN))
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('cualquier interacción vuelve el contador a cero', () => {
    mockServer()
    const onTimeout = vi.fn()
    renderHook(() => useIdleLogout(true, onTimeout))

    act(() => void vi.advanceTimersByTime(10 * MIN))
    fireEvent.keyDown(window, { key: 'a' })
    act(() => void vi.advanceTimersByTime(10 * MIN))
    fireEvent.pointerMove(window)
    act(() => void vi.advanceTimersByTime(10 * MIN))

    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('con el aviso en pantalla mover el mouse no basta; «Seguir conectado» sí', () => {
    mockServer()
    const onTimeout = vi.fn()
    const { result } = renderHook(() => useIdleLogout(true, onTimeout))

    act(() => void vi.advanceTimersByTime(14 * MIN))
    expect(result.current.secondsLeft).not.toBeNull()
    fireEvent.pointerMove(window)
    act(() => void vi.advanceTimersByTime(1_000))
    expect(result.current.secondsLeft).not.toBeNull()

    act(() => result.current.stayConnected())
    expect(result.current.secondsLeft).toBeNull()
    act(() => void vi.advanceTimersByTime(12 * MIN))
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('usa el tiempo que manda el servidor', () => {
    mockServer()
    setIdleTimeoutMinutes(30)
    const onTimeout = vi.fn()
    renderHook(() => useIdleLogout(true, onTimeout))

    act(() => void vi.advanceTimersByTime(20 * MIN))
    expect(onTimeout).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(10 * MIN + 1_000))
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('la actividad en otra pestaña también cuenta', () => {
    mockServer()
    const onTimeout = vi.fn()
    renderHook(() => useIdleLogout(true, onTimeout))

    act(() => void vi.advanceTimersByTime(14 * MIN))
    localStorage.setItem('ucomp_last_activity', String(Date.now()))
    act(() => void vi.advanceTimersByTime(5 * MIN))

    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('sin sesión no cuenta nada', () => {
    const fetch = mockServer()
    const onTimeout = vi.fn()
    renderHook(() => useIdleLogout(false, onTimeout))

    act(() => void vi.advanceTimersByTime(60 * MIN))
    expect(onTimeout).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('aviso de actividad al servidor', () => {
  it('avisa como mucho una vez por minuto, y al final del minuto si hubo actividad', async () => {
    const fetch = mockServer()
    renderHook(() => useIdleLogout(true, vi.fn()))
    expect(activityCalls(fetch)).toHaveLength(1) // al entrar

    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(window, { key: 'a' })
      await act(async () => void vi.advanceTimersByTime(2_000))
    }
    // 40 segundos de actividad continua: ningún aviso extra todavía.
    expect(activityCalls(fetch)).toHaveLength(1)

    await act(async () => void vi.advanceTimersByTime(21_000))
    expect(activityCalls(fetch)).toHaveLength(2)
  })

  it('sin actividad no avisa: las consultas automáticas no mantienen viva la sesión', async () => {
    const fetch = mockServer()
    renderHook(() => useIdleLogout(true, vi.fn()))

    await act(async () => void vi.advanceTimersByTime(10 * MIN))
    expect(activityCalls(fetch)).toHaveLength(1)
  })

  it('si el servidor ya la cerró por inactividad, la página también la cierra', async () => {
    mockServer(401, 'Tu sesión se cerró por inactividad')
    const onTimeout = vi.fn()
    renderHook(() => useIdleLogout(true, onTimeout))

    await act(async () => void vi.advanceTimersByTime(0))
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })
})

describe('IdleWarningDialog', () => {
  it('muestra la cuenta regresiva y deja seguir o salir', () => {
    const onStay = vi.fn()
    const onLogout = vi.fn()
    render(<IdleWarningDialog secondsLeft={95} onStay={onStay} onLogout={onLogout} />)

    expect(screen.getByRole('alertdialog', { name: '¿Sigues ahí?' })).toBeInTheDocument()
    expect(screen.getByText('1:35')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seguir conectado' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Seguir conectado' }))
    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
    expect(onStay).toHaveBeenCalledTimes(1)
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('sin aviso no pinta nada', () => {
    render(<IdleWarningDialog secondsLeft={null} onStay={vi.fn()} onLogout={vi.fn()} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('mensaje en el inicio de sesión', () => {
  it('explica que la sesión se cerró por inactividad, una sola vez', () => {
    markIdleLogout(15)
    const { unmount } = render(<LoginScreen onMicrosoftLogin={vi.fn()} />)

    expect(screen.getByText('Cerramos tu sesión por inactividad')).toBeInTheDocument()
    expect(screen.getByText(/Pasaron 15 minutos sin actividad/)).toBeInTheDocument()
    unmount()

    render(<LoginScreen onMicrosoftLogin={vi.fn()} />)
    expect(screen.queryByText('Cerramos tu sesión por inactividad')).not.toBeInTheDocument()
  })

  it('si una llamada descubre que el servidor la cerró por inactividad, el login lo explica', async () => {
    vi.useRealTimers()
    useAppStore.getState().loginSuccess({ id: 'u1', name: 'Ana' } as unknown as User, 'old-token')
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { detail: 'Credenciales inválidas o expiradas' }))
      .mockResolvedValueOnce(json(401, { detail: 'Tu sesión se cerró por inactividad' }))

    await expect(request('/processes', { headers: authHeaders('old-token') })).rejects.toMatchObject({ status: 401 })

    expect(useAppStore.getState().isAuthenticated).toBe(false)
    expect(peekIdleLogout()).toEqual({ minutes: 15 })
  })
})
