import { useEffect, useRef } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { DeliverButton } from './DeliverButton'
import { formatMoment } from '@/components/seguimiento/monitoringUi'

interface Props {
  fileName: string
  version: number
  taskTitle: string
  late: boolean
  publishing: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Confirmación previa a publicar. Un solo «Confirmar entrega»: queda deshabilitado mientras se publica. */
export function SubmissionConfirmationDialog({ fileName, version, taskTitle, late, publishing, onCancel, onConfirm }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { confirmRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !publishing) { e.stopPropagation(); onCancel() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, publishing])

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#031C34]/45 p-4 backdrop-blur-[2px]">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc" className="fu-rise w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-6 shadow-2xl">
        <h2 id="confirm-title" className="font-display text-[20px] font-extrabold text-[var(--color-secondary)]">¿Confirmas la entrega?</h2>
        <p id="confirm-desc" className="mt-2 text-[13.5px] text-[var(--color-text)]">Tu documento quedará publicado para que tu tutor pueda revisarlo. Verifica que sea la versión correcta antes de continuar.</p>
        <dl className="mt-4 space-y-1.5 rounded-xl bg-[#F2F6FC] p-3.5 text-[13px] dark:bg-white/5">
          <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Archivo</dt><dd className="truncate font-bold text-[var(--color-secondary)]" title={fileName}>{fileName}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Versión</dt><dd className="font-bold text-[var(--color-secondary)]">Versión {version}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Tarea</dt><dd className="text-right font-bold text-[var(--color-secondary)]">{taskTitle}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Publicación estimada</dt><dd className="font-bold text-[var(--color-secondary)]">{formatMoment(new Date().toISOString())}</dd></div>
        </dl>
        {late && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border-2 border-[#DC2626] bg-[#FEE2E2] p-3 text-[12.5px] font-semibold text-red-900 dark:bg-red-500/10 dark:text-red-100">
            <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[#DC2626]" />La fecha límite ya pasó: la entrega quedará registrada fuera de plazo.
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <button type="button" onClick={onCancel} disabled={publishing} className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-[var(--color-border)] px-4 text-[13px] font-bold text-[var(--color-secondary)] hover:border-[#1565C0] disabled:opacity-50">Volver a revisar</button>
          <DeliverButton ref={confirmRef} size="md" onClick={onConfirm} disabled={publishing} icon={publishing ? <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : undefined}>
            {publishing ? 'Publicando…' : 'Confirmar entrega'}
          </DeliverButton>
        </div>
      </div>
    </div>
  )
}
