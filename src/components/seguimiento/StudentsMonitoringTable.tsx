import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Download, Eye, ShieldAlert, Users } from 'lucide-react'
import { Card } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { RiskLevel, StudentRow } from '@/services/monitoring.service'
import { RiskLevelBadge, formatDay, formatMoment, formatMomentDay } from './monitoringUi'
import { RISK_TONE, alertReasons, expedientePath, initials, rowsToCsv } from './monitoringHelpers'

const NUMERIC = new Set(['Asignadas', 'Entregadas', 'Pendientes', 'Vencidas'])
const HEADERS = ['Estudiante', 'Proyecto', 'Modalidad', 'Tutor', 'Asignadas', 'Entregadas', 'Pendientes', 'Vencidas', 'Próximo vencimiento', 'Nivel', 'Última intervención', 'Acciones']

function Avatar({ name }: { name: string }) {
  return <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[12px] font-extrabold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">{initials(name)}</span>
}

function PriorityNote({ row, level }: { row: StudentRow; level: RiskLevel }) {
  if (level !== 'moderado' && level !== 'critico') return null
  const reasons = alertReasons(row)
  if (reasons.length === 0) return null
  return (
    <div className="mt-1.5 space-y-1">
      {level === 'critico' && <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm shadow-red-600/40"><ShieldAlert size={10} aria-hidden="true" />Prioridad</span>}
      <p className={cn('max-w-[150px] text-[11px] font-bold leading-snug', RISK_TONE[level].text)}>{reasons.join(' · ')}</p>
    </div>
  )
}

function ExpedienteButton({ row, level, full, compact }: { row: StudentRow; level: RiskLevel; full?: boolean; compact?: boolean }) {
  return (
    <Link
      to={expedientePath(row)}
      aria-label={`Abrir expediente de ${row.student_name}`}
      title={`Abrir expediente de ${row.student_name}`}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl border font-bold transition-all duration-200 hover:-translate-y-px hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
        level === 'critico' ? 'border-red-600 bg-red-600 text-white hover:bg-red-700' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-secondary)] hover:border-[#0876B9]',
        compact ? 'h-8 px-2.5 text-[12px]' : 'h-9 px-3.5 text-[12.5px]',
        full && 'w-full',
      )}
    >
      <Eye size={14} aria-hidden="true" />
      <span className={cn(compact && 'hidden min-[1500px]:inline')}>{full ? 'Abrir expediente' : 'Expediente'}</span>
    </Link>
  )
}

