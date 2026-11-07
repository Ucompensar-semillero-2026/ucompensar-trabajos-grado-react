import { Link } from 'react-router-dom'
import { ArrowLeft, Download, FileSpreadsheet, FolderOpen, PencilLine } from 'lucide-react'
import { cn } from '@/utils/cn'

const btn = 'inline-flex h-11 w-full cursor-pointer sm:w-auto items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B1A]'

interface DossierHeaderProps {
  /** Solo el tutor del proyecto registra intervenciones (el backend lo exige): para el resto no se muestra el botón. */
  canRegister: boolean
  ready: boolean
  onRegister: () => void
  onDownload: () => void
  onExport: () => void
}

export function DossierHeader({ canRegister, ready, onRegister, onDownload, onExport }: DossierHeaderProps) {
  return (
    <div className="fu-rise space-y-2">
      <Link to="/seguimiento" className="inline-flex items-center gap-2 text-[13px] font-bold text-[#1565C0] hover:underline dark:text-sky-300">
        <ArrowLeft size={15} aria-hidden="true" />Volver a seguimiento y alertas
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFB020] to-[#FF6B1A] text-white shadow-lg shadow-orange-500/30">
            <FolderOpen size={28} />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-tight text-[var(--color-secondary)] md:text-[28px]">Expediente del estudiante</h1>
            <p className="text-[13.5px] text-[var(--color-text-muted)]">Seguimiento detallado del proyecto, avances, entregables, alertas e intervenciones.</p>
          </div>
        </div>
        <div className="grid w-full grid-cols-1 gap-2.5 sm:flex sm:w-auto sm:flex-wrap">
          {canRegister && (
            <button type="button" onClick={onRegister} disabled={!ready} className={cn(btn, 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-secondary)] hover:border-[#1565C0]')}>
              <PencilLine size={16} aria-hidden="true" />Registrar intervención
            </button>
          )}
          <button
            type="button"
            onClick={onDownload}
            disabled={!ready}
            title="Descarga el expediente completo en un archivo HTML listo para imprimir o guardar como PDF"
            className={cn(btn, 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-secondary)] hover:border-[#1565C0]')}
          >
            <Download size={16} aria-hidden="true" />Descargar expediente
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={!ready}
            title="Exporta el historial de actividades en CSV (Excel)"
            className={cn(btn, 'bg-[#062B4F] text-white shadow-md shadow-[#062B4F]/30 hover:bg-[#031C34]')}
          >
            <FileSpreadsheet size={16} aria-hidden="true" />Exportar
          </button>
        </div>
      </div>
    </div>
  )
}
