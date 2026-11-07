import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Expediente, RiskLevel } from '@/services/monitoring.service'
import { GroupRiskBanner } from '../monitoringUi'
import { RISK_META, formatDay } from '../monitoringUi.utils'
import { alertReasons } from '../monitoringHelpers'
import { DossierCard, EmptyNote } from './dossierUi'

// Nivel INDIVIDUAL del estudiante (lo calcula el backend). La alerta GRUPAL se presenta aparte para no confundirlas.
const LEVEL_BLOCK: Record<RiskLevel, { box: string; icon: string; Icon: LucideIcon; summary: string }> = {
  al_dia: { box: 'border-green-500 bg-green-50 dark:bg-green-500/10', icon: 'bg-green-600 text-white', Icon: CheckCircle2, summary: 'El estudiante no tiene tareas vencidas.' },
  atencion: { box: 'border-blue-500 bg-blue-50 dark:bg-blue-500/10', icon: 'bg-blue-600 text-white', Icon: Clock, summary: 'Hay señales tempranas que conviene acompañar.' },
  moderado: { box: 'border-[#F5B800] bg-[#FFF0B3] dark:bg-amber-400/10', icon: 'bg-[#F5B800] text-amber-950', Icon: AlertTriangle, summary: 'El estudiante tiene un incumplimiento pendiente de atención.' },
  critico: { box: 'border-red-600 bg-red-50 shadow-[0_8px_22px_-12px_rgba(220,38,38,0.75)] dark:bg-red-500/10', icon: 'bg-red-600 text-white fu-pulse', Icon: ShieldAlert, summary: 'Requiere intervención prioritaria del tutor.' },
}

function LevelBlock({ expediente }: { expediente: Expediente }) {
  const level = expediente.student.level
  const block = LEVEL_BLOCK[level]
  const reasons = alertReasons({ ...expediente.student, group_alert: false })
  return (
    <div className={cn('rounded-xl border-2 p-3.5', block.box)}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', block.icon)}><block.Icon size={18} /></span>
        <div>
          <p className="text-[14px] font-extrabold text-[var(--color-secondary)]">{RISK_META[level].label}</p>
          <p className="text-[12.5px] text-[var(--color-text)]">{block.summary}</p>
          {reasons.length > 0 && <p className="mt-1 text-[12.5px] font-extrabold text-red-700 dark:text-red-300">{reasons.join(' · ')}</p>}
        </div>
      </div>
    </div>
  )
}

/** Panel lateral «Alertas del proyecto». */
export function ProjectAlertsCard({ expediente }: { expediente: Expediente }) {
  return (
    <DossierCard title="Alertas del proyecto" Icon={AlertTriangle} iconClassName={expediente.student.level === 'critico' ? 'text-red-600' : 'text-amber-500'} titleId="exp-alerts-card-title">
      <div className="space-y-2.5">
        <LevelBlock expediente={expediente} />
        <GroupRiskBanner alert={{ active: expediente.group_alert, message: null }} culprits={expediente.group_overdue_students} />
        {!expediente.group_alert && <p className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]"><UsersRound size={14} aria-hidden="true" />Sin alerta grupal en el equipo.</p>}
      </div>
    </DossierCard>
  )
}

/** Pestaña Alertas: detalle de qué tareas y compromisos explican el nivel. */
export function AlertsTab({ expediente }: { expediente: Expediente }) {
  const overdueTasks = expediente.tasks.filter((t) => t.state === 'vencida')
  const overdueCommitments = expediente.commitments.filter((c) => c.is_overdue)
  return (
    <DossierCard title="Alertas" Icon={AlertTriangle} titleId="exp-alerts-title">
      <div className="space-y-4">
        <LevelBlock expediente={expediente} />
        <div>
          <h3 className="mb-2 text-[13.5px] font-extrabold text-[var(--color-secondary)]">Tareas vencidas ({overdueTasks.length})</h3>
          {overdueTasks.length === 0 ? <EmptyNote>Sin tareas vencidas.</EmptyNote> : (
            <ul className="space-y-2">
              {overdueTasks.map((t) => (
                <li key={t.assignment_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-3.5 py-2.5 text-[13px] dark:border-red-500/40 dark:bg-red-500/10">
                  <span><strong className="text-[var(--color-secondary)]">{t.title}</strong> <span className="text-[var(--color-text-muted)]">· {t.stage}</span></span>
                  <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11.5px] font-bold text-white">Venció el {formatDay(t.effective_due)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-[13.5px] font-extrabold text-[var(--color-secondary)]">Compromisos vencidos ({overdueCommitments.length})</h3>
          {overdueCommitments.length === 0 ? <EmptyNote>Sin compromisos vencidos.</EmptyNote> : (
            <ul className="space-y-2">
              {overdueCommitments.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-3.5 py-2.5 text-[13px] dark:border-orange-500/40 dark:bg-orange-500/10">
                  <span className="font-semibold">{c.description}</span>
                  <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[11.5px] font-bold text-orange-950">Fecha: {formatDay(c.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-[13.5px] font-extrabold text-[var(--color-secondary)]">Alerta grupal</h3>
          {expediente.group_alert ? <p className="text-[12.5px] text-[var(--color-text-muted)]">Se muestra en el panel «Alertas del proyecto». Es independiente del nivel individual del estudiante.</p> : <EmptyNote>El equipo no tiene alerta grupal activa.</EmptyNote>}
        </div>
      </div>
    </DossierCard>
  )
}
