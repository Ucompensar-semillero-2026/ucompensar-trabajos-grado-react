import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hasModule, homePathFor, type ModuleKey } from '@/config/access'
import { NO_ACCESS_PATH } from '@/config/roles'
import { useAppStore } from '@/stores/app.store'

interface RequireModuleProps {
  // Sin `module`: basta con tener algún módulo (una cuenta con algún rol conocido).
  module?: ModuleKey
  children: ReactNode
}

// Guarda de rutas por MÓDULO, según GET /auth/me -> `modules`. Es comodidad
// de interfaz, no seguridad: quien decide es el backend en cada endpoint.
// Sin sesión -> /login; sin ningún módulo -> /sin-acceso; sin este módulo ->
// su propio inicio.
export function RequireModule({ module, children }: RequireModuleProps) {
  const { currentUser } = useAppStore()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }
  if (currentUser.modules.length === 0) {
    return <Navigate to={NO_ACCESS_PATH} replace />
  }
  if (module && !hasModule(currentUser, module)) {
    return <Navigate to={homePathFor(currentUser.modules)} replace />
  }
  return <>{children}</>
}
