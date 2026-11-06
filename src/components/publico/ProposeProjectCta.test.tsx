import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthFlowContext } from '@/components/auth/AuthFlowContext'
import { useAppStore } from '@/stores/app.store'

vi.mock('@/config/msal', () => ({ isMicrosoftLoginConfigured: true }))
vi.mock('@/services/proposals.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/proposals.service')>()),
  proposalsApi: { create: vi.fn() },
}))

import { proposalsApi } from '@/services/proposals.service'
import { ModalityOpportunitiesPage } from './ModalityOpportunitiesPage'
import { modalityRouteSlug, projectModalities } from './projectCatalog.data'
import { PROPOSAL_ENABLED_MODALITIES } from './ProposeProjectCta'

const ENABLED = ['Proyecto de investigación', 'Proyecto de semillero de investigación', 'Proyecto de emprendimiento', 'Proyecto aplicado']
const slugOf = (name: string) => modalityRouteSlug(projectModalities.find((m) => m.name === name)!.id)

const loginMock = vi.fn<(returnTo?: string) => Promise<void>>(async () => {})
const endSessionMock = vi.fn<(options?: unknown) => Promise<string | null>>(async () => null)

const renderModality = (name: string) =>
  render(
    <MemoryRouter initialEntries={[`/proyectos-de-grado/modalidad/${slugOf(name)}`]}>
      <AuthFlowContext.Provider value={{ loginWithMicrosoft: loginMock, endSession: endSessionMock, loginError: null }}>
        <Routes>
          <Route path="/proyectos-de-grado/modalidad/:modalitySlug" element={<ModalityOpportunitiesPage />} />
        </Routes>
      </AuthFlowContext.Provider>
    </MemoryRouter>
  )

beforeEach(() => {
  sessionStorage.clear()
  useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('«Proponer mi proyecto» en la página de modalidad', () => {
  it.each(ENABLED)('shows the proposal block with its button in «%s»', (name) => {
    renderModality(name)
    expect(screen.getByRole('button', { name: 'Proponer mi proyecto' })).toBeInTheDocument()
  })

  it('is enabled in exactly four modalities and hidden in all the others', () => {
    expect(Object.keys(PROPOSAL_ENABLED_MODALITIES)).toHaveLength(4)
    for (const modality of projectModalities.filter((m) => !ENABLED.includes(m.name))) {
      renderModality(modality.name)
      expect(screen.queryByRole('button', { name: 'Proponer mi proyecto' }), modality.name).not.toBeInTheDocument()
      cleanup()
    }
  })

  it('opens «Propón tu proyecto de grado» as a modal over the modality page, with the modality preloaded', async () => {
    const user = userEvent.setup()
    renderModality('Proyecto de emprendimiento')
    await user.click(screen.getByRole('button', { name: 'Proponer mi proyecto' }))

    const dialog = screen.getByRole('dialog', { name: 'Propón tu proyecto de grado' })
    expect(within(dialog).getByLabelText('Modalidad sugerida')).toHaveValue('emprendimiento')
    expect(within(dialog).getByLabelText('Título de la propuesta')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Acepto el tratamiento de mis datos/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Proyecto de emprendimiento' })).toBeInTheDocument() // la página sigue debajo

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    ['Proyecto de investigación', 'proyecto_investigacion'],
    ['Proyecto de semillero de investigación', 'semillero_investigacion'],
    ['Proyecto aplicado', 'desarrollo_tecnologico'],
  ])('maps «%s» to the backend modality %s', async (name, expected) => {
    const user = userEvent.setup()
    renderModality(name)
    await user.click(screen.getByRole('button', { name: 'Proponer mi proyecto' }))
    expect(screen.getByLabelText('Modalidad sugerida')).toHaveValue(expected)
  })

  it('submitting asks for Microsoft login, returning to this same modality page, and registers nothing yet', async () => {
    const user = userEvent.setup()
    renderModality('Proyecto aplicado')
    await user.click(screen.getByRole('button', { name: 'Proponer mi proyecto' }))
    await user.type(screen.getByLabelText('Título de la propuesta'), 'Sistema de alertas')
    await user.type(screen.getByLabelText(/Problema o necesidad/), 'Las alertas llegan tarde a los equipos')
    await user.type(screen.getByLabelText(/Propuesta de solución/), 'Un servicio que notifique en tiempo real')
    await user.click(screen.getByLabelText(/Confirmo que la información es correcta/))
    await user.click(screen.getByLabelText(/Acepto el tratamiento de mis datos/))
    await user.click(screen.getByRole('button', { name: 'Enviar propuesta' }))

    expect(loginMock).toHaveBeenCalledWith(`/proyectos-de-grado/modalidad/${slugOf('Proyecto aplicado')}`)
    expect(proposalsApi.create).not.toHaveBeenCalled()
  })

  it('reopens the modal with the restored draft when coming back from Microsoft to this page', () => {
    sessionStorage.setItem('ucomp_idea_draft', JSON.stringify({ title: 'Borrador guardado', modality: 'desarrollo_tecnologico' }))
    sessionStorage.setItem('ucomp_idea_pending', JSON.stringify({ returnPath: `/proyectos-de-grado/modalidad/${slugOf('Proyecto aplicado')}`, at: Date.now() }))
    renderModality('Proyecto aplicado')

    expect(screen.getByRole('dialog', { name: 'Propón tu proyecto de grado' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título de la propuesta')).toHaveValue('Borrador guardado')
  })

  it('does not reopen the modal for a pending send that belongs to another page', () => {
    sessionStorage.setItem('ucomp_idea_pending', JSON.stringify({ returnPath: `/proyectos-de-grado/modalidad/${slugOf('Proyecto aplicado')}`, at: Date.now() }))
    renderModality('Proyecto de investigación')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
