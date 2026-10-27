import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthFlowContext } from '@/components/auth/AuthFlowContext'
import { ApiError } from '@/services/http'
import type { User } from '@/types'
import { useAppStore } from '@/stores/app.store'
import { OpportunityDetailDialog } from './OpportunityDetailDialog'
import { modalityGuidance } from './modalityGuidance.data'
import { projectModalities, projectOffers } from './projectCatalog.data'

vi.mock('@/services/modalities.service', () => ({ modalitiesApi: { list: vi.fn() } }))
vi.mock('@/services/processes.service', () => ({ processesApi: { list: vi.fn(), create: vi.fn() } }))

import { applicationsService } from '@/services/applications.service'
import { modalitiesApi } from '@/services/modalities.service'
import { processesApi } from '@/services/processes.service'

const student: User = {
  id: 'student-public-id',
  name: 'Estudiante de prueba',
  initials: 'EP',
  email: 'estudiante@ucompensar.edu.co',
  role: 'estudiante',
}

const offer = projectOffers.find((item) => item.status === 'Disponible' && !applicationsService.isAtCapacity(item))!
const modality = projectModalities.find((item) => item.id === offer.modalityId)!
const guidance = modalityGuidance[modality.id]

const createdProcess = {
  public_id: 'process-public-id',
  process_code: 'PROYECTO_INV-2026-ABC123',
  student: { public_id: student.id },
  modality: { public_id: 'modality-public-id', code: offer.modalityId, name: modality.name },
  state: { public_id: 'state-id', code: 'RADICADO', name: 'Radicado' },
  academic_semester: '2026-1',
  created_at: '2026-03-01T10:00:00',
  updated_at: null,
  closed_at: null,
  observations: null,
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}

function renderDialog(currentUser: User | null, options: { loginResult?: User | null; loginError?: string | null; endSessionResult?: string | null } = {}) {
  const { loginResult = student, loginError = null, endSessionResult = null } = options
  useAppStore.setState({ currentUser, isAuthenticated: Boolean(currentUser), accessToken: currentUser ? 'session-access-token' : null })
  const loginWithCredentials = vi.fn(async () => {
    if (loginResult) useAppStore.setState({ currentUser: loginResult, isAuthenticated: true, accessToken: 'login-access-token' })
    return loginResult
  })
  const endSession = vi.fn(async () => endSessionResult)
  render(
    <MemoryRouter initialEntries={['/proyectos-de-grado']}>
      <AuthFlowContext.Provider value={{ loginWithCredentials, endSession, isLoggingIn: false, loginError }}>
        <LocationProbe />
        <OpportunityDetailDialog offer={offer} modality={modality} guidance={guidance} onClose={vi.fn()} />
      </AuthFlowContext.Provider>
    </MemoryRouter>,
  )
  return { loginWithCredentials, endSession }
}

const confirmationHeading = () => screen.queryByRole('heading', { name: `¡Te postulaste a ${offer.title}!`, level: 3 })

async function loginAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /postularme/i }))
  await user.type(screen.getByLabelText('Usuario o correo'), student.email)
  await user.type(screen.getByPlaceholderText('••••••••'), 'clave-valida')
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

