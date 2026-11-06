import { Badge } from '@/components/ui'
import type { EstadoTramite } from '@/services/trazabilidad.service'

const META: Record<EstadoTramite, { label: string; variant: 'gray' | 'orange' | 'blue' | 'green' | 'red' }> = {
  BORRADOR: { label: 'Borrador', variant: 'gray' },
  ENVIADO: { label: 'Enviado', variant: 'blue' },
  EN_REVISION: { label: 'En revisión', variant: 'orange' },
  DEVUELTO: { label: 'Devuelto', variant: 'red' },
  APROBADO: { label: 'Aprobado', variant: 'green' },
  RECHAZADO: { label: 'Rechazado', variant: 'red' },
  EN_SUSTENTACION: { label: 'En sustentación', variant: 'orange' },
  FINALIZADO: { label: 'Finalizado', variant: 'green' },
}

export function EstadoBadge({ estado }: { estado: EstadoTramite }) {
  const meta = META[estado]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}
