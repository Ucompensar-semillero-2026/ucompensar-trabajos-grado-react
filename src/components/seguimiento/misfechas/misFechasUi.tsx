import { AlertCircle, CheckCircle2, CircleDot, Clock, Download, Eye, FileDown, History, MessageSquareText } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { DeliverableOut } from '@/services/workplan.service'
import { IconLink, iconBtn } from '@/components/proceso/documentos/documentosUi'
import { DeliverButton } from '@/components/proceso/entrega/DeliverButton'
import { BUCKET_TONE, bucketLabel, bucketOf, type Bucket } from './misFechasHelpers'

const ICON: Record<Bucket, typeof CheckCircle2> = { aprobado: CheckCircle2, revision: Clock, pendiente: CircleDot, vencido: AlertCircle }

export function BucketPill({ deliverable: d, hasDraft, className }: { deliverable: DeliverableOut; hasDraft: boolean; className?: string }) {
  const bucket = bucketOf(d)
  const Icon = ICON[bucket]
  return (
    <span className={cn('inline-flex min-h-[28px] items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold leading-none shadow-sm', BUCKET_TONE[bucket].badge, className)}>
      <Icon size={15} aria-hidden="true" />
      {bucketLabel(d, hasDraft)}
    </span>
  )
}

const textBtn =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[12.5px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1'

/**
 * Acciones permitidas según el estado real: «Entregar» solo si el backend lo permite (`can_submit`), ver/descargar solo si hay
 * entrega OFICIAL, plantilla solo si existe. «Historial» y «Observaciones» abren el mismo detalle del entregable.
 */
export function DateRowActions({ deliverable: d, onOpen }: { deliverable: DeliverableOut; onOpen: (deliverableId: string) => void }) {
  const current = d.current_submission
  const open = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onOpen(d.public_id) }
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {current && <IconLink href={current.download_url} label={`Ver entrega oficial de ${d.title}`}><Eye size={17} aria-hidden="true" /></IconLink>}
      {current && <IconLink href={current.download_url} label={`Descargar entrega oficial de ${d.title}`} download><Download size={17} aria-hidden="true" /></IconLink>}
      {d.template_download_url && <IconLink href={d.template_download_url} label={`Descargar plantilla de ${d.title}`} download><FileDown size={17} aria-hidden="true" /></IconLink>}
      {d.submissions_count > 0 && (
        <button type="button" className={iconBtn} aria-label={`Ver historial de ${d.title}`} title="Ver historial de versiones" onClick={open}><History size={17} aria-hidden="true" /></button>
      )}
      {(current?.reviews.length ?? 0) > 0 && (
        <button type="button" className={iconBtn} aria-label={`Ver observaciones de ${d.title}`} title="Ver observaciones del tutor" onClick={open}><MessageSquareText size={17} aria-hidden="true" /></button>
      )}
      {d.can_submit && (
        <DeliverButton size="sm" onClick={open} aria-label={`Abrir entrega de ${d.title}`}>
          Entregar
        </DeliverButton>
      )}
      <button type="button" onClick={open} aria-label={`Ver detalle de ${d.title}`} className={cn(textBtn, 'border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[#0E6B9C] hover:text-[#0E6B9C] focus-visible:outline-[#0E6B9C]')}>
        <Eye size={14} aria-hidden="true" />Ver detalle
      </button>
    </div>
  )
}
