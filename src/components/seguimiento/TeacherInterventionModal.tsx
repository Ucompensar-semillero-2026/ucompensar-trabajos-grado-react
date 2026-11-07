import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { ApiError } from '@/services/http'
import { monitoringApi, type InterventionKind, type InterventionOut, type StudentRow, type TaskOut } from '@/services/monitoring.service'
import { KIND_LABEL, toBogotaIso, validateIntervention, InterventionForm } from './intervention.utils'

const fieldClass = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]'
const labelClass = 'mb-1 block text-[12px] font-bold text-[var(--color-secondary)]'

interface Props {
  token: string
  student: StudentRow
  tasks: TaskOut[]
  onClose: () => void
  onSaved: (intervention: InterventionOut) => void
}

/** Registra la reunión/retroalimentación y sus compromisos. No crea reuniones en Teams: solo guarda el evento y su enlace. */
export function TeacherInterventionModal({ token, student, tasks, onClose, onSaved }: Props) {
  const [form, setForm] = useState<InterventionForm>({
    kind: 'reunion_teams', mode: 'virtual', occurred: '', url: '', observations: '', difficulties: '', taskIds: [], commitments: [],
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof InterventionForm>(key: K, value: InterventionForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const eligible = tasks.filter((t) => t.state !== 'cancelada')

  const save = async () => {
    if (saving) return
    const problem = validateIntervention(form)
    if (problem) return setError(problem)
    setSaving(true)
    setError(null)
    try {
      onSaved(await monitoringApi.registerIntervention(token, {
        process_id: student.process_id, student_id: student.student_id, kind: form.kind, mode: form.mode, occurred_at: toBogotaIso(form.occurred),
        meeting_url: form.url.trim() || null, observations: form.observations.trim() || null, difficulties: form.difficulties.trim() || null,
        deliverable_ids: form.taskIds,
        commitments: form.commitments.map((c) => ({ description: c.description.trim(), due_date: c.due, student_id: student.student_id, deliverable_ids: c.taskIds })),
      }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la intervención.')
      setSaving(false)
    }
  }

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  return (
    <ModalDialog
      title="Registrar intervención académica" onClose={onClose} wide
      footer={<><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" form="intervention-form" disabled={saving}>{saving ? 'Guardando…' : 'Guardar seguimiento'}</Button></>}
    >
      <form id="intervention-form" noValidate className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <p className="text-[13px] text-[var(--color-text-muted)]">Estudiante: <strong>{student.student_name}</strong> · {student.project_title ?? student.process_code}. La retroalimentación es privada: el equipo no la ve.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="iv-kind" className={labelClass}>Tipo de intervención</label>
            <select id="iv-kind" className={fieldClass} value={form.kind} onChange={(e) => {
              const kind = e.target.value as InterventionKind
              setForm((f) => ({ ...f, kind, mode: kind === 'reunion_teams' ? 'virtual' : kind === 'reunion_presencial' ? 'presencial' : f.mode }))
            }}>{(Object.keys(KIND_LABEL) as InterventionKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></div>
          <div><label htmlFor="iv-when" className={labelClass}>Fecha y hora (Bogotá)</label>
            <input id="iv-when" type="datetime-local" className={fieldClass} value={form.occurred} onChange={(e) => set('occurred', e.target.value)} /></div>
        </div>
        <div role="radiogroup" aria-label="Modalidad de la reunión" className="flex flex-wrap gap-5 text-[13px]">
          <label className="flex items-center gap-2"><input type="radio" name="iv-mode" checked={form.mode === 'virtual'} onChange={() => set('mode', 'virtual')} />Virtual</label>
          <label className="flex items-center gap-2"><input type="radio" name="iv-mode" checked={form.mode === 'presencial'} onChange={() => set('mode', 'presencial')} />Presencial</label>
        </div>
        <div><label htmlFor="iv-url" className={labelClass}>Enlace de la reunión (opcional)</label>
          <input id="iv-url" className={fieldClass} placeholder="https://teams.microsoft.com/…" value={form.url} onChange={(e) => set('url', e.target.value)} />
          <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">Aquí solo se guarda el enlace: la plataforma no crea reuniones en Microsoft Teams.</p></div>
        <div><label htmlFor="iv-obs" className={labelClass}>Observaciones y retroalimentación</label>
          <textarea id="iv-obs" rows={3} maxLength={4000} className={fieldClass} value={form.observations} onChange={(e) => set('observations', e.target.value)} /></div>
        <div><label htmlFor="iv-dif" className={labelClass}>Dificultades identificadas</label>
          <textarea id="iv-dif" rows={2} maxLength={4000} className={fieldClass} value={form.difficulties} onChange={(e) => set('difficulties', e.target.value)} /></div>
        <fieldset>
          <legend className={labelClass}>Tareas relacionadas</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {eligible.map((t) => (
              <label key={t.deliverable_id} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={form.taskIds.includes(t.deliverable_id)} onChange={() => set('taskIds', toggle(form.taskIds, t.deliverable_id))} />{t.title}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="rounded-xl border border-[var(--color-border)] p-3">
          <legend className="px-1 text-[12px] font-bold text-[var(--color-secondary)]">Compromisos</legend>
          {form.commitments.map((c, i) => (
            <div key={i} className="mb-3 grid gap-2 rounded-lg bg-[var(--color-surface-2,#F4F6F8)] p-3">
              <div><label htmlFor={`cm-desc-${i}`} className={labelClass}>Compromiso {i + 1}</label>
                <textarea id={`cm-desc-${i}`} rows={2} className={fieldClass} value={c.description} onChange={(e) => set('commitments', form.commitments.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} /></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><label htmlFor={`cm-due-${i}`} className={labelClass}>Fecha de cumplimiento</label>
                  <input id={`cm-due-${i}`} type="date" className={fieldClass} value={c.due} onChange={(e) => set('commitments', form.commitments.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} /></div>
                <div className="flex items-end"><Button type="button" variant="outline" size="sm" className="gap-1.5" aria-label={`Quitar compromiso ${i + 1}`} onClick={() => set('commitments', form.commitments.filter((_, j) => j !== i))}><Trash2 size={13} aria-hidden="true" />Quitar</Button></div>
              </div>
              <p className="text-[12px] text-[var(--color-text-muted)]">Responsable: {student.student_name}</p>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => set('commitments', [...form.commitments, { description: '', due: '', taskIds: form.taskIds }])}><Plus size={13} aria-hidden="true" />Agregar compromiso</Button>
        </fieldset>
        {error && <p role="alert" className="text-[13px] font-medium text-red-700">{error}</p>}
      </form>
    </ModalDialog>
  )
}
