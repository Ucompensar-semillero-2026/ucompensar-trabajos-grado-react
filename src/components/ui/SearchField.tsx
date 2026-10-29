import { Search } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  wrapperClassName?: string
}

export function SearchField({ label, wrapperClassName, className, ...props }: SearchFieldProps) {
  return (
    <label
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 shadow-[var(--shadow-sm)] transition-all',
        'focus-within:border-[var(--color-info,#0876B9)] focus-within:ring-2 focus-within:ring-[rgba(8,118,185,0.18)]',
        wrapperClassName
      )}
    >
      <span className="sr-only">{label}</span>
      <Search size={16} aria-hidden className="flex-shrink-0 text-[var(--color-text-dim)]" />
      <input
        type="search"
        className={cn(
          'w-full border-none bg-transparent text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-dim)]',
          className
        )}
        {...props}
      />
    </label>
  )
}
