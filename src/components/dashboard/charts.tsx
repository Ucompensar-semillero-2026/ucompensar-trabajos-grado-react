import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Gráficos del dashboard en SVG/CSS, sin librerías. Cada valor va rotulado (la paleta no alcanza 3:1 contra el
// fondo claro) y cada gráfico trae su tabla de datos para lectores de pantalla e impresión.

export const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'] as const
/** Color de la serie «Otras» cuando hay más categorías que colores. */
export const OTHER_COLOR = 'var(--color-text-dim)'

export interface ChartDatum {
  key: string
  label: string
  value: number
  to?: string
  color?: string
}

interface ChartCardProps {
  title: string
  subtitle?: string
  /** Filas de la tabla de datos (encabezados + valores). */
  table?: { headers: string[]; rows: Array<Array<string | number>> }
  children: ReactNode
  className?: string
}

export function ChartCard({ title, subtitle, table, children, className = '' }: ChartCardProps) {
  return (
    <section className={`card p-6 flex flex-col min-w-0 ${className}`} aria-label={title}>
      <h2 className="text-[17px] font-bold text-[var(--color-text)] tracking-tight">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">{subtitle}</p>}
      <div className="mt-5 flex-1">{children}</div>
      {table && table.rows.length > 0 && (
        <details className="mt-4 text-[12px] text-[var(--color-text-muted)]">
          <summary className="cursor-pointer select-none font-semibold hover:text-[var(--color-text)]">Ver datos en tabla</summary>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr>{table.headers.map((h) => <th key={h} className="py-1 pr-3 text-left font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  {r.map((c, j) => <td key={j} className={`py-1 pr-3 ${typeof c === 'number' ? 'tabular-nums' : ''}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  )
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-[var(--color-text-muted)]">{children}</p>
}

function MaybeLink({ to, className, label, children }: { to?: string; className: string; label: string; children: ReactNode }) {
  return to ? (
    <Link to={to} className={`${className} rounded-lg hover:bg-[var(--color-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chart-1)]`} aria-label={label} title={label}>
      {children}
    </Link>
  ) : (
    <div className={className} title={label}>{children}</div>
  )
}

/** Barras horizontales de una sola serie: etiqueta, valor rotulado y barra proporcional al máximo. */
export function HBarList({ data, color = CHART_COLORS[0], unit = 'trámites' }: { data: ChartDatum[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="space-y-1">
      {data.map((d) => (
        <li key={d.key}>
          <MaybeLink to={d.to} label={`${d.label}: ${d.value} ${unit}${d.to ? ' (ver lista)' : ''}`} className="group block px-2 py-2">
            <span className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="truncate text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]">{d.label}</span>
              <span className="flex-shrink-0 font-bold tabular-nums text-[var(--color-text)]">{d.value}</span>
            </span>
            <span className="mt-1.5 block h-2 rounded-full bg-[var(--color-bg)]">
              <span
                className="block h-full rounded-full transition-[width] duration-700"
                style={{ width: `${d.value === 0 ? 0 : Math.max(2, (d.value / max) * 100)}%`, background: d.color ?? color }}
              />
            </span>
          </MaybeLink>
        </li>
      ))}
    </ul>
  )
}

/** Dona con leyenda rotulada (nombre, cantidad y porcentaje). Más de 5 categorías se agrupan en «Otras». */
export function Donut({ data, centerLabel }: { data: ChartDatum[]; centerLabel: string }) {
  const [active, setActive] = useState<string | null>(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const slices: ChartDatum[] =
    sorted.length > CHART_COLORS.length
      ? [
          ...sorted.slice(0, CHART_COLORS.length - 1),
          { key: '__otras', label: 'Otras', value: sorted.slice(CHART_COLORS.length - 1).reduce((s, d) => s + d.value, 0), color: OTHER_COLOR },
        ]
      : sorted
  const colored = slices.map((d, i) => ({ ...d, color: d.color ?? CHART_COLORS[i] }))

  const r = 54
  const circumference = 2 * Math.PI * r
  const gap = colored.length > 1 ? 2 : 0
  let offset = 0
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0)

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={`${centerLabel}: ${total}`} className="flex-shrink-0">
        <circle cx="74" cy="74" r={r} fill="none" stroke="var(--color-bg)" strokeWidth="18" />
        {colored.map((d) => {
          const len = total ? (d.value / total) * circumference : 0
          const dash = Math.max(0, len - gap)
          const el = (
            <circle
              key={d.key}
              cx="74" cy="74" r={r} fill="none"
              stroke={d.color}
              strokeWidth={active === d.key ? 22 : 18}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 74 74)"
              onMouseEnter={() => setActive(d.key)}
              onMouseLeave={() => setActive(null)}
              style={{ transition: 'stroke-width 150ms' }}
            >
              <title>{`${d.label}: ${d.value} (${pct(d.value)}%)`}</title>
            </circle>
          )
          offset += len
          return el
        })}
        <text x="74" y="72" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--color-text)">{total}</text>
        <text x="74" y="92" textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">{centerLabel}</text>
      </svg>
      <ul className="min-w-[180px] flex-1 space-y-0.5">
        {colored.map((d) => (
          <li key={d.key} onMouseEnter={() => setActive(d.key)} onMouseLeave={() => setActive(null)}>
            <MaybeLink to={d.to} label={`${d.label}: ${d.value} (${pct(d.value)}%)${d.to ? ' (ver lista)' : ''}`} className={`flex items-center gap-2.5 px-2 py-1.5 text-[12.5px] ${active === d.key ? 'bg-[var(--color-bg)]' : ''}`}>
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: d.color }} aria-hidden />
              <span className="flex-1 truncate text-[var(--color-text-muted)]">{d.label}</span>
              <span className="font-bold tabular-nums text-[var(--color-text)]">{d.value}</span>
              <span className="w-9 text-right tabular-nums text-[var(--color-text-dim)]">{pct(d.value)}%</span>
            </MaybeLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface SeriesDef {
  key: string
  label: string
  color: string
}

/** Columnas agrupadas por periodo (p. ej. radicados y cerrados por mes), un solo eje, valores rotulados. */
export function GroupedColumns({ categories, series, values }: { categories: string[]; series: SeriesDef[]; values: Record<string, number[]> }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...series.flatMap((s) => values[s.key] ?? []))
  const height = 150

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-4 text-[12px] text-[var(--color-text-muted)]" aria-label="Leyenda">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative">
        <div className="flex items-end gap-2 border-b border-[var(--color-border)]" style={{ height: height + 20 }}>
          {categories.map((cat, i) => (
            <div
              key={cat}
              className={`relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-md ${hover === i ? 'bg-[var(--color-bg)]' : ''}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {series.map((s) => {
                const v = values[s.key]?.[i] ?? 0
                return (
                  <div key={s.key} className="flex w-full max-w-[22px] flex-col items-center justify-end">
                    {v > 0 && <span className="mb-0.5 text-[10.5px] font-bold tabular-nums text-[var(--color-text)]">{v}</span>}
                    <div className="w-full rounded-t-[4px]" style={{ height: v === 0 ? 0 : Math.max(3, (v / max) * height), background: s.color }} />
                  </div>
                )
              })}
              {hover === i && (
                <div role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-[12px] shadow-lg">
                  <p className="mb-1 font-bold text-[var(--color-text)]">{cat}</p>
                  {series.map((s) => (
                    <p key={s.key} className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                      <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                      {s.label}: <strong className="tabular-nums text-[var(--color-text)]">{values[s.key]?.[i] ?? 0}</strong>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2">
          {categories.map((cat) => (
            <span key={cat} className="flex-1 text-center text-[11px] capitalize text-[var(--color-text-muted)]">{cat}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
