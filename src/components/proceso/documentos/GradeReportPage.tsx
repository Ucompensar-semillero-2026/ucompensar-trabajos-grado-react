import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Award, BarChart3, ChevronDown, ClipboardList, Eye, ListChecks, MessageSquare, Percent } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Badge, EmptyState } from '@/components/ui'
import { LoadError } from '@/components/ui/LoadError'
import { hasModule, homePathFor } from '@/config/access'
import { useAppStore } from '@/stores/app.store'
import { ApiError, messageForStatus } from '@/services/http'
import { evaluationApi, type EvaluationCriterion, type EvaluationMoment, type EvaluationOut, type EvaluationTotals, type OfficialFinalGrade } from '@/services/evaluation.service'
import { processesApi, type ProcessOut } from '@/services/processes.service'
import { EmptyNote } from './documentosUi'
import { instantMs } from './documentosHelpers'
import { GRADE_MAX, formatGrade, formatGradeOfScale, formatPercent, formatPoints } from './gradeReport.utils'

/**
 * Libro de calificaciones de un proyecto de grado (reporte general de notas). Una sola pantalla para todos los roles:
 *  - el estudiante ve la estructura que configuró su tutor y SOLO las notas publicadas;
 *  - quien califica (tutor/evaluador) o configura (tutor/Coordinación/Administración) la abre desde el proyecto
 *    (`?proceso=`) y ve además los borradores, rotulados como tales. Qué se puede ver lo decide el backend (404/403), no esta pantalla.
 * Nada de lo que se muestra se calcula aquí: aportes, nota acumulada y porcentaje evaluado llegan resueltos del servidor.
 */

const reportDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })

