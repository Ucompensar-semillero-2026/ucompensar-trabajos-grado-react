import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Info, Layers, ListChecks, Lock, Pencil, Percent, Plus, RotateCcw, Save, Send } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { evaluationApi, type EvaluationOut } from '@/services/evaluation.service'
import {
  MOMENT_COLORS,
  criteriaCount,
  defaultDraft,
  duplicateMoment,
  fieldProblems,
  initialDraft,
  type DeliverableOption,
  isDirty,
  momentProblem,
  momentsStatus,
  newKey,
  parseWeight,
  publishProblems,
  sumWeights,
  syncNames,
  toDraft,
  toPayload,
  type DraftMoment,
} from './evaluationDraft'
import { MomentCard } from './MomentCard'
import { ProjectSummaryCard, type SummaryStat } from './ProjectSummaryCard'

interface Props {
  processId: string
  report: EvaluationOut
  /** Entregables ACTIVOS del plan de trabajo real del proyecto: a ellos se pueden asociar los criterios. */
  deliverables: DeliverableOption[]
  onReport: (report: EvaluationOut) => void
}

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function EvaluationConfigEditor({ processId, report, deliverables, onReport }: Props) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [saved, setSaved] = useState<DraftMoment[]>(() => syncNames(toDraft(report), deliverables))
  const [draft, setDraft] = useState<DraftMoment[]>(() => initialDraft(report, deliverables))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  // Cada respuesta del servidor (guardar, publicar, calificar) es la nueva versión guardada. Sin nada guardado se sugiere la plantilla.
  useEffect(() => {
    setSaved(syncNames(toDraft(report), deliverables))
    setDraft(initialDraft(report, deliverables))
    setRestoring(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- los entregables solo sugieren la plantilla inicial; no deben pisar lo que el tutor edita
  }, [report])

  const published = report.status === 'publicada'
  const locked = report.has_published_grades // con notas publicadas: sin agregar/quitar momentos o criterios ni cambiar porcentajes
  const dirty = isDirty(draft, saved)
  const hasGradedCriteria = draft.some((m) => m.criteria.some((c) => c.graded))
  const usingTemplate = report.moments.length === 0 && !published
  const fieldIssues = fieldProblems(draft)
  const problems = publishProblems(draft)
  const total = sumWeights(draft.map((m) => m.weight))
  const status = momentsStatus(total)
  const criteria = criteriaCount(draft)
  const complete = problems.length === 0
  const usedLinks = new Set(draft.flatMap((m) => m.criteria.map((c) => c.deliverable_public_id)).filter(Boolean))
  const unlinked = deliverables.filter((d) => !usedLinks.has(d.value))
  const deliverableOwner = useMemo(() => {
    const owner: Record<string, string> = {}
    for (const m of draft) for (const c of m.criteria) if (c.deliverable_public_id) owner[c.deliverable_public_id] = c.key
    return owner
  }, [draft])

  const patchMoment = (i: number, patch: Partial<DraftMoment>) => setDraft((d) => d.map((m, j) => (j === i ? { ...m, ...patch } : m)))

  const run = async (action: () => Promise<EvaluationOut>, done: string) => {
    if (!accessToken) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      onReport(await action())
      setNotice(done)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const save = () => run(() => evaluationApi.saveConfig(accessToken as string, processId, toPayload(draft)), 'Guardado correctamente.')
  const publish = () => run(() => evaluationApi.publish(accessToken as string, processId), 'Evaluación publicada: tu estudiante ya ve la estructura y, cuando publiques notas, sus resultados.')
  const unpublish = () => run(() => evaluationApi.unpublish(accessToken as string, processId), 'Evaluación desactivada: el estudiante ya no la ve.')
  const cancel = () => { setDraft(initialDraft(report, deliverables)); setError(null); setNotice(null); setRestoring(false) }
  const restore = () => { setDraft(defaultDraft()); setRestoring(false); setError(null); setNotice('Se restauró la distribución sugerida (20 % - 35 % - 45 %). Guarda para conservarla.') }

  const restoreBlocked = published || hasGradedCriteria || locked
  const restoreTitle = published ? 'Desactiva la evaluación para restaurar la distribución sugerida' : hasGradedCriteria || locked ? 'Hay notas registradas: no se puede reemplazar la estructura' : 'Volver a 20 % - 35 % - 45 %'

  const stats: SummaryStat[] = [
    { Icon: Layers, value: String(draft.length), label: draft.length === 1 ? 'momento evaluativo' : 'momentos evaluativos', tone: 'bg-[#0E6B9C]/10 text-[#0E6B9C] dark:bg-sky-400/15 dark:text-sky-300' },
    { Icon: Percent, value: `${fmt(total)} %`, label: 'distribuido', tone: status.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' },
    { Icon: ListChecks, value: String(criteria), label: criteria === 1 ? 'criterio configurado' : 'criterios configurados', tone: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
    { Icon: Pencil, value: published ? 'Publicada' : 'Borrador', label: published ? (locked ? 'estructura bloqueada' : 'visible para el estudiante') : 'editable', tone: 'bg-[#FF641D]/10 text-[#E5530F] dark:text-orange-300' },
  ]

  const banner = usingTemplate
    ? 'Se ha cargado la distribución sugerida de UCompensar Virtual (20 % - 35 % - 45 %). Puedes editar los nombres, porcentajes, criterios, asignar o modificar entregables, agregar o eliminar momentos. El porcentaje total de los momentos debe ser 100 % para publicar la evaluación.'
    : published
      ? 'La evaluación está publicada: tu estudiante ya ve esta estructura y las notas que publiques. El porcentaje total de los momentos debe seguir en 100 %.'
      : 'Configuración guardada como borrador. El porcentaje total de los momentos debe ser 100 % para publicar la evaluación.'

  return (
    <div className="flex flex-col gap-4">
      <ProjectSummaryCard report={report} stats={stats} />

      <p role="note" className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200">
        <Info size={17} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>{banner}</span>
      </p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
        <span className="font-display text-[14.5px] font-extrabold text-[var(--color-secondary)]">Distribución de la evaluación</span>
        <div
          role="img"
          aria-label={`Distribución de la evaluación: ${draft.map((m, i) => `${m.name.trim() || `Momento ${i + 1}`} ${Number.isFinite(parseWeight(m.weight)) ? fmt(parseWeight(m.weight)) : 0} %`).join(', ')}`}
          className="flex h-7 min-w-[260px] flex-1 overflow-hidden rounded-full bg-[var(--color-border)]"
        >
          {draft.map((m, i) => {
            const w = parseWeight(m.weight)
            const share = Number.isFinite(w) && w > 0 ? (w / Math.max(total, 100)) * 100 : 0
            return (
              <div key={m.key} className="flex h-full items-center justify-center overflow-hidden px-1 transition-[width]" style={{ width: `${share}%`, background: MOMENT_COLORS[i % MOMENT_COLORS.length] }}>
                {share >= 9 && <span className="truncate text-[12px] font-bold text-white">Momento {i + 1} · {fmt(w)} %</span>}
              </div>
            )
          })}
          {total < 100 && <div className="flex h-full flex-1 items-center justify-center px-1"><span className="truncate text-[11.5px] font-bold text-[var(--color-text-muted)]">Faltan {fmt(100 - total)} %</span></div>}
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-extrabold', status.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200')}>
          {status.ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}
          Total: {fmt(total)} %
        </span>
      </div>

      {locked && (
        <p role="note" className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200">
          <Lock size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          Ya hay notas publicadas: no se pueden agregar ni quitar momentos o criterios, ni cambiar sus porcentajes. Sí puedes corregir nombres, descripciones, orden y vínculos con entregables.
        </p>
      )}

      {draft.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">
          Aún no hay momentos evaluativos. Agrega el primero o restaura la distribución sugerida.
        </p>
      )}

      {draft.map((m, i) => (
        <MomentCard
          key={m.key}
          index={i}
          count={draft.length}
          moment={m}
          locked={locked}
          deliverables={deliverables}
          deliverableOwner={deliverableOwner}
          onPatch={(patch) => patchMoment(i, patch)}
          onMove={(delta) => setDraft((d) => move(d, i, i + delta))}
          onDuplicate={() => setDraft((d) => [...d.slice(0, i + 1), duplicateMoment(m), ...d.slice(i + 1)])}
          onDelete={() => setDraft((d) => d.filter((_, j) => j !== i))}
        />
      ))}

      <div>
        <Button type="button" variant="outline" disabled={locked || draft.length >= 12} onClick={() => setDraft((d) => [...d, { key: newKey(), public_id: null, name: '', description: '', weight: '0', criteria: [] }])}>
          <Plus size={14} aria-hidden="true" /> Agregar momento
        </Button>
      </div>

      <ul role="status" aria-label="Estado de la configuración" className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px]">
        {draft.length === 0 ? (
          <li className="font-semibold text-amber-700 dark:text-amber-300">Agrega al menos un momento evaluativo.</li>
        ) : (
          <li className={cn('font-semibold', status.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>{status.text}</li>
        )}
        {draft.map((m, i) => {
          const p = momentProblem(i + 1, m)
          return p ? <li key={m.key} className="text-amber-700 dark:text-amber-300">{p}</li> : null
        })}
        {fieldIssues.map((p) => <li key={p} className="text-red-700 dark:text-red-300">{p}</li>)}
        {deliverables.length === 0 && <li className="text-[var(--color-text-secondary)]">Aún no hay entregables en el plan de trabajo de este proyecto: créalos en la pestaña «Plan» para poder asociarlos a los criterios.</li>}
        {unlinked.length > 0 && <li className="text-[var(--color-text-secondary)]">Entregables del plan sin criterio asociado: {unlinked.map((d) => d.label).join(', ')}. Puedes dejarlos sin asociar o vincularlos desde el selector de cada criterio.</li>}
        {complete && fieldIssues.length === 0 && <li className="text-emerald-700 dark:text-emerald-300">Los entregables de cada momento suman 100 %: la evaluación se puede publicar.</li>}
      </ul>

      {restoring && (
        <div role="alertdialog" aria-label="Confirmar restauración" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          <span className="min-w-0 flex-1">
            ¿Restaurar la distribución sugerida? Se reemplazarán los momentos actuales por Contextualización 20 %, Profundización 35 % y Transferencia y cierre 45 %, y se descartarán sus criterios. No se borra ningún entregable ni nota.
            Nada se guarda hasta que pulses «Guardar configuración»; con «Cancelar cambios» vuelves a lo guardado.
          </span>
          <Button type="button" size="sm" variant="secondary" onClick={restore}>Sí, restaurar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRestoring(false)}>No, conservar</Button>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{notice}</p>}

      <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-md)]">
        <Button type="button" variant="outline" disabled={restoreBlocked || busy} title={restoreTitle} onClick={() => setRestoring(true)}>
          <RotateCcw size={14} aria-hidden="true" /> Restaurar distribución sugerida (20 % - 35 % - 45 %)
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={!dirty || busy} onClick={cancel}>Cancelar cambios</Button>
          <Button type="button" variant="secondary" disabled={!dirty || busy || fieldIssues.length > 0} onClick={() => void save()}>
            <Save size={14} aria-hidden="true" /> {busy ? 'Guardando…' : 'Guardar configuración'}
          </Button>
          {published ? (
            <Button type="button" variant="outline" disabled={busy || locked || dirty} title={locked ? 'Hay notas publicadas: no se puede desactivar' : undefined} onClick={() => void unpublish()}>
              Desactivar evaluación
            </Button>
          ) : (
            <Button type="button" disabled={busy || dirty || problems.length > 0} title={dirty ? 'Guarda la configuración antes de publicarla' : problems.length > 0 ? 'Corrige lo indicado arriba para poder publicar' : undefined} onClick={() => void publish()}>
              <Send size={14} aria-hidden="true" /> Publicar evaluación
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
