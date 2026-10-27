import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import { useThemeStore } from '@/stores/theme.store'
import { useAuth } from '@/hooks/useAuth'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { AuthFlowContext } from '@/components/auth/AuthFlowContext'
import { RequireSection } from '@/components/auth/RequireSection'
import { RequireRole } from '@/components/auth/RequireRole'
import { NoAccessScreen } from '@/components/auth/NoAccessScreen'
import { MODULE_ROLES } from '@/config/access'
import { NO_ACCESS_PATH, homePathFor } from '@/config/roles'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

// Section imports
import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { TramitesSection } from '@/components/tramites/TramitesSection'
import { NuevoTramiteSection } from '@/components/tramites/NuevoTramiteSection'
import { BuscarSection } from '@/components/tramites/BuscarSection'
import { TrazabilidadSection } from '@/components/trazabilidad/TrazabilidadSection'
import { DocumentosSection } from '@/components/documentos/DocumentosSection'
import { ReportesSection } from '@/components/reportes/ReportesSection'
import { ComitesSection } from '@/components/comites/ComitesSection'
import { AdministrativoSection } from '@/components/administrativo/AdministrativoSection'
import { ExternoSection } from '@/components/externo/ExternoSection'
import { CalificacionesSection } from '@/components/calificaciones/CalificacionesSection'
import { NotificacionesSection } from '@/components/notificaciones/NotificacionesSection'
import { InstitutionalHome } from '@/components/publico/InstitutionalHome'
import { ProjectsCatalog } from '@/components/publico/ProjectsCatalog'
import { ProjectDetail } from '@/components/publico/ProjectDetail'
import { ModalityOpportunitiesPage } from '@/components/publico/ModalityOpportunitiesPage'

export default function App() {
  const { isAuthenticated, currentUser } = useAppStore()
  const { theme } = useThemeStore()
  const { logout, endSession, loginWithMicrosoft, microsoftError, isRestoringSession } = useAuth()
  const homePath = currentUser ? homePathFor(currentUser.institutionalRoles) : '/login'
  const location = useLocation()

  useEffect(() => {
    // For institucional branding, the login screen is always light
    const isLogin = location.pathname === '/login' || location.pathname === NO_ACCESS_PATH
    const activeTheme = isLogin ? 'light' : theme

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(activeTheme)
  }, [theme, location.pathname])

  // Mientras se intenta restaurar la sesión (ver useAuth), no renderizar
  // las rutas todavía: si no, alguien con una cookie de refresh válida
  // vería un parpadeo a /login antes de que la restauración termine y lo
  // mande de vuelta a /dashboard.
  if (isRestoringSession) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-bg)]">
        <p className="text-[12.5px] text-[var(--color-text-dim)]">Cargando…</p>
      </div>
    )
  }

  return (
    <AuthFlowContext.Provider value={{ loginWithMicrosoft, endSession, loginError: microsoftError }}>
      <Routes>
        {/* Public institutional prototype */}
        <Route path="/" element={<InstitutionalHome />} />
        <Route path="/proyectos-de-grado" element={<ProjectsCatalog />} />
        <Route path="/proyectos-de-grado/modalidad/:modalitySlug" element={<ModalityOpportunitiesPage />} />
        <Route path="/proyectos-de-grado/:offerId" element={<ProjectDetail />} />
        {/* Public — Login */}
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to={homePath} replace />
              : <LoginScreen
                  onMicrosoftLogin={() => void loginWithMicrosoft()}
                  microsoftError={microsoftError}
                />
          }
        />

        {/* Cuenta válida pero sin rol institucional */}
        <Route path={NO_ACCESS_PATH} element={<NoAccessScreen onLogout={logout} />} />

        {/* Authenticated — Shared sidebar layout (pathless route).
            RequireRole sin `roles`: exige al menos un rol institucional. */}
        <Route
          element={
            <RequireRole>
              <DashboardLayout onLogout={logout} />
            </RequireRole>
          }
        >
          <Route path="/dashboard" element={<DashboardSection />} />
          <Route path="/tramites" element={<TramitesSection />} />
          <Route
            path="/nuevo"
            element={
              <RequireRole roles={MODULE_ROLES.nuevo}>
                <RequireSection section="nuevo">
                  <NuevoTramiteSection />
                </RequireSection>
              </RequireRole>
            }
          />
          <Route
            path="/buscar"
            element={
              <RequireRole roles={MODULE_ROLES.buscar}>
                <BuscarSection />
              </RequireRole>
            }
          />
          <Route path="/trazabilidad" element={<TrazabilidadSection />} />
          <Route path="/trazabilidad/:processId" element={<TrazabilidadSection />} />
          <Route path="/documentos" element={<DocumentosSection />} />
          <Route
            path="/comites"
            element={
              <RequireRole roles={MODULE_ROLES.comites}>
                <RequireSection section="comites">
                  <ComitesSection />
                </RequireSection>
              </RequireRole>
            }
          />
          <Route
            path="/administrativo"
            element={
              <RequireRole roles={MODULE_ROLES.administrativo}>
                <AdministrativoSection />
              </RequireRole>
            }
          />
          <Route
            path="/externo"
            element={
              <RequireRole roles={MODULE_ROLES.externo}>
                <ExternoSection />
              </RequireRole>
            }
          />
          <Route
            path="/calificaciones"
            element={
              <RequireRole roles={MODULE_ROLES.calificaciones}>
                <CalificacionesSection />
              </RequireRole>
            }
          />
          <Route path="/notificaciones" element={<NotificacionesSection />} />
          <Route
            path="/reportes"
            element={
              <RequireRole roles={MODULE_ROLES.reportes}>
                <ReportesSection />
              </RequireRole>
            }
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthFlowContext.Provider>
  )
}
