import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, GitBranch, GraduationCap, Layers, User } from 'lucide-react'
import { Card } from '@/components/ui'
import { useAppStore } from '@/stores/app.store'
import { ApiError } from '@/services/http'
import { processesApi, type ProcessHistoryOut, type ProcessOut, type TeamMemberOut } from '@/services/processes.service'
import { workPlanApi, type PlanEventOut, type WorkPlanOut } from '@/services/workplan.service'
import { formatRelativeDate } from '@/utils/format'
import { LoadError, Pill } from './tutorUi'
import { CARD, EVENT_LABELS, stateTone } from './tutorUi.utils'
import { ProjectSummary } from './ProjectSummary'
import { PlanWorkspace } from './PlanWorkspace'
import { ScheduleBoard } from './ScheduleBoard'
import { EvaluationPanel } from './evaluacion/EvaluationPanel'

const TABS = [
  ['resumen', 'Resumen'],
  ['plan', 'Plan de trabajo y entregables'],
  ['cronograma', 'Cronograma'],
  ['evaluacion', 'Evaluación'],
  ['historial', 'Historial de actividad'],
] as const
type TabId = (typeof TABS)[number][0]

interface ExpedienteData {
  process: ProcessOut
  plan: WorkPlanOut | null
  team: TeamMemberOut[]
  activity: PlanEventOut[]
  history: ProcessHistoryOut[]
}

function useExpediente(processId: string | undefined) {
  const accessToken = useAppStore((s) => s.accessToken)
  const [data, setData] = useState<ExpedienteData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || !processId) return
    try {
      const [process, team, history] = await Promise.all([
        processesApi.get(accessToken, processId),
        processesApi.team(accessToken, processId),
        processesApi.history(accessToken, processId),
      ])
      let plan: WorkPlanOut | null = null
      let activity: PlanEventOut[] = []
      try {
        plan = await workPlanApi.get(accessToken, processId)
        activity = await workPlanApi.activity(accessToken, processId).catch(() => [])
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err // 404 = aún no hay plan
      }
      setData({ process, plan, team, activity, history })
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'No encontramos este proyecto o no tienes acceso a él.' : err instanceof ApiError ? err.message : 'No se pudo cargar el proyecto')
      setStatus('error')
    }
  }, [accessToken, processId])

  useEffect(() => {
    setStatus('loading')
    void load()
  }, [load])

  return { data, status, error, reload: load, setPlan: (plan: WorkPlanOut) => setData((d) => (d ? { ...d, plan } : d)) }
}

// ── Pestañas ──────────────────────────────────────────────────────────────────

