import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from './App'
import { useAppStore } from '@/stores/app.store'
import type { User } from '@/types'

const student: User = {
  id: 'student-public-id',
  name: 'Estudiante de prueba',
  initials: 'EP',
  email: 'estudiante@ucompensar.edu.co',
  role: 'estudiante',
  institutionalRoles: ['Estudiante'],
  authMethod: 'credentials',
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="current-route">{location.pathname}</output>
}

function renderApp(entry: string | { pathname: string; state?: unknown }, user: User | null) {
  localStorage.clear()
  useAppStore.setState({ currentUser: user, isAuthenticated: Boolean(user), accessToken: null })
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('App authentication routes', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    useAppStore.setState({ currentUser: null, isAuthenticated: false, accessToken: null })
  })

  it('keeps private dashboard routes protected for signed-out visitors', async () => {
    renderApp('/dashboard', null)

    // Solo se entra con Microsoft: no hay formulario de usuario/contraseña
    expect(await screen.findByRole('button', { name: /continuar con microsoft/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Usuario o correo')).not.toBeInTheDocument()
    expect(screen.getByTestId('current-route')).toHaveTextContent('/login')
  })

  it('keeps the normal authenticated login redirect to the dashboard', async () => {
    renderApp('/login', student)

    expect(await screen.findByTestId('current-route')).toHaveTextContent('/dashboard')
  })
})
