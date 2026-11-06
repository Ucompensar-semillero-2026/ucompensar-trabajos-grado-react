import { AlertTriangle, CalendarClock, Clock3, Users } from 'lucide-react'
import { Card } from '@/components/ui'
import { daysSince } from '@/utils/format'
import { ETAPAS_TRAZABILIDAD, type TramiteTrazabilidad } from '@/services/trazabilidad.service'
import { EstadoBadge } from './EstadoBadge'
import { SecuenciaProyecto } from './Timeline'

function dateLabel(value: string | null) {
  if (!value) return 'Sin fecha definida'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value))
}

export function ResumenTramite({ tramite }: { tramite: TramiteTrazabilidad }) {
  const stagnantDays = daysSince(tramite.fechaActualizacion)
  const stagnant = stagnantDays > 15
  const risk = stagnantDays > 15 ? { label: 'Riesgo alto', classes: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200' }
    : stagnantDays > 7 ? { label: 'Riesgo medio', classes: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' }
      : { label: 'Riesgo bajo', classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' }
  const currentStep = tramite.tutor && tramite.pasoActual <= 3 ? 4 : tramite.pasoActual
  const currentStage = ETAPAS_TRAZABILIDAD[currentStep - 1] ?? tramite.etapaActual
  const progress = Math.round((currentStep / tramite.totalPasos) * 100)
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold text-[var(--color-text-muted)]">{tramite.codigo}</p>
          <h1 className="mt-1 text-[22px] font-bold text-[var(--color-secondary)]">{tramite.titulo}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)]"><Users size={14} aria-hidden />{tramite.estudiantes.map((person) => person.nombre).join(', ')}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">Tutor: {tramite.tutor?.nombre ?? 'Pendiente de asignación'}{tramite.tutor && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Asignado</span>} · {tramite.programa}</p>
        </div>
        <EstadoBadge estado={tramite.estado} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${risk.classes}`} aria-label={`Indicador de riesgo: ${risk.label}`}>{risk.label}</span>
        {stagnant && <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle size={15} aria-hidden />Trámite estancado: más de 15 días sin movimiento.</p>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--color-bg)] p-3"><p className="text-[11px] text-[var(--color-text-muted)]">Progreso del flujo</p><p className="mt-1 text-[13px] font-bold text-[var(--color-text)]">Paso {currentStep} de {tramite.totalPasos}</p><div role="progressbar" aria-label="Progreso del trámite" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]"><div className="h-full bg-[#FF6500]" style={{ width: `${progress}%` }} /></div></div>
        <div className="rounded-xl bg-[var(--color-bg)] p-3"><p className="text-[11px] text-[var(--color-text-muted)]">Tiempo en etapa</p><p className="mt-1 flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-text)]"><Clock3 size={14} aria-hidden />{daysSince(tramite.fechaInicioEtapa)} días · {currentStage}</p></div>
        <div className="rounded-xl bg-[var(--color-bg)] p-3"><p className="text-[11px] text-[var(--color-text-muted)]">{tramite.fechaSustentacion ? 'Fecha de sustentación' : 'Próxima fecha límite'}</p><p className="mt-1 flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-text)]"><CalendarClock size={14} aria-hidden />{dateLabel(tramite.fechaSustentacion ?? tramite.proximaFechaLimite)}</p></div>
      </div>
      <div className="mt-4 border-t border-[var(--color-border)] pt-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">Ruta de aprobación y seguimiento</p>
          {tramite.tutor && <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">La asignación del tutor ya está completada</p>}
        </div>
        <SecuenciaProyecto tramite={tramite} />
      </div>
    </Card>
  )
}
