import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CalendarPlus, Check, ListChecks, Users } from 'lucide-react'
import { Button } from '@/components/ui'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { cn } from '@/utils/cn'
import { ApiError } from '@/services/http'
import { monitoringApi, type StudentRow, type TaskOut } from '@/services/monitoring.service'
import { formatDay } from './monitoringUi'
import { EXTENSION_META, countByCategory, dueDistance, extensionCategory, stillOverdue, type ExtensionCategory } from './extensionHelpers'

const fieldClass = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]'
const labelClass = 'mb-1 block text-[12px] font-bold text-[var(--color-secondary)]'
const LEGEND: ExtensionCategory[] = ['vencida', 'proxima', 'en_plazo', 'entregada']

/** Vista previa de la nueva fecha (días calendario). El backend es quien la calcula y valida de verdad. */
export function previewDue(effectiveDue: string, days: number): string {
  const date = new Date(`${effectiveDue}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

interface Props {
  token: string
  student: StudentRow
  tasks: TaskOut[]
  onClose: () => void
  onSaved: () => void
}

function StateBadge({ category }: { category: ExtensionCategory }) {
  const { label, Icon, badge } = EXTENSION_META[category]
  return <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold leading-none shadow-sm', badge)}><Icon size={13} aria-hidden="true" />{label}</span>
}

function Stat({ Icon, label, children }: { Icon: typeof Users; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface)] p-3 ring-1 ring-[var(--color-border)]">
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-text-muted)]"><Icon size={13} aria-hidden="true" />{label}</p>
      <div className="mt-1 text-[14px] font-extrabold text-[var(--color-secondary)]">{children}</div>
    </div>
  )
}

export function ExtensionManager({ token, student, tasks, onClose, onSaved }: Props) {
  // Se muestran todas las tareas con su estado real; solo las elegibles (misma regla del backend) se pueden marcar.
  const rows = useMemo(() => tasks.map((t) => ({ task: t, ...extensionCategory(t) })), [tasks])
  const extendable = rows.filter((r) => r.eligible)
  const [team, setTeam] = useState<StudentRow[]>([student])
  const [studentIds, setStudentIds] = useState<string[]>([student.student_id])
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [days, setDays] = useState('3')
  const [reason, setReason] = useState('')
  const [observations, setObservations] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    monitoringApi.students(token, { process_id: student.process_id, page_size: 100 }).then((p) => setTeam(p.items)).catch(() => undefined)
  }, [token, student.process_id])

  const n = Number(days)
  const validDays = Number.isInteger(n) && n > 0
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const selected = extendable.filter((r) => taskIds.includes(r.task.deliverable_id)).map((r) => r.task)
  const counts = countByCategory(selected)
  const late = validDays ? stillOverdue(selected, n) : { tasks: [], minimumDays: 0 }
  const previews = validDays ? selected.map((t) => previewDue(t.effective_due as string, n)).sort() : []
  const beneficiaries = team.filter((s) => studentIds.includes(s.student_id))

  const save = async () => {
    if (saving) return
    if (!Number.isInteger(n) || n < 1) return setError('Indica los días adicionales (mínimo 1).')
    if (taskIds.length === 0) return setError('Selecciona al menos una tarea.')
    if (studentIds.length === 0) return setError('Selecciona al menos un estudiante.')
    if (reason.trim().length < 3) return setError('El motivo es obligatorio.')
    setSaving(true)
    setError(null)
    try {
      await monitoringApi.extend(token, { process_id: student.process_id, student_ids: studentIds, deliverable_ids: taskIds, days: n, reason: reason.trim(), observations: observations.trim() || null })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo autorizar la ampliación.')
      setSaving(false)
    }
  }

  return (
    <ModalDialog
      title="Ampliar plazo de entrega" onClose={onClose} wide
      footer={<><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" form="extension-form" disabled={saving}>{saving ? 'Autorizando…' : 'Autorizar ampliación'}</Button></>}
    >
      <form id="extension-form" noValidate className="grid gap-5" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <fieldset>
          <legend className={labelClass}>Estudiantes beneficiados</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {team.map((s) => {
              const on = studentIds.includes(s.student_id)
              return (
                <label key={s.student_id} className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors', on ? 'border-[#062B4F] bg-[#062B4F]/[0.06] text-[var(--color-secondary)] dark:border-sky-400' : 'border-[var(--color-border)] hover:border-[#1565C0]')}>
                  <input type="checkbox" className="h-4 w-4 accent-[#062B4F]" checked={on} onChange={() => setStudentIds((ids) => toggle(ids, s.student_id))} />{s.student_name}
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <legend className="text-[12px] font-bold text-[var(--color-secondary)]">Tareas</legend>
            <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Leyenda de estados">
              {LEGEND.map((c) => (
                <li key={c} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-text-muted)]">
                  <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', EXTENSION_META[c].badge.split(' ')[0])} />{EXTENSION_META[c].label}
                </li>
              ))}
            </ul>
          </div>
          {extendable.length === 0 && <p className="mb-2 text-[13px] text-[var(--color-text-muted)]">No hay tareas activas con fecha límite para ampliar.</p>}
          <ul className="grid gap-2">
            {rows.map(({ task: t, category, eligible, blockedReason }) => {
              const checked = taskIds.includes(t.deliverable_id)
              const meta = EXTENSION_META[category]
              const distance = dueDistance(t)
              return (
                <li key={t.deliverable_id}>
                  <label
                    title={blockedReason}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border-l-[5px] px-3.5 py-3 text-[13px] transition-all duration-200',
                      meta.row,
                      eligible ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed opacity-80',
                      checked && 'shadow-md ring-2 ring-[#062B4F] dark:ring-sky-300',
                    )}
                  >
                    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#062B4F]" disabled={!eligible} checked={checked} onChange={() => setTaskIds((ids) => toggle(ids, t.deliverable_id))} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold text-[var(--color-secondary)]">{t.title}</span>
                      <span className="mt-0.5 block text-[12px] text-[var(--color-text-muted)]">
                        {t.stage} · Fecha límite: <strong className="text-[var(--color-text)]">{formatDay(t.effective_due)}</strong>
                        {distance && <> · <strong className={meta.text}>{distance}</strong></>}
                        {t.extensions.length > 0 && t.state !== 'entregada' && <> · <span className="font-semibold text-violet-700 dark:text-violet-300">ya ampliada {t.extensions.length === 1 ? '1 vez' : `${t.extensions.length} veces`}</span></>}
                      </span>
                      {!eligible && blockedReason && <span className="mt-0.5 block text-[12px] font-semibold text-[var(--color-text-muted)]">{blockedReason}</span>}
                      {checked && validDays && t.effective_due && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[12px] font-bold text-[#062B4F] dark:bg-white/10 dark:text-sky-200">Nueva fecha → {formatDay(previewDue(t.effective_due, n))}</span>
                      )}
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <StateBadge category={category} />
                      {checked && <span className="inline-flex items-center gap-1 rounded-full bg-[#062B4F] px-2 py-0.5 text-[10.5px] font-bold text-white"><Check size={11} aria-hidden="true" />Seleccionada</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {selected.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-[var(--color-text-muted)]" aria-live="polite">
              <span className="rounded-full bg-[#062B4F] px-2.5 py-0.5 font-bold text-white">{selected.length} {selected.length === 1 ? 'seleccionada' : 'seleccionadas'}</span>
              {counts.vencida > 0 && <span className="rounded-full bg-[#DC2626] px-2.5 py-0.5 font-bold text-white">{counts.vencida} {counts.vencida === 1 ? 'vencida' : 'vencidas'}</span>}
              {counts.proxima > 0 && <span className="rounded-full bg-[#F97316] px-2.5 py-0.5 font-bold text-orange-950">{counts.proxima} {counts.proxima === 1 ? 'próxima a vencer' : 'próximas a vencer'}</span>}
              {counts.en_plazo > 0 && <span className="rounded-full bg-[#2563EB] px-2.5 py-0.5 font-bold text-white">{counts.en_plazo} en plazo</span>}
            </p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="ext-days" className={labelClass}>Días adicionales (calendario)</label>
            <input id="ext-days" type="number" min={1} className={fieldClass} value={days} onChange={(e) => setDays(e.target.value)} /></div>
        </div>
        <div><label htmlFor="ext-reason" className={labelClass}>Motivo (obligatorio)</label>
          <textarea id="ext-reason" rows={2} maxLength={2000} className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <div><label htmlFor="ext-obs" className={labelClass}>Observaciones (opcional)</label>
          <textarea id="ext-obs" rows={2} maxLength={2000} className={fieldClass} value={observations} onChange={(e) => setObservations(e.target.value)} /></div>

        <section aria-label="Resumen de la ampliación" className="rounded-2xl border-2 border-[#062B4F]/15 bg-[#F2F6FC] p-4 dark:bg-white/5">
          <h3 className="mb-3 text-[13px] font-extrabold text-[var(--color-secondary)]">Resumen antes de autorizar</h3>
          <div className="grid gap-2.5 sm:grid-cols-4">
            <Stat Icon={Users} label="Estudiantes beneficiados">
              {beneficiaries.length}
              {beneficiaries.length > 0 && <span className="block truncate text-[11.5px] font-semibold text-[var(--color-text-muted)]" title={beneficiaries.map((b) => b.student_name).join(', ')}>{beneficiaries.map((b) => b.student_name).join(', ')}</span>}
            </Stat>
            <Stat Icon={ListChecks} label="Tareas seleccionadas">{selected.length}</Stat>
            <Stat Icon={CalendarPlus} label="Días adicionales">{validDays ? n : '—'}</Stat>
            <Stat Icon={CalendarClock} label="Fecha nueva calculada">
              {previews.length === 0 ? '—' : previews[0] === previews[previews.length - 1] ? formatDay(previews[0]) : <span className="text-[12.5px]">Del {formatDay(previews[0])} al {formatDay(previews[previews.length - 1])}</span>}
            </Stat>
          </div>
          {counts.vencida > 0 && (
            <div role="note" className="mt-3 flex items-start gap-2.5 rounded-xl border-2 border-[#DC2626] bg-[#FEE2E2] p-3 text-[12.5px] text-red-900 dark:bg-red-500/15 dark:text-red-100">
              <AlertTriangle size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-[#DC2626]" />
              <div>
                <p className="font-extrabold">Vas a ampliar {counts.vencida === 1 ? 'una tarea que ya está vencida' : `${counts.vencida} tareas que ya están vencidas`}.</p>
                <p>La nueva fecha se cuenta desde la fecha límite vigente, no desde hoy.</p>
                {late.tasks.length > 0 && (
                  <p className="mt-1 font-bold">Con {n} {n === 1 ? 'día' : 'días'}, {late.tasks.length === 1 ? `«${late.tasks[0].title}» seguiría vencida` : `${late.tasks.length} tareas seguirían vencidas`} y el sistema no lo aceptará: concede al menos {late.minimumDays} días.</p>
                )}
              </div>
            </div>
          )}
          {studentIds.length > 1 && (
            <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">Los estados que ves son los de {student.student_name}. Para cada estudiante seleccionado el sistema vuelve a comprobar, al autorizar, que la tarea siga siendo ampliable.</p>
          )}
          <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">La fecha original no se modifica: queda registrada junto con esta ampliación, quién la autoriza y cuándo.</p>
        </section>
        {error && <p role="alert" className="text-[13px] font-medium text-red-700">{error}</p>}
      </form>
    </ModalDialog>
  )
}
