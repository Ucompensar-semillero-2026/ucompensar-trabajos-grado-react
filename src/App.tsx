import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import { useThemeStore } from '@/stores/theme.store'
import { useAuth } from '@/hooks/useAuth'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { AuthFlowContext } from '@/components/auth/AuthFlowContext'
import { RequireSection } from '@/components/auth/RequireSection'
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
  const { isAuthenticated } = useAppStore()
  const { theme } = useThemeStore()
  const { logout, endSession, loginWithCredentials, isLoggingIn, loginError, isRestoringSession } = useAuth()
  const location = useLocation()

  useEffect(() => {
    // For institucional branding, the login screen is always light
    const isLogin = location.pathname === '/login'
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
    <AuthFlowContext.Provider value={{ loginWithCredentials, endSession, isLoggingIn, loginError }}>
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
              ? <Navigate to="/dashboard" replace />
              : <LoginScreen
                  onCredentialsLogin={loginWithCredentials}
                  isLoggingIn={isLoggingIn}
                  loginError={loginError}
                />
          }
        />

        {/* Authenticated — Shared sidebar layout (pathless route) */}
        <Route element={<DashboardLayout onLogout={logout} />}>
          <Route path="/dashboard" element={<DashboardSection />} />
          <Route path="/tramites" element={<TramitesSection />} />
          <Route
            path="/nuevo"
            element={
              <RequireSection section="nuevo">
                <NuevoTramiteSection />
              </RequireSection>
            }
          />
          <Route path="/buscar" element={<BuscarSection />} />
          <Route path="/trazabilidad" element={<TrazabilidadSection />} />
          <Route path="/trazabilidad/:processId" element={<TrazabilidadSection />} />
          <Route path="/documentos" element={<DocumentosSection />} />
          <Route
            path="/comites"
            element={
              <RequireSection section="comites">
                <ComitesSection />
              </RequireSection>
            }
          />
          <Route path="/administrativo" element={<AdministrativoSection />} />
          <Route path="/externo" element={<ExternoSection />} />
          <Route path="/calificaciones" element={<CalificacionesSection />} />
          <Route path="/notificaciones" element={<NotificacionesSection />} />
          <Route path="/reportes" element={<ReportesSection />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthFlowContext.Provider>
  )
}
