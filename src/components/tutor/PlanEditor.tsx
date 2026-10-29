import { useState } from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import {
  DEFAULT_ACCEPTED_EXTENSIONS,
  workPlanApi,
  type DeliverableInput,
  type DeliverableOut,
  type StageOut,
  type WorkPlanOut,
} from '@/services/workplan.service'
import { DeliverableStatusBadge, formatCalendarDate } from '@/components/proceso/workPlanUi'

const inputClass =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[#0876B9]'

function Field({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
      {label}
      {children}
    </label>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-[var(--color-text)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#FF6500]" />
      {label}
    </label>
  )
}

/** Ejecuta una operación del plan, muestra su error y entrega el plan actualizado que devuelve la API. */
function useMutation(processId: string, onPlan: (plan: WorkPlanOut) => void) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: (token: string) => Promise<WorkPlanOut>): Promise<boolean> => {
    if (!accessToken || busy) return false
    setBusy(true)
    setError(null)
    try {
      onPlan(await action(accessToken))
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cambio')
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run, processId }
}

function Alert({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-[13px] font-medium text-red-700">
      {message}
    </p>
  ) : null
}

// ── Crear el plan ─────────────────────────────────────────────────────────────

function CreatePlanForm({ processId, onPlan }: { processId: string; onPlan: (p: WorkPlanOut) => void }) {
  const { busy, error, run } = useMutation(processId, onPlan)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [useTemplate, setUseTemplate] = useState(true)

  return (
    <Card>
      <h3 className="text-[18px] font-bold text-[var(--color-text)]">Crear el plan de trabajo</h3>
      <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
        La plantilla inicial es un punto de partida para semilleros de investigación (dos semestres) y es totalmente editable. Si indicas una fecha de
        inicio, se proponen fechas relativas que podrás cambiar antes de publicar.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Fecha de inicio (opcional)" htmlFor="plan-start">
          <input id="plan-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Fecha objetivo de finalización (opcional)" htmlFor="plan-end">
          <input id="plan-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="mt-4">
        <Check label="Usar la plantilla inicial de dos semestres para semilleros de investigación" checked={useTemplate} onChange={setUseTemplate} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            void run((t) =>
              workPlanApi.create(t, processId, {
                start_date: start || null,
                target_end_date: end || null,
                template: useTemplate ? 'semillero_investigacion_dos_semestres' : null,
              })
            )
          }
        >
          {busy ? 'Creando…' : 'Crear plan en borrador'}
        </Button>
        <Alert message={error} />
      </div>
    </Card>
  )
}

// ── Fechas del plan y publicación ─────────────────────────────────────────────

function PlanHeader({ plan, processId, onPlan }: { plan: WorkPlanOut; processId: string; onPlan: (p: WorkPlanOut) => void }) {
  const dates = useMutation(processId, onPlan)
  const publish = useMutation(processId, onPlan)
  const [start, setStart] = useState(plan.start_date ?? '')
  const [end, setEnd] = useState(plan.target_end_date ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const published = plan.status === 'publicado'

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[18px] font-bold text-[var(--color-text)]">Fechas y publicación</h3>
        <Badge variant={published ? 'green' : 'orange'}>{published ? 'Plan publicado' : 'Borrador (el estudiante no lo ve)'}</Badge>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Fecha de inicio" htmlFor="header-start">
          <input id="header-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Fecha objetivo de finalización" htmlFor="header-end">
          <input id="header-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={dates.busy}
          onClick={() => void dates.run((t) => workPlanApi.updateDates(t, processId, { start_date: start || null, target_end_date: end || null }))}
        >
          Guardar fechas
        </Button>
      </div>
      <Alert message={dates.error} />

      {published ? (
        <p className="mt-4 text-[13px] text-[var(--color-text-muted)]">
          Publicado{plan.published_at ? ` el ${formatCalendarDate(plan.published_at.slice(0, 10))}` : ''}. Los cambios se aplican de inmediato y quedan
          registrados en el historial.
        </p>
      ) : (
        <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Revisa etapas, entregables y fechas. Las fechas solo se consideran confirmadas para el estudiante cuando publicas el plan.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Check label="Confirmo que revisé las fechas y los entregables" checked={confirmed} onChange={setConfirmed} />
            <Button type="button" disabled={!confirmed || publish.busy} onClick={() => void publish.run((t) => workPlanApi.publish(t, processId))}>
              <CheckCircle2 size={16} aria-hidden /> {publish.busy ? 'Publicando…' : 'Publicar plan'}
            </Button>
          </div>
          <Alert message={publish.error} />
        </div>
      )}
    </Card>
  )
}

