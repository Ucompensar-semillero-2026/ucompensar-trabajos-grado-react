import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { getSectionMeta } from './sectionMeta'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonitoringHeroArt } from '@/components/seguimiento/MonitoringHeroArt'
import { audienceOf } from '@/config/navLabels'
import { DocumentsHeroArt } from '@/components/proceso/documentos/DocumentsHeroArt'
import { MyDatesHeroArt } from '@/components/seguimiento/misfechas/MyDatesHeroArt'
import { EXPEDIENTE_PATH } from '@/components/seguimiento/expediente/dossierHelpers'
import { useAppStore } from '@/stores/app.store'
import { NAV_ITEMS, TUTOR_ROUTE_SECTIONS } from '@/constants'
import { hasModule } from '@/config/access'

interface DashboardLayoutProps {
  onLogout: () => void
}

export function DashboardLayout({ onLogout }: DashboardLayoutProps) {
  const { currentUser, searchQuery, setSearchQuery } = useAppStore()
  const location = useLocation()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  // Rutas anidadas (p. ej. /trazabilidad/:processId) pertenecen a su sección base; para el
  // estudiante el detalle de trazabilidad es parte de "Mis trámites".
  const activeItem =
    NAV_ITEMS.find(item => item.path === location.pathname) ||
    NAV_ITEMS.find(item => location.pathname.startsWith(`${item.path}/`)) ||
    NAV_ITEMS[0]
  const isStudent = hasModule(currentUser, 'workspace-student')
  const tutorSection = TUTOR_ROUTE_SECTIONS.find((r) =>
    r.exact ? location.pathname === r.prefix : location.pathname === r.prefix || location.pathname.startsWith(`${r.prefix}/`)
  )
  const activeSection = tutorSection?.section ?? (isStudent && activeItem.id === 'trazabilidad' ? 'tramites' : activeItem.id)
  const meta = getSectionMeta(activeSection, audienceOf(currentUser))

  return (
    // .dashboard-shell activa los tokens de la identidad de Ingeniería (ver globals.css)
    <div className="dashboard-shell flex h-screen">
      <Sidebar
        user={currentUser}
        onLogout={onLogout}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg)]">
        <Topbar
          onLogout={onLogout}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-premium">
          {/* El expediente del estudiante trae su propio encabezado (volver, título y acciones). */}
          {!EXPEDIENTE_PATH.test(location.pathname) && (<PageHeader title={meta.title} description={meta.description} showArt={meta.art} illustration={meta.illustration === 'monitoring' ? <MonitoringHeroArt /> : meta.illustration === 'documents' ? <DocumentsHeroArt /> : meta.illustration === 'dates' ? <MyDatesHeroArt /> : undefined} />)}
          <div className="animate-in">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
