import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAppStore } from '@/stores/app.store'
import { NAV_ITEMS } from '@/constants'
import { isStudentRole } from '@/config/access'

interface DashboardLayoutProps {
  onLogout: () => void
}

export function DashboardLayout({ onLogout }: DashboardLayoutProps) {
  const { currentUser, searchQuery, setSearchQuery } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  // Derive activeSection from current path
  // Rutas anidadas (p. ej. /trazabilidad/:processId) pertenecen a su sección base; para el
  // estudiante el detalle de trazabilidad es parte de "Mis trámites".
  const activeItem =
    NAV_ITEMS.find(item => item.path === location.pathname) ||
    NAV_ITEMS.find(item => location.pathname.startsWith(`${item.path}/`)) ||
    NAV_ITEMS[0]
  const activeSection = isStudentRole(currentUser.role) && activeItem.id === 'trazabilidad' ? 'tramites' : activeItem.id

  return (
    <div className="flex h-screen">
      <Sidebar
        user={currentUser}
        onLogout={onLogout}
      />
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--color-bg)]">
        <Topbar
          activeSection={activeSection}
          onNewTramite={() => navigate('/nuevo')}
          onLogout={onLogout}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-premium">
          <div className="animate-in">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
