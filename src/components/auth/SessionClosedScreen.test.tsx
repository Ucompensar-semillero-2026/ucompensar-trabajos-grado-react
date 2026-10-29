import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { clearFlash, peekFlash, setFlash } from '@/services/sessionFlash'
import { PublicFlashNotice } from '@/components/publico/PublicFlashNotice'
import { SessionClosedScreen } from './SessionClosedScreen'

const Where = () => <p data-testid="where">{useLocation().pathname}</p>
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/sesion-cerrada" element={<SessionClosedScreen />} />
        <Route path="/login" element={<p>portal de inicio de sesión</p>} />
        <Route path="/proyectos-de-grado" element={<PublicFlashNotice />} />
      </Routes>
    </MemoryRouter>
  )

afterEach(() => {
  cleanup()
  clearFlash()
})

describe('confirmación del cierre manual de sesión', () => {
  it('shows «Has cerrado sesión correctamente», stays until the button is pressed, and then goes to /login', async () => {
    const user = userEvent.setup()
    setFlash({ kind: 'manual_logout' })
    renderAt('/sesion-cerrada')

    expect(screen.getByRole('heading', { name: 'Has cerrado sesión correctamente' })).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 300)) // no desaparece por tiempo
    expect(screen.getByRole('heading', { name: 'Has cerrado sesión correctamente' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continuar al inicio de sesión' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/login')
    expect(screen.getByText('portal de inicio de sesión')).toBeInTheDocument()
    expect(peekFlash()).toBeNull() // un solo uso
  })

  it('does not reappear later: without the one-time mark it redirects to /login', () => {
    renderAt('/sesion-cerrada')
    expect(screen.getByTestId('where')).toHaveTextContent('/login')
    expect(screen.queryByText('Has cerrado sesión correctamente')).not.toBeInTheDocument()
  })

  it('is tied only to the manual logout: application/proposal confirmations never show it, and the catalog notice ignores it', () => {
    setFlash({ kind: 'proposal', code: 'PROP-1', title: 'Idea' })
    renderAt('/sesion-cerrada')
    expect(screen.getByTestId('where')).toHaveTextContent('/login')

    cleanup()
    setFlash({ kind: 'manual_logout' })
    renderAt('/proyectos-de-grado')
    expect(screen.queryByText(/Has cerrado sesión|Tu sesión se cerró/)).not.toBeInTheDocument()
    expect(peekFlash()).toEqual({ kind: 'manual_logout' }) // el catálogo no la consume
  })

  it('the application confirmation card has no logout message, only data and «Volver al catálogo»', () => {
    setFlash({ kind: 'application', offerTitle: 'Oferta X', modality: 'Proyecto aplicado', code: 'PA-2026-1', state: 'Radicado', registeredAt: '2026-05-01T10:00:00' })
    renderAt('/proyectos-de-grado')
    expect(screen.getByText('Tu postulación quedó registrada')).toBeInTheDocument()
    expect(screen.getByText('PA-2026-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Volver al catálogo/ })).toBeInTheDocument()
    expect(screen.queryByText(/sesión se cerró|iniciar sesión de nuevo|cerrado sesión/i)).not.toBeInTheDocument()
  })
})
