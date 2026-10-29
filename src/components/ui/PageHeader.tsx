import type { ReactNode } from 'react'
import heroPhoto from '@/assets/images/Imagen Dashboard.jpg'
import { cn } from '@/utils/cn'

interface PageHeaderProps {
  title: string
  description?: string
  /** Muestra la fotografía y las formas decorativas a la derecha (solo en pantallas anchas). */
  showArt?: boolean
  actions?: ReactNode
  className?: string
}

// El último término del título lleva el acento naranja (p. ej. "Mis <documentos>").
function AccentTitle({ title }: { title: string }) {
  const words = title.trim().split(/\s+/)
  if (words.length < 2) return <>{title}</>
  const last = words.pop()
  return (
    <>
      {words.join(' ')} <span className="text-[var(--color-primary)]">{last}</span>
    </>
  )
}

export function PageHeader({ title, description, showArt = false, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'relative mb-5 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-sm)] md:px-8',
        showArt && 'lg:pr-[340px]',
        className
      )}
    >
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-extrabold leading-[1.05] tracking-tight text-[var(--color-secondary)] md:text-[34px]">
            <AccentTitle title={title} />
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--color-text-muted)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>

      {showArt && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[320px] lg:block">
          <span className="absolute -right-4 bottom-0 h-[88%] w-24 -skew-x-[18deg] bg-[#0876B9]" />
          <span className="absolute right-16 bottom-0 h-[70%] w-20 -skew-x-[18deg] bg-[#FF6500]" />
          <img
            src={heroPhoto}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-y-0 right-8 h-full w-[230px] object-cover object-[50%_16%] [mask-image:linear-gradient(to_right,transparent,black_38%)]"
          />
          <span className="absolute bottom-3 right-10 h-px w-24 bg-white/70" />
        </div>
      )}
    </header>
  )
}
