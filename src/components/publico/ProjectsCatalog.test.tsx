import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ProjectsCatalog } from './ProjectsCatalog'

afterEach(cleanup)

function mockScrollEnvironment(reduceMotion = false) {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
  const scrollIntoView = vi.fn()

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: reduceMotion }),
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })

  return {
    scrollIntoView,
    restore() {
      if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia)
      else Reflect.deleteProperty(window, 'matchMedia')

      if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    },
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

describe('ProjectsCatalog navigation', () => {
  it('opens the existing institutional login route from the public catalog', () => {
    render(
      <MemoryRouter initialEntries={['/proyectos-de-grado']}>
        <ProjectsCatalog />
        <LocationProbe />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '¿Ya te postulaste a una oferta de proyecto de grado?' })).toBeInTheDocument()
    expect(screen.getByText('Consulta el estado de tu postulación, conoce los avances y realiza seguimiento a tu proceso académico desde el Portal de Trabajos de Grado.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Ingresar al portal' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar al portal' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('moves down from the hero once and ignores repeated wheel events during the transition', () => {
    const { scrollIntoView, restore } = mockScrollEnvironment()
    try {
      render(
        <MemoryRouter initialEntries={['/proyectos-de-grado']}>
          <ProjectsCatalog />
        </MemoryRouter>,
      )

      const hero = screen.getByRole('heading', { name: /Encuentra el proyecto de grado/ }).closest('section') as HTMLElement
      const modalities = document.getElementById('modalidades') as HTMLElement

      expect(fireEvent.wheel(hero, { deltaY: 14 })).toBe(true)
      expect(fireEvent.wheel(hero, { deltaY: 18 })).toBe(false)
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView.mock.instances[0]).toBe(modalities)
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })

      expect(fireEvent.wheel(hero, { deltaY: 40 })).toBe(true)
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })

  it('returns to the hero only when scrolling up from the start of modalities', () => {
    const { scrollIntoView, restore } = mockScrollEnvironment()
    const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')
    try {
      render(
        <MemoryRouter initialEntries={['/proyectos-de-grado']}>
          <ProjectsCatalog />
        </MemoryRouter>,
      )

      const hero = screen.getByRole('heading', { name: /Encuentra el proyecto de grado/ }).closest('section') as HTMLElement
      const modalities = document.getElementById('modalidades') as HTMLElement
      expect(fireEvent.wheel(modalities, { deltaY: -40 })).toBe(false)
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView.mock.instances[0]).toBe(hero)
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })

      expect(fireEvent.wheel(modalities, { deltaY: -40 })).toBe(true)
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
    } finally {
      if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY)
      restore()
    }
  })

  it('keeps upward wheel movement normal after the start of modalities', () => {
    const { scrollIntoView, restore } = mockScrollEnvironment()
    const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')
    try {
      render(
        <MemoryRouter initialEntries={['/proyectos-de-grado']}>
          <ProjectsCatalog />
        </MemoryRouter>,
      )

      const modalities = document.getElementById('modalidades') as HTMLElement
      vi.spyOn(modalities, 'getBoundingClientRect').mockReturnValue({ top: -500 } as DOMRect)
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 })

      expect(fireEvent.wheel(modalities, { deltaY: -40 })).toBe(true)
      expect(scrollIntoView).not.toHaveBeenCalled()
    } finally {
      if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY)
      restore()
    }
  })

  it('keeps the explicit button functional and uses immediate scroll for reduced motion', () => {
    const { scrollIntoView, restore } = mockScrollEnvironment(true)
    try {
      render(
        <MemoryRouter initialEntries={['/proyectos-de-grado']}>
          <ProjectsCatalog />
        </MemoryRouter>,
      )

      const modalities = document.getElementById('modalidades') as HTMLElement
      const hero = screen.getByRole('heading', { name: /Encuentra el proyecto de grado/ }).closest('section') as HTMLElement
      fireEvent.click(screen.getAllByRole('button', { name: /Explorar modalidades/ })[0])
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' })
      expect(scrollIntoView.mock.instances[0]).toBe(modalities)

      fireEvent.wheel(modalities, { deltaY: -40 })
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' })
      expect(scrollIntoView.mock.instances[1]).toBe(hero)
    } finally {
      restore()
    }
  })
})
