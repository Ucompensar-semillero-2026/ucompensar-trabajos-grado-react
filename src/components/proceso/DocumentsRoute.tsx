import { DocumentosSection } from '@/components/documentos/DocumentosSection'
import { isStudentRole } from '@/config/access'
import { useAppStore } from '@/stores/app.store'
import { EntregablesSection } from './EntregablesSection'

// La ruta /documentos se conserva para todos los roles: el estudiante ve sus entregables por etapa y
// el resto de roles mantiene el repositorio de documentos con revisión. No cambia ningún permiso.
export function DocumentsRoute() {
  const role = useAppStore((s) => s.currentUser?.role)
  return role && isStudentRole(role) ? <EntregablesSection /> : <DocumentosSection />
}
