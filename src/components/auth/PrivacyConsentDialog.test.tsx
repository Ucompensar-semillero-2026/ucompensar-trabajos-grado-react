import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PrivacyConsentDialog } from './PrivacyConsentDialog'
import { LoginScreen } from './LoginScreen'
import { toStoreUser } from '@/hooks/useAuth'
import type { MeOut } from '@/types/api'

afterEach(cleanup)

const URL = 'https://ucompensar.edu.co/pdf/documentos/Tratamiento-de-datos-personales.pdf'

function renderDialog(onAccept = vi.fn(async () => null as string | null), onLogout = vi.fn()) {
  render(<PrivacyConsentDialog open policyUrl={URL} policyVersion="TEC-SIN-PO-001 v00" onAccept={onAccept} onLogout={onLogout} />)
  return { onAccept, onLogout }
}

describe('PrivacyConsentDialog (Ley 1581)', () => {
  it('muestra los 5 elementos que pide la política de UCompensar', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Tratamiento de tus datos personales' })).toBeInTheDocument()
    expect(screen.getByText(/Fundación Universitaria Compensar \(NIT 860\.506\.140-6\)/)).toBeInTheDocument() // responsable
    expect(screen.getByText(/gestionar el proceso/)).toBeInTheDocument() // finalidad
    expect(screen.getByText(/conocer, actualizar, rectificar y suprimir/)).toBeInTheDocument() // derechos
    expect(screen.getByRole('link', { name: 'notificacionesjudiciales@ucompensar.edu.co' })).toBeInTheDocument() // cómo ejercerlos
    expect(screen.getByRole('link', { name: /política de tratamiento de datos completa/ })).toHaveAttribute('href', URL) // política
    expect(screen.getByText(/TEC-SIN-PO-001 v00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acepto' })).toHaveFocus()
  })

  it('aceptar llama al servidor; si falla, dice por qué y sigue abierta', async () => {
    const onAccept = vi.fn(async () => 'La política de tratamiento de datos cambió. Recarga la página y revísala de nuevo.')
    renderDialog(onAccept)

    fireEvent.click(screen.getByRole('button', { name: 'Acepto' }))

    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('alert')).toHaveTextContent('La política de tratamiento de datos cambió')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('quien no acepta puede salir', () => {
    const { onLogout } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /No acepto, salir/ }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('cerrada no pinta nada', () => {
    render(<PrivacyConsentDialog open={false} policyUrl={URL} policyVersion="v" onAccept={vi.fn()} onLogout={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('aviso y datos de la sesión', () => {
  it('el login avisa y enlaza la política', () => {
    render(<LoginScreen onMicrosoftLogin={vi.fn()} />)

    expect(screen.getByText(/tratará tus datos personales para gestionar tu trabajo de grado/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'política de tratamiento de datos' })).toHaveAttribute('href', URL)
  })

  it('GET /auth/me decide si hay que pedir la aceptación', async () => {
    const me = {
      public_id: 'u1', full_name: 'Ana Estudiante', email: 'a@ucompensar.edu.co', roles: ['estudiante'], modules: [],
      privacy_accepted: false, privacy_policy_version: 'TEC-SIN-PO-001 v00', privacy_policy_url: URL,
    } as unknown as MeOut

    await waitFor(() => expect(toStoreUser(me).privacy).toEqual({ accepted: false, version: 'TEC-SIN-PO-001 v00', url: URL }))
    expect(toStoreUser({ ...me, privacy_policy_version: undefined } as MeOut).privacy).toBeUndefined()
  })
})
