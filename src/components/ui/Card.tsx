import { cn } from '@/utils/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
}

interface CardHeaderProps {
  title: string
  action?: React.ReactNode
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'card p-6 bg-[var(--color-surface)]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-border)] -mx-6 px-6">
      <h3 className="text-[18px] font-bold text-[var(--color-text)] tracking-tight">{title}</h3>
      {action}
    </div>
  )
}
