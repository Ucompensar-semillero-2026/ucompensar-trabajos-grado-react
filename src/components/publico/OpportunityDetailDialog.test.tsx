import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  return <output data-testid="current-path">{`${location.pathname}${location.search}`}</output>
}

const APPLY_LOGIN_KEY = 'ucomp_apply_login_offer'

function signIn(currentUser: User | null) {
  useAppStore.setState({ currentUser, isAuthenticated: Boolean(currentUser), accessToken: currentUser ? 'session-access-token' : null })
}

function renderDialog(currentUser: User | null, options: { loginError?: string | null; endSessionResult?: string | null } = {}) {
  const { loginError = null, endSessionResult = null } = options
  signIn(currentUser)
  const loginWithMicrosoft = vi.fn(async () => {})
  const endSession = vi.fn(async () => endSessionResult)
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/proyectos-de-grado/modalidad/x']}>
      <AuthFlowContext.Provider value={{ loginWithMicrosoft, endSession, loginError }}>
        <LocationProbe />
        <OpportunityDetailDialog offer={offer} modality={modality} guidance={guidance} onClose={onClose} />
      </AuthFlowContext.Provider>
    </MemoryRouter>,
  )
  return { loginWithMicrosoft, endSession, onClose }
}

function renderProjectDetail(url: string) {
  const endSession = vi.fn(async () => null)
  render(
    <MemoryRouter initialEntries={[url]}>
      <AuthFlowContext.Provider value={{ loginWithMicrosoft: vi.fn(async () => {}), endSession, loginError: null }}>
        <LocationProbe />
        <Routes>
          <Route path="/proyectos-de-grado/:offerId" element={<ProjectDetail />} />
          <Route path="/proyectos-de-grado" element={<p>catálogo</p>} />
        </Routes>
      </AuthFlowContext.Provider>
    </MemoryRouter>,
  )
  return { endSession }
}

/** Estado tras volver de Microsoft: marca de "sesión abierta solo para postular esta oferta". */
function returnedFromMicrosoft() {
  sessionStorage.setItem(APPLY_LOGIN_KEY, offer.id)
}

const successHeading = () => screen.queryByRole('heading', { name: '¡Te has postulado correctamente!', level: 3 })

beforeEach(() => {
  vi.mocked(modalitiesApi.list).mockResolvedValue([{ public_id: 'modality-public-id', code: offer.modalityId, name: modality.name }])
  vi.mocked(processesApi.list).mockResolvedValue([])
  vi.mocked(processesApi.create).mockResolvedValue(createdProcess as never)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  sessionStorage.clear()
  signIn(null)
})

