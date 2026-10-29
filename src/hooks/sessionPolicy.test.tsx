import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'
import { routeArea } from '@/config/sessionPolicy'
import { clearFlash, peekFlash, type PublicFlash } from '@/services/sessionFlash'

vi.mock('@/services/auth.service', () => ({
  authApi: { microsoftLogin: vi.fn(), me: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
}))

const account = { homeAccountId: 'h', username: 'ana@ucompensar.edu.co' }
const msal = vi.hoisted(() => ({
  state: { account: null as unknown },
}))
vi.mock('@/config/msal', () => ({
  isMicrosoftLoginConfigured: true,
  loginRequest: { scopes: ['openid'], prompt: 'login' },
  msalInstance: {
    loginRedirect: vi.fn(async () => {}),
    logoutRedirect: vi.fn(async () => {}),
    logoutPopup: vi.fn(async () => {}),
    getActiveAccount: vi.fn(() => msal.state.account),
    getAllAccounts: vi.fn(() => (msal.state.account ? [msal.state.account] : [])),
  },
  clearMicrosoftSession: vi.fn(async () => {}),
  getMsalRedirectOutcome: () => ({ result: null, errorCode: null, errorMessage: null }),
}))

import { authApi } from '@/services/auth.service'
import { clearMicrosoftSession, msalInstance } from '@/config/msal'
import { useAuth } from './useAuth'
import { useSessionExitPolicy } from './useSessionExitPolicy'
import { PublicFlashNotice } from '@/components/publico/PublicFlashNotice'

const user = (role: string, institutionalRoles: User['institutionalRoles']): User => ({
  id: `${role}-id`, name: 'Persona de Prueba', initials: 'PP', email: `${role}@ucompensar.edu.co`, role, institutionalRoles, authMethod: 'sso',
})
const student = user('estudiante', ['Estudiante'])
const flash: PublicFlash = { kind: 'proposal', code: 'PROP-2026-AAA', title: 'Detección de fallas' }

// El indicador local de sesión solo lo usa la restauración al arrancar (F5); aquí se pone después de montar.
const signIn = (u: User = student) => {
  useAppStore.getState().loginSuccess(u, 'token')
}

/** Réplica mínima de App: el hook de auth + la política de salida + enlaces entre rutas. */
function Harness() {
  const { leavePortal, isRestoringSession } = useAuth()
  useSessionExitPolicy(leavePortal, isRestoringSession)
  const { pathname } = useLocation()
  return (
    <>
      <p data-testid="path">{pathname}</p>
      <Link to="/documentos">a documentos</Link>
      <Link to="/dashboard">a dashboard</Link>
      <Link to="/">a portada</Link>
      <Link to="/proyectos-de-grado">a catálogo</Link>
      <Link to="/proyectos-de-grado/oferta-1">a oferta</Link>
      <Link to="/login">a login</Link>
    </>
  )
}
const renderHarness = (initial: string) =>
  render(<MemoryRouter initialEntries={[initial]}><Routes><Route path="*" element={<Harness />} /></Routes></MemoryRouter>)

/** Ninguna salida de MSAL hacia las pantallas de Microsoft («Cerró la sesión de su cuenta…»). */
const expectNoMicrosoftLogoutScreens = () => {
  expect(msalInstance.logoutRedirect).not.toHaveBeenCalled()
  expect(msalInstance.logoutPopup).not.toHaveBeenCalled()
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  msal.state.account = null
  vi.mocked(authApi.logout).mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  clearFlash()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('clasificación de rutas', () => {
  it('separates the portal from the public site and ignores login and unknown routes', () => {
    for (const p of ['/dashboard', '/documentos', '/tramites', '/mi-proceso', '/tutor/proyectos/1', '/coordinacion/portafolio', '/mis-propuestas', '/reportes']) expect(routeArea(p)).toBe('protected')
    for (const p of ['/', '/proyectos-de-grado', '/proyectos-de-grado/modalidad/x', '/proyectos-de-grado/oferta-1']) expect(routeArea(p)).toBe('public')
    for (const p of ['/login', '/sin-acceso', '/ruta-rota', '/dashboardx']) expect(routeArea(p)).toBe('neutral')
  })
})

describe('salida del portal', () => {
  it('keeps the session when moving between protected modules and when reloading a protected route', async () => {
    const u = userEvent.setup()
    signIn()
    renderHarness('/dashboard')
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/dashboard'))

    await u.click(screen.getByText('a documentos'))
    await u.click(screen.getByText('a dashboard'))

    expect(screen.getByTestId('path')).toHaveTextContent('/dashboard')
    expect(authApi.logout).not.toHaveBeenCalled()
    expectNoMicrosoftLogoutScreens()
    expect(useAppStore.getState().isAuthenticated).toBe(true)
  })

  it.each([['a portada', '/'], ['a catálogo', '/proyectos-de-grado'], ['a oferta', '/proyectos-de-grado/oferta-1']])(
    'leaving the portal for the public site (%s) clears the session silently and stays on that page',
    async (linkText, destination) => {
      const u = userEvent.setup()
      msal.state.account = account
      signIn()
      renderHarness('/dashboard')
      await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/dashboard'))
      localStorage.setItem('ucomp_has_session', 'true')

      await u.click(screen.getByText(linkText))

      await waitFor(() => expect(useAppStore.getState().isAuthenticated).toBe(false))
      expect(authApi.logout).toHaveBeenCalledTimes(1)
      expect(clearMicrosoftSession).toHaveBeenCalledTimes(1) // caché y cuenta activa de MSAL
      expectNoMicrosoftLogoutScreens()
      expect(useAppStore.getState()).toMatchObject({ currentUser: null, accessToken: null })
      expect(localStorage.getItem('ucomp_has_session')).toBeNull()
      expect(screen.getByTestId('path')).toHaveTextContent(destination)
      expect(peekFlash()).toBeNull()
    }
  )

  it('shows no logout message of any kind when leaving the portal automatically', async () => {
    const u = userEvent.setup()
    signIn()
    renderHarness('/dashboard')
    await u.click(screen.getByText('a portada'))
    await waitFor(() => expect(useAppStore.getState().isAuthenticated).toBe(false))
    expect(screen.queryByText(/sesión se cerró|cerrado sesión|cerrando/i)).not.toBeInTheDocument()
    expect(peekFlash()).toBeNull() // un cierre automático no deja marcas de confirmación
  })

  it('works the same without an active Microsoft account', async () => {
    const u = userEvent.setup()
    signIn()
    renderHarness('/dashboard')
    await u.click(screen.getByText('a catálogo'))

    await waitFor(() => expect(useAppStore.getState().isAuthenticated).toBe(false))
    expectNoMicrosoftLogoutScreens()
    expect(screen.getByTestId('path')).toHaveTextContent('/proyectos-de-grado')
    expect(authApi.logout).toHaveBeenCalledTimes(1)
  })

  it('does not log out when a public page is just mounted or when a signed-in user moves between public pages', async () => {
    const u = userEvent.setup()
    signIn()
    renderHarness('/proyectos-de-grado')
    await u.click(screen.getByText('a portada'))
    await u.click(screen.getByText('a oferta'))

    expect(authApi.logout).not.toHaveBeenCalled()
    expect(useAppStore.getState().isAuthenticated).toBe(true)
  })

  it('ignores the login screen and avoids loops: a single logout per exit, never a Microsoft redirect', async () => {
    const u = userEvent.setup()
    msal.state.account = account
    signIn()
    renderHarness('/dashboard')
    await u.click(screen.getByText('a login')) // neutral: no cuenta como salida
    expect(authApi.logout).not.toHaveBeenCalled()

    await u.click(screen.getByText('a portada'))
    await waitFor(() => expect(authApi.logout).toHaveBeenCalledTimes(1))
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(authApi.logout).toHaveBeenCalledTimes(1)
    expectNoMicrosoftLogoutScreens()
  })

  it('manual logout reuses the same mechanism, avoids the Microsoft screens and a double click makes a single logout', async () => {
    msal.state.account = account
    signIn()
    const Page = () => { const { logout } = useAuth(); return <><button onClick={() => { logout(); logout() }}>salir</button><p data-testid="p">{useLocation().pathname}</p></> }
    const u = userEvent.setup()
    render(<MemoryRouter initialEntries={['/dashboard']}><Page /></MemoryRouter>)

    await u.click(screen.getByText('salir'))

    await waitFor(() => expect(screen.getByTestId('p')).toHaveTextContent('/sesion-cerrada'))
    expect(authApi.logout).toHaveBeenCalledTimes(1)
    expect(clearMicrosoftSession).toHaveBeenCalledTimes(1)
    expectNoMicrosoftLogoutScreens()
    expect(peekFlash()).toEqual({ kind: 'manual_logout' })
    expect(useAppStore.getState().isAuthenticated).toBe(false)
  })

  it.each([
    ['estudiante', ['Estudiante']], ['docente', ['Docente']], ['coordinador', ['Coordinador']], ['administrativo', ['Administrador']], ['comite', ['Comité']],
  ] as Array<[string, User['institutionalRoles']]>)('works for the %s role', async (role, roles) => {
    const u = userEvent.setup()
    signIn(user(role, roles))
    renderHarness('/dashboard')
    await u.click(screen.getByText('a documentos'))
    expect(useAppStore.getState().isAuthenticated).toBe(true)
    await u.click(screen.getByText('a portada'))
    await waitFor(() => expect(useAppStore.getState().isAuthenticated).toBe(false))
  })
})

describe('cierre tras una operación pública', () => {
  const setup = () => {
    msal.state.account = account
    signIn()
    const Page = () => {
      const { endSession } = useAuth()
      return (
        <>
          <button onClick={() => void endSession({ reason: 'proposal_success', returnTo: '/proyectos-de-grado', flash })}>cerrar</button>
          <p data-testid="p">{useLocation().pathname}</p>
          <PublicFlashNotice />
        </>
      )
    }
    return render(<MemoryRouter initialEntries={['/proyectos-de-grado/oferta-1']}><Page /></MemoryRouter>)
  }

  it('closes the local session after the backend confirmed, with no Microsoft logout screens and the confirmation shown directly', async () => {
    const u = userEvent.setup()
    setup()
    await u.click(screen.getByText('cerrar'))

    expect(await screen.findByText('Recibimos tu propuesta')).toBeInTheDocument()
    expect(screen.getByTestId('p')).toHaveTextContent('/proyectos-de-grado')
    expect(useAppStore.getState().isAuthenticated).toBe(false)
    expect(clearMicrosoftSession).toHaveBeenCalledTimes(1)
    expectNoMicrosoftLogoutScreens()
    expect(screen.queryByText(/sesión se cerró|cerrado sesión|iniciar sesión de nuevo/i)).not.toBeInTheDocument()
    expect(JSON.stringify(flash)).not.toMatch(/token|password|contraseña/i)
  })

  it('keeps the session and shows no confirmation when the server cannot confirm the logout', async () => {
    vi.mocked(authApi.logout).mockRejectedValueOnce(new ApiError(500, 'Error del servidor'))
    msal.state.account = account
    signIn()
    let error: string | null = null
    const Page = () => { const { endSession } = useAuth(); return <button onClick={() => void endSession({ reason: 'proposal_success', returnTo: '/proyectos-de-grado', flash }).then((m) => { error = m })}>cerrar</button> }
    const u = userEvent.setup()
    render(<MemoryRouter><Page /></MemoryRouter>)
    await u.click(screen.getByText('cerrar'))

    await waitFor(() => expect(error).toBe('Error del servidor'))
    expectNoMicrosoftLogoutScreens()
    expect(useAppStore.getState().isAuthenticated).toBe(true)
    expect(peekFlash()).toBeNull()
  })

  it('consumes the confirmation once: dismissing or reloading never shows it (or repeats the operation) again', async () => {
    const u = userEvent.setup()
    const first = setup()
    await u.click(screen.getByText('cerrar'))
    expect(await screen.findByText('Recibimos tu propuesta')).toBeInTheDocument()
    expect(peekFlash()).toBeNull() // ya consumida

    await u.click(screen.getByRole('button', { name: /Volver al catálogo/ }))
    expect(screen.queryByText('Recibimos tu propuesta')).not.toBeInTheDocument()

    first.unmount()
    render(<MemoryRouter initialEntries={['/proyectos-de-grado']}><PublicFlashNotice /></MemoryRouter>) // «recarga»
    expect(screen.queryByText('Recibimos tu propuesta')).not.toBeInTheDocument()
    expect(authApi.logout).toHaveBeenCalledTimes(1)
  })
})

describe('inicio de sesión interactivo', () => {
  it('asks Microsoft for an interactive login (prompt: login) with the same MSAL instance', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter> })
    await waitFor(() => expect(result.current.isRestoringSession).toBe(false))
    await act(async () => { await result.current.loginWithMicrosoft('/proyectos-de-grado#proponer-idea') })
    expect(msalInstance.loginRedirect).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'login', state: '/proyectos-de-grado#proponer-idea' }))
  })

  it('the real MSAL config requests prompt "login" and keeps the registered origin as post-logout URI', async () => {
    vi.resetModules()
    vi.doUnmock('@/config/msal')
    vi.stubEnv('VITE_AZURE_CLIENT_ID', '11111111-1111-1111-1111-111111111111')
    vi.stubEnv('VITE_AZURE_TENANT_ID', '22222222-2222-2222-2222-222222222222')
    const real = await import('@/config/msal')
    expect(real.loginRequest.prompt).toBe('login')
    expect(real.msalInstance.getConfiguration().auth.postLogoutRedirectUri).toBe(window.location.origin)
    vi.unstubAllEnvs()
  })
})
