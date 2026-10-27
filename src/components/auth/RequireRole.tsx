import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { NO_ACCESS_PATH, hasAnyRole, homePathFor, type InstitutionalRole } from '@/config/roles'
import { useAppStore } from '@/stores/app.store'

interface RequireRoleProps {
  // Sin `roles`: basta con tener al menos un rol institucional.
  roles?: readonly InstitutionalRole[]
  children: ReactNode
}

// Guard por rol INSTITUCIONAL (App Roles de Entra ID). Es comodidad de
// interfaz, no seguridad: quien de verdad decide es el backend en cada
// endpoint. Sin sesión -> /login; sin ningún rol -> /sin-acceso; con
// roles pero no los de esta ruta -> su propio panel de inicio.
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { currentUser } = useAppStore()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  const userRoles = currentUser.institutionalRoles
  if (userRoles.length === 0) {
    return <Navigate to={NO_ACCESS_PATH} replace />
  }

  if (roles && !hasAnyRole(userRoles, roles)) {
    return <Navigate to={homePathFor(userRoles)} replace />
  }

  return <>{children}</>
}