describe('OpportunityDetailDialog application flow', () => {
  it('without a session, "Postularme" only offers the Microsoft login and registers nothing', async () => {
    const user = userEvent.setup()
    renderDialog(null)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(screen.getByRole('heading', { name: 'Inicia sesión', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar con microsoft/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Usuario o correo')).not.toBeInTheDocument()
    expect(processesApi.create).not.toHaveBeenCalled()
    expect(successHeading()).not.toBeInTheDocument()
  })

  it('sends the student to Microsoft remembering the offer, without registering anything yet', async () => {
    const user = userEvent.setup()
    const { loginWithMicrosoft } = renderDialog(null)

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.click(screen.getByRole('button', { name: /continuar con microsoft/i }))

    expect(loginWithMicrosoft).toHaveBeenCalledWith(applicationReturnPath(offer.id))
    expect(sessionStorage.getItem(APPLY_LOGIN_KEY)).toBe(offer.id)
    expect(processesApi.create).not.toHaveBeenCalled()
  })

  it('a cancelled or failed Microsoft login shows the error and registers nothing', async () => {
    const user = userEvent.setup()
    renderDialog(null, { loginError: 'Cancelaste el inicio de sesión con Microsoft.' })

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(screen.getByText('Cancelaste el inicio de sesión con Microsoft.')).toBeInTheDocument()
    expect(processesApi.create).not.toHaveBeenCalled()
    expect(successHeading()).not.toBeInTheDocument()
  })

  it('with a session, asks for an explicit confirmation before registering', async () => {
    const user = userEvent.setup()
    const { loginWithMicrosoft } = renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(screen.getByRole('heading', { name: '¿Confirmas tu postulación?', level: 3 })).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(offer.title.slice(0, 20))).length).toBeGreaterThan(0)
    expect(processesApi.create).not.toHaveBeenCalled()
    expect(loginWithMicrosoft).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(processesApi.create).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: '¿Confirmas tu postulación?' })).not.toBeInTheDocument()
  })

  it('registers once confirmed and shows the real backend data in the success dialog', async () => {
    const user = userEvent.setup()
    const { endSession } = renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.click(screen.getByRole('button', { name: 'Confirmar postulación' }))

    expect(await screen.findByRole('heading', { name: '¡Te has postulado correctamente!', level: 3 })).toBeInTheDocument()
    const [token, payload] = vi.mocked(processesApi.create).mock.calls[0]
    expect(token).toBe('session-access-token')
    expect(payload).toMatchObject({ modality_public_id: 'modality-public-id' })
    expect(payload.observations).toContain(offer.title)
    expect(payload).not.toHaveProperty('student_id')
    expect(payload.title).toBe(offer.title.slice(0, 200))
    expect(screen.getByText(createdProcess.process_code)).toBeInTheDocument()
    expect(screen.getByText('Radicado')).toBeInTheDocument()
    await waitFor(() => expect(endSession).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/sesión se cerró|cerrado sesión|cerrando tu sesión/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Volver al catálogo/ })).toBeInTheDocument()
    // El backend registró PRIMERO; solo después se cierra la sesión, con el destino público y una confirmación mínima sin datos sensibles.
    expect(vi.mocked(processesApi.create).mock.invocationCallOrder[0]).toBeLessThan(endSession.mock.invocationCallOrder[0])
    const options = (endSession.mock.calls[0] as unknown[])[0] as { returnTo: string; flash: Record<string, string> }
    expect(options).toMatchObject({ reason: 'postulation_success', returnTo: '/proyectos-de-grado' })
    expect(options.flash).toMatchObject({ kind: 'application', offerTitle: offer.title, code: createdProcess.process_code })
    expect(JSON.stringify(options.flash)).not.toMatch(/session-access-token|token|password/i)
  })

  it('double clicks on "Confirmar postulación" register a single application', async () => {
    renderDialog(student)

    fireEvent.click(screen.getByRole('button', { name: /postularme/i }))
    const confirm = await screen.findByRole('button', { name: 'Confirmar postulación' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(await screen.findByRole('heading', { name: '¡Te has postulado correctamente!', level: 3 })).toBeInTheDocument()
    expect(processesApi.create).toHaveBeenCalledTimes(1)
  })

  it('shows the backend error, no success dialog, and keeps a pre-existing session', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.create).mockRejectedValueOnce(new ApiError(403, 'No tienes permiso para esta operación'))
    const { endSession } = renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.click(screen.getByRole('button', { name: 'Confirmar postulación' }))

    expect(await screen.findByText('No tienes permiso para esta operación')).toBeInTheDocument()
    expect(successHeading()).not.toBeInTheDocument()
    expect(endSession).not.toHaveBeenCalled()
  })

  it('does not create a duplicate application for the same offer', async () => {
    const user = userEvent.setup()
    vi.mocked(processesApi.list).mockResolvedValueOnce([{ ...createdProcess, observations: `Postulación [oferta:${offer.id}]` }] as never)
    renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.click(screen.getByRole('button', { name: 'Confirmar postulación' }))

    expect(await screen.findByText(/ya te postulaste a esta oferta/i)).toBeInTheDocument()
    expect(processesApi.create).not.toHaveBeenCalled()
    expect(successHeading()).not.toBeInTheDocument()
  })

  it('does not claim the session closed when the server logout fails', async () => {
    const user = userEvent.setup()
    const { endSession } = renderDialog(student, { endSessionResult: 'Error del servidor' })

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.click(screen.getByRole('button', { name: 'Confirmar postulación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    expect(screen.queryByText(/tu sesión se cerró/i)).not.toBeInTheDocument()
    expect(successHeading()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reintentar cierre de sesión/i }))
    expect(endSession).toHaveBeenCalledTimes(2)
  })

  it('a stale Microsoft marker does not skip the confirmation when clicking "Postularme"', async () => {
    const user = userEvent.setup()
    returnedFromMicrosoft()
    renderDialog(student)

    await user.click(screen.getByRole('button', { name: /postularme/i }))

    expect(screen.getByRole('heading', { name: '¿Confirmas tu postulación?', level: 3 })).toBeInTheDocument()
    expect(processesApi.create).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(APPLY_LOGIN_KEY)).toBeNull()
  })
})