/** Barra del proyecto: nombre, estudiantes, modalidad, tutor, periodo y estado reales (se ve en todas las pestañas). */
function ProjectBar({ process, team }: { process: ProcessOut; team: TeamMemberOut[] }) {
  // Estudiantes = integrantes activos con el mismo rol de proceso que el titular del trámite (sin comparar nombres de rol).
  const ownerRole = team.find((m) => m.user.public_id === process.student.public_id)?.process_role
  const students = ownerRole ? team.filter((m) => m.active && m.process_role === ownerRole).map((m) => m.user.full_name) : []
  const names = students.length ? students : [process.student.full_name]
  const tutors = team.filter((m) => m.process_role === 'tutor' && m.active)
  const label = 'text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'
  return (
    <section aria-label="Información del proyecto" className={`${CARD} grid gap-4 p-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_auto] xl:items-center`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6500] dark:bg-orange-500/15"><Layers size={26} aria-hidden="true" /></span>
        <h2 className="min-w-0 break-words border-l-4 border-[#FF6500] pl-3 font-display text-[18px] font-extrabold leading-snug text-[var(--color-secondary)]">
          {process.title?.trim() || `Sin título registrado · ${process.process_code}`}
        </h2>
      </div>
      <div className="min-w-0 xl:border-l xl:border-[#DCE6F2] xl:pl-4 dark:xl:border-[var(--color-border)]">
        <p className={label}>{names.length === 1 ? 'Estudiante' : `Estudiantes (${names.length})`}</p>
        <ul aria-label="Estudiantes del proyecto" className="mt-1 flex flex-wrap gap-1.5">
          {names.map((n) => (
            <li key={n} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[13px] font-bold text-[var(--color-secondary)] dark:bg-white/10">
              <User size={14} aria-hidden="true" className="shrink-0" /><span className="truncate">{n}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex min-w-0 items-center gap-2.5 xl:border-l xl:border-[#DCE6F2] xl:pl-4 dark:xl:border-[var(--color-border)]">
        <Layers size={20} aria-hidden="true" className="shrink-0 text-slate-500" />
        <div className="min-w-0"><p className={label}>Modalidad</p><p className="break-words text-[13.5px] font-bold text-[var(--color-secondary)]">{process.modality.name}</p></div>
      </div>
      <div className="flex min-w-0 items-center gap-2.5 xl:border-l xl:border-[#DCE6F2] xl:pl-4 dark:xl:border-[var(--color-border)]">
        <GraduationCap size={20} aria-hidden="true" className="shrink-0 text-slate-500" />
        <div className="min-w-0"><p className={label}>Tutor</p><p className="break-words text-[13.5px] font-bold text-[var(--color-secondary)]">{tutors.length ? tutors.map((t) => t.user.full_name).join(', ') : 'Sin tutor activo'}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 xl:border-l xl:border-[#DCE6F2] xl:pl-4 dark:xl:border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <CalendarDays size={20} aria-hidden="true" className="shrink-0 text-slate-500" />
          <div><p className={label}>Periodo</p><p className="text-[13.5px] font-bold text-[var(--color-secondary)]">{process.academic_semester}</p></div>
        </div>
        <div><p className={label}>Estado</p><div className="mt-0.5"><Pill tone={stateTone(process.state.name)}>{process.state.name}</Pill></div></div>
      </div>
    </section>
  )
}

function Activity({ activity, history }: { activity: PlanEventOut[]; history: ProcessHistoryOut[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 text-[18px] font-bold text-[var(--color-text)]">Cambios del plan y entregas</h3>
        {activity.length === 0 ? <p className="text-[13px] text-[var(--color-text-muted)]">Sin actividad registrada.</p> : (
          <ol className="flex flex-col gap-3">
            {activity.map((e) => (
              <li key={e.public_id} className="border-l-2 border-[#0876B9] pl-3">
                <p className="text-[13px] font-semibold text-[var(--color-text)]">{EVENT_LABELS[e.event_type] ?? e.event_type}{e.subject ? ` · ${e.subject}` : ''}</p>
                {e.detail && <p className="text-[12px] text-[var(--color-text-muted)]">{e.detail}</p>}
                <p className="text-[12px] text-[var(--color-text-muted)]">{e.actor.full_name} · {formatRelativeDate(e.created_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card>
        <h3 className="mb-3 text-[18px] font-bold text-[var(--color-text)]">Estados del proceso</h3>
        {history.length === 0 ? <p className="text-[13px] text-[var(--color-text-muted)]">Sin movimientos.</p> : (
          <ol className="flex flex-col gap-3">
            {history.map((h) => (
              <li key={h.public_id} className="border-l-2 border-[#FF6500] pl-3">
                <p className="text-[13px] font-semibold text-[var(--color-text)]">{h.previous_state ? `${h.previous_state.name} → ` : ''}{h.new_state.name}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">{formatRelativeDate(h.event_date)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

export function ProjectExpediente({ backTo = { to: '/tutor/proyectos', label: 'Volver a mis proyectos' } }: { backTo?: { to: string; label: string } }) {
  const { processId } = useParams<{ processId: string }>()
  const [params, setParams] = useSearchParams()
  const currentUser = useAppStore((s) => s.currentUser)
  const { data, status, error, reload, setPlan } = useExpediente(processId)
  // `?tab=documentos` era la pestaña «Entregables» (hoy unificada con el plan): los enlaces antiguos siguen funcionando.
  const requestedTab = params.get('tab') === 'documentos' ? 'plan' : params.get('tab')
  const tab = (TABS.find(([id]) => id === requestedTab)?.[0] ?? 'resumen') as TabId

  const focusId = params.get('entregable')
  const clearFocus = useCallback(() => setParams((prev) => { const n = new URLSearchParams(prev); n.delete('entregable'); return n }, { replace: true }), [setParams])
  const openDeliverable = (id: string) => setParams({ tab: 'plan', entregable: id })

  if (!processId) return null
  if (status === 'loading' && !data) {
    return (
      <div role="status" aria-label="Cargando proyecto" className="flex flex-col gap-4" aria-busy="true">
        <span className="sr-only">Cargando proyecto…</span>
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
        <div className="grid gap-4 lg:grid-cols-3"><div className="h-64 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" /><div className="h-64 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10 lg:col-span-2" /></div>
      </div>
    )
  }
  if (status === 'error' || !data) return <LoadError message={error} onRetry={() => void reload()} />

  const isTutor = data.team.some((m) => m.process_role === 'tutor' && m.active && m.user.public_id === currentUser?.id)
  // Solo el tutor ACTIVO modifica el plan y revisa entregas; Coordinación supervisa en modo consulta.
  // El backend decide de verdad (403/404); esto solo evita mostrar controles inútiles.
  const canManage = data.plan?.can_manage ?? isTutor

  return (
    <div className="flex flex-col gap-5">
      <Link to={backTo.to} className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-[#0876B9] underline underline-offset-4">
        <ArrowLeft size={14} aria-hidden /> {backTo.label}
      </Link>

      <ProjectBar process={data.process} team={data.team} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Secciones del proyecto" className="flex flex-wrap gap-2">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setParams(id === 'resumen' ? {} : { tab: id })}
              className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors ${tab === id ? 'bg-[#FF6500] text-white shadow-sm' : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {isTutor && <Link
          to={`/trazabilidad/${processId}`}
          state={{ fromTutorExpediente: true }}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#FF6500] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#e65c00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6500]"
        ><GitBranch size={16} aria-hidden="true" />Abrir seguimiento del proyecto</Link>}
      </div>

      {!canManage && (
        <p role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
          Vista de consulta: solo el tutor asignado a este proyecto puede modificar el plan o revisar entregas.
        </p>
      )}

      <div role="tabpanel">
        {tab === 'resumen' && <ProjectSummary process={data.process} plan={data.plan} team={data.team} activity={data.activity} history={data.history} onOpenDeliverable={openDeliverable} />}
        {tab === 'plan' && (
          <PlanWorkspace
            processId={processId}
            process={data.process}
            plan={data.plan}
            canManage={canManage}
            onPlan={setPlan}
            reload={reload}
            focusId={focusId}
            onFocusHandled={clearFocus}
          />
        )}
        {tab === 'cronograma' && <ScheduleBoard processId={processId} process={data.process} plan={data.plan} canManage={canManage} onPlan={setPlan} reload={reload} />}
        {tab === 'evaluacion' && <EvaluationPanel processId={processId} />}
        {tab === 'historial' && <Activity activity={data.activity} history={data.history} />}
      </div>
    </div>
  )
}
