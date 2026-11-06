import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import { useThemeStore } from '@/stores/theme.store'
import { useAuth } from '@/hooks/useAuth'
import { useSessionExitPolicy } from '@/hooks/useSessionExitPolicy'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { AuthFlowContext } from '@/components/auth/AuthFlowContext'
import { RequireModule } from '@/components/auth/RequireModule'
import { NoAccessScreen } from '@/components/auth/NoAccessScreen'
import { SessionClosedScreen } from '@/components/auth/SessionClosedScreen'
import { homePathFor } from '@/config/access'
import { NO_ACCESS_PATH } from '@/config/roles'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

// Section imports
import { TramitesSection } from '@/components/tramites/TramitesSection'
import { NuevoTramiteSection } from '@/components/tramites/NuevoTramiteSection'
import { BuscarSection } from '@/components/tramites/BuscarSection'
import { TrazabilidadSection } from '@/components/trazabilidad/TrazabilidadSection'
import { DocumentsRoute } from '@/components/proceso/DocumentsRoute'
import { MiProcesoSection } from '@/components/proceso/MiProcesoSection'
import { TutorPanel, TutorProjectsPage, TutorPlansPage, TutorReviewsPage, TutorStatsPage } from '@/components/tutor/TutorPages'
import { ProjectExpediente } from '@/components/tutor/ProjectExpediente'
import { AsignacionTutores } from '@/components/coordinacion/AsignacionTutores'
import { DashboardRoute } from '@/components/coordinacion/DashboardRoute'
import { PortafolioProyectos } from '@/components/coordinacion/PortafolioProyectos'
import { MisPropuestas } from '@/components/propuestas/MisPropuestas'
import { PropuestasEstudiantiles } from '@/components/propuestas/PropuestasEstudiantiles'
import { PropuestaDetalle } from '@/components/propuestas/PropuestaDetalle'
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
import { CalendarioAcademico } from '@/components/coordinacion/CalendarioAcademico'

export default function App() {
  const { isAuthenticated, currentUser } = useAppStore()
  const { theme } = useThemeStore()
  const { logout, leavePortal, endSession, loginWithMicrosoft, microsoftError, isRestoringSession } = useAuth()
  const homePath = currentUser ? homePathFor(currentUser.modules) : '/login'
  const location = useLocation()

  useEffect(() => {
    // For institucional branding, the login screen is always light
    const isLogin = location.pathname === '/login' || location.pathname === NO_ACCESS_PATH
    const activeTheme = isLogin ? 'light' : theme

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(activeTheme)
  }, [theme, location.pathname])

  // Política de sesión: cierra la sesión al salir del portal hacia una página pública (ver useSessionExitPolicy).
  useSessionExitPolicy(leavePortal, isRestoringSession)

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
        {/* Enlaces antiguos: el calendario vive dentro del catálogo, ya no es una página aparte */}
        <Route path="/proyectos-de-grado/calendario" element={<Navigate to="/proyectos-de-grado#calendario" replace />} />
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

        {/* Confirmación del cierre voluntario de sesión (única que informa del cierre) */}
        <Route path="/sesion-cerrada" element={<SessionClosedScreen />} />

        {/* Cuenta válida pero sin rol institucional */}
        <Route path={NO_ACCESS_PATH} element={<NoAccessScreen onLogout={logout} />} />

        {/* Authenticated — Shared sidebar layout (pathless route).
            RequireModule sin `module`: exige al menos un módulo (GET /auth/me). */}
        <Route
          element={
            <RequireModule>
              <DashboardLayout onLogout={logout} />
            </RequireModule>
          }
        >
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/mis-propuestas" element={<RequireModule module="mis-propuestas"><MisPropuestas /></RequireModule>} />
          {/* Coordinación académica: el backend exige coordinador/administrativo en cada endpoint */}
          <Route path="/coordinacion/portafolio" element={<RequireModule module="portafolio"><PortafolioProyectos /></RequireModule>} />
          <Route path="/coordinacion/calendario" element={<RequireModule module="calendario"><CalendarioAcademico /></RequireModule>} />
          <Route path="/coordinacion/propuestas" element={<RequireModule module="propuestas"><PropuestasEstudiantiles /></RequireModule>} />
          <Route path="/coordinacion/propuestas/:proposalId" element={<RequireModule module="propuestas"><PropuestaDetalle /></RequireModule>} />
          <Route path="/coordinacion/asignacion" element={<RequireModule module="asignacion"><AsignacionTutores /></RequireModule>} />
          <Route
            path="/coordinacion/proyectos/:processId"
            element={<RequireModule module="asignacion"><ProjectExpediente backTo={{ to: '/coordinacion/asignacion', label: 'Volver a la asignación de tutores' }} /></RequireModule>}
          />
          <Route
            path="/mi-proceso"
            element={
              <RequireModule module="proceso">
                <MiProcesoSection />
              </RequireModule>
            }
          />
          {/* Espacio del tutor: la asignación real (process_team) la valida el backend en cada endpoint */}
          <Route path="/tutor" element={<RequireModule module="tutor"><TutorPanel /></RequireModule>} />
          <Route path="/tutor/proyectos" element={<RequireModule module="tutor"><TutorProjectsPage /></RequireModule>} />
          <Route path="/tutor/proyectos/:processId" element={<RequireModule module="tutor"><ProjectExpediente /></RequireModule>} />
          <Route path="/tutor/planes" element={<RequireModule module="tutor"><TutorPlansPage /></RequireModule>} />
          <Route path="/tutor/revisiones" element={<RequireModule module="tutor"><TutorReviewsPage /></RequireModule>} />
          <Route path="/tutor/estadisticas" element={<RequireModule module="tutor"><TutorStatsPage /></RequireModule>} />
          <Route path="/tramites" element={<TramitesSection />} />
          <Route
            path="/nuevo"
            element={
              <RequireModule module="nuevo">
                <NuevoTramiteSection />
              </RequireModule>
            }
          />
          <Route
            path="/buscar"
            element={
              <RequireModule module="buscar">
                <BuscarSection />
              </RequireModule>
            }
          />
          <Route path="/trazabilidad" element={<TrazabilidadSection />} />
          <Route path="/trazabilidad/:processId" element={<TrazabilidadSection />} />
          <Route path="/documentos" element={<DocumentsRoute />} />
          <Route
            path="/comites"
            element={
              <RequireModule module="comites">
                <ComitesSection />
              </RequireModule>
            }
          />
          <Route
            path="/administrativo"
            element={
              <RequireModule module="administrativo">
                <AdministrativoSection />
              </RequireModule>
            }
          />
          <Route
            path="/externo"
            element={
              <RequireModule module="externo">
                <ExternoSection />
              </RequireModule>
            }
          />
          <Route
            path="/calificaciones"
            element={
              <RequireModule module="calificaciones">
                <CalificacionesSection />
              </RequireModule>
            }
          />
          <Route path="/notificaciones" element={<NotificacionesSection />} />
          <Route
            path="/reportes"
            element={
              <RequireModule module="reportes">
                <ReportesSection />
              </RequireModule>
            }
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthFlowContext.Provider>
  )
}