describe('closing the confirmation', () => {
  it('"Volver al catálogo" closes the dialog, goes to /proyectos-de-grado, restores scroll and body styles', async () => {
    const user = userEvent.setup()
    document.body.style.overflow = 'auto'
    const { onClose } = renderDialog(student)
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(screen.getByRole('button', { name: /postularme/i }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar postulación' }))
    await user.click(await screen.findByRole('button', { name: /volver al catálogo/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('current-path')).toHaveTextContent(/^\/proyectos-de-grado$/)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })
    cleanup() // el diálogo se desmonta al cambiar de ruta: se liberan el bloqueo y el atributo inert
    expect(document.body.style.overflow).toBe('auto')
    expect(sessionStorage.getItem(APPLY_LOGIN_KEY)).toBeNull()
    document.body.style.overflow = ''
  })
})

describe('ProjectDetail ?postular=1 (vuelta de Microsoft)', () => {
  it('resumes and registers once when coming back from Microsoft, clearing the query and ending the session', async () => {
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'session-access-token' })
    returnedFromMicrosoft()

    const { endSession } = renderProjectDetail(applicationReturnPath(offer.id))

    expect(await screen.findByRole('heading', { name: '¡Te has postulado correctamente!', level: 3 })).toBeInTheDocument()
    expect(processesApi.create).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('current-path')).toHaveTextContent(new RegExp(`^/proyectos-de-grado/${encodeURIComponent(offer.id)}$`))
    await waitFor(() => expect(endSession).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/sesión se cerró|cerrado sesión/i)).not.toBeInTheDocument()
    expect(sessionStorage.getItem(APPLY_LOGIN_KEY)).toBeNull()
  })

  it('asks for confirmation instead of registering when there is no Microsoft marker for this offer', async () => {
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'session-access-token' })

    renderProjectDetail(applicationReturnPath(offer.id))

    expect(await screen.findByRole('heading', { name: '¿Confirmas tu postulación?', level: 3 })).toBeInTheDocument()
    expect(processesApi.create).not.toHaveBeenCalled()
  })

  it('if the backend rejects the resumed application, shows the error and ends the session opened for applying', async () => {
    vi.mocked(processesApi.create).mockRejectedValueOnce(new ApiError(409, 'Ya existe un trámite'))
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'session-access-token' })
    returnedFromMicrosoft()

    const { endSession } = renderProjectDetail(applicationReturnPath(offer.id))

    // primero se cierra la sesión abierta solo para postular y luego se vuelve al paso de acceso con el error
    expect(await screen.findByRole('heading', { name: 'Inicia sesión', level: 3 })).toBeInTheDocument()
    expect(screen.getByText('Ya existe un trámite')).toBeInTheDocument()
    expect(successHeading()).not.toBeInTheDocument()
    expect(endSession).toHaveBeenCalledTimes(1)
  })
})