/** Instante UTC sin zona del backend → «1 nov 2026» en hora de Bogotá. Se arma por partes: el texto de Intl cambia con la versión de ICU. */
function formatInstant(value: string): string {
  const parts = reportDate.formatToParts(new Date(instantMs(value)))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('day')} ${part('month').replace(/\./g, '')} ${part('year')}`
}

// Clase completa: Tailwind no detecta plantillas. Ítem | Ponderación | Calificación | Rango | Porcentaje | Aporte | Retroalimentación | Estado
const COLS = 'grid-cols-[minmax(200px,2.2fr)_88px_108px_92px_92px_104px_minmax(112px,1fr)_100px]'
const RANGE = `0.0 – ${GRADE_MAX.toFixed(1)}`

/** Mensaje claro y seguro según la causa (nunca el detalle interno del servidor). */
function describeError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback
  if (err.status === 0) return messageForStatus(0)
  if (err.status === 401) return messageForStatus(401)
  if (err.status === 403) return 'No tienes permiso para ver este reporte.'
  if (err.status === 404) return 'No encontramos este proyecto o no tienes acceso a él.'
  return err.message || fallback // incluye el 503 «falta actualizar la base de datos», que ya viene redactado para el usuario
}

/** Estado del proceso de calificación (solo describe lo que ya calculó el backend). */
function gradingState(totals: EvaluationTotals, official: OfficialFinalGrade | null): { label: string; variant: 'gray' | 'orange' | 'green' } {
  if (official) return { label: 'Cerrado: nota final oficial registrada', variant: 'green' }
  if (totals.complete) return { label: 'Notas completas: falta la nota final oficial', variant: 'green' }
  if (totals.graded_criteria > 0) return { label: 'Calificación en curso', variant: 'orange' }
  return { label: 'Sin notas todavía', variant: 'gray' }
}

function Stat({ Icon, label, value, caption, tone }: { Icon: typeof Award; label: string; value: string; caption?: string; tone?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone ?? 'bg-[#0E6B9C]/10 text-[#0E6B9C] dark:bg-sky-400/15 dark:text-sky-300')}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
        <p className="font-display text-[22px] font-extrabold leading-tight text-[var(--color-secondary)]">{value}</p>
        {caption && <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{caption}</p>}
      </div>
    </div>
  )
}

const Dash = () => <span aria-label="Sin calificar" className="text-[var(--color-text-dim)]">—</span>

function CriterionRow({ c, open, onToggle }: { c: EvaluationCriterion; open: boolean; onToggle: () => void }) {
  const published = c.status === 'publicada' && c.grade !== null
  const draft = c.status === 'borrador' && c.grade !== null // solo lo ve quien califica
  const shown = published || draft
  return (
    <>
      <li role="row" className={cn('grid items-center gap-x-3 border-t border-[var(--color-border)] px-4 py-2.5 text-[13px]', COLS)}>
        <div role="cell" className="min-w-0 pl-6">
          <p className="font-semibold text-[var(--color-text)]">{c.name}</p>
          {c.description && <p className="text-[12px] text-[var(--color-text-muted)]">{c.description}</p>}
        </div>
        <span role="cell" className="text-center text-[var(--color-text)]">{formatPercent(c.weight_percentage)}</span>
        <span role="cell" className={cn('text-center font-extrabold', shown ? 'text-[var(--color-secondary)]' : '')}>{shown ? formatGradeOfScale(c.grade as number) : <Dash />}</span>
        <span role="cell" className="text-center text-[12.5px] text-[var(--color-text-muted)]">{RANGE}</span>
        <span role="cell" className="text-center text-[var(--color-text)]">{shown && c.percent_obtained !== null ? formatPercent(c.percent_obtained) : <Dash />}</span>
        <span role="cell" className="text-center text-[var(--color-text)]">{shown && c.contribution_to_total !== null ? formatPoints(c.contribution_to_total) : <Dash />}</span>
        <span role="cell" className="text-center">
          {c.feedback ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={onToggle}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-bold text-[#0E6B9C] hover:bg-[#0E6B9C]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C] dark:text-sky-300"
            >
              <MessageSquare size={14} aria-hidden="true" />
              {open ? 'Ocultar' : 'Ver retroalimentación'}
            </button>
          ) : (
            <Dash />
          )}
        </span>
        <span role="cell" className="text-center">
          <Badge variant={published ? 'green' : draft ? 'orange' : 'gray'}>{published ? 'Calificado' : draft ? 'Borrador' : 'Pendiente'}</Badge>
        </span>
      </li>
      {open && c.feedback && (
        <li role="row" className="border-t border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 pl-10 text-[13px]">
          <p className="whitespace-pre-line text-[var(--color-text)]">{c.feedback}</p>
          {c.published_at && <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Publicada el {formatInstant(c.published_at)}</p>}
        </li>
      )}
    </>
  )
}

function MomentSection({ moment, open, onToggle }: { moment: EvaluationMoment; open: boolean; onToggle: () => void }) {
  const [feedbackOpen, setFeedbackOpen] = useState<Record<string, boolean>>({})
  const state = moment.closed ? 'Cerrado' : moment.graded_count > 0 ? 'En curso' : 'Pendiente'
  const grade = moment.moment_grade ?? moment.partial_average
  return (
    <Fragment>
      <li role="rowgroup" className="border-t border-[var(--color-border)]">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 bg-[var(--color-secondary-soft)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-border)]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E6B9C]"
        >
          <ChevronDown size={18} aria-hidden="true" className={cn('shrink-0 text-[var(--color-text-muted)] transition-transform', open ? 'rotate-0' : '-rotate-90')} />
          <span className="min-w-0 flex-1 text-[14.5px] font-extrabold text-[var(--color-secondary)]">
            {moment.name} <span className="font-semibold text-[var(--color-text-muted)]">— {formatPercent(moment.weight_percentage)}</span>
          </span>
          <span className="text-[12px] text-[var(--color-text-muted)]">{moment.graded_count} de {moment.graded_count + moment.pending_count} criterios calificados</span>
          <Badge variant={moment.closed ? 'green' : moment.graded_count > 0 ? 'orange' : 'gray'}>{state}</Badge>
        </button>
        {open && (
          <ul role="rowgroup">
            {moment.description && <li role="row" className="px-4 py-2 pl-10 text-[12.5px] text-[var(--color-text-muted)]">{moment.description}</li>}
            {moment.criteria.map((c) => (
              <CriterionRow key={c.public_id} c={c} open={!!feedbackOpen[c.public_id]} onToggle={() => setFeedbackOpen((s) => ({ ...s, [c.public_id]: !s[c.public_id] }))} />
            ))}
            <li role="row" className={cn('grid items-center gap-x-3 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-[13px] font-bold', COLS)}>
              <span role="cell" className="pl-6 text-[var(--color-secondary)]">Total del {moment.name.toLowerCase()}</span>
              <span role="cell" className="text-center">{formatPercent(moment.weight_percentage)}</span>
              <span role="cell" className="text-center text-[var(--color-secondary)]">
                {grade === null ? <Dash /> : moment.moment_grade !== null ? formatGradeOfScale(grade) : <>{formatGrade(grade)} <span className="font-normal text-[var(--color-text-muted)]">parcial</span></>}
              </span>
              <span role="cell" className="text-center text-[12.5px] font-normal text-[var(--color-text-muted)]">{RANGE}</span>
              <span role="cell" className="text-center" title="Porcentaje del momento que ya está evaluado">{formatPercent(moment.evaluated_weight)} <span className="font-normal text-[var(--color-text-muted)]">eval.</span></span>
              <span role="cell" className="text-center">{moment.graded_count > 0 ? formatPoints(moment.contribution_to_total) : <Dash />}</span>
              <span role="cell" className="text-center"><Dash /></span>
              <span role="cell" className="text-center"><Badge variant={moment.closed ? 'green' : 'gray'}>{moment.closed ? 'Completo' : 'Parcial'}</Badge></span>
            </li>
          </ul>
        )}
      </li>
    </Fragment>
  )
}

export function GradeReportPage() {
  const accessToken = useAppStore((s) => s.accessToken)
  const currentUser = useAppStore((s) => s.currentUser)
  const [params, setParams] = useSearchParams()
  const requested = params.get('proceso')
  const [processes, setProcesses] = useState<ProcessOut[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(requested)
  const [data, setData] = useState<EvaluationOut | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [closed, setClosed] = useState<Record<string, boolean>>({}) // momentos contraídos (por defecto todos abiertos)
  const [attempt, setAttempt] = useState(0) // «Reintentar»

  // Procesos que la persona puede ver (el backend filtra por rol: el estudiante, los suyos; el tutor, los asignados…).
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setState('loading')
    processesApi
      .list(accessToken)
      .then((mine) => {
        if (cancelled) return
        setProcesses(mine)
        // Si se pidió un proyecto concreto (?proceso=) y no es de los visibles, no se sustituye por otro: se dice que no se encontró.
        setSelectedId((current) => {
          if (current && mine.some((p) => p.public_id === current)) return current
          if (requested) return mine.some((p) => p.public_id === requested) ? requested : null
          return mine[0]?.public_id ?? null
        })
        if (mine.length === 0) setState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(describeError(err, 'No se pudieron cargar tus proyectos.'))
        setState('error')
      })
    return () => { cancelled = true }
    // `requested` solo decide la selección inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, attempt])

  const selected = useMemo(() => processes?.find((p) => p.public_id === selectedId) ?? null, [processes, selectedId])
  const unknownRequest = Boolean(processes && processes.length > 0 && requested && !processes.some((p) => p.public_id === requested))

  useEffect(() => {
    if (!accessToken || !selected) return
    let cancelled = false
    setState('loading')
    setData(null)
    evaluationApi
      .get(accessToken, selected.public_id)
      .then((report) => { if (!cancelled) { setData(report); setClosed({}); setState('ready') } })
      .catch((err) => {
        if (cancelled) return
        setError(describeError(err, 'No se pudo cargar el libro de calificaciones.'))
        setState('error')
      })
    return () => { cancelled = true }
  }, [accessToken, selected, attempt])

  const isStudent = hasModule(currentUser, 'workspace-student')
  const back = (() => {
    if (isStudent) return { to: '/documentos', label: 'Volver a Mis tareas y calificaciones' }
    if (hasModule(currentUser, 'tutor') && selectedId) return { to: `/tutor/proyectos/${selectedId}?tab=evaluacion`, label: 'Volver a la evaluación del proyecto' }
    return { to: homePathFor(currentUser?.modules ?? []), label: 'Volver al inicio' }
  })()
  const backLink = (
    <Link to={back.to} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#0E6B9C] underline-offset-4 hover:underline dark:text-sky-300">
      <ArrowLeft size={15} aria-hidden="true" />
      {back.label}
    </Link>
  )

  if (state === 'error') {
    return (
      <div className="flex flex-col gap-3">
        {backLink}
        <LoadError message={error ?? 'No se pudo cargar el libro de calificaciones.'} onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    )
  }
  if (processes && processes.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {backLink}
        <EmptyNote title={isStudent ? 'Aún no tienes un proceso de grado' : 'No tienes proyectos asignados'}>
          {isStudent ? 'Cuando tengas un proceso, aquí verás tus momentos evaluativos, notas y retroalimentación.' : 'Cuando se te asigne un proyecto, podrás consultar aquí su libro de calificaciones.'}
        </EmptyNote>
      </div>
    )
  }
  if (unknownRequest) {
    return (
      <div className="flex flex-col gap-3">
        {backLink}
        <LoadError message="No encontramos este proyecto o no tienes acceso a él." />
      </div>
    )
  }

  const totals = data?.totals ?? null
  const official = data?.official_final_grade ?? null
  const configured = data !== null && data.status !== 'sin_configurar'
  const manager = data?.viewer === 'manager'
  const grading = totals ? gradingState(totals, official) : null
  const studentName = data?.student_name

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          {backLink}
          <h2 className="font-display text-[22px] font-extrabold text-[var(--color-secondary)]">Libro de calificaciones</h2>
          <p className="max-w-2xl text-[13.5px] text-[var(--color-text-muted)]">
            {data
              ? `${data.process_title?.trim() || selected?.modality.name || 'Proyecto de grado'} · Periodo ${data.academic_semester}${manager && studentName ? ` · ${studentName}` : ''}`
              : 'Momentos evaluativos, ponderaciones, notas y retroalimentación de tu proyecto de grado.'}
          </p>
          {grading && configured && <div><Badge variant={grading.variant}>{grading.label}</Badge></div>}
        </div>
        {processes && processes.length > 1 && (
          <label className="flex min-w-[240px] flex-col gap-1 text-[12.5px] font-bold text-[var(--color-secondary)]">
            Proyecto de grado
            <select
              value={selectedId ?? ''}
              onChange={(e) => { setSelectedId(e.target.value); setParams(e.target.value ? { proceso: e.target.value } : {}, { replace: true }) }}
              className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] font-normal text-[var(--color-text)]"
            >
              {processes.map((p) => <option key={p.public_id} value={p.public_id}>{p.title?.trim() || `${p.modality.name} · ${p.process_code}`}</option>)}
            </select>
          </label>
        )}
      </div>

      {manager && configured && (
        <p role="note" className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200">
          <Eye size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          Vista de quien califica: incluye las notas en borrador, que el estudiante no ve hasta que las publiques.
        </p>
      )}

      {state === 'loading' || !data || !totals ? (
        <p role="status" className="px-2 py-6 text-[13px] text-[var(--color-text-muted)]">Cargando las calificaciones…</p>
      ) : !configured ? (
        manager ? (
          <EmptyState icon={ClipboardList} title="Este proyecto aún no tiene evaluación configurada" description="Define los momentos evaluativos y sus criterios desde la pestaña «Evaluación» del proyecto." />
        ) : (
          <EmptyNote title="Tu tutor aún no ha publicado la evaluación">
            Cuando defina los momentos evaluativos y sus criterios, aquí verás la estructura, tus notas y la retroalimentación.
          </EmptyNote>
        )
      ) : data.moments.length === 0 || totals.total_criteria === 0 ? (
        <EmptyNote title="La evaluación todavía no tiene criterios">Cuando se agreguen criterios a los momentos evaluativos, aparecerán aquí.</EmptyNote>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              Icon={BarChart3}
              label="Nota acumulada"
              value={`${formatPoints(totals.accumulated)} / ${GRADE_MAX.toFixed(1)}`}
              caption={totals.complete ? 'Con todo calificado' : 'Nota acumulada parcial'}
            />
            <Stat
              Icon={Percent}
              label="Porcentaje evaluado"
              value={formatPercent(totals.evaluated_percent)}
              caption={totals.evaluated_percent < 100 ? 'del proceso con nota' : 'del proceso'}
              tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            />
            <Stat
              Icon={Award}
              label="Nota final oficial"
              value={official ? formatGradeOfScale(official.final_grade) : 'Aún no registrada'}
              caption={official ? `${official.passed ? 'Aprobado' : 'No aprobado'} · registrada el ${formatInstant(official.registered_at)}` : 'La registra Coordinación al cerrar el proceso'}
              tone="bg-[#FF641D]/10 text-[#C2410C] dark:text-orange-300"
            />
            <Stat Icon={ClipboardList} label="Momentos evaluativos" value={String(data.moments.length)} caption={`${totals.total_criteria} criterios en total`} />
            <Stat Icon={ListChecks} label="Criterios pendientes" value={String(totals.pending_criteria)} caption={totals.pending_criteria === 0 ? 'Todo calificado' : 'sin nota'} tone="bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" />
          </div>

          {totals.graded_criteria === 0 ? (
            <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200">
              {manager ? 'Todavía no hay notas registradas.' : 'Todavía no hay notas publicadas.'} Los criterios pendientes no cuentan como cero y aparecen con «—».
            </p>
          ) : (
            !totals.complete && (
              <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200">
                Nota acumulada parcial: va el {formatPercent(totals.evaluated_percent)} del proceso evaluado y quedan {totals.pending_criteria} {totals.pending_criteria === 1 ? 'criterio' : 'criterios'} por calificar.
                Los criterios pendientes no cuentan como cero.
              </p>
            )
          )}
          {totals.calculated_final !== null && !official && (
            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              Con todas las notas {manager ? 'registradas' : 'publicadas'}, el resultado calculado es <strong>{formatPoints(totals.calculated_final)} / {GRADE_MAX.toFixed(1)}</strong>. Es una referencia: la nota final oficial la registra Coordinación.
            </p>
          )}

          <section aria-label="Tabla de calificaciones" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
            <div className="overflow-x-auto">
              <div role="table" aria-label="Libro de calificaciones" className="min-w-[960px]">
                <div role="row" className={cn('grid gap-x-3 bg-[var(--color-secondary)] px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-white', COLS)}>
                  <span role="columnheader">Ítem de calificación</span>
                  <span role="columnheader" className="text-center">Ponderación</span>
                  <span role="columnheader" className="text-center">Calificación</span>
                  <span role="columnheader" className="text-center">Rango</span>
                  <span role="columnheader" className="text-center">Porcentaje</span>
                  <span role="columnheader" className="text-center">Aporte al total</span>
                  <span role="columnheader" className="text-center">Retroalimentación</span>
                  <span role="columnheader" className="text-center">Estado</span>
                </div>
                <div role="row" className="bg-[var(--color-secondary)]/10 px-4 py-2.5 text-[14px] font-extrabold text-[var(--color-secondary)]">
                  Proyecto de grado
                </div>
                <ul role="rowgroup">
                  {data.moments.map((m) => (
                    <MomentSection key={m.public_id} moment={m} open={!closed[m.public_id]} onToggle={() => setClosed((s) => ({ ...s, [m.public_id]: !s[m.public_id] }))} />
                  ))}
                </ul>
                <div role="row" className={cn('grid items-center gap-x-3 border-t-2 border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-4 py-3 text-[13.5px] font-extrabold text-[var(--color-secondary)]', COLS)}>
                  <span role="cell">Total del proceso</span>
                  <span role="cell" className="text-center">100 %</span>
                  <span role="cell" className="text-center">{formatPoints(totals.accumulated)} / {GRADE_MAX.toFixed(1)}</span>
                  <span role="cell" className="text-center text-[12.5px] font-normal text-[var(--color-text-muted)]">{RANGE}</span>
                  <span role="cell" className="text-center" title="Porcentaje del proceso ya evaluado">{formatPercent(totals.evaluated_percent)} <span className="font-normal text-[var(--color-text-muted)]">eval.</span></span>
                  <span role="cell" className="text-center">{formatPoints(totals.accumulated)}</span>
                  <span role="cell" className="text-center"><Dash /></span>
                  <span role="cell" className="text-center"><Badge variant={totals.complete ? 'green' : 'orange'}>{totals.complete ? 'Completo' : 'Parcial'}</Badge></span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
