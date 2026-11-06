import { useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Download, Printer, RotateCcw, UserCheck, XCircle } from 'lucide-react'
import type { ProcessHistoryOut } from '@/services/processes.service'
import { ETAPAS_TRAZABILIDAD, type TramiteTrazabilidad } from '@/services/trazabilidad.service'

const eventColor = (code: string) => {
  if (/RECHAZ|DEVUEL|CORRECC/.test(code.toUpperCase())) return 'text-red-600 bg-red-50 dark:bg-red-950/30'
  if (/APROB|FINALIZ|CERRAD/.test(code.toUpperCase())) return 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
  if (/REVISION|REVISI|ENVIAD/.test(code.toUpperCase())) return 'text-amber-700 bg-amber-50 dark:bg-amber-950/30'
  return 'text-[var(--color-text-muted)] bg-[var(--color-bg)]'
}

function eventIcon(code: string) {
  const value = code.toUpperCase()
  if (/RECHAZ/.test(value)) return XCircle
  if (/DEVUEL|CORRECC/.test(value)) return RotateCcw
  if (/APROB|FINALIZ|CERRAD/.test(value)) return CheckCircle2
  return Clock3
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function eventType(entry: ProcessHistoryOut) {
  const comment = entry.comment?.toLocaleLowerCase('es-CO') ?? ''
  if (/tutor asignado|asignacion automatica/.test(comment)) return 'Tutor asignado'
  if (/cambio de tutor|tutor reasignado/.test(comment)) return 'Cambio de tutor'
  return entry.previous_state ? 'Cambio de estado' : 'Inicio del trámite'
}

export function Timeline({ history, currentStep, canExport = false, hasTutor = false }: { history: ProcessHistoryOut[]; currentStep: number; canExport?: boolean; hasTutor?: boolean }) {
  const progressStep = hasTutor && currentStep <= 3 ? 4 : currentStep
  const [selectedType, setSelectedType] = useState('todos')
  const [selectedUser, setSelectedUser] = useState('todos')
  const types = useMemo(() => [...new Set(history.map(eventType))], [history])
  const users = useMemo(() => [...new Set(history.map((entry) => entry.user.full_name))], [history])
  const filtered = history.filter((entry) => {
    const type = eventType(entry)
    return (selectedType === 'todos' || type === selectedType) && (selectedUser === 'todos' || entry.user.full_name === selectedUser)
  })
  const ordered = [...filtered].reverse()
  const exportCsv = () => {
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`
    const lines = [
      ['Fecha', 'Tipo', 'Estado anterior', 'Estado nuevo', 'Usuario', 'Rol', 'Comentario'],
      ...history.map((entry) => [entry.event_date, eventType(entry), entry.previous_state?.name ?? '', entry.new_state.name, entry.user.full_name, entry.user.role?.name ?? '', entry.comment ?? '']),
    ].map((row) => row.map(quote).join(';')).join('\r\n')
    const blob = new Blob([`\uFEFF${lines}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'historial-trazabilidad.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div aria-label="Etapas del trámite" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {ETAPAS_TRAZABILIDAD.map((stage, index) => {
          const tutorAssignedStage = index === 2 && hasTutor
          const done = index + 1 < progressStep || tutorAssignedStage
          const current = index + 1 === progressStep
          return <div key={stage} className={`rounded-lg border px-3 py-2 text-xs ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : current ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-bold text-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]'}`}><span className="mr-1.5">{done ? '✓' : current ? '●' : '○'}</span>{stage}{!done && !current && <span className="ml-1 block text-[10px]">Pendiente</span>}</div>
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">Tipo de evento
          <select aria-label="Filtrar por tipo de evento" className="field-input" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}><option value="todos">Todos</option>{types.map((type) => <option key={type}>{type}</option>)}</select>
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">Usuario
          <select aria-label="Filtrar por usuario" className="field-input" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}><option value="todos">Todos</option>{users.map((user) => <option key={user}>{user}</option>)}</select>
        </label>
      </div>
      {canExport && <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]"><Download size={14} aria-hidden="true" />Exportar para Excel (.csv)</button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)]"><Printer size={14} aria-hidden="true" />Imprimir / Guardar como PDF</button>
      </div>}

      {ordered.length === 0 ? <p className="rounded-xl bg-[var(--color-bg)] px-4 py-5 text-sm text-[var(--color-text-muted)]">No hay movimientos que coincidan con estos filtros.</p> : (
        <ol className="space-y-0">
          {ordered.map((entry, index) => {
            const result = entry.new_state.code
            const type = eventType(entry)
            const isTutorEvent = type === 'Tutor asignado' || type === 'Cambio de tutor'
            const Icon = isTutorEvent ? UserCheck : eventIcon(result)
            const sameState = entry.previous_state?.public_id === entry.new_state.public_id
            return <li key={entry.public_id} className="flex gap-3.5">
              <div className="flex flex-col items-center"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${isTutorEvent ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' : eventColor(result)}`}><Icon size={16} aria-hidden="true" /></span>{index < ordered.length - 1 && <span className="my-1 w-px flex-1 bg-[var(--color-border)]" />}</div>
              <div className="min-w-0 flex-1 pb-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[var(--color-text)]">{isTutorEvent ? type : sameState || !entry.previous_state ? type : `${entry.previous_state.name} → ${entry.new_state.name}`}</p><time className="text-xs text-[var(--color-text-muted)]" dateTime={entry.event_date}>{formatDate(entry.event_date)}</time></div>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{entry.user.full_name} · {entry.user.role?.name ?? 'Usuario'}</p>
                {entry.comment && <p className="mt-2 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">{entry.comment}</p>}
              </div>
            </li>
          })}
        </ol>
      )}
    </div>
  )
}

export function SecuenciaProyecto({ tramite }: { tramite: Pick<TramiteTrazabilidad, 'pasoActual' | 'tutor'> }) {
  const progressStep = tramite.tutor && tramite.pasoActual <= 3 ? 4 : tramite.pasoActual
  return <div className="-mx-1 overflow-x-auto px-1 pb-2">
    <ol aria-label="Progreso del trámite" className="flex min-w-[760px] items-start">
    {ETAPAS_TRAZABILIDAD.map((stage, index) => {
      const tutorAssignedStage = index === 2 && Boolean(tramite.tutor)
      const done = index + 1 < progressStep || tutorAssignedStage
      const current = index + 1 === progressStep
      const connectorDone = index + 1 < progressStep || (index === 2 && Boolean(tramite.tutor))
      return <li key={stage} aria-current={current ? 'step' : undefined} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
        {index < ETAPAS_TRAZABILIDAD.length - 1 && <span aria-hidden="true" className={`absolute left-1/2 top-3.5 h-0.5 w-full ${connectorDone ? 'bg-emerald-400' : 'bg-[var(--color-border)]'}`} />}
        <span className={`relative z-[1] flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold ${done ? 'border-emerald-500 bg-emerald-500 text-white' : current ? 'border-[#FF6500] bg-[#FF6500] text-white ring-4 ring-[#FF6500]/15' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>
          {done ? '✓' : index + 1}
        </span>
        <span className={`mt-2 max-w-[90px] text-[10px] leading-tight ${current ? 'font-bold text-[var(--color-primary)]' : done ? 'font-semibold text-emerald-800 dark:text-emerald-200' : 'text-[var(--color-text-muted)]'}`}>{stage}</span>
        {tutorAssignedStage && <span className="mt-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">Tutor asignado</span>}
        {current && <span className="mt-1 text-[9px] font-semibold text-[var(--color-primary)]">En curso</span>}
      </li>
    })}
    </ol>
  </div>
}
