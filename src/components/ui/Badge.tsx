import { cn } from '@/utils/cn'
import type { TramiteEstado, DocumentoTipo } from '@/types'

type BadgeVariant = 'orange' | 'green' | 'blue' | 'gray' | 'red'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantMap: Record<BadgeVariant, string> = {
  orange: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--color-primary)]/20',
  green: 'bg-[var(--color-teal-soft)] text-[var(--color-teal)] border border-[var(--color-teal)]/20',
  blue: 'bg-[var(--color-secondary-soft)] text-[var(--color-secondary)] border border-[var(--color-secondary)]/20',
  gray: 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)]',
  red: 'bg-red-500/10 text-red-500 border border-red-500/20',
}

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold',
        variantMap[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function EstadoBadge({ estado }: { estado: TramiteEstado }) {
  const map: Record<TramiteEstado, { label: string; variant: BadgeVariant }> = {
    borrador: { label: 'Borrador', variant: 'gray' },
    'en-revision': { label: 'En revisión', variant: 'orange' },
    'aprobado-consejo': { label: 'Aprobado consejo', variant: 'blue' },
    completado: { label: 'Completado', variant: 'green' },
    'docs-faltantes': { label: 'Docs faltantes', variant: 'red' },
  }
  const { label, variant } = map[estado]
  return <Badge variant={variant}>{label}</Badge>
}

export function TipoBadge({ tipo }: { tipo: DocumentoTipo }) {
  const map: Record<DocumentoTipo, BadgeVariant> = {
    Anteproyecto: 'orange',
    'Acta consejo': 'blue',
    'Carta aval': 'green',
    'Paz y salvo': 'gray',
    Resolución: 'gray',
  }
  return <Badge variant={map[tipo]}>{tipo}</Badge>
}

const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  'borrador':        { label: 'Borrador',         variant: 'gray'   },
  'en-revision':     { label: 'En revisión',      variant: 'orange' },
  'aprobado':        { label: 'Aprobado',         variant: 'blue'   },
  'aprobado-consejo':{ label: 'Aprobado consejo', variant: 'blue'   },
  'completado':      { label: 'Completado',       variant: 'green'  },
  'docs-faltantes':  { label: 'Docs faltantes',   variant: 'red'    },
}

const workflowStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  POSTULACION_INICIADA: { label: 'Postulación iniciada', variant: 'blue' },
  DOCUMENTOS_PENDIENTES: { label: 'Documentos pendientes', variant: 'orange' },
  AVAL_AREA_ESPECIALIZADA: { label: 'Pendiente de aval del área especializada', variant: 'orange' },
  EN_REVISION_COMITE_FACULTAD: { label: 'En revisión por Comité de Facultad', variant: 'orange' },
  PRESENTADO_COMITE_GENERAL: { label: 'Presentado ante Comité General', variant: 'blue' },
  APROBADO_COMITE_GENERAL: { label: 'Aprobado por Comité General', variant: 'green' },
  ANTEPROYECTO_EN_REVISION: { label: 'Anteproyecto en revisión', variant: 'orange' },
  AVANCES_EN_REVISION: { label: 'Avances en curso', variant: 'orange' },
  ACUERDO_PEDAGOGICO_FIRMADO: { label: 'Acuerdo pedagógico firmado', variant: 'blue' },
  EN_EJECUCION: { label: 'En ejecución', variant: 'orange' },
  ENTREGA_TRABAJO_ESCRITO: { label: 'Trabajo escrito entregado', variant: 'blue' },
  JURADOS_ASIGNADOS: { label: 'Jurados asignados', variant: 'blue' },
  CORRECCIONES_SOLICITADAS: { label: 'Correcciones solicitadas', variant: 'red' },
  EN_SUSTENTACION: { label: 'En sustentación', variant: 'orange' },
  CALIFICACION_REGISTRADA: { label: 'Calificación registrada', variant: 'green' },
  HOMOLOGACION_SOLICITADA: { label: 'Homologación solicitada', variant: 'blue' },
  HOMOLOGADO: { label: 'Homologado', variant: 'green' },
  MENCION_SOLICITADA: { label: 'Mención honorífica solicitada', variant: 'blue' },
  MENCION_CONFIRMADA: { label: 'Mención honorífica confirmada', variant: 'green' },
  EN_REPOSITORIO: { label: 'En trámite de repositorio', variant: 'blue' },
  PRORROGA_SOLICITADA: { label: 'Prórroga solicitada', variant: 'orange' },
  CERRADO: { label: 'Cerrado', variant: 'green' },
  REPROBADO: { label: 'Reprobado', variant: 'red' },
  CANCELADO: { label: 'Cancelado', variant: 'red' },
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const workflowEntry = workflowStatusMap[status.toLocaleUpperCase()]
  const inferredVariant: BadgeVariant = /CANCEL|RECHAZ|REPROB|DEVUEL|CORRECC/.test(status.toLocaleUpperCase())
    ? 'red'
    : /APROB|FINALIZ|HOMOLOG|CERRAD/.test(status.toLocaleUpperCase())
      ? 'green'
      : /REVISION|REVISI|AVAL|PENDIENTE|EJECUCION|ENTREGA|EN_/.test(status.toLocaleUpperCase())
        ? 'orange'
        : 'gray'
  const entry = statusMap[status] ?? workflowEntry ?? { label: label ?? status, variant: inferredVariant }
  return <Badge variant={workflowEntry?.variant ?? entry.variant}>{workflowEntry?.label ?? label ?? entry.label}</Badge>
}
