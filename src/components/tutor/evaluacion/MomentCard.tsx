import { useState } from 'react'
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, CircleAlert, CheckCircle2, ClipboardCheck, ClipboardList, Copy, FileText, GraduationCap, Info, Lock, Plus, Presentation, Star, Trash2, User, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui'
import { effectiveWeight, momentProblem, newKey, parseWeight, sumWeights, type DeliverableOption, type DraftCriterion, type DraftMoment } from './evaluationDraft'

/** Icono y tono de cada momento (los tres primeros como en la referencia: documento, libro y birrete). */
const MOMENT_LOOK: Array<{ Icon: LucideIcon; tile: string }> = [
  { Icon: FileText, tile: 'bg-[#0E6B9C]/10 text-[#0E6B9C] dark:bg-sky-400/15 dark:text-sky-300' },
  { Icon: BookOpen, tile: 'bg-[#FF641D]/10 text-[#E5530F] dark:text-orange-300' },
  { Icon: GraduationCap, tile: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
]
const MOMENT_FALLBACK = { Icon: ClipboardList, tile: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' }

/** Icono discreto del criterio según su nombre (solo decorativo). */
function criterionIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (/sustent|presentaci|exposici/.test(n)) return Presentation
  if (/autoeval/.test(n)) return Star
  if (/coeval|tutor|semillero|equipo/.test(n)) return Users
  if (/evaluador|jurado|docente/.test(n)) return User
  if (/escrit|document|informe|trabajo|propuesta|avance/.test(n)) return FileText
  return ClipboardCheck
}

const iconBtn =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C] disabled:cursor-not-allowed disabled:opacity-40'
const bare = 'rounded-lg border border-transparent bg-transparent outline-none transition-colors hover:border-[var(--color-border)] focus:border-[#0E6B9C] focus:bg-[var(--color-surface)]'
const numberInput =
  'field-input !py-1.5 pr-11 text-right text-[13px] font-bold [appearance:auto] disabled:cursor-not-allowed disabled:opacity-60'
// Clase completa: Tailwind no detecta plantillas. Entregable | % del momento | Aporte | Acciones
const COLS = 'grid-cols-[minmax(260px,3fr)_118px_132px_72px]'

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
const pct2 = (n: number) => `${n.toFixed(2).replace('.', ',')} %`

