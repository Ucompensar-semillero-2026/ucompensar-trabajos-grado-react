import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthFlowContext } from '@/components/auth/AuthFlowContext'
import { ApiError } from '@/services/http'
import type { User } from '@/types'
import { useAppStore } from '@/stores/app.store'
import { OpportunityDetailDialog } from './OpportunityDetailDialog'
import { applicationReturnPath } from './applicationReturn'
import { ProjectDetail } from './ProjectDetail'
import { modalityGuidance } from './modalityGuidance.data'
import { projectModalities, projectOffers } from './projectCatalog.data'

// El botón de Microsoft solo se habilita con VITE_AZURE_* configurado; en
// las pruebas no debe depender del .env de quien las corra.
vi.mock('@/config/msal', () => ({ isMicrosoftLoginConfigured: true }))
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
  institutionalRoles: ['Estudiante'],
  authMethod: 'sso',
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

const APPLY_LOGIN_KEY = 'ucomp_apply_login_offer'

function renderDialog(currentUser: User | null, options: { loginError?: string | null; endSessionResult?: string | null } = {}) {
  const { loginError = null, endSessionResult = null } = options
  useAppStore.setState({ currentUser, isAuthenticated: Boolean(currentUser), accessToken: currentUser ? 'session-access-token' : null })
  const loginWithMicrosoft = vi.fn(async () => {})
  const endSession = vi.fn(async () => endSessionResult)
  render(
    <MemoryRouter initialEntries={['/proyectos-de-grado']}>
      <AuthFlowContext.Provider value={{ loginWithMicrosoft, endSession, loginError }}>
        <LocationProbe />
        <OpportunityDetailDialog offer={offer} modality={modality} guidance={guidance} onClose={vi.fn()} />
      </AuthFlowContext.Provider>
    </MemoryRouter>,
  )
  return { loginWithMicrosoft, endSession }
}

/** Estado tras volver de Microsoft: sesión activa + marca de "sesión abierta solo para postular". */
function returnedFromMicrosoft() {
  sessionStorage.setItem(APPLY_LOGIN_KEY, offer.id)
}

const confirmationHeading = () => screen.queryByRole('heading', { name: `¡Te postulaste a ${offer.title}!`, level: 3 })

describe('OpportunityDetailDialog application flow', () => {
  beforeEach(() => {
    vi.mocked(modalitiesApi.list).mockResolvedValue([{ public_id: 'modality-public-id', code: offer.modalityId, name: modality.name }])
    vi.mocked(processesApi.list).mockResolvedValue([])
    vi.mocked(processesApi.create).mockResolvedValue(createdProcess as never)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    sessionStorage.clear()
    useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
  })

  it('offers only the Microsoft login inside the dialog when there is no session', async () => {
    const user = userEvent.setup()
    renderDialog(null)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(screen.getByRole('heading', { name: 'Inicia sesión', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar con microsoft/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Usuario o correo')).not.toBeInTheDocument()
    expect(processesApi.create).not.toHaveBeenCalled()
  })

  it('sends the student to Microsoft with a return path to this offer', async () => {
    const user = userEvent.setup()
    const { loginWithMicrosoft } = renderDialog(null)

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.click(screen.getByRole('button', { name: /continuar con microsoft/i }))

    expect(loginWithMicrosoft).toHaveBeenCalledWith(applicationReturnPath(offer.id))
    expect(sessionStorage.getItem(APPLY_LOGIN_KEY)).toBe(offer.id)
    expect(processesApi.create).not.toHaveBeenCalled()
  })

  it('shows the Microsoft login error inside the dialog', async () => {
    const user = userEvent.setup()
    renderDialog(null, { loginError: 'Cancelaste el inicio de sesión con Microsoft.' })

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(screen.getByText('Cancelaste el inicio de sesión con Microsoft.')).toBeInTheDocument()
    expect(confirmationHeading()).not.toBeInTheDocument()
  })

  it('after returning from Microsoft, registers the process and ends the session opened for applying', async () => {
    const user = userEvent.setup()
    returnedFromMicrosoft()
    const { endSession } = renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(await screen.findByRole('heading', { name: `¡Te postulaste a ${offer.title}!`, level: 3 })).toBeInTheDocument()
    const [token, payload] = vi.mocked(processesApi.create).mock.calls[0]
    expect(token).toBe('session-access-token')
    expect(payload).toMatchObject({ modality_public_id: 'modality-public-id' })
    expect(payload.observations).toContain(offer.title)
    expect(payload).not.toHaveProperty('student_id')
    expect(screen.getByText(createdProcess.process_code)).toBeInTheDocument()
    expect(screen.getByText('Radicado')).toBeInTheDocument()
    expect(await screen.findByText(/tu sesión se cerró/i)).toBeInTheDocument()
    expect(endSession).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(APPLY_LOGIN_KEY)).toBeNull()
  })

  it('shows the server error and ends the session opened only for applying', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.create).mockRejectedValueOnce(new ApiError(403, 'No tienes permiso para esta operación'))
    returnedFromMicrosoft()
    const { endSession } = renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(await screen.findByText('No tienes permiso para esta operación')).toBeInTheDocument()
    expect(confirmationHeading()).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inicia sesión', level: 3 })).toBeInTheDocument()
    expect(endSession).toHaveBeenCalledTimes(1)
  })

  it('keeps a pre-existing session when the application fails', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.create).mockRejectedValueOnce(new ApiError(500, 'Error del servidor'))
    const { endSession } = renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(await screen.findByText('Error del servidor')).toBeInTheDocument()
    expect(endSession).not.toHaveBeenCalled()
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

  it('applies straight away with an existing session, without going to Microsoft', async () => {
    const user = userEvent.setup()
    const { loginWithMicrosoft } = renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(await screen.findByRole('heading', { name: `¡Te postulaste a ${offer.title}!`, level: 3 })).toBeInTheDocument()
    expect(vi.mocked(processesApi.create).mock.calls[0][0]).toBe('session-access-token')
    expect(loginWithMicrosoft).not.toHaveBeenCalled()
  })

  it('"Volver al catálogo" navigates to /proyectos-de-grado', async () => {
    const user = userEvent.setup()
    renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.click(await screen.findByRole('button', { name: /volver al catálogo/i }))

    expect(screen.getByTestId('current-path')).toHaveTextContent('/proyectos-de-grado')
  })
})

describe('ProjectDetail ?postular=1', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    sessionStorage.clear()
    useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
  })

  it('resumes the application when coming back from Microsoft', async () => {
    vi.mocked(modalitiesApi.list).mockResolvedValue([{ public_id: 'modality-public-id', code: offer.modalityId, name: modality.name }])
    vi.mocked(processesApi.list).mockResolvedValue([])
    vi.mocked(processesApi.create).mockResolvedValue(createdProcess as never)
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'session-access-token' })
    returnedFromMicrosoft()

    render(
      <MemoryRouter initialEntries={[applicationReturnPath(offer.id)]}>
        <AuthFlowContext.Provider value={{ loginWithMicrosoft: vi.fn(async () => {}), endSession: vi.fn(async () => null), loginError: null }}>
          <Routes>
            <Route path="/proyectos-de-grado/:offerId" element={<ProjectDetail />} />
          </Routes>
        </AuthFlowContext.Provider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: `¡Te postulaste a ${offer.title}!`, level: 3 })).toBeInTheDocument()
    expect(processesApi.create).toHaveBeenCalledTimes(1)
  })
})
