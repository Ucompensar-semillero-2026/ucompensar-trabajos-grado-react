import { CommitteeDashboard } from '@/components/dashboard/CommitteeDashboard'
import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { ExternalDashboard } from '@/components/dashboard/ExternalDashboard'
import { StudentDashboard } from '@/components/dashboard/StudentDashboard'
import { TutorPanel } from '@/components/tutor/TutorPages'
import { hasModule } from '@/config/access'
import { useAppStore } from '@/stores/app.store'
import { CoordinationDashboard } from './CoordinationDashboard'

// /dashboard es una sola pantalla para todos; cada espacio de trabajo ve su propio panel (un archivo por panel).
// El espacio de trabajo lo manda el backend en `modules` (GET /auth/me). Solo cambia la presentación,
// no los permisos: los datos ya llegan filtrados por el backend según quién consulta.
export function DashboardRoute() {
  const user = useAppStore((s) => s.currentUser)
  if (hasModule(user, 'workspace-coordination')) return <CoordinationDashboard />
  if (hasModule(user, 'workspace-student')) return <StudentDashboard />
  if (hasModule(user, 'workspace-tutor')) return <TutorPanel />
  if (hasModule(user, 'workspace-committee')) return <CommitteeDashboard />
  if (hasModule(user, 'workspace-external')) return <ExternalDashboard />
  return <DashboardSection />
}
