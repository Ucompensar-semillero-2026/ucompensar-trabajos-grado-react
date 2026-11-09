import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LoadError } from './LoadError'
import { errorMessage } from './errorMessage'
import { ApiError } from '@/services/http'

afterEach(cleanup)

describe('LoadError', () => {
  it('muestra la causa y deja reintentar', () => {
    const onRetry = vi.fn()
    render(<LoadError message="El servidor tuvo un problema. Intenta de nuevo en unos minutos." onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('El servidor tuvo un problema')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('usa el mensaje del servidor y, si no hay, uno propio', () => {
    expect(errorMessage(new ApiError(403, 'No tienes permiso para hacer esto.'), 'x')).toBe('No tienes permiso para hacer esto.')
    expect(errorMessage(new Error('interno'), 'No se pudo cargar.')).toBe('No se pudo cargar.')
  })
})
