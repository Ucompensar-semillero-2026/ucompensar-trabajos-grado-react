import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthFlowContext } from '@/components/auth/AuthFlowContext'
import { ApiError } from '@/services/http'
import { useAppStore } from '@/stores/app.store'
import { STUDENT_NAV_GROUPS } from '@/constants'
import type { User } from '@/types'
import type { InvitationOut, ProposalListItem, ProposalOut, ProposalStatus } from '@/services/proposals.service'

vi.mock('@/config/msal', () => ({ isMicrosoftLoginConfigured: true }))
vi.mock('@/services/proposals.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/proposals.service')>()),
  proposalsApi: { create: vi.fn(), mine: vi.fn(), invitations: vi.fn(), update: vi.fn(), confirmMembership: vi.fn(), get: vi.fn(), summary: vi.fn(), list: vi.fn(), transition: vi.fn(), assignTutor: vi.fn(), convert: vi.fn() },
}))
vi.mock('@/services/processes.service', () => ({ processesApi: { teamCandidates: vi.fn() } }))
vi.mock('@/services/modalities.service', () => ({ modalitiesApi: { list: vi.fn() } }))

import { proposalsApi } from '@/services/proposals.service'
import { processesApi } from '@/services/processes.service'
import { modalitiesApi } from '@/services/modalities.service'
import { IdeaProposalSection, validateIdea } from '@/components/publico/IdeaProposalSection'
import { ProjectsCatalog } from '@/components/publico/ProjectsCatalog'
import { MisPropuestas } from './MisPropuestas'
import { PropuestasEstudiantiles } from './PropuestasEstudiantiles'
import { PropuestaDetalle } from './PropuestaDetalle'

const student: User = { id: 's1', name: 'Ana Estudiante', initials: 'AE', email: 'ana@ucompensar.edu.co', role: 'estudiante', institutionalRoles: ['Estudiante'], authMethod: 'sso' }
const coordinator: User = { id: 'c1', name: 'Diana Coordinadora', initials: 'DC', email: 'd@ucompensar.edu.co', role: 'coordinador', institutionalRoles: ['Coordinador'], authMethod: 'sso' }

const person = (id: string, name: string) => ({ public_id: id, full_name: name })

function proposal(o: Partial<ProposalOut> = {}): ProposalOut {
  return {
    public_id: 'pr1', code: 'PROP-2026-AAA111', title: 'Detección de fallas', suggested_modality: 'proyecto_investigacion', problem: 'Los equipos fallan sin aviso',
    solution: 'Un modelo predictivo con sensores', expected_impact: null, status: 'pendiente_revision', author: person('s1', 'Ana Estudiante'),
    members: [{ email: 'amiga@ucompensar.edu.co', status: 'propuesto', full_name: null }], suggested_tutor_email: null, suggested_tutor: null, assigned_tutor: null,
    decision_reason: null, reviewed_by: null, reviewed_at: null, process_public_id: null, created_at: '2026-03-01T10:00:00', updated_at: null,
    events: [{ event_type: 'propuesta_enviada', from_status: null, to_status: 'pendiente_revision', comment: null, actor: person('s1', 'Ana Estudiante'), created_at: '2026-03-01T10:00:00' }],
    can_edit: true, view: 'full', ...o,
  }
}

const item = (o: Partial<ProposalListItem> = {}): ProposalListItem => ({
  public_id: 'pr1', code: 'PROP-2026-AAA111', title: 'Detección de fallas', suggested_modality: 'proyecto_investigacion', status: 'pendiente_revision',
  author: person('s1', 'Ana Estudiante'), member_count: 1, has_suggested_tutor: false, assigned_tutor: null, created_at: '2026-03-01T10:00:00', updated_at: null, ...o,
})

const summaryOf = (o: Partial<Record<ProposalStatus, number>> = {}) => ({
  total: 5,
  by_status: { pendiente_revision: 2, en_evaluacion: 1, requiere_informacion: 1, aprobada: 1, pendiente_tutor: 0, tutor_asignado: 0, rechazada: 0, convertida: 0, ...o } as Record<ProposalStatus, number>,
})

