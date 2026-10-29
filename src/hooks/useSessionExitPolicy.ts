import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import { isExitFromPortal, routeArea, type RouteArea } from '@/config/sessionPolicy'

/**
 * Cierra la sesión SOLO en la transición real portal → sitio público (ver config/sessionPolicy).
 * No actúa durante la restauración de sesión, en recargas, entre módulos protegidos, en el login ni al
 * volver de Microsoft (rutas neutrales), y nunca montar una página pública basta para disparar el cierre.
 */
export function useSessionExitPolicy(leavePortal: (publicPath: string) => unknown, isRestoringSession: boolean) {
  const { pathname, search, hash } = useLocation()
  const lastArea = useRef<RouteArea | null>(null)

  useEffect(() => {
    if (isRestoringSession) return
    const area = routeArea(pathname)
    if (!useAppStore.getState().isAuthenticated) {
      lastArea.current = area === 'neutral' ? null : area // sin sesión no hay nada que cerrar ni arrastrar
      return
    }
    if (area === 'neutral') return
    const previous = lastArea.current
    lastArea.current = area
    if (isExitFromPortal(previous, area)) void leavePortal(`${pathname}${search}${hash}`)
  }, [pathname, search, hash, isRestoringSession, leavePortal])
}
