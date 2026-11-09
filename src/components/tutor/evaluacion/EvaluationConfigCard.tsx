import { useState } from 'react'
import { Lock, Pencil, Save, Send, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Badge, Button } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { evaluationApi, type EvaluationOut } from '@/services/evaluation.service'
import { formatPercent } from '@/components/proceso/documentos/gradeReport.utils'
import { isValidWeight, sumWeights, suggestedDraft, toDraft, toPayload, type DeliverableOption } from './evaluationDraft'

interface Props {
  processId: string
  report: EvaluationOut
  /** Entregables activos del plan: solo para armar la distribución sugerida cuando todavía no hay configuración. */
  deliverables: DeliverableOption[]
  onReport: (r: EvaluationOut) => void
  /** Abre/cierra el ajuste de las actividades de cada momento (editor existente). */
  advancedOpen: boolean
  onToggleAdvanced: () => void
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',')

/**
 * Configuración general: el porcentaje de cada momento evaluativo (deben sumar 100 %). Solo cambia los porcentajes de los momentos; las
 * actividades, sus ponderaciones y los entregables no se tocan aquí. Guarda con el mismo servicio de configuración de la evaluación.
 */
export function EvaluationConfigCard({ processId, report, deliverables, onReport, advancedOpen, onToggleAdvanced }: Props) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [editing, setEditing] = useState(false)
  const [weights, setWeights] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const published = report.status === 'publicada'
  const locked = report.has_published_grades
  const total = report.moments.reduce((sum, m) => sum + m.weight_percentage, 0)
  const sum = sumWeights(weights)
  const invalid = weights.some((w) => !isValidWeight(w))
  const problem = invalid ? 'Cada porcentaje debe estar entre 0 y 100, con hasta 2 decimales.' : sum !== 100 ? `Los momentos suman ${fmt(sum)} %: deben sumar exactamente 100 %.` : null

  const run = async (action: (token: string) => Promise<EvaluationOut>, success: string, after?: () => void) => {
    if (!accessToken || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      onReport(await action(accessToken))
      setNotice(success)
      after?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const startEditing = () => {
    setWeights(report.moments.map((m) => String(m.weight_percentage)))
    setError(null)
    setNotice(null)
    setEditing(true)
  }
  const save = () =>
    run(
      (t) => {
        const draft = toDraft(report).map((m, i) => ({ ...m, weight: weights[i] })) // solo cambian los porcentajes de los momentos
        return evaluationApi.saveConfig(t, processId, toPayload(draft))
      },
      'Configuración guardada: la tabla ya usa los nuevos porcentajes.',
      () => setEditing(false)
    )
  const loadSuggested = () => run((t) => evaluationApi.saveConfig(t, processId, toPayload(suggestedDraft(deliverables))), 'Se cargó la distribución sugerida (20 % - 35 % - 45 %) con los entregables del plan.')
  const publish = () => run((t) => evaluationApi.publish(t, processId), 'Evaluación publicada: ya se pueden calificar las entregas y el estudiante ve las notas publicadas.')
  const unpublish = () => run((t) => evaluationApi.unpublish(t, processId), 'Evaluación desactivada: vuelve a ser un borrador.')

  const canEdit = report.can_configure
  const problems = report.config_problems ?? []

  return (
    <section aria-label="Configuración general de evaluación" className="flex flex-col gap-3 rounded-2xl border border-[#DCE6F2] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] dark:border-[var(--color-border)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-[18px] font-extrabold text-[var(--color-secondary)]">Configuración general de evaluación</h3>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">Define el porcentaje de cada momento evaluativo del proyecto.</p>
        </div>
        <Badge variant={published ? 'green' : 'orange'}>{report.status === 'sin_configurar' ? 'Sin configurar' : published ? 'Publicada' : 'Borrador'}</Badge>
      </div>

      {report.moments.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-[#DCE6F2] px-4 py-4 text-[13px] text-[var(--color-text-muted)] dark:border-[var(--color-border)]">
          <p>Este proyecto todavía no tiene momentos evaluativos.</p>
          {canEdit && <Button type="button" size="sm" disabled={busy} onClick={() => void loadSuggested()}>{busy ? 'Cargando…' : 'Cargar distribución sugerida (20 % - 35 % - 45 %)'}</Button>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#DCE6F2] dark:border-[var(--color-border)]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="bg-[var(--color-bg)] text-[12px] font-bold text-[var(--color-secondary)]">
                <th scope="col" className="px-3 py-2">Momento evaluativo</th>
                <th scope="col" className="px-3 py-2 text-right">Porcentaje del proyecto</th>
              </tr>
            </thead>
            <tbody>
              {report.moments.map((m, i) => (
                <tr key={m.public_id} className="border-t border-[#E6EDF7] dark:border-[var(--color-border)]">
                  <th scope="row" className="px-3 py-2 font-semibold text-[var(--color-text)]">{m.name}</th>
                  <td className="px-3 py-2 text-right">
                    {editing ? (
                      <span className="relative inline-block">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          aria-label={`Porcentaje del momento ${i + 1}`}
                          value={weights[i] ?? ''}
                          disabled={busy}
                          onChange={(e) => setWeights((w) => w.map((x, j) => (j === i ? e.target.value : x)))}
                          className="field-input w-[104px] !py-1 pr-8 text-right text-[13px] font-bold [appearance:auto]"
                        />
                        <span aria-hidden="true" className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[var(--color-text-muted)]">%</span>
                      </span>
                    ) : (
                      <span className="font-bold text-[var(--color-secondary)]">{formatPercent(m.weight_percentage)}</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[#E6EDF7] bg-amber-50/70 font-bold text-[var(--color-secondary)] dark:border-[var(--color-border)] dark:bg-amber-400/10">
                <th scope="row" className="px-3 py-2">Total del proyecto</th>
                <td className={cn('px-3 py-2 text-right', editing && problem && 'text-red-600')}>{formatPercent(editing ? sum : total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {editing && problem && <p role="alert" className="text-[12.5px] font-semibold text-red-600">{problem}</p>}
      {error && <p role="alert" className="text-[12.5px] font-semibold text-red-600">{error}</p>}
      {notice && <p role="status" className="text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {canEdit && report.moments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button type="button" size="sm" disabled={busy || Boolean(problem)} onClick={() => void save()}><Save size={14} aria-hidden="true" /> {busy ? 'Guardando…' : 'Guardar'}</Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setEditing(false); setError(null) }}><X size={14} aria-hidden="true" /> Cancelar</Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={busy || locked} title={locked ? 'Ya hay notas publicadas: los porcentajes no se pueden cambiar' : undefined} onClick={startEditing}>
              {locked ? <Lock size={14} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />} Editar configuración
            </Button>
          )}
          {!editing && (published ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy || locked} title={locked ? 'Hay notas publicadas: no se puede desactivar' : undefined} onClick={() => void unpublish()}>Desactivar evaluación</Button>
          ) : (
            <Button type="button" size="sm" disabled={busy || problems.length > 0} title={problems.length > 0 ? 'Corrige lo indicado abajo para poder publicar' : undefined} onClick={() => void publish()}><Send size={14} aria-hidden="true" /> Publicar evaluación</Button>
          ))}
          <button type="button" aria-expanded={advancedOpen} onClick={onToggleAdvanced} className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-bold text-[#0E6B9C] underline-offset-4 hover:underline dark:text-sky-300">
            <SlidersHorizontal size={13} aria-hidden="true" /> {advancedOpen ? 'Ocultar actividades y ponderaciones' : 'Ajustar actividades y ponderaciones'}
          </button>
        </div>
      )}
      {!published && canEdit && problems.length > 0 && (
        <ul aria-label="Pendientes para publicar" className="list-disc pl-5 text-[12px] text-amber-800 dark:text-amber-300">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {locked && <p className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]"><Lock size={12} aria-hidden="true" /> Hay notas publicadas: los porcentajes y la estructura no se pueden cambiar.</p>}
    </section>
  )
}
