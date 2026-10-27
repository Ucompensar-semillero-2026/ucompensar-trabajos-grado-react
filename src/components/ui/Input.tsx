import { cn } from '@/utils/cn'
import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className, id, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="flex flex-col gap-1.5 group">
      {label && (
        <label
          htmlFor={inputId}
          className="field-label group-focus-within:text-[var(--color-primary)] transition-colors"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'field-input shadow-sm',
          className
        )}
        {...props}
      />
    </div>
  )
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'field-input appearance-none bg-[var(--color-surface)] pr-10 cursor-pointer shadow-sm',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-dim)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
  )
}
