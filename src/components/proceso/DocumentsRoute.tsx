import { DocumentosSection } from '@/components/documentos/DocumentosSection'
import { hasModule } from '@/config/access'
import { useAppStore } from '@/stores/app.store'
import { DocumentsCenter } from './documentos/DocumentsCenter'

// La ruta /documentos se conserva para todos los roles: el estudiante ve su centro de documentos (entregables por semestre, versiones y calendario) y
// el resto de roles mantiene el repositorio de documentos con revisión. No cambia ningún permiso.
export function DocumentsRoute() {
  const user = useAppStore((s) => s.currentUser)
  return hasModule(user, 'workspace-student') ? <DocumentsCenter /> : <DocumentosSection />
}
