import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { isCoordinationUser } from '@/config/access'
import { useAppStore } from '@/stores/app.store'
import { CoordinationDashboard } from './CoordinationDashboard'

// /dashboard se conserva para todos los roles: Coordinación (y Administración) ve su panel de gestión;
// el resto mantiene el tablero general. Solo cambia la presentación, no los permisos.
export function DashboardRoute() {
  const user = useAppStore((s) => s.currentUser)
  return user && isCoordinationUser(user) ? <CoordinationDashboard /> : <DashboardSection />
}
