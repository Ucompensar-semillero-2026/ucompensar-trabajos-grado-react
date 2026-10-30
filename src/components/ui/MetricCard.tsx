import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface MetricCardProps {
  label: string
  value: string | number
  sub: ReactNode
  subColor?: string
  icon?: ReactNode
  /** Si se indica, la tarjeta completa lleva a la lista detallada de esa cifra. */
  to?: string
}

export function MetricCard({ label, value, sub, subColor, icon, to }: MetricCardProps) {
  const card = (
    <div className="card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group relative overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-dim)] group-hover:text-[var(--color-primary)] transition-colors">
          {label}
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-dim)]">
            {icon}
          </div>
        )}
      </div>
      <div className="font-display text-[34px] font-extrabold text-[var(--color-text)] leading-none tracking-tight mb-2">
        {value}
      </div>
      <div
        className="text-[11px] font-medium opacity-90 flex items-center gap-1.5"
        style={{ color: subColor ?? 'var(--color-text-muted)' }}
      >
        {sub}
      </div>
    </div>
  )
  return to ? (
    <Link to={to} className="block rounded-[var(--radius-lg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
      {card}
    </Link>
  ) : (
    card
  )
}