// ── Entregables ───────────────────────────────────────────────────────────────

function DeliverableEditor({
  deliverable,
  siblings,
  processId,
  onPlan,
}: {
  deliverable: DeliverableOut
  siblings: DeliverableOut[]
  processId: string
  onPlan: (p: WorkPlanOut) => void
}) {
  const { busy, error, run } = useMutation(processId, onPlan)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(deliverable.title)
  const [instructions, setInstructions] = useState(deliverable.instructions ?? '')
  const [mandatory, setMandatory] = useState(deliverable.mandatory)
  const [applicable, setApplicable] = useState(deliverable.applicable)
  const [active, setActive] = useState(deliverable.active)
  const [due, setDue] = useState(deliverable.due_date ?? '')
  const [dependsOn, setDependsOn] = useState(deliverable.depends_on_public_id ?? '')
  const [formats, setFormats] = useState<string[]>(deliverable.accepted_extensions ?? [])

  const save = async () => {
    const body: Partial<DeliverableInput> = {
      title,
      instructions: instructions || null,
      mandatory,
      applicable,
      active,
      due_date: due || null,
      depends_on_public_id: dependsOn || null,
      accepted_extensions: formats.length ? formats : null,
    }
    if (await run((t) => workPlanApi.updateDeliverable(t, processId, deliverable.public_id, body))) setOpen(false)
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--color-text)]">
            {deliverable.title}{' '}
            {!deliverable.mandatory && <span className="text-[12px] font-normal text-[var(--color-text-muted)]">(opcional)</span>}
            {!deliverable.applicable && <span className="text-[12px] font-normal text-[var(--color-text-muted)]"> · No aplica</span>}
            {!deliverable.active && <span className="text-[12px] font-normal text-[var(--color-text-muted)]"> · Desactivado</span>}
          </p>
          <p className="text-[12px] text-[var(--color-text-muted)]">Fecha límite: {formatCalendarDate(deliverable.due_date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <DeliverableStatusBadge status={deliverable.status} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-[13px] font-semibold text-[#0876B9] underline underline-offset-4"
          >
            {open ? 'Cerrar' : 'Editar'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <Field label="Título" htmlFor={`t-${deliverable.public_id}`}>
            <input id={`t-${deliverable.public_id}`} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Instrucciones para el estudiante" htmlFor={`i-${deliverable.public_id}`}>
            <textarea id={`i-${deliverable.public_id}`} rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={inputClass} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha límite" htmlFor={`d-${deliverable.public_id}`}>
              <input id={`d-${deliverable.public_id}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Se habilita al aprobar" htmlFor={`p-${deliverable.public_id}`}>
              <select id={`p-${deliverable.public_id}`} value={dependsOn} onChange={(e) => setDependsOn(e.target.value)} className={inputClass}>
                <option value="">Sin dependencia</option>
                {siblings.filter((s) => s.public_id !== deliverable.public_id).map((s) => (
                  <option key={s.public_id} value={s.public_id}>{s.title}</option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1 text-[12px] font-semibold text-[var(--color-text-muted)]">Formatos permitidos (ninguno marcado = todos los admitidos)</legend>
            <div className="flex flex-wrap gap-3">
              {DEFAULT_ACCEPTED_EXTENSIONS.map((ext) => (
                <Check key={ext} label={ext} checked={formats.includes(ext)} onChange={(v) => setFormats((f) => (v ? [...f, ext] : f.filter((x) => x !== ext)))} />
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-4">
            <Check label="Obligatorio" checked={mandatory} onChange={setMandatory} />
            <Check label="Aplica a este proyecto" checked={applicable} onChange={setApplicable} />
            <Check label="Activo" checked={active} onChange={setActive} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" disabled={busy || !title.trim()} onClick={() => void save()}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Alert message={error} />
          </div>
        </div>
      )}
    </li>
  )
}

function NewDeliverableForm({ stage, processId, onPlan }: { stage: StageOut; processId: string; onPlan: (p: WorkPlanOut) => void }) {
  const { busy, error, run } = useMutation(processId, onPlan)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [mandatory, setMandatory] = useState(true)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0876B9] underline underline-offset-4">
        <Plus size={14} aria-hidden /> Agregar entregable
      </button>
    )
  }
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-dashed border-[var(--color-border)] p-4">
      <Field label="Título del entregable" htmlFor={`new-${stage.public_id}`}>
        <input id={`new-${stage.public_id}`} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Fecha límite (opcional)" htmlFor={`new-due-${stage.public_id}`}>
        <input id={`new-due-${stage.public_id}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
      </Field>
      <Check label="Obligatorio" checked={mandatory} onChange={setMandatory} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={busy || !title.trim()}
          onClick={async () => {
            if (await run((t) => workPlanApi.createDeliverable(t, processId, stage.public_id, { title, due_date: due || null, mandatory }))) {
              setTitle('')
              setDue('')
              setOpen(false)
            }
          }}
        >
          {busy ? 'Creando…' : 'Crear entregable'}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-[var(--color-text-muted)] underline">Cancelar</button>
        <Alert message={error} />
      </div>
    </div>
  )
}

function StageCard({ stage, plan, processId, onPlan }: { stage: StageOut; plan: WorkPlanOut; processId: string; onPlan: (p: WorkPlanOut) => void }) {
  const { busy, error, run } = useMutation(processId, onPlan)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(stage.name)
  const [description, setDescription] = useState(stage.description ?? '')
  const [semester, setSemester] = useState(stage.semester)
  const all = plan.stages.flatMap((s) => s.deliverables)

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[17px] font-bold text-[var(--color-text)]">
            {stage.name} {!stage.active && <span className="text-[12px] font-normal text-[var(--color-text-muted)]">· Desactivada</span>}
          </h4>
          {stage.description && <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{stage.description}</p>}
        </div>
        <div className="flex items-center gap-3 text-[13px] font-semibold">
          <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="text-[#0876B9] underline underline-offset-4">
            {editing ? 'Cerrar' : 'Editar etapa'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run((t) => workPlanApi.updateStage(t, processId, stage.public_id, { active: !stage.active }))}
            className="text-[var(--color-text-muted)] underline underline-offset-4"
          >
            {stage.active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <Field label="Nombre de la etapa" htmlFor={`sn-${stage.public_id}`}>
            <input id={`sn-${stage.public_id}`} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Descripción" htmlFor={`sd-${stage.public_id}`}>
            <textarea id={`sd-${stage.public_id}`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Semestre" htmlFor={`ss-${stage.public_id}`}>
            <input id={`ss-${stage.public_id}`} type="number" min={1} max={12} value={semester} onChange={(e) => setSemester(Number(e.target.value))} className={inputClass} />
          </Field>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={busy || !name.trim()}
              onClick={async () => {
                if (await run((t) => workPlanApi.updateStage(t, processId, stage.public_id, { name, description: description || null, semester }))) setEditing(false)
              }}
            >
              Guardar etapa
            </Button>
          </div>
        </div>
      )}
      <Alert message={error} />

      <ul className="mt-3 divide-y divide-[var(--color-border)]">
        {stage.deliverables.map((d) => (
          <DeliverableEditor key={d.public_id} deliverable={d} siblings={all} processId={processId} onPlan={onPlan} />
        ))}
      </ul>
      {stage.deliverables.length === 0 && <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">Esta etapa aún no tiene entregables.</p>}
      <NewDeliverableForm stage={stage} processId={processId} onPlan={onPlan} />
    </Card>
  )
}

function AddStageForm({ processId, onPlan }: { processId: string; onPlan: (p: WorkPlanOut) => void }) {
  const { busy, error, run } = useMutation(processId, onPlan)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [semester, setSemester] = useState(1)

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden /> Agregar etapa
      </Button>
    )
  }
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="Nombre de la nueva etapa" htmlFor="new-stage-name">
          <input id="new-stage-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Semestre" htmlFor="new-stage-semester">
          <input id="new-stage-semester" type="number" min={1} max={12} value={semester} onChange={(e) => setSemester(Number(e.target.value))} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={busy || !name.trim()}
          onClick={async () => {
            if (await run((t) => workPlanApi.createStage(t, processId, { name, semester }))) {
              setName('')
              setOpen(false)
            }
          }}
        >
          {busy ? 'Creando…' : 'Crear etapa'}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-[var(--color-text-muted)] underline">Cancelar</button>
        <Alert message={error} />
      </div>
    </Card>
  )
}

export function PlanEditor({ plan, processId, onPlan }: { plan: WorkPlanOut | null; processId: string; onPlan: (p: WorkPlanOut) => void }) {
  if (!plan) return <CreatePlanForm processId={processId} onPlan={onPlan} />
  return (
    <div className="flex flex-col gap-5">
      <PlanHeader plan={plan} processId={processId} onPlan={onPlan} />
      {plan.stages.map((stage) => (
        <StageCard key={stage.public_id} stage={stage} plan={plan} processId={processId} onPlan={onPlan} />
      ))}
      <div>
        <AddStageForm processId={processId} onPlan={onPlan} />
      </div>
    </div>
  )
}