const endSessionMock = vi.fn<(options?: unknown) => Promise<string | null>>(async () => null)
const authFlow = (loginWithMicrosoft = vi.fn(async () => {})) => ({ loginWithMicrosoft, endSession: endSessionMock, loginError: null })
const renderIdea = (loginWithMicrosoft?: () => Promise<void>) =>
  render(<MemoryRouter><AuthFlowContext.Provider value={authFlow(loginWithMicrosoft as never)}><IdeaProposalSection /></AuthFlowContext.Provider></MemoryRouter>)

async function fillIdea(user: ReturnType<typeof userEvent.setup>, extra: { members?: string } = {}) {
  await user.type(screen.getByLabelText('Título de la propuesta'), 'Detección de fallas')
  await user.type(screen.getByLabelText(/Problema o necesidad/), 'Los equipos de la red fallan sin aviso')
  await user.type(screen.getByLabelText(/Propuesta de solución/), 'Un modelo que anticipe fallas con sensores')
  if (extra.members) await user.type(screen.getByLabelText('Correo del compañero 1'), extra.members)
  await user.click(screen.getByLabelText(/Confirmo que la información es correcta/))
  await user.click(screen.getByLabelText(/Acepto el tratamiento de mis datos/))
}

beforeEach(() => {
  sessionStorage.clear()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  Element.prototype.scrollIntoView = vi.fn()
  // jsdom no implementa matchMedia; el desplazamiento suave depende de prefers-reduced-motion (aquí: sin reducción).
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  sessionStorage.clear()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
})

