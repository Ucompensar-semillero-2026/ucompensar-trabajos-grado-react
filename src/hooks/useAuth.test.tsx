import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { useAuth } from './useAuth'

vi.mock('@/services/auth.service', () => ({
  authApi: { login: vi.fn(), me: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
}))

import { authApi } from '@/services/auth.service'

const backendUser = {
  public_id: 'student-public-id',
  full_name: 'Estudiante de Prueba',
  email: 'estudiante@ucompensar.edu.co',
  role: { name: 'estudiante' },
}

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/proyectos-de-grado']}>{children}</MemoryRouter>
}

function renderAuth() {
  return renderHook(() => ({ auth: useAuth(), path: useLocation().pathname }), { wrapper })
}

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(authApi.login).mockResolvedValue({ access_token: 'token', token_type: 'bearer' })
    vi.mocked(authApi.me).mockResolvedValue(backendUser as never)
    vi.mocked(authApi.logout).mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    localStorage.clear()
    useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
  })

  it('normal login keeps the session and navigates to the dashboard', async () => {
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))

    await act(async () => { await result.current.auth.loginWithCredentials('a@b.co', 'x') })

    expect(result.current.path).toBe('/dashboard')
    expect(useAppStore.getState().isAuthenticated).toBe(true)
    expect(localStorage.getItem('ucomp_has_session')).toBe('true')
  })

  it('login with redirectToDashboard:false authenticates without navigating', async () => {
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))

    let user: unknown
    await act(async () => { user = await result.current.auth.loginWithCredentials('a@b.co', 'x', { redirectToDashboard: false }) })

    expect(user).toMatchObject({ id: 'student-public-id' })
    expect(result.current.path).toBe('/proyectos-de-grado')
  })

  it('endSession invalidates the server session, clears memory and the local flag, without navigating', async () => {
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))
    await act(async () => { await result.current.auth.loginWithCredentials('a@b.co', 'x', { redirectToDashboard: false }) })

    let error: string | null = 'pending'
    await act(async () => { error = await result.current.auth.endSession() })

    expect(error).toBeNull()
    expect(authApi.logout).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState()).toMatchObject({ isAuthenticated: false, currentUser: null, accessToken: null })
    expect(localStorage.getItem('ucomp_has_session')).toBeNull()
    expect(result.current.path).toBe('/proyectos-de-grado')
  })

  it('endSession keeps the local session and reports the error when the server logout fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValueOnce(new ApiError(500, 'Error del servidor'))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))
    await act(async () => { await result.current.auth.loginWithCredentials('a@b.co', 'x', { redirectToDashboard: false }) })

    let error: string | null = null
    await act(async () => { error = await result.current.auth.endSession() })

    expect(error).toBe('Error del servidor')
    expect(useAppStore.getState().isAuthenticated).toBe(true)
    expect(localStorage.getItem('ucomp_has_session')).toBe('true')
  })
})
