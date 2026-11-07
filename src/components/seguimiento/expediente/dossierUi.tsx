import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { cn } from '@/utils/cn'
import { initials } from '../monitoringHelpers'

/** Tarjeta blanca de sección del expediente (paneles laterales y pestañas). */
export function DossierCard({ title, Icon, iconClassName, action, children, className, titleId }: {
  title: ReactNode
  Icon: LucideIcon
  iconClassName?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  titleId?: string
}) {
  return (
    <section aria-labelledby={titleId} className={cn('fu-rise rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]', className)}>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 id={titleId} className="flex items-center gap-2.5 font-display text-[16.5px] font-extrabold text-[var(--color-secondary)]">
          <Icon size={19} aria-hidden="true" className={cn('shrink-0 text-[#062B4F] dark:text-sky-300', iconClassName)} />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-[12.5px] text-[var(--color-text-muted)]">
      <Inbox size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export function SectionError({ message }: { message: string }) {
  return <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12.5px] font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{message}</p>
}

export function Avatar({ name, size = 'md', tone = 'violet' }: { name: string; size?: 'sm' | 'md' | 'lg'; tone?: 'violet' | 'navy' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-extrabold',
        tone === 'violet' ? 'bg-gradient-to-br from-violet-200 to-violet-400 text-violet-900' : 'bg-[#062B4F] text-white',
        size === 'sm' && 'h-8 w-8 text-[11px]', size === 'md' && 'h-9 w-9 text-[12px]', size === 'lg' && 'h-14 w-14 text-[18px]',
      )}
    >
      {initials(name)}
    </span>
  )
}

/** Barra de carga con la forma de la pantalla. */
export function DossierSkeleton() {
  const block = 'rounded-2xl bg-slate-200/80 animate-pulse motion-reduce:animate-none dark:bg-white/10'
  return (
    <div role="status" aria-label="Cargando expediente" className="space-y-4">
      <span className="sr-only">Cargando expediente…</span>
      <div className={`${block} h-[60px]`} />
      <div className="grid gap-5 min-[1280px]:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <div className={`${block} h-[84px]`} />
          <div className={`${block} h-[210px]`} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`${block} h-[78px]`} />)}</div>
          <div className={`${block} h-[320px]`} />
        </div>
        <div className="space-y-4">{[180, 170, 140, 170].map((h, i) => <div key={i} className={block} style={{ height: h }} />)}</div>
      </div>
    </div>
  )
}
