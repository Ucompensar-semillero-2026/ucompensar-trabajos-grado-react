import { CommitteeDashboard } from '@/components/dashboard/CommitteeDashboard'
import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { ExternalDashboard } from '@/components/dashboard/ExternalDashboard'
import { StudentDashboard } from '@/components/dashboard/StudentDashboard'
import { TutorPanel } from '@/components/tutor/TutorPages'
import { isCommitteeUser, isCoordinationUser, isExternalUser, isStudentRole, isTutorWorkspaceUser } from '@/config/access'
import { useAppStore } from '@/stores/app.store'
import { CoordinationDashboard } from './CoordinationDashboard'

// /dashboard es una sola pantalla para todos; cada rol ve su propio panel (un archivo por panel).
// Solo cambia la presentación, no los permisos: los datos ya llegan filtrados por el backend según quién consulta.
export function DashboardRoute() {
  const user = useAppStore((s) => s.currentUser)
  if (!user) return <DashboardSection />
  if (isCoordinationUser(user)) return <CoordinationDashboard />
  if (isStudentRole(user.role)) return <StudentDashboard />
  if (isTutorWorkspaceUser(user)) return <TutorPanel />
  if (isCommitteeUser(user)) return <CommitteeDashboard />
  if (isExternalUser(user)) return <ExternalDashboard />
  return <DashboardSection />
}
