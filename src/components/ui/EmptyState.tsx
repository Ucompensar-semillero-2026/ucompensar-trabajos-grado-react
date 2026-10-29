import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

// Estado vacío sin datos simulados: un icono, un título breve y una explicación útil.
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-info-soft,rgba(8,118,185,0.1))] text-[#0876B9]">
        <Icon size={30} aria-hidden />
      </span>
      <p className="font-display text-[22px] font-bold text-[var(--color-secondary)]">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[var(--color-text-muted)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