describe('tarjeta del banner y formulario público', () => {
  it('adds the idea card under the portal card and scrolls to #proponer-idea, keeping the portal card', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AuthFlowContext.Provider value={authFlow()}><ProjectsCatalog /></AuthFlowContext.Provider></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '¿Ya te postulaste a una oferta de proyecto de grado?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresar al portal' })).toBeInTheDocument()
    const ideaCard = screen.getByRole('heading', { name: '¿Tienes una idea para tu proyecto de grado?' }).closest('aside') as HTMLElement
    expect(within(ideaCard).getByText(/¿Tú y tus compañeros tienen una propuesta\? Compártela con nosotros/)).toBeInTheDocument()
    expect(document.getElementById('proponer-idea')).toBeInTheDocument()

    await user.click(within(ideaCard).getByRole('button', { name: 'Presentar mi idea' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }) // respeta prefers-reduced-motion
    expect(document.activeElement).toBe(document.getElementById('idea-title'))
  })

  it('anonymous visitors can draft but must sign in with Microsoft: nothing is sent and the draft survives', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => {})
    renderIdea(login)
    await fillIdea(user)

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión con Microsoft para enviar' }))

    expect(login).toHaveBeenCalledWith('/proyectos-de-grado#proponer-idea')
    expect(proposalsApi.create).not.toHaveBeenCalled()
    expect(JSON.parse(sessionStorage.getItem('ucomp_idea_draft') as string).title).toBe('Detección de fallas')
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument() // jamás se piden contraseñas aquí
  })

  it('restores the draft after coming back from Microsoft and does NOT submit on its own', async () => {
    sessionStorage.setItem('ucomp_idea_draft', JSON.stringify({ title: 'Idea guardada', problem: 'Un problema suficientemente largo', solution: 'Una solución suficientemente larga' }))
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    renderIdea()

    expect(screen.getByLabelText('Título de la propuesta')).toHaveValue('Idea guardada')
    expect(screen.getByRole('button', { name: 'Enviar propuesta' })).toBeInTheDocument()
    expect(proposalsApi.create).not.toHaveBeenCalled()
  })

  it('explains each missing required field under it and blocks the request, keeping the button usable', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    renderIdea()

    const send = screen.getByRole('button', { name: 'Enviar propuesta' })
    expect(send).toBeEnabled() // nunca se deshabilita en silencio
    await user.click(send)

    expect(await screen.findByText(/Revisa el formulario: falta o debes corregir el título, el problema o necesidad, la propuesta de solución, la confirmación de la información, el tratamiento de datos\./)).toBeInTheDocument()
    expect(document.getElementById('idea-error-title')).toHaveTextContent('al menos 3 caracteres')
    expect(document.getElementById('idea-error-problem')).toBeInTheDocument()
    expect(document.getElementById('idea-error-solution')).toBeInTheDocument()
    expect(screen.getByLabelText('Título de la propuesta')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/Debes aceptar el tratamiento de datos/)).toBeInTheDocument()
    expect(send).toBeEnabled()
    expect(proposalsApi.create).not.toHaveBeenCalled()

    // Los errores desaparecen al corregir cada campo.
    await user.type(screen.getByLabelText('Título de la propuesta'), 'Detección de fallas')
    expect(document.getElementById('idea-error-title')).toBeNull()
  })

  it('rejects duplicated emails and the author email, with the error under the right row', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    renderIdea()
    await fillIdea(user, { members: 'a@u.co, A@U.co' })
    await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))
    expect(document.getElementById('idea-member-error-1')).toHaveTextContent('repetido')

    expect(validateIdea({ title: 'Idea', modality: 'por_definir', problem: 'x'.repeat(12), solution: 'y'.repeat(12), impact: '', members: ['ANA@ucompensar.edu.co'], tutor: '', confirm: true, policy: true }, 'ana@ucompensar.edu.co')).toMatch(/propio correo/)
    expect(validateIdea({ title: 'Idea', modality: 'por_definir', problem: 'x'.repeat(12), solution: 'y'.repeat(12), impact: '', members: ['a@u.co', 'b@u.co', 'c@u.co', 'd@u.co', 'e@u.co', 'f@u.co'], tutor: '', confirm: true, policy: true }, null)).toMatch(/máximo 5/)
    expect(proposalsApi.create).not.toHaveBeenCalled()
  })

  it('a complete form with the two confirmations and every optional field empty can be sent', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    vi.mocked(proposalsApi.create).mockResolvedValue(proposal())
    renderIdea()
    await fillIdea(user)

    expect(screen.getByRole('button', { name: 'Enviar propuesta' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

    expect(await screen.findByText('Recibimos tu propuesta')).toBeInTheDocument()
    expect(vi.mocked(proposalsApi.create).mock.calls[0][1]).toMatchObject({ member_emails: [], suggested_tutor_email: null, expected_impact: null })
  })

  it('an optional teacher email with a bad format shows its own error; empty optional fields never block', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    renderIdea()
    await fillIdea(user)
    await user.type(screen.getByLabelText(/Correo del docente propuesto/), 'no-es-correo')
    await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

    expect(document.getElementById('idea-error-tutor')).toHaveTextContent('docente propuesto no tiene un formato válido')
    expect(document.getElementById('idea-error-title')).toBeNull()
    expect(proposalsApi.create).not.toHaveBeenCalled()
  })

  it('an anonymous visitor starts the Microsoft sign-in from the button once the required content is complete', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => {})
    renderIdea(login)
    const button = screen.getByRole('button', { name: 'Iniciar sesión con Microsoft para enviar' })
    expect(button).toBeEnabled()

    await user.click(button) // incompleto: explica qué falta y no redirige
    expect(login).not.toHaveBeenCalled()
    expect(document.getElementById('idea-error-title')).toBeInTheDocument()

    await fillIdea(user)
    await user.click(button)
    expect(login).toHaveBeenCalledWith('/proyectos-de-grado#proponer-idea')
    expect(proposalsApi.create).not.toHaveBeenCalled()
  })

  describe('lista dinámica de integrantes', () => {
    const emailInputs = () => screen.getAllByLabelText(/^Correo del compañero \d+$/) as HTMLInputElement[]

    it('adds and removes rows, never offering to remove the only one, and caps at five', async () => {
      const user = userEvent.setup()
      renderIdea()
      expect(emailInputs()).toHaveLength(1)
      expect(screen.queryByRole('button', { name: /Quitar compañero/ })).not.toBeInTheDocument()
      expect(screen.getByText(/1 de 5 compañeros como máximo/)).toBeInTheDocument()

      const add = screen.getByRole('button', { name: /Agregar integrante/ })
      for (let i = 0; i < 4; i++) await user.click(add)
      expect(emailInputs()).toHaveLength(5)
      expect(add).toBeDisabled()

      await user.type(emailInputs()[1], 'dos@u.co')
      await user.click(screen.getByRole('button', { name: 'Quitar compañero 1' }))
      expect(emailInputs()).toHaveLength(4)
      expect(emailInputs()[0]).toHaveValue('dos@u.co')
      expect(add).toBeEnabled()
    })

    it('splits pasted emails (commas, semicolons, new lines) into separate editable rows', async () => {
      const user = userEvent.setup()
      renderIdea()
      await user.click(emailInputs()[0])
      await user.paste('uno@u.co, dos@u.co;tres@u.co\ncuatro@u.co')

      expect(emailInputs().map((i) => i.value)).toEqual(['uno@u.co', 'dos@u.co', 'tres@u.co', 'cuatro@u.co'])
      await user.clear(emailInputs()[1])
      await user.type(emailInputs()[1], 'otro@u.co')
      expect(emailInputs()[1]).toHaveValue('otro@u.co')
    })

    it('keeps what was written when a paste exceeds the maximum and says what was left out', async () => {
      const user = userEvent.setup()
      renderIdea()
      await user.click(emailInputs()[0])
      await user.paste('a@u.co b@u.co c@u.co d@u.co e@u.co f@u.co g@u.co')

      expect(emailInputs().map((i) => i.value)).toEqual(['a@u.co', 'b@u.co', 'c@u.co', 'd@u.co', 'e@u.co'])
      expect(screen.getByRole('status')).toHaveTextContent('f@u.co, g@u.co')
    })

    it('shows errors under the offending row only, rejecting duplicates and the author, without clearing other rows', async () => {
      const user = userEvent.setup()
      useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
      renderIdea()
      await fillIdea(user)
      await user.click(screen.getByRole('button', { name: /Agregar integrante/ }))
      await user.click(screen.getByRole('button', { name: /Agregar integrante/ }))
      await user.click(screen.getByRole('button', { name: /Agregar integrante/ }))
      await user.type(emailInputs()[0], 'buena@u.co')
      await user.type(emailInputs()[1], 'BUENA@u.co')
      await user.type(emailInputs()[2], student.email.toUpperCase())
      await user.type(emailInputs()[3], 'sin-formato')

      await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

      const rowError = (i: number) => document.getElementById(`idea-member-error-${i}`)
      expect(rowError(0)).toBeNull()
      expect(rowError(1)).toHaveTextContent('repetido')
      expect(rowError(2)).toHaveTextContent('propio correo')
      expect(rowError(3)).toHaveTextContent('formato')
      expect(emailInputs().map((i) => i.value)).toEqual(['buena@u.co', 'BUENA@u.co', student.email.toUpperCase(), 'sin-formato'])
      expect(proposalsApi.create).not.toHaveBeenCalled()
    })

    it('sends a plain normalized list of emails, ignores empty rows and keeps the teacher email separate', async () => {
      const user = userEvent.setup()
      useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
      vi.mocked(proposalsApi.create).mockResolvedValue(proposal())
      renderIdea()
      await fillIdea(user)
      await user.click(screen.getByRole('button', { name: /Agregar integrante/ }))
      await user.click(screen.getByRole('button', { name: /Agregar integrante/ }))
      await user.type(emailInputs()[0], '  Amiga@U.co ')
      await user.type(emailInputs()[2], 'otra@u.co')
      await user.type(screen.getByLabelText(/Correo del docente propuesto/), 'Docente@u.co')

      await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

      await screen.findByText('Recibimos tu propuesta')
      expect(vi.mocked(proposalsApi.create).mock.calls[0][1]).toMatchObject({ member_emails: ['amiga@u.co', 'otra@u.co'], suggested_tutor_email: 'docente@u.co' })
    })
  })

  it('shows success only after the backend confirms, sends the form once and clears the draft', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    vi.mocked(proposalsApi.create).mockResolvedValue(proposal())
    renderIdea()
    await fillIdea(user, { members: 'amiga@ucompensar.edu.co' })

    const send = screen.getByRole('button', { name: 'Enviar propuesta' })
    fireEvent.click(send)
    fireEvent.click(send)

    expect(await screen.findByText('Recibimos tu propuesta')).toBeInTheDocument()
    expect(proposalsApi.create).toHaveBeenCalledTimes(1)
    expect(vi.mocked(proposalsApi.create).mock.calls[0][1]).toMatchObject({ title: 'Detección de fallas', member_emails: ['amiga@ucompensar.edu.co'], confirm_information: true, accept_data_policy: true })
    expect(screen.getByRole('link', { name: 'Mis propuestas' })).toHaveAttribute('href', '/mis-propuestas')
    expect(sessionStorage.getItem('ucomp_idea_draft')).toBeNull()
  })

  it('closes the session only after the backend persisted the proposal, handing over a minimal one-time confirmation', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    vi.mocked(proposalsApi.create).mockResolvedValue(proposal())
    renderIdea()
    await fillIdea(user)
    await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

    await screen.findByText('Recibimos tu propuesta')
    expect(endSessionMock).toHaveBeenCalledTimes(1)
    expect(vi.mocked(proposalsApi.create).mock.invocationCallOrder[0]).toBeLessThan(endSessionMock.mock.invocationCallOrder[0])
    const options = endSessionMock.mock.calls[0][0] as { returnTo: string; flash: { kind: string; code: string } }
    expect(options).toMatchObject({ reason: 'proposal_success', returnTo: '/proyectos-de-grado' })
    expect(screen.queryByText(/sesión se cerró|cerrado sesión|iniciar sesión de nuevo/i)).not.toBeInTheDocument()
    expect(options.flash).toMatchObject({ kind: 'proposal', code: 'PROP-2026-AAA111' })
    expect(JSON.stringify(options.flash)).not.toMatch(/token|password|@/i)
  })

  it('reports a failed logout without losing the fact that the proposal was registered', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    vi.mocked(proposalsApi.create).mockResolvedValue(proposal())
    endSessionMock.mockResolvedValueOnce('Error del servidor')
    renderIdea()
    await fillIdea(user)
    await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

    expect(await screen.findByText('Recibimos tu propuesta')).toBeInTheDocument()
    expect(await screen.findByText(/No se pudo cerrar tu sesión: Error del servidor/)).toBeInTheDocument()
  })

  it('shows API errors as errors, keeps what the student wrote and never claims success', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    vi.mocked(proposalsApi.create).mockRejectedValue(new ApiError(409, 'Ya registraste una propuesta con este título'))
    renderIdea()
    await fillIdea(user)

    await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya registraste una propuesta')
    expect(endSessionMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Título de la propuesta')).toHaveValue('Detección de fallas')
    expect(screen.queryByText('Recibimos tu propuesta')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Título de la propuesta')).toHaveValue('Detección de fallas')
  })

  it('a non-student account is told why and nothing is sent, even with a valid form', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: coordinator, isAuthenticated: true, accessToken: 'token' })
    renderIdea()
    expect(screen.getByText(/cuenta que no es de estudiante/)).toBeInTheDocument()
    await fillIdea(user)

    const send = screen.getByRole('button', { name: 'Enviar propuesta' })
    expect(send).toBeEnabled() // no queda apagado en silencio: explica el motivo al pulsarlo
    await user.click(send)

    expect(await screen.findByText(/no tiene el rol Estudiante/)).toBeInTheDocument()
    expect(proposalsApi.create).not.toHaveBeenCalled()
  })

  it('disables the button only while sending, so a double click registers one proposal', async () => {
    const user = userEvent.setup()
    useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' })
    let finish: (value: ReturnType<typeof proposal>) => void = () => {}
    vi.mocked(proposalsApi.create).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderIdea()
    await fillIdea(user)

    await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))
    expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Enviando…' }))
    expect(proposalsApi.create).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Recibimos tu propuesta')).not.toBeInTheDocument() // sin éxito hasta que el backend confirme

    finish(proposal())
    expect(await screen.findByText('Recibimos tu propuesta')).toBeInTheDocument()
  })
})

