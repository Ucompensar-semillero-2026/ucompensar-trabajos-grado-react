import { AlertTriangle, RotateCw } from 'lucide-react'

interface LoadErrorProps {
  message: string
  onRetry?: () => void
  className?: string
}

/**
 * Error al CARGAR datos. Antes varias pantallas mostraban una lista vacía («Sin avales todavía»), y un fallo del
 * servidor parecía «no hay nada». Ahora se dice qué pasó y se puede reintentar.
 */
export function LoadError({ message, onRetry, className = '' }: LoadErrorProps) {
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 dark:border-red-500/30 dark:bg-red-500/10 ${className}`}>
      <AlertTriangle size={16} className="shrink-0 text-red-600 dark:text-red-300" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[12.5px] text-red-700 dark:text-red-200">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-[12px] font-bold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/40 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-500/15"
        >
          <RotateCw size={13} aria-hidden="true" />
          Reintentar
        </button>
      )}
    </div>
  )
}