/** Tabla en pantallas anchas (filas con fondo suave y borde por nivel); tarjetas en pantallas pequeñas. */
export function StudentsMonitoringTable({ rows }: { rows: StudentRow[] }) {
  return (
    <>
      <div className="-mx-3 hidden overflow-x-auto px-3 lg:block">
        <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-[12.5px]">
          <thead className="text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              {HEADERS.map((h) => <th key={h} scope="col" className={cn('px-1.5 pb-1 pt-0 text-[9.5px] font-bold tracking-tight', NUMERIC.has(h) && 'text-center')}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tone = RISK_TONE[r.level]
              const cell = cn('px-1.5 py-3 align-middle transition-[background-color,box-shadow] duration-200 ', tone.row, tone.rowHover, tone.edge, tone.shadow)
              return (
                <tr key={`${r.process_id}:${r.student_id}`} className="group transition-transform duration-200 hover:-translate-y-px">
                  <td className={cn(cell, 'rounded-l-xl border-l-[6px]', tone.border)}>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.student_name} />
                      <div className="min-w-0"><p className="font-bold text-[var(--color-secondary)]">{r.student_name}</p><p title={r.student_email} className="max-w-[115px] truncate text-[11px] text-[var(--color-text-muted)]">{r.student_email}</p></div>
                    </div>
                  </td>
                  <td className={cn(cell, 'max-w-[120px]')}>{r.project_title ?? r.process_code}</td>
                  <td className={cell}>{r.modality_name}</td>
                  <td className={cell}>{r.tutor_name ?? '—'}</td>
                  <td className={cn(cell, 'text-center tabular-nums')}>{r.assigned}</td>
                  <td className={cn(cell, 'text-center tabular-nums')}>{r.delivered}</td>
                  <td className={cn(cell, 'text-center tabular-nums')}>{r.pending}</td>
                  <td className={cn(cell, 'text-center')}>
                    <span className={cn('inline-flex min-w-[26px] justify-center rounded-lg px-2 py-0.5 font-extrabold tabular-nums', r.overdue > 0 ? (r.level === 'critico' ? 'bg-red-600 text-white shadow-sm shadow-red-600/40' : 'bg-orange-500 text-orange-950 shadow-sm shadow-orange-500/40') : 'text-[var(--color-text)]')}>{r.overdue}</span>
                  </td>
                  <td className={cell}>{formatDay(r.next_due)}</td>
                  <td className={cell}><RiskLevelBadge level={r.level} /><PriorityNote row={r} level={r.level} /></td>
                  <td className={cell} title={r.last_intervention_at ? formatMoment(r.last_intervention_at) : undefined}>{formatMomentDay(r.last_intervention_at)}</td>
                  <td className={cn(cell, 'rounded-r-xl')}><ExpedienteButton row={r} level={r.level} compact /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 lg:hidden" aria-label="Estudiantes">
        {rows.map((r) => {
          const tone = RISK_TONE[r.level]
          return (
            <li key={`${r.process_id}:${r.student_id}`}>
              <div className={cn('rounded-2xl border-l-[6px] p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-md', tone.row, tone.border, tone.edge)}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.student_name} />
                    <div><p className="font-bold text-[var(--color-secondary)]">{r.student_name}</p><p className="text-[12px] text-[var(--color-text-muted)]">{r.project_title ?? r.process_code} · {r.modality_name}</p></div>
                  </div>
                  <RiskLevelBadge level={r.level} />
                </div>
                <PriorityNote row={r} level={r.level} />
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
                  <div><dt className="text-[var(--color-text-muted)]">Tutor</dt><dd>{r.tutor_name ?? '—'}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Próximo vencimiento</dt><dd>{formatDay(r.next_due)}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Entregadas / asignadas</dt><dd>{r.delivered} / {r.assigned}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Vencidas</dt><dd className="font-bold">{r.overdue}</dd></div>
                  <div className="col-span-2"><dt className="text-[var(--color-text-muted)]">Última intervención</dt><dd>{formatMoment(r.last_intervention_at)}</dd></div>
                </dl>
                <div className="mt-3"><ExpedienteButton row={r} level={r.level} full /></div>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

interface StudentsMonitoringPanelProps {
  rows: StudentRow[]
  total: number
  busy?: boolean
  children?: React.ReactNode
}

export function StudentsMonitoringPanel({ rows, total, busy, children }: StudentsMonitoringPanelProps) {
  const [exported, setExported] = useState(false)
  useEffect(() => {
    if (!exported) return
    const t = window.setTimeout(() => setExported(false), 3500)
    return () => window.clearTimeout(t)
  }, [exported])

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `seguimiento-estudiantes-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setExported(true)
  }

  return (
    <Card className="fu-rise fu-delay p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"><Users size={17} aria-hidden="true" /></span>
          <h2 className="font-display text-[17px] font-extrabold text-[var(--color-secondary)]">Estudiantes y proyectos ({total})</h2>
        </div>
        <div className="flex items-center gap-3">
          {exported && <span role="status" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-green-700 dark:text-green-300"><CheckCircle2 size={14} aria-hidden="true" />Archivo descargado</span>}
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            title="Descarga en CSV los estudiantes que se muestran en esta página"
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[12.5px] font-bold text-[var(--color-secondary)] transition-all hover:-translate-y-px hover:border-[#0876B9] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <Download size={14} aria-hidden="true" />Exportar
          </button>
        </div>
      </div>
      <div aria-busy={busy} className={cn('transition-opacity duration-300', busy && 'opacity-60')}>
        <StudentsMonitoringTable rows={rows} />
      </div>
      {children}
    </Card>
  )
}