describe('menús', () => {
  it('students get "Mis propuestas" in their menu', () => {
    const labels = STUDENT_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toContain('Mis propuestas')
  })
})

describe('Mis propuestas', () => {
  beforeEach(() => useAppStore.setState({ currentUser: student, isAuthenticated: true, accessToken: 'token' }))

  it('shows an empty state, and a retry when the API fails', async () => {
    const user = userEvent.setup()
    vi.mocked(proposalsApi.mine).mockRejectedValueOnce(new ApiError(500, 'Error del servidor')).mockResolvedValue([])
    vi.mocked(proposalsApi.invitations).mockResolvedValue([])
    render(<MemoryRouter><MisPropuestas /></MemoryRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Aún no has presentado propuestas')).toBeInTheDocument()
  })

  it('shows the information request and lets the author send an update', async () => {
    const user = userEvent.setup()
    vi.mocked(proposalsApi.mine).mockResolvedValue([item({ status: 'requiere_informacion' })])
    vi.mocked(proposalsApi.invitations).mockResolvedValue([])
    const asked = proposal({ status: 'requiere_informacion', events: [{ event_type: 'solicitar_informacion', from_status: 'en_evaluacion', to_status: 'requiere_informacion', comment: 'Detalla los objetivos medibles', actor: person('c1', 'Diana Coordinadora'), created_at: '2026-03-05T10:00:00' }] })
    vi.mocked(proposalsApi.get).mockResolvedValue(asked)
    vi.mocked(proposalsApi.update).mockResolvedValue(proposal({ status: 'pendiente_revision' }))
    render(<MemoryRouter><MisPropuestas /></MemoryRouter>)

    expect(await screen.findByText('Requiere información')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver detalle' }))
    expect(await screen.findByText('Detalla los objetivos medibles')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enviar actualización' }))

    expect(proposalsApi.update).toHaveBeenCalledTimes(1)
    expect(vi.mocked(proposalsApi.update).mock.calls[0][1]).toBe('pr1')
    await waitFor(() => expect(vi.mocked(proposalsApi.mine).mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('lets an invited student confirm their participation', async () => {
    const user = userEvent.setup()
    vi.mocked(proposalsApi.mine).mockResolvedValue([])
    const invitation: InvitationOut = { proposal_public_id: 'pr9', code: 'PROP-9', title: 'Idea de una amiga', author: person('s2', 'Luisa'), status: 'pendiente_revision', member_status: 'propuesto' }
    vi.mocked(proposalsApi.invitations).mockResolvedValueOnce([invitation]).mockResolvedValue([{ ...invitation, member_status: 'verificado' }])
    vi.mocked(proposalsApi.confirmMembership).mockResolvedValue(proposal({ view: 'member' }))
    render(<MemoryRouter><MisPropuestas /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: 'Confirmar mi participación' }))

    expect(proposalsApi.confirmMembership).toHaveBeenCalledWith('token', 'pr9')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar mi participación' })).not.toBeInTheDocument())
  })
})

describe('Propuestas estudiantiles (Coordinación)', () => {
  beforeEach(() => useAppStore.setState({ currentUser: coordinator, isAuthenticated: true, accessToken: 'token' }))

  it('shows real counters per status, filters, search and the list', async () => {
    const user = userEvent.setup()
    vi.mocked(proposalsApi.summary).mockResolvedValue(summaryOf())
    vi.mocked(proposalsApi.list).mockResolvedValue({ items: [item(), item({ public_id: 'pr2', code: 'PROP-2', title: 'Otra', status: 'en_evaluacion' })], total: 2, page: 1, page_size: 15 })
    render(<MemoryRouter><PropuestasEstudiantiles /></MemoryRouter>)

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByLabelText('Propuestas por estado')).toHaveTextContent('Pendiente de revisión: 2')
    expect(screen.getByRole('link', { name: 'Abrir la propuesta PROP-2026-AAA111' })).toHaveAttribute('href', '/coordinacion/propuestas/pr1')

    await user.selectOptions(screen.getByLabelText('Estado'), 'aprobada')
    await user.type(screen.getByLabelText('Buscar'), 'fallas')
    await waitFor(() => expect(proposalsApi.list).toHaveBeenLastCalledWith('token', expect.objectContaining({ status: 'aprobada', search: 'fallas', page: 1 })))
  })

  it('distinguishes an empty inbox from an API failure', async () => {
    const user = userEvent.setup()
    vi.mocked(proposalsApi.summary).mockResolvedValue(summaryOf({ pendiente_revision: 0, en_evaluacion: 0, requiere_informacion: 0, aprobada: 0 }))
    vi.mocked(proposalsApi.list).mockRejectedValueOnce(new ApiError(503, 'No disponible')).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 15 })
    render(<MemoryRouter><PropuestasEstudiantiles /></MemoryRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent('No disponible')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Aún no hay propuestas')).toBeInTheDocument()
  })
})

describe('Detalle de la propuesta (Coordinación)', () => {
  const renderDetail = () =>
    render(<MemoryRouter initialEntries={['/coordinacion/propuestas/pr1']}><Routes><Route path="/coordinacion/propuestas/:proposalId" element={<PropuestaDetalle />} /></Routes></MemoryRouter>)

  beforeEach(() => {
    useAppStore.setState({ currentUser: coordinator, isAuthenticated: true, accessToken: 'token' })
    vi.mocked(processesApi.teamCandidates).mockResolvedValue([{ public_id: 'u1', full_name: 'Marta Docente', active_projects: 1, role: { name: 'tutor_investigador' } }] as never)
    vi.mocked(modalitiesApi.list).mockResolvedValue([{ public_id: 'm1', code: 'PROYECTO_INV', name: 'Proyecto de investigación' }] as never)
  })

  it('starts the evaluation, then requires observations to ask for information and a reason to reject', async () => {
    const user = userEvent.setup()
    vi.mocked(proposalsApi.get).mockResolvedValue(proposal())
    vi.mocked(proposalsApi.transition).mockResolvedValue(proposal({ status: 'en_evaluacion' }))
    renderDetail()

    await user.click(await screen.findByRole('button', { name: 'Iniciar evaluación' }))
    expect(proposalsApi.transition).toHaveBeenCalledWith('token', 'pr1', 'iniciar_evaluacion')
    expect(await screen.findByRole('button', { name: 'Solicitar información' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rechazar' }))
    const confirm = screen.getByRole('button', { name: 'Confirmar rechazo' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText(/Motivo del rechazo/), 'No cumple los criterios')
    vi.mocked(proposalsApi.transition).mockResolvedValue(proposal({ status: 'rechazada', decision_reason: 'No cumple los criterios' }))
    await user.click(confirm)
    expect(proposalsApi.transition).toHaveBeenLastCalledWith('token', 'pr1', 'rechazar', 'No cumple los criterios')
    expect(await screen.findByText('Rechazada')).toBeInTheDocument()
  })

  it('preselects the suggested teacher, confirms the tutor from real candidates and then converts into a process', async () => {
    const user = userEvent.setup()
    vi.mocked(proposalsApi.get).mockResolvedValue(proposal({ status: 'aprobada', suggested_tutor_email: 'marta@u.co', suggested_tutor: person('u1', 'Marta Docente') }))
    vi.mocked(proposalsApi.assignTutor).mockResolvedValue(proposal({ status: 'tutor_asignado', assigned_tutor: person('u1', 'Marta Docente') }))
    vi.mocked(proposalsApi.convert).mockResolvedValue({ process_public_id: 'proc1', process_code: 'PROYECTO_INV-2026-1-AB', linked_members: [], unlinked_members: ['amiga@ucompensar.edu.co'] })
    renderDetail()

    const select = (await screen.findByLabelText('Docente')) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('u1'))
    expect(within(select).getByText(/Marta Docente · 1 proyecto\(s\) · sugerido/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar tutor' }))
    expect(proposalsApi.assignTutor).toHaveBeenCalledWith('token', 'pr1', 'u1')

    await user.click(await screen.findByRole('button', { name: 'Convertir en proceso' }))
    expect(proposalsApi.convert).toHaveBeenCalledWith('token', 'pr1', 'm1', expect.stringMatching(/^\d{4}-[12]$/)) // la modalidad sugerida se preselecciona
    expect(await screen.findByRole('status')).toHaveTextContent('PROYECTO_INV-2026-1-AB')
    expect(screen.getByRole('status')).toHaveTextContent('Sin vincular (no han confirmado su participación): amiga@ucompensar.edu.co')
  })

  it('shows backend errors and does not move the proposal when the assignment is rejected', async () => {
    const user = userEvent.setup()
    vi.mocked(proposalsApi.get).mockResolvedValue(proposal({ status: 'pendiente_tutor' }))
    vi.mocked(proposalsApi.assignTutor).mockRejectedValue(new ApiError(422, 'Solo un docente puede ser tutor de un trámite'))
    renderDetail()

    await user.selectOptions(await screen.findByLabelText('Docente'), 'u1')
    await user.click(screen.getByRole('button', { name: 'Confirmar tutor' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo un docente puede ser tutor')
    expect(screen.getByText('Pendiente de tutor')).toBeInTheDocument()
    expect(proposalsApi.convert).not.toHaveBeenCalled()
  })
})
