import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'
import { useAuth } from './useAuth'

vi.mock('@/services/auth.service', () => ({
  authApi: { microsoftLogin: vi.fn(), me: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
}))

vi.mock('@/config/msal', () => ({
  isMicrosoftLoginConfigured: true,
  loginRequest: { scopes: ['openid', 'profile', 'email'], prompt: 'login' },
  msalInstance: {
    loginRedirect: vi.fn(async () => {}),
    logoutRedirect: vi.fn(async () => {}),
    getActiveAccount: vi.fn(() => null),
    getAllAccounts: vi.fn(() => []),
  },
  clearMicrosoftSession: vi.fn(async () => {}),
  getMsalRedirectOutcome: () => ({ result: null, errorCode: null, errorMessage: null }),
}))

import { authApi } from '@/services/auth.service'
import { clearMicrosoftSession, msalInstance } from '@/config/msal'

const student: User = {
  id: 'student-public-id',
  name: 'Estudiante de Prueba',
  initials: 'EP',
  email: 'estudiante1@ucompensar.edu.co',
  role: 'estudiante',
  institutionalRoles: ['Estudiante'],
  authMethod: 'sso',
}

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/proyectos-de-grado']}>{children}</MemoryRouter>
}

function renderAuth() {
  return renderHook(() => ({ auth: useAuth(), path: useLocation().pathname }), { wrapper })
}

function signIn() {
  localStorage.setItem('ucomp_has_session', 'true')
  useAppStore.getState().loginSuccess(student, 'token')
}

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(authApi.logout).mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    localStorage.clear()
    useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
  })

  it('loginWithMicrosoft redirects to Microsoft carrying the internal return path', async () => {
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))

    await act(async () => { await result.current.auth.loginWithMicrosoft('/proyectos-de-grado/oferta-1?postular=1') })

    expect(msalInstance.loginRedirect).toHaveBeenCalledWith(expect.objectContaining({ state: '/proyectos-de-grado/oferta-1?postular=1' }))
  })

  it.each(['https://evil.example', '//evil.example', '/\\evil.example'])('ignores an external return path (%s)', async (returnTo) => {
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))

    await act(async () => { await result.current.auth.loginWithMicrosoft(returnTo) })

    expect(msalInstance.loginRedirect).toHaveBeenCalledWith(expect.objectContaining({ state: undefined }))
  })

  it('endSession invalidates the server session, clears memory, the local flag and the Microsoft cache, without navigating', async () => {
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))
    act(() => signIn())

    let error: string | null = 'pending'
    await act(async () => { error = await result.current.auth.endSession() })

    expect(error).toBeNull()
    expect(authApi.logout).toHaveBeenCalledTimes(1)
    expect(clearMicrosoftSession).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState()).toMatchObject({ isAuthenticated: false, currentUser: null, accessToken: null })
    expect(localStorage.getItem('ucomp_has_session')).toBeNull()
    expect(result.current.path).toBe('/proyectos-de-grado')
  })

  it('endSession keeps the local session and reports the error when the server logout fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValueOnce(new ApiError(500, 'Error del servidor'))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))
    act(() => signIn())

    let error: string | null = null
    await act(async () => { error = await result.current.auth.endSession() })

    expect(error).toBe('Error del servidor')
    expect(useAppStore.getState().isAuthenticated).toBe(true)
    expect(localStorage.getItem('ucomp_has_session')).toBe('true')
  })

  it('logout (manual) clears the session and goes to the logout confirmation', async () => {
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))
    act(() => signIn())

    act(() => result.current.auth.logout())

    expect(result.current.path).toBe('/sesion-cerrada')
    expect(useAppStore.getState().isAuthenticated).toBe(false)
    expect(clearMicrosoftSession).toHaveBeenCalledTimes(1)
  })
})