describe('OpportunityDetailDialog application flow', () => {
  beforeEach(() => {
    vi.mocked(modalitiesApi.list).mockResolvedValue([{ public_id: 'modality-public-id', code: offer.modalityId, name: modality.name }])
    vi.mocked(processesApi.list).mockResolvedValue([])
    vi.mocked(processesApi.create).mockResolvedValue(createdProcess as never)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
  })

  it('opens the login inside the dialog when there is no session', async () => {
    const user = userEvent.setup()
    renderDialog(null)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(screen.getByRole('heading', { name: 'Inicia sesión', level: 3 })).toBeInTheDocument()
    expect(screen.getByLabelText('Usuario o correo')).toBeInTheDocument()
    expect(processesApi.create).not.toHaveBeenCalled()
  })

  it('keeps the login open and shows the auth error when credentials fail', async () => {
    const user = userEvent.setup()
    const { loginWithCredentials } = renderDialog(null, { loginResult: null, loginError: 'Credenciales inválidas' })

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.type(screen.getByLabelText('Usuario o correo'), student.email)
    await user.type(screen.getByPlaceholderText('••••••••'), 'incorrecta')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => expect(loginWithCredentials).toHaveBeenCalledWith(student.email, 'incorrecta', { redirectToDashboard: false }))
    expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument()
    expect(confirmationHeading()).not.toBeInTheDocument()
    expect(processesApi.create).not.toHaveBeenCalled()
  })

  it('registers the process with the real API and confirms only after the server accepts it', async () => {
    const user = userEvent.setup()
    renderDialog(null)

    await loginAndSubmit(user)

    expect(await screen.findByRole('heading', { name: `¡Te postulaste a ${offer.title}!`, level: 3 })).toBeInTheDocument()
    expect(processesApi.create).toHaveBeenCalledTimes(1)
    const [token, payload] = vi.mocked(processesApi.create).mock.calls[0]
    expect(token).toBe('login-access-token')
    expect(payload).toMatchObject({ modality_public_id: 'modality-public-id' })
    expect(payload.observations).toContain(offer.title)
    expect(payload).not.toHaveProperty('student_id')
    expect(screen.getByText(createdProcess.process_code)).toBeInTheDocument()
    expect(screen.getByText('Radicado')).toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/proyectos-de-grado')
  })

  it('shows the server error, does not confirm, and ends the session opened only for applying', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.create).mockRejectedValueOnce(new ApiError(403, 'No tienes permiso para esta operación'))
    const { endSession } = renderDialog(null)

    await loginAndSubmit(user)

    expect(await screen.findByText('No tienes permiso para esta operación')).toBeInTheDocument()
    expect(confirmationHeading()).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inicia sesión', level: 3 })).toBeInTheDocument()
    expect(endSession).toHaveBeenCalledTimes(1)
  })

  it('does not create a duplicate application for the same offer', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.list).mockResolvedValueOnce([{ ...createdProcess, observations: `Postulación [oferta:${offer.id}]` }] as never)
    renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(await screen.findByText(/ya te postulaste a esta oferta/i)).toBeInTheDocument()
    expect(processesApi.create).not.toHaveBeenCalled()
    expect(confirmationHeading()).not.toBeInTheDocument()
  })

  it('ends the session after registering and keeps the confirmation visible', async () => {
    const user = userEvent.setup()
    const { endSession } = renderDialog(null)

    await loginAndSubmit(user)

    expect(await screen.findByText(/tu sesión se cerró/i)).toBeInTheDocument()
    expect(endSession).toHaveBeenCalledTimes(1)
    expect(confirmationHeading()).toBeInTheDocument()
  })

  it('does not claim the session closed when the server logout fails', async () => {
    const user = userEvent.setup()
    const { endSession } = renderDialog(student, { endSessionResult: 'Error del servidor' })

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    expect(screen.queryByText(/tu sesión se cerró/i)).not.toBeInTheDocument()
    expect(confirmationHeading()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reintentar cierre de sesión/i }))
    expect(endSession).toHaveBeenCalledTimes(2)
  })

  it('applies straight away with an existing session, using its token', async () => {
    const user = userEvent.setup()
    const { loginWithCredentials } = renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(await screen.findByRole('heading', { name: `¡Te postulaste a ${offer.title}!`, level: 3 })).toBeInTheDocument()
    expect(vi.mocked(processesApi.create).mock.calls[0][0]).toBe('session-access-token')
    expect(screen.queryByLabelText('Usuario o correo')).not.toBeInTheDocument()
    expect(loginWithCredentials).not.toHaveBeenCalled()
  })

  it('"Volver al catálogo" navigates to /proyectos-de-grado', async () => {
    const user = userEvent.setup()
    renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.click(await screen.findByRole('button', { name: /volver al catálogo/i }))

    expect(screen.getByTestId('current-path')).toHaveTextContent('/proyectos-de-grado')
  })
})
