import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

// useAuth consume el resultado del redirect de MSAL UNA vez por carga de módulo,
// así que cada prueba importa una copia nueva del hook con su propio resultado.
const backendUser = {
  public_id: 'student-public-id',
  full_name: 'Estudiante de Prueba',
  email: 'estudiante@ucompensar.edu.co',
  role: { name: 'estudiante' },
  institutional_roles: ['Estudiante'],
}

interface Outcome {
  result: { idToken: string; idTokenClaims: { roles: string[] }; state?: string } | null
  errorCode: string | null
  errorMessage: string | null
}

async function loadHook(outcome: Outcome) {
  vi.resetModules()
  const microsoftLogin = vi.fn(async () => ({ access_token: 'api-token', token_type: 'bearer' }))
  const me = vi.fn(async () => backendUser)
  vi.doMock('@/services/auth.service', () => ({
    authApi: { microsoftLogin, me, refresh: vi.fn(), logout: vi.fn(async () => undefined) },
  }))
  vi.doMock('@/config/msal', () => ({
    isMicrosoftLoginConfigured: true,
    loginRequest: { scopes: ['openid'] },
    msalInstance: { loginRedirect: vi.fn(async () => {}), logoutRedirect: vi.fn(async () => {}), getActiveAccount: vi.fn(() => null), getAllAccounts: vi.fn(() => []) },
    clearMicrosoftSession: vi.fn(async () => {}),
    getMsalRedirectOutcome: () => outcome,
  }))
  const { useAuth } = await import('./useAuth')
  const { useAppStore } = await import('@/stores/app.store')
  return { useAuth, useAppStore, microsoftLogin, me }
}

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
}

describe('useAuth: vuelta del redirect de Microsoft', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.doUnmock('@/services/auth.service')
    vi.doUnmock('@/config/msal')
  })

  it('a cancelled login shows the error and neither exchanges tokens nor opens a session', async () => {
    const { useAuth, useAppStore, microsoftLogin } = await loadHook({ result: null, errorCode: 'user_cancelled', errorMessage: 'cancelled' })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isRestoringSession).toBe(false))

    expect(result.current.microsoftError).toBe('Cancelaste el inicio de sesión con Microsoft.')
    expect(microsoftLogin).not.toHaveBeenCalled()
    expect(useAppStore.getState().isAuthenticated).toBe(false)
  })

  it('a successful login exchanges the id_token once and returns to the internal path carried in the state', async () => {
    const returnTo = '/proyectos-de-grado/oferta-1?postular=1'
    const { useAuth, useAppStore, microsoftLogin } = await loadHook({
      result: { idToken: 'ms-id-token', idTokenClaims: { roles: ['Estudiante'] }, state: returnTo },
      errorCode: null,
      errorMessage: null,
    })

    const { result } = renderHook(() => ({ auth: useAuth(), location: useLocation() }), { wrapper })
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))
    await act(async () => {})

    expect(microsoftLogin).toHaveBeenCalledTimes(1)
    expect(microsoftLogin).toHaveBeenCalledWith('ms-id-token')
    expect(useAppStore.getState().isAuthenticated).toBe(true)
    expect(`${result.current.location.pathname}${result.current.location.search}`).toBe(returnTo)
  })

  it('an external return path in the state is ignored', async () => {
    const { useAuth, microsoftLogin } = await loadHook({
      result: { idToken: 'ms-id-token', idTokenClaims: { roles: ['Estudiante'] }, state: '//evil.example' },
      errorCode: null,
      errorMessage: null,
    })

    const { result } = renderHook(() => ({ auth: useAuth(), location: useLocation() }), { wrapper })
    await waitFor(() => expect(result.current.auth.isRestoringSession).toBe(false))
    await act(async () => {})

    expect(microsoftLogin).toHaveBeenCalledTimes(1)
    expect(result.current.location.pathname).not.toContain('evil')
  })

  it('a backend failure after Microsoft succeeded shows the error and registers no session', async () => {
    const { useAuth, useAppStore, microsoftLogin } = await loadHook({
      result: { idToken: 'ms-id-token', idTokenClaims: { roles: ['Estudiante'] }, state: '/proyectos-de-grado/oferta-1?postular=1' },
      errorCode: null,
      errorMessage: null,
    })
    const { ApiError } = await import('@/services/http')
    microsoftLogin.mockRejectedValueOnce(new ApiError(500, 'Error del servidor'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isRestoringSession).toBe(false))

    expect(result.current.microsoftError).toBe('Error del servidor')
    expect(useAppStore.getState().isAuthenticated).toBe(false)
  })
})
