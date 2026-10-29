import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { RequireModule } from '@/components/auth/RequireModule'
import { toStoreUser } from '@/hooks/useAuth'
import { useAppStore } from '@/stores/app.store'
import { hasModule, homePathFor, knownModules } from './access'
import { can, knownActions } from './actions'
import { makeUser } from '@/test/users'
import type { User } from '@/types'

afterEach(() => {
  cleanup()
  useAppStore.getState().logout()
})

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

function renderGuarded(user: User | null, module: Parameters<typeof RequireModule>[0]['module'], start = '/coordinacion/asignacion') {
  if (user) useAppStore.getState().loginSuccess(user, 'token')
  return render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path={start} element={<RequireModule module={module}><p>contenido protegido</p></RequireModule>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('módulos de /auth/me', () => {
  it('ignora sin romperse los módulos y acciones que el frontend no conoce', () => {
    expect(knownModules(['dashboard', 'modulo-del-futuro', 'asignacion', 'dashboard'])).toEqual(['dashboard', 'asignacion'])
    expect(knownModules(undefined)).toEqual([])
    expect(knownActions(['grade', 'accion-nueva'])).toEqual(['grade'])
    expect(can({ allowed_actions: ['accion-nueva'] }, 'grade')).toBe(false)
    expect(can(null, 'grade')).toBe(false)
  })

  it('arma el usuario del store solo con lo que dice /auth/me', () => {
    const user = toStoreUser({
      public_id: 'u1', email: 'a@b.co', full_name: 'Ana María Pérez', active: true,
      roles: ['coordinador', 'docente'], modules: ['dashboard', 'asignacion', 'tutor', 'algo-nuevo'],
      // Campos obsoletos que el backend aún manda: no se usan.
      role: { public_id: 'r', name: 'cualquier-cosa', description: null, active: true }, institutional_roles: ['Rector'],
    })
    expect(user).toEqual({ id: 'u1', name: 'Ana María Pérez', initials: 'AM', email: 'a@b.co', roles: ['coordinador', 'docente'], modules: ['dashboard', 'asignacion', 'tutor'] })
  })

  it('el inicio sale de los módulos', () => {
    expect(homePathFor(makeUser(['coordinador', 'docente']).modules)).toBe('/dashboard')
    expect(homePathFor(makeUser(['docente']).modules)).toBe('/tutor')
    expect(homePathFor(makeUser(['comite_grado']).modules)).toBe('/comites')
    expect(homePathFor(makeUser(['externo']).modules)).toBe('/externo')
    expect(homePathFor(makeUser(['consulta']).modules)).toBe('/buscar')
    expect(homePathFor([])).toBe('/sin-acceso')
  })
})

describe('RequireModule', () => {
  it('deja pasar a quien tiene el módulo', () => {
    renderGuarded(makeUser(['coordinador']), 'asignacion')
    expect(screen.getByText('contenido protegido')).toBeInTheDocument()
  })

  it('manda a su inicio a quien no tiene el módulo', () => {
    renderGuarded(makeUser(['docente']), 'asignacion')
    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('/tutor')
  })

  it('sin sesión va al login y sin módulos a /sin-acceso', () => {
    renderGuarded(null, 'asignacion')
    expect(screen.getByTestId('where')).toHaveTextContent('/login')
    cleanup()
    renderGuarded(makeUser([], { modules: [] }), 'asignacion')
    expect(screen.getByTestId('where')).toHaveTextContent('/sin-acceso')
  })
})

describe('menú según /auth/me', () => {
  const renderMenu = (user: User) => render(<MemoryRouter><Sidebar user={user} onLogout={() => {}} /></MemoryRouter>)

  it('coordinación ve Gestión y no el menú de estudiante', () => {
    renderMenu(makeUser(['coordinador']))
    expect(screen.getByRole('button', { name: 'Asignación de tutores' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Propuestas estudiantiles' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Comités' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mi proceso de grado' })).not.toBeInTheDocument()
    expect(screen.getByText('Coordinación')).toBeInTheDocument()
  })

  it('el estudiante ve su menú propio', () => {
    renderMenu(makeUser(['estudiante']))
    expect(screen.getByRole('button', { name: 'Mi proceso de grado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mis propuestas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignación de tutores' })).not.toBeInTheDocument()
  })

  it('el docente ve el espacio del tutor', () => {
    renderMenu(makeUser(['docente']))
    expect(screen.getByRole('button', { name: 'Panel del tutor' })).toBeInTheDocument()
  })

  it('un jurado externo ve Calificaciones y Entidades externas, nada de coordinación', () => {
    renderMenu(makeUser(['externo']))
    expect(screen.getByRole('button', { name: 'Calificaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entidades externas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignación de tutores' })).not.toBeInTheDocument()
  })

  it('el menú solo muestra lo que traen los módulos, aunque sean de otro perfil', () => {
    // Si el backend da 'comites' a alguien, aparece; si no lo da, no aparece. El frontend no decide.
    renderMenu(makeUser(['coordinador'], { modules: [...makeUser(['coordinador']).modules, 'comites'] }))
    expect(screen.getByRole('button', { name: 'Comités' })).toBeInTheDocument()
    expect(hasModule(makeUser(['coordinador']), 'comites')).toBe(false)
  })
})
