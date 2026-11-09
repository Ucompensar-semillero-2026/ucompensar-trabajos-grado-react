import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Ban, CheckCircle2, Circle, Clock, Cloud, CloudUpload, Download, Eye, FileDown, FileSpreadsheet, FileText, Image as ImageIcon, Lock, PanelRightOpen, Presentation, TriangleAlert } from 'lucide-react'
import { cn } from '@/utils/cn'
import { resolveFileUrl } from '@/services/http'
import type { DeliverableOut } from '@/services/workplan.service'
import { DeliverButton } from '../entrega/DeliverButton'
import { DISPLAY_STATUS_LABEL, type DisplayStatus } from './documentosHelpers'

type IconType = LucideIcon

const STATUS_STYLE: Record<DisplayStatus, { Icon: IconType; cls: string }> = {
  aprobada: { Icon: CheckCircle2, cls: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300' },
  en_revision: { Icon: Clock, cls: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300' },
  con_correcciones: { Icon: AlertCircle, cls: 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300' },
  borrador: { Icon: Cloud, cls: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300' },
  vencida: { Icon: TriangleAlert, cls: 'border-red-400 bg-red-100 text-red-900 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-200' },
  disponible: { Icon: Circle, cls: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200' },
  pendiente: { Icon: Lock, cls: 'border-slate-300 bg-slate-50 text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-300' },
  no_aplica: { Icon: Ban, cls: 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]' },
}

export function StatusPill({ status, className }: { status: DisplayStatus; className?: string }) {
  const { Icon, cls } = STATUS_STYLE[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-bold leading-none', cls, className)}>
      <Icon size={13} aria-hidden="true" />
      {DISPLAY_STATUS_LABEL[status]}
    </span>
  )
}

/**
 * Nota oficial publicada de un entregable («4.5 / 5.0»). Sin nota publicada (pendiente, en revisión o sin dato) se muestra «—»:
 * nunca se infiere una nota del estado ni se muestra una provisional como definitiva.
 */
export function GradeCell({ grade, className }: { grade: number | null | undefined; className?: string }) {
  if (grade == null || !Number.isFinite(grade)) {
    return <span aria-label="Sin nota publicada" className={cn('block text-center text-[18px] font-bold leading-none text-[var(--color-text-muted)]', className)}>—</span>
  }
  return (
    <span className={cn('block whitespace-nowrap text-center text-[15px] font-extrabold text-[var(--color-secondary)]', className)}>
      {grade.toFixed(1)} <span className="font-semibold text-[var(--color-text-muted)]">/ 5.0</span>
    </span>
  )
}

/** Icono por tipo de documento: el de la entrega actual, si no el de la plantilla y, si no, el primer formato admitido. */
export function FileTypeIcon({ deliverable: d, className, tone }: { deliverable: DeliverableOut; className?: string; tone?: string }) {
  const name = (d.current_submission?.file_name ?? d.template_file_name ?? d.accepted_extensions?.[0] ?? '').toLowerCase()
  const Icon: IconType = /xls/.test(name) ? FileSpreadsheet : /ppt/.test(name) ? Presentation : /(png|jpe?g)$/.test(name) ? ImageIcon : FileText
  return (
    <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone ?? 'bg-[#0E6B9C]/10 text-[#0E6B9C] dark:bg-sky-400/15 dark:text-sky-300', className)}>
      <Icon size={20} />
    </span>
  )
}

export const iconBtn =
  'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-bg)] hover:text-[#0E6B9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0E6B9C]'

export function IconLink({ href, label, download, children }: { href: string; label: string; download?: boolean; children: ReactNode }) {
  return (
    <a href={resolveFileUrl(href)} target="_blank" rel="noopener noreferrer" download={download ? '' : undefined} aria-label={label} title={label} onClick={(e) => e.stopPropagation()} className={iconBtn}>
      {children}
    </a>
  )
}

/**
 * Acciones compactas de un entregable. Solo aparecen las que corresponden: entregar/ver (modal con el flujo de borrador y el
 * único «Entregar»), vista previa y descarga de la entrega OFICIAL, y plantilla. Los borradores nunca se ofrecen aquí.
 */
export function DeliverableActions({ deliverable: d, onOpen }: { deliverable: DeliverableOut; onOpen: (deliverableId: string) => void }) {
  const current = d.current_submission
  const hasHistory = d.submissions_count > 0
  return (
    <div className="flex items-center justify-end gap-0.5">
      {current && (
        <IconLink href={current.download_url} label={`Vista previa de ${d.title}`}>
          <Eye size={17} aria-hidden="true" />
        </IconLink>
      )}
      {current && (
        <IconLink href={current.download_url} label={`Descargar entrega de ${d.title}`} download>
          <Download size={17} aria-hidden="true" />
        </IconLink>
      )}
      {d.template_download_url && (
        <IconLink href={d.template_download_url} label={`Descargar plantilla de ${d.title}`} download>
          <FileDown size={17} aria-hidden="true" />
        </IconLink>
      )}
      {d.can_submit ? (
        <DeliverButton size="icon" icon={<CloudUpload size={18} aria-hidden="true" />} aria-label={`Abrir entrega de ${d.title}`} title="Abrir entrega: cargar, reemplazar o entregar" onClick={(e) => { e.stopPropagation(); onOpen(d.public_id) }} />
      ) : (
        (current || hasHistory) && (
          <button type="button" className={iconBtn} aria-label={`Ver entrega de ${d.title}`} title="Ver detalle, historial y observaciones" onClick={(e) => { e.stopPropagation(); onOpen(d.public_id) }}>
            <PanelRightOpen size={17} aria-hidden="true" />
          </button>
        )
      )}
    </div>
  )
}

/** Tarjeta de panel con el mismo estilo en las tres tarjetas laterales y en las pestañas. */
export function Panel({ title, Icon, action, children, className }: { title: string; Icon?: IconType; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]', className)}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-[var(--color-secondary)]">
          {Icon && <Icon size={18} aria-hidden="true" className="text-[#0E6B9C]" />}
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  )
}

export function EmptyNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-8 text-center">
      <p className="text-[14px] font-bold text-[var(--color-text)]">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--color-text-muted)]">{children}</p>}
    </div>
  )
}