interface Props {
  /** Posición (desde 0) y cantidad de momentos, para el número, el icono y los botones de orden. */
  index: number
  count: number
  moment: DraftMoment
  /** Con notas publicadas no se agregan/quitan momentos o criterios ni se cambian porcentajes. */
  locked: boolean
  /** Entregables ACTIVOS del plan de trabajo real del proyecto (su nota aparece en «Mis tareas»). */
  deliverables: DeliverableOption[]
  /** Entregable → clave del criterio que ya lo usa (un entregable solo puede tener un criterio). */
  deliverableOwner: Record<string, string>
  onPatch: (patch: Partial<DraftMoment>) => void
  onMove: (delta: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
}

export function MomentCard({ index, count, moment: m, locked, deliverables, deliverableOwner, onPatch, onMove, onDuplicate, onDelete }: Props) {
  const n = index + 1
  const [open, setOpen] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const look = MOMENT_LOOK[index] ?? MOMENT_FALLBACK
  const problem = momentProblem(n, m)
  const weight = parseWeight(m.weight)
  const hasGrades = m.criteria.some((c) => c.graded)
  const criteriaTotal = sumWeights(m.criteria.map((c) => c.weight))
  const known = new Set(deliverables.map((d) => d.value))

  const setCriterion = (ci: number, patch: Partial<DraftCriterion>) => onPatch({ criteria: m.criteria.map((c, j) => (j === ci ? { ...c, ...patch } : c)) })
  const deleteTitle = hasGrades ? 'Tiene notas registradas: no se puede eliminar' : locked ? 'Hay notas publicadas: la estructura está bloqueada' : 'Eliminar este momento (hasta que guardes puedes cancelar el cambio)'

  return (
    <section aria-label={`Momento ${n}`} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 p-4">
        <span aria-hidden="true" className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', look.tile)}><look.Icon size={24} /></span>

        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="whitespace-nowrap font-display text-[17px] font-extrabold text-[var(--color-secondary)]">Momento {n} ·</span>
            <input
              aria-label={`Nombre del momento ${n}`}
              className={cn(bare, 'min-w-[160px] flex-1 px-1.5 py-0.5 font-display text-[17px] font-extrabold text-[var(--color-secondary)]')}
              value={m.name}
              maxLength={150}
              onChange={(e) => onPatch({ name: e.target.value })}
              placeholder="Nombre del momento"
            />
            <span className="rounded-full bg-[#FF641D]/12 px-2.5 py-0.5 text-[12.5px] font-extrabold text-[#C2410C] dark:text-orange-300">{Number.isFinite(weight) ? `${fmt(weight)} %` : '— %'}</span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-bold',
                problem ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
              )}
            >
              {problem ? <CircleAlert size={12} aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
              {problem ? 'Incompleto' : 'Completo'}
            </span>
          </div>
          <input
            aria-label={`Descripción del momento ${n}`}
            className={cn(bare, 'mt-0.5 w-full px-1.5 py-0.5 text-[13px] text-[var(--color-text-muted)]')}
            value={m.description}
            maxLength={500}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="Agrega una descripción (opcional)"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-text-muted)]">
            Porcentaje del momento
            <span className="relative block">
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                aria-label={`Porcentaje del momento ${n}`}
                className={cn(numberInput, 'w-[104px]')}
                value={m.weight}
                disabled={locked}
                onChange={(e) => onPatch({ weight: e.target.value })}
              />
              <span aria-hidden="true" className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-[var(--color-text-muted)]">%</span>
            </span>
          </label>
          <button type="button" className={iconBtn} aria-label={`Subir momento ${n}`} title="Subir" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={15} aria-hidden="true" /></button>
          <button type="button" className={iconBtn} aria-label={`Bajar momento ${n}`} title="Bajar" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={15} aria-hidden="true" /></button>
          <button type="button" className={iconBtn} aria-label={`Duplicar momento ${n}`} title="Duplicar con sus criterios (el porcentaje de la copia queda en 0 %)" disabled={locked || count >= 12} onClick={onDuplicate}><Copy size={15} aria-hidden="true" /></button>
          <button type="button" className={iconBtn} aria-label={`Eliminar momento ${n}`} title={deleteTitle} disabled={locked || hasGrades} onClick={() => (m.criteria.length > 0 ? setConfirming(true) : onDelete())}><Trash2 size={15} aria-hidden="true" /></button>
          <button type="button" className={iconBtn} aria-label={open ? `Contraer momento ${n}` : `Expandir momento ${n}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <ChevronDown size={16} aria-hidden="true" className={cn('transition-transform', open ? 'rotate-180' : 'rotate-0')} />
          </button>
        </div>
      </div>

      {confirming && (
        <div role="alertdialog" aria-label={`Confirmar eliminación del momento ${n}`} className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <span className="min-w-0 flex-1">¿Eliminar este momento y sus {m.criteria.length} {m.criteria.length === 1 ? 'criterio' : 'criterios'}? El cambio no se guarda hasta que pulses «Guardar configuración».</span>
          <Button type="button" size="sm" variant="secondary" aria-label={`Sí, eliminar el momento ${n}`} onClick={() => { setConfirming(false); onDelete() }}>Sí, eliminar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Button>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-[var(--color-border)]">
            <h4 className="border-b border-[var(--color-border)] px-4 py-2.5 text-[13px] font-extrabold text-[var(--color-secondary)]">Entregables del momento ({m.criteria.length})</h4>
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div aria-hidden="true" className={cn('grid items-center gap-x-3 bg-[var(--color-bg)] px-4 py-2 text-[11.5px] font-bold text-[var(--color-text-muted)]', COLS)}>
                  <span>Entregable (plan de trabajo)</span>
                  <span className="text-center">% dentro del momento</span>
                  <span className="flex items-center justify-center gap-1 text-center" title="Porcentaje del momento × porcentaje del entregable / 100">Aporte a la nota final <Info size={12} /></span>
                  <span className="text-center">Acciones</span>
                </div>
                {m.criteria.length === 0 && <p className="px-4 py-5 text-center text-[12.5px] text-[var(--color-text-muted)]">Este momento aún no tiene entregables. Asocia los del plan de trabajo que determinarán su nota.</p>}
                {m.criteria.map((c, ci) => {
                  const eff = effectiveWeight(m.weight, c.weight)
                  const Icon = criterionIcon(c.name)
                  const label = (id: string) => deliverables.find((d) => d.value === id)?.label
                  return (
                    <div key={c.key} className="border-t border-[var(--color-border)]">
                      <div className={cn('grid items-center gap-x-3 px-4 py-2', COLS)}>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon size={16} aria-hidden="true" className="shrink-0 text-[var(--color-text-muted)]" />
                            <select
                              aria-label={`Entregable vinculado del criterio ${n}.${ci + 1}`}
                              className={cn('field-input min-w-0 flex-1 cursor-pointer !py-1.5 text-[13px] font-semibold', !c.deliverable_public_id && '!border-amber-400')}
                              value={c.deliverable_public_id}
                              onChange={(e) => setCriterion(ci, { deliverable_public_id: e.target.value, name: label(e.target.value) ?? c.name })}
                            >
                              <option value="">Selecciona un entregable del plan</option>
                              {c.deliverable_public_id && !known.has(c.deliverable_public_id) && <option value={c.deliverable_public_id}>Entregable ya no disponible en el plan</option>}
                              {deliverables.map((d) => (
                                <option key={d.value} value={d.value} disabled={Boolean(deliverableOwner[d.value] && deliverableOwner[d.value] !== c.key)}>{d.detail ? `${d.label} — ${d.detail}` : d.label}</option>
                              ))}
                            </select>
                          </div>
                          {!c.deliverable_public_id && <p className="mt-0.5 pl-6 text-[11.5px] text-amber-700 dark:text-amber-300">{c.name.trim() ? `Criterio anterior «${c.name.trim()}»: ` : ''}asócialo a un entregable del plan para poder calificarlo.</p>}
                        </div>
                        <span className="relative block justify-self-center">
                          <input type="number" min={0} max={100} step="0.01" aria-label={`Porcentaje del criterio ${n}.${ci + 1}`} className={cn(numberInput, 'w-[98px]')} value={c.weight} disabled={locked} onChange={(e) => setCriterion(ci, { weight: e.target.value })} />
                          <span aria-hidden="true" className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-[var(--color-text-muted)]">%</span>
                        </span>
                        <span className="justify-self-center rounded-full bg-[#0E6B9C]/10 px-3 py-1 text-[12.5px] font-bold text-[#0E6B9C] dark:bg-sky-400/15 dark:text-sky-300" title="Aporte a la nota final">{eff === null ? '—' : pct2(eff)}</span>
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" className={iconBtn} aria-label={`Eliminar criterio ${n}.${ci + 1}`} title={c.graded ? 'Tiene nota registrada: no se puede quitar' : locked ? 'Hay notas publicadas: la estructura está bloqueada' : 'Quitar este entregable del momento'} disabled={locked || c.graded} onClick={() => onPatch({ criteria: m.criteria.filter((_, j) => j !== ci) })}><Trash2 size={14} aria-hidden="true" /></button>
                        </div>
                      </div>
                      {c.graded && <p className="px-4 pb-2 text-[12px] text-[var(--color-text-muted)]">Este entregable ya tiene una nota registrada.</p>}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3">
              <Button type="button" variant="outline" size="sm" disabled={locked || m.criteria.length >= 30} onClick={() => onPatch({ criteria: [...m.criteria, { key: newKey(), public_id: null, name: '', description: '', weight: '0', deliverable_public_id: '', graded: false }] })}>
                <Plus size={13} aria-hidden="true" /> Agregar entregable
              </Button>
              <p className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-bold', problem ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>
                {problem ? <CircleAlert size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                {problem ?? `Total criterios: ${fmt(criteriaTotal)} %`}
              </p>
            </div>
          </div>
          {locked && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]"><Lock size={12} aria-hidden="true" /> Hay notas publicadas: los porcentajes y la estructura no se pueden cambiar.</p>}
        </div>
      )}
    </section>
  )
}
