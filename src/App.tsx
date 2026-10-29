import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/app.store'
import { useThemeStore } from '@/stores/theme.store'
import { useAuth } from '@/hooks/useAuth'
import { useSessionExitPolicy } from '@/hooks/useSessionExitPolicy'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { AuthFlowContext } from '@/components/auth/AuthFlowContext'
import { RequireSection } from '@/components/auth/RequireSection'
import { RequireRole } from '@/components/auth/RequireRole'
import { NoAccessScreen } from '@/components/auth/NoAccessScreen'
import { SessionClosedScreen } from '@/components/auth/SessionClosedScreen'
import { MODULE_ROLES } from '@/config/access'
import { NO_ACCESS_PATH, homePathFor } from '@/config/roles'
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

export default function App() {
  const { isAuthenticated, currentUser } = useAppStore()
  const { theme } = useThemeStore()
  const { logout, leavePortal, endSession, loginWithMicrosoft, microsoftError, isRestoringSession } = useAuth()
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
            RequireRole sin `roles`: exige al menos un rol institucional. */}
        <Route
          element={
            <RequireRole>
              <DashboardLayout onLogout={logout} />
            </RequireRole>
          }
        >
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/mis-propuestas" element={<RequireRole roles={MODULE_ROLES['mis-propuestas']}><MisPropuestas /></RequireRole>} />
          {/* Coordinación académica: el backend exige coordinador/administrativo en cada endpoint */}
          <Route path="/coordinacion/portafolio" element={<RequireRole roles={MODULE_ROLES.portafolio}><PortafolioProyectos /></RequireRole>} />
          <Route path="/coordinacion/propuestas" element={<RequireRole roles={MODULE_ROLES.propuestas}><PropuestasEstudiantiles /></RequireRole>} />
          <Route path="/coordinacion/propuestas/:proposalId" element={<RequireRole roles={MODULE_ROLES.propuestas}><PropuestaDetalle /></RequireRole>} />
          <Route path="/coordinacion/asignacion" element={<RequireRole roles={MODULE_ROLES.asignacion}><AsignacionTutores /></RequireRole>} />
          <Route
            path="/coordinacion/proyectos/:processId"
            element={<RequireRole roles={MODULE_ROLES.asignacion}><ProjectExpediente backTo={{ to: '/coordinacion/asignacion', label: 'Volver a la asignación de tutores' }} /></RequireRole>}
          />
          <Route
            path="/mi-proceso"
            element={
              <RequireRole roles={MODULE_ROLES.proceso}>
                <MiProcesoSection />
              </RequireRole>
            }
          />
          {/* Espacio del tutor: la asignación real (process_team) la valida el backend en cada endpoint */}
          <Route path="/tutor" element={<RequireRole roles={MODULE_ROLES.tutor}><TutorPanel /></RequireRole>} />
          <Route path="/tutor/proyectos" element={<RequireRole roles={MODULE_ROLES.tutor}><TutorProjectsPage /></RequireRole>} />
          <Route path="/tutor/proyectos/:processId" element={<RequireRole roles={MODULE_ROLES.tutor}><ProjectExpediente /></RequireRole>} />
          <Route path="/tutor/planes" element={<RequireRole roles={MODULE_ROLES.tutor}><TutorPlansPage /></RequireRole>} />
          <Route path="/tutor/revisiones" element={<RequireRole roles={MODULE_ROLES.tutor}><TutorReviewsPage /></RequireRole>} />
          <Route path="/tutor/estadisticas" element={<RequireRole roles={MODULE_ROLES.tutor}><TutorStatsPage /></RequireRole>} />
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
          <Route path="/documentos" element={<DocumentsRoute />} />
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
